-- Wipe every league and start again with two: OG-SET and ORC-MODE.
-- Run in the Supabase SQL editor, top to bottom. 2026-08-18.
--
-- DESTRUCTIVE. This deletes every recorded league game, every league, and
-- every membership. It is deliberate: the board generator changed (Mode B/C
-- now reject sparse boards), so games recorded earlier sit on boards the
-- generator would no longer produce, and there is no generator versioning.
-- Practice records are untouched — they live in each device's localStorage,
-- never in this database.
--
-- AFTER RUNNING THIS, EVERY PLAYER MUST RE-JOIN with the new codes below.
-- Memberships are wiped along with the leagues, including yours.

-- ---------------------------------------------------------------------------
-- 1. Delete the league game records FIRST.
--
-- game_records.league_id is ON DELETE SET NULL, not CASCADE — so dropping the
-- leagues first would leave orphan rows with league_id = null that no query
-- ever reaches again. Delete them explicitly while they can still be found.
-- ---------------------------------------------------------------------------
delete from game_records where context = 'league';

-- ---------------------------------------------------------------------------
-- 2. Delete the leagues. This cascades to memberships and daily_seeds.
-- ---------------------------------------------------------------------------
delete from leagues;

-- ---------------------------------------------------------------------------
-- 3. Create the two new leagues.
--
-- A league's day rolls over at LOCAL MIDNIGHT in its timezone, so the timezone
-- column is what sets the "new game" mark.
--
--   OG-SET   -> Asia/Singapore : midnight SGT.
--   ORC-MODE -> Etc/GMT+7      : 3pm SGT.
--
-- Etc/GMT+7 is UTC-7 (the POSIX Etc/ zones invert the sign) and never observes
-- DST, so its local midnight is 15:00 in Singapore all year round. A US zone
-- at the same offset would have been readable but riskier: America/Phoenix
-- happens to work today only because Arizona skips DST, and any zone that does
-- observe it (America/Los_Angeles) would drift the mark by an hour twice a
-- year. There is a test pinning the 15:00 result in both January and July.
-- ---------------------------------------------------------------------------
insert into leagues (name, timezone, mode, join_code, penalty_base_ms) values
  ('OG Set',   'Asia/Singapore', 'A', 'OG-SET',   5000),
  ('Orc Mode', 'Etc/GMT+7',      'C', 'ORC-MODE', 5000);

-- ---------------------------------------------------------------------------
-- 4. Check what you just made.
-- ---------------------------------------------------------------------------
select
  name,
  join_code,
  mode,
  timezone,
  penalty_base_ms,
  -- The mark, expressed in Singapore time — this is the column to eyeball.
  to_char(
    (date_trunc('day', (now() at time zone timezone)) + interval '1 day')
      at time zone timezone at time zone 'Asia/Singapore',
    'YYYY-MM-DD HH24:MI'
  ) as next_puzzle_sgt
from leagues
order by join_code;
