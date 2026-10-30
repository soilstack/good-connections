-- past_puzzles_v2: every FINISHED day of a league in one call, for the
-- failure analyzer (each player's hardest sets across their history).
--
-- The same rules as past_puzzle_v2, applied to all days at once:
--   * members of the league only;
--   * only days strictly before the league's local today, so a day still being
--     played is never returned — its solution must not leak to anyone;
--   * the same shape per day (seed, puzzle_date, mode, cards), so the client
--     rebuilds each board exactly as the history browser does.
-- Days nobody played have no daily_seeds row and simply do not appear.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

create or replace function past_puzzles_v2 (p_league uuid)
  returns json
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  tz text;
  m text;
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
  return coalesce(
    (
      select json_agg(
               json_build_object('seed', ds.seed, 'puzzle_date', ds.puzzle_date, 'mode', m, 'cards', bp.cards)
               order by ds.puzzle_date
             )
        from daily_seeds ds
        left join board_pool bp on bp.id = ds.pool_id
       where ds.league_id = p_league
         and ds.puzzle_date < today
    ),
    '[]'::json
  );
end;
$$;

grant execute on function past_puzzles_v2 (uuid) to authenticated;
