-- Set — league play schema (slice 3, first milestone)
--
-- Run this in the Supabase SQL editor once the project exists. It creates the
-- tables + row-level-security (RLS) rules so that:
--   * players can only read their own records and their leagues' leaderboards,
--   * the daily board's SOLUTION is never readable by any client (only the
--     server-side Edge Function can see it), per the anti-cheat design.
--
-- Board generation and leaderboard math are NOT in here on purpose — they reuse
-- the pure TypeScript modules (generateBoard, deriveStats) so there is one
-- source of truth. See supabase/functions/ (Edge Function) and the app client.
--
-- Order: all tables first (so policies can reference each other), then the
-- policies, then the join-by-code function.

-- ===========================================================================
-- Tables
-- ===========================================================================

-- profiles: one row per signed-in user, holds the display name shown on boards.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- leagues: the config you set up (name, timezone, game mode, join code).
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null,                       -- IANA tz, e.g. 'Asia/Singapore'
  mode text not null check (mode in ('A', 'B', 'C')),
  join_code text not null unique,               -- players use this to join
  penalty_base_ms int not null default 5000,    -- Mode C: base penalty (doubles each false done)
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- memberships: who belongs to which league.
create table if not exists memberships (
  league_id uuid not null references leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- board_pool: precomputed base boards for Mode B/C league days from the
-- cutover date (see add-board-pool.sql). 12 card ids sorted ascending, exactly
-- n sets each. Loaded from supabase/board-pool/pool-NN.sql.
create table if not exists board_pool (
  id serial primary key,
  n smallint not null check (n between 1 and 10),
  cards smallint[] not null check (array_length(cards, 1) = 12),
  unique (cards)
);
create index if not exists board_pool_n on board_pool (n);

-- board_pool_config: one row, the first league-local date that uses the pool.
create table if not exists board_pool_config (
  id boolean primary key default true check (id),
  cutover date not null
);
insert into board_pool_config (cutover) values ('2026-10-23') on conflict (id) do nothing;

-- daily_seeds: one random seed per league per local date. The seed is issued
-- (via today_puzzle_v2() below) only for the CURRENT local date, so everyone
-- gets the same board while future puzzles cannot be pre-computed. The board
-- itself is built client-side: from the seed alone by the pure generateBoard()
-- when pool_id is null (every Mode A day, and B/C days before the cutover), or
-- from the pool board relabelled by the seed (boardFromPool()) otherwise.
create table if not exists daily_seeds (
  league_id uuid not null references leagues (id) on delete cascade,
  puzzle_date date not null,                     -- league-local date
  seed bigint not null,
  pool_id int references board_pool (id),        -- null = legacy seed-only board
  created_at timestamptz not null default now(),
  primary key (league_id, puzzle_date)
);

-- game_records: the append-only telemetry event log, posted to the server.
-- Same shape as slice 1's localStorage records; `context` still separates
-- league from practice. Derived stats are computed on read (deriveStats), never
-- stored, so they cannot drift from the log.
create table if not exists game_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  context text not null check (context in ('league', 'practice')),
  league_id uuid references leagues (id) on delete set null,
  puzzle_date date,                              -- league-local date, for league games
  mode text not null check (mode in ('A', 'B', 'C')),
  total_sets int not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  events jsonb not null
);

-- ===========================================================================
-- Row-level security
-- ===========================================================================

alter table profiles enable row level security;
alter table leagues enable row level security;
alter table memberships enable row level security;
alter table daily_seeds enable row level security;    -- no SELECT policy; reached via today_puzzle_v2()
alter table board_pool enable row level security;     -- no SELECT policy; reached via *_v2 RPCs only
alter table board_pool_config enable row level security;
alter table game_records enable row level security;

-- profiles ------------------------------------------------------------------
create policy "profiles readable by any signed-in user"
  on profiles for select to authenticated using (true);
create policy "a user creates their own profile"
  on profiles for insert to authenticated with check (auth.uid() = id);
create policy "a user updates their own profile"
  on profiles for update to authenticated using (auth.uid() = id);

-- leagues -------------------------------------------------------------------
create policy "members can read their leagues"
  on leagues for select to authenticated using (
    exists (
      select 1 from memberships m
      where m.league_id = leagues.id and m.user_id = auth.uid()
    )
  );

-- memberships ---------------------------------------------------------------
create policy "a user reads their own memberships"
  on memberships for select to authenticated using (user_id = auth.uid());

-- game_records --------------------------------------------------------------
create policy "a user inserts their own records"
  on game_records for insert to authenticated with check (user_id = auth.uid());
create policy "a user reads their own records"
  on game_records for select to authenticated using (user_id = auth.uid());
create policy "members read their league's records"
  on game_records for select to authenticated using (
    context = 'league' and exists (
      select 1 from memberships m
      where m.league_id = game_records.league_id and m.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- Join-by-code: enroll the caller without exposing the whole leagues table.
-- ===========================================================================
create or replace function join_league (code text)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  target uuid;
begin
  select id into target from leagues where join_code = code;
  if target is null then
    raise exception 'no league with that code';
  end if;
  insert into memberships (league_id, user_id)
    values (target, auth.uid())
    on conflict do nothing;
  return target;
end;
$$;

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

-- ===========================================================================
-- league_members: the roster of one league, for members of that league only.
--
-- The memberships policy above is deliberately "your own rows only", so a
-- member cannot otherwise see who else is in their league. Two features need
-- the roster: stable per-player chart colours (assigned from the full roster,
-- so a colour does not shift on days someone is absent) and the "everyone has
-- played" gate that decides when a day's set cards become safe to show.
--
-- Returns bare user ids for a league the caller already belongs to, and
-- nothing else -- members can already read each other's display names and
-- game records, so this leaks nothing new. Zero rows for a league you are not
-- in, rather than an error.
-- ===========================================================================
create or replace function league_members (p_league uuid)
  returns setof uuid
  language sql
  security definer
  set search_path = public
as $$
  select m.user_id
  from memberships m
  where m.league_id = p_league
    and exists (
      select 1 from memberships self
      where self.league_id = p_league and self.user_id = auth.uid()
    )
  -- Join order, NOT user_id order: the client assigns chart colours by position
  -- here, so a new member must append rather than reshuffle everyone after them.
  order by m.joined_at, m.user_id;
$$;

-- ===========================================================================
-- past_puzzle: the old (pre-pool) way to redraw a finished day, kept for app
-- versions cached before the pool. Refuses pool rows, like today_puzzle above.
-- past_puzzle_v2 is the current one.
-- ===========================================================================
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
