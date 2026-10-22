-- Board pool: a flat 1–10 set-count distribution for Mode B and Mode C league
-- boards, from a cutover date onward. Run in the Supabase SQL editor, top to
-- bottom. 2026-10-22.
--
-- NON-DESTRUCTIVE and re-runnable (if not exists / create or replace / on
-- conflict do nothing). No existing row is changed. Legacy behaviour is
-- unchanged until the cutover date in board_pool_config.
--
-- Why. A random 12-card deal has 2–4 sets most of the time and almost never 8+,
-- and the old keep-with-probability-N/6 rule only nudged that. From the cutover,
-- each B/C league day picks N uniformly from 1..10, then a random pool board
-- with exactly N sets. The client applies a random set-preserving relabelling
-- seeded by the day's seed (src/game/relabel.ts), so every member sees the same
-- board and a pool of 2,000 per N never visibly repeats.
--
-- Old rows stay on the old path. A daily_seeds row with no pool_id is still
-- redrawn by generateBoard(mode, mulberry32(seed)), exactly as before.
--
-- Old cached app versions must fail loudly. An old bundle given a pool day's
-- seed would build the WRONG board from it and record telemetry against it. So
-- the pool is served only by the new today_puzzle_v2 / past_puzzle_v2, and the
-- old today_puzzle / past_puzzle refuse pool rows with "app update required".
--
-- After this, load supabase/board-pool/pool-01.sql .. pool-10.sql and run the
-- count check at the bottom. Then deploy the client. All before the first B/C
-- league reaches its local midnight on the cutover date — if that cannot
-- happen, move the cutover first:
--   update board_pool_config set cutover = '<date>';

-- ===========================================================================
-- Tables
-- ===========================================================================

-- board_pool: base boards, 12 card ids sorted ascending, exactly n sets each.
create table if not exists board_pool (
  id serial primary key,
  n smallint not null check (n between 1 and 10),
  cards smallint[] not null check (array_length(cards, 1) = 12),
  unique (cards)
);
create index if not exists board_pool_n on board_pool (n);
alter table board_pool enable row level security;   -- no SELECT policy; reached via *_v2 RPCs only

-- Which pool board a league day uses; null = legacy seed-only board. The
-- foreign key (no cascade) also stops a used pool row from being deleted out
-- from under a day that would then silently fall back to the legacy redraw.
alter table daily_seeds add column if not exists pool_id int references board_pool (id);

-- One-row config: the first league-local date that uses the pool.
create table if not exists board_pool_config (
  id boolean primary key default true check (id),
  cutover date not null
);
alter table board_pool_config enable row level security;
insert into board_pool_config (cutover) values ('2026-10-23') on conflict (id) do nothing;

-- ===========================================================================
-- issue_puzzle: create a league day's daily_seeds row if it does not exist.
-- Internal — called only by the puzzle functions below, never by a client.
--
-- B/C on or after the cutover: N uniform on 1..10, independently per day (not a
-- shuffled bag: in Mode C a bag would let a player who tracked previous days
-- work out N late in a cycle). Then a random pool board with that N, avoiding
-- ones this league has already had while any remain. No pool board for that N
-- at all is an error, never a quiet fall back to the legacy distribution.
-- ===========================================================================
create or replace function issue_puzzle (p_league uuid, p_date date)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  m text;
  cut date;
  target int;
  pid int;
begin
  if exists (select 1 from daily_seeds where league_id = p_league and puzzle_date = p_date) then
    return;
  end if;
  select mode into m from leagues where id = p_league;
  if m is null then
    raise exception 'no such league';
  end if;

  if m in ('B', 'C') then
    select cutover into cut from board_pool_config;
    if cut is null then
      raise exception 'board_pool_config has no cutover row';
    end if;
    if p_date >= cut then
      target := 1 + floor(random() * 10)::int;
      select bp.id into pid from board_pool bp
        where bp.n = target
          and not exists (
            select 1 from daily_seeds ds where ds.league_id = p_league and ds.pool_id = bp.id
          )
        order by random() limit 1;
      if pid is null then
        select id into pid from board_pool where n = target order by random() limit 1;
      end if;
      if pid is null then
        raise exception 'board pool empty for n=%', target;
      end if;
    end if;
  end if;

  -- Two first requests racing: one insert wins, the other is a no-op, and both
  -- callers then read back the same row.
  insert into daily_seeds (league_id, puzzle_date, seed, pool_id)
    values (p_league, p_date, (random() * 2000000000)::bigint, pid)
    on conflict (league_id, puzzle_date) do nothing;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default, so take it away explicitly: a client must not be able to issue (and
-- so peek at) a future day.
revoke execute on function issue_puzzle (uuid, date) from public, anon, authenticated;

