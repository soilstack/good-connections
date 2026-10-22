-- Checks for the board pool. Run in the Supabase SQL editor AFTER
-- add-board-pool.sql and the ten board-pool/pool-NN.sql files. 2026-10-22.
--
-- The SQL editor only shows the last statement's result, so run each numbered
-- block on its own (select it, then Run). Blocks 1–3 only read. Block 4 creates
-- two throwaway leagues, block 6 deletes them again; no live league is touched.

-- ---------------------------------------------------------------------------
-- 1. Pool size. Expect ten rows, n = 1..10, 2000 each.
-- ---------------------------------------------------------------------------
select n, count(*) from board_pool group by n order by n;

-- ---------------------------------------------------------------------------
-- 2. Every stored board really has n sets, counted here in SQL straight from
--    the card ids (id = ((count*3 + colour)*3 + shape)*3 + fill, so each
--    attribute is one base-3 digit). Expect NO rows.
-- ---------------------------------------------------------------------------
select bp.id, bp.n, t.sets
from board_pool bp
cross join lateral (
  select count(*) as sets
  from unnest(bp.cards) a, unnest(bp.cards) b, unnest(bp.cards) c
  where a < b and b < c
    and (a % 3 + b % 3 + c % 3) % 3 = 0
    and (a / 3 % 3 + b / 3 % 3 + c / 3 % 3) % 3 = 0
    and (a / 9 % 3 + b / 9 % 3 + c / 9 % 3) % 3 = 0
    and (a / 27 % 3 + b / 27 % 3 + c / 27 % 3) % 3 = 0
) t
where t.sets <> bp.n;

-- ---------------------------------------------------------------------------
-- 3. Every board is 12 distinct ids in 0..80. Expect 0.
-- ---------------------------------------------------------------------------
select count(*) from board_pool
where (select count(distinct x) from unnest(cards) x) <> 12
   or exists (select 1 from unnest(cards) x where x < 0 or x > 80);

-- ---------------------------------------------------------------------------
-- 4. Two throwaway leagues (Mode C and Mode A). Issue the day before the
--    cutover plus the 30 days from it, for both.
-- ---------------------------------------------------------------------------
insert into leagues (id, name, timezone, mode, join_code) values
  ('00000000-0000-4000-8000-00000000c0c0', 'pool test C (delete me)', 'UTC', 'C', 'POOL-TEST-C-DELETE-ME'),
  ('00000000-0000-4000-8000-00000000a0a0', 'pool test A (delete me)', 'UTC', 'A', 'POOL-TEST-A-DELETE-ME');
select issue_puzzle(l.id, (select cutover from board_pool_config) + i)
from (values ('00000000-0000-4000-8000-00000000c0c0'::uuid), ('00000000-0000-4000-8000-00000000a0a0'::uuid)) l (id),
     generate_series(-1, 29) i;

-- ---------------------------------------------------------------------------
-- 5. What was issued. Expect:
--    * Mode A: no pool board on any date (pool_n null throughout).
--    * Mode C: no pool board the day before the cutover; a pool board on all
--      30 days from it, with a spread of n across 1..10 (30 draws, so expect
--      gaps and repeats — about 3 per value, not exactly 3).
--    * sets_counted = pool_n on every pool row.
-- ---------------------------------------------------------------------------
select l.mode, ds.puzzle_date, ds.puzzle_date >= cfg.cutover as from_cutover,
       bp.n as pool_n, t.sets as sets_counted, ds.pool_id, ds.seed
from daily_seeds ds
join leagues l on l.id = ds.league_id
cross join board_pool_config cfg
left join board_pool bp on bp.id = ds.pool_id
left join lateral (
  select count(*) as sets
  from unnest(bp.cards) a, unnest(bp.cards) b, unnest(bp.cards) c
  where a < b and b < c
    and (a % 3 + b % 3 + c % 3) % 3 = 0
    and (a / 3 % 3 + b / 3 % 3 + c / 3 % 3) % 3 = 0
    and (a / 9 % 3 + b / 9 % 3 + c / 9 % 3) % 3 = 0
    and (a / 27 % 3 + b / 27 % 3 + c / 27 % 3) % 3 = 0
) t on bp.id is not null
where ds.league_id in ('00000000-0000-4000-8000-00000000c0c0', '00000000-0000-4000-8000-00000000a0a0')
order by l.mode, ds.puzzle_date;

-- The spread of n on its own:
-- select bp.n, count(*) from daily_seeds ds join board_pool bp on bp.id = ds.pool_id
-- where ds.league_id = '00000000-0000-4000-8000-00000000c0c0' group by bp.n order by bp.n;

-- ---------------------------------------------------------------------------
-- 6. Clean up. Deleting the leagues cascades to their daily_seeds rows.
--    Expect "DELETE 2"; then rerun block 5 and expect no rows.
-- ---------------------------------------------------------------------------
delete from leagues
where id in ('00000000-0000-4000-8000-00000000c0c0', '00000000-0000-4000-8000-00000000a0a0');