-- ===========================================================================
-- today_puzzle_v2: today's puzzle for a league (members only), creating it on
-- first request. Returns { seed, puzzle_date, mode, cards }, where cards is the
-- pool board's ids or null for a legacy day. Never returns n — in Mode C that
-- would give the count away.
-- ===========================================================================
create or replace function today_puzzle_v2 (p_league uuid)
  returns json
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  tz text;
  m text;
  d date;
  s bigint;
  c smallint[];
begin
  select timezone, mode into tz, m from leagues where id = p_league;
  if tz is null then
    raise exception 'no such league';
  end if;
  if not exists (
    select 1 from memberships where league_id = p_league and user_id = auth.uid()
  ) then
    raise exception 'not a member of this league';
  end if;
  d := (now() at time zone tz)::date;
  perform issue_puzzle(p_league, d);
  select ds.seed, bp.cards into s, c
    from daily_seeds ds left join board_pool bp on bp.id = ds.pool_id
    where ds.league_id = p_league and ds.puzzle_date = d;
  return json_build_object('seed', s, 'puzzle_date', d, 'mode', m, 'cards', c);
end;
$$;

-- ===========================================================================
-- past_puzzle_v2: a finished league day, so the history browser can redraw it.
-- Same guard as past_puzzle: p_date >= today is refused. Same shape as
-- today_puzzle_v2, or null for a day nobody played.
-- ===========================================================================
create or replace function past_puzzle_v2 (p_league uuid, p_date date)
  returns json
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  tz text;
  m text;
  s bigint;
  c smallint[];
  today date;
begin
  select timezone, mode into tz, m from leagues where id = p_league;
  if tz is null then
    raise exception 'no such league';
  end if;
  if not exists (
    select 1 from memberships where league_id = p_league and user_id = auth.uid()
  ) then
    raise exception 'not a member of this league';
  end if;
  today := (now() at time zone tz)::date;
  if p_date >= today then
    raise exception 'that puzzle is not finished yet';
  end if;
  select ds.seed, bp.cards into s, c
    from daily_seeds ds left join board_pool bp on bp.id = ds.pool_id
    where ds.league_id = p_league and ds.puzzle_date = p_date;
  if s is null then
    return null;   -- a day nobody played: no seed was ever issued
  end if;
  return json_build_object('seed', s, 'puzzle_date', p_date, 'mode', m, 'cards', c);
end;
$$;

-- ===========================================================================
-- The old functions, for app versions cached before this change. Unchanged for
-- legacy rows; a pool row is refused, because an old client would redraw the
-- wrong board from its seed.
--
-- The message is what an old client shows on screen, verbatim, so it is
-- written for a player. The new client matches on "app update required".
--
-- today_puzzle goes through issue_puzzle so that an old client's first request
-- on a pool day can never create a LEGACY row for that day. (The raise rolls
-- the new row back with it; the next v2 request issues it again.)
-- ===========================================================================
create or replace function today_puzzle (p_league uuid)
  returns json
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  tz text;
  m text;
  d date;
  s bigint;
  pid int;
begin
  select timezone, mode into tz, m from leagues where id = p_league;
  if tz is null then
    raise exception 'no such league';
  end if;
  if not exists (
    select 1 from memberships where league_id = p_league and user_id = auth.uid()
  ) then
    raise exception 'not a member of this league';
  end if;
  d := (now() at time zone tz)::date;
  perform issue_puzzle(p_league, d);
  select seed, pool_id into s, pid from daily_seeds where league_id = p_league and puzzle_date = d;
  if pid is not null then
    raise exception 'app update required: a new version is available. Close and reopen the app.';
  end if;
  return json_build_object('seed', s, 'puzzle_date', d, 'mode', m);
end;
$$;

create or replace function past_puzzle (p_league uuid, p_date date)
  returns json
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  tz text;
  m text;
  s bigint;
  pid int;
  today date;
begin
  select timezone, mode into tz, m from leagues where id = p_league;
  if tz is null then
    raise exception 'no such league';
  end if;
  if not exists (
    select 1 from memberships where league_id = p_league and user_id = auth.uid()
  ) then
    raise exception 'not a member of this league';
  end if;
  today := (now() at time zone tz)::date;
  if p_date >= today then
    raise exception 'that puzzle is not finished yet';
  end if;
  select seed, pool_id into s, pid from daily_seeds where league_id = p_league and puzzle_date = p_date;
  if s is null then
    return null;
  end if;
  if pid is not null then
    raise exception 'app update required: a new version is available. Close and reopen the app.';
  end if;
  return json_build_object('seed', s, 'puzzle_date', p_date, 'mode', m);
end;
$$;

-- ---------------------------------------------------------------------------
-- Check it, after loading the ten pool files. Expect 2000 for every n, 1..10.
-- ---------------------------------------------------------------------------
-- select n, count(*) from board_pool group by n order by n;
--
-- The rest of the checks, including a throwaway-league test of issue_puzzle,
-- are in supabase/check-board-pool.sql.
