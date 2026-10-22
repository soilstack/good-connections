import { describe, it, expect } from 'vitest'
import { cardFromId } from './cards'
import { countSets, enumerateSetsBrute } from './set'
import { boardFromPool } from './relabel'

/**
 * Checks the committed pool data (supabase/board-pool/pool-NN.sql) — the exact
 * rows that get loaded into board_pool. A bad row there would be served to a
 * whole league as a board whose set count is not the N it was drawn for.
 */
const FILES = import.meta.glob('../../supabase/board-pool/pool-*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const POOL_SIZE = 2000

function parse(sql: string): { n: number; ids: number[] }[] {
  return [...sql.matchAll(/\((\d+), '\{([\d,]+)\}'\)/g)].map((m) => ({
    n: Number(m[1]),
    ids: m[2]!.split(',').map(Number),
  }))
}

describe('board pool data', () => {
  it('has one file for each N in 1..10', () => {
    const names = Object.keys(FILES).map((p) => p.split('/').pop())
    expect(names.sort()).toEqual(Array.from({ length: 10 }, (_, i) => `pool-${String(i + 1).padStart(2, '0')}.sql`))
  })

  for (const [path, sql] of Object.entries(FILES)) {
    const n = Number(/pool-(\d+)\.sql$/.exec(path)![1])

    it(`pool-${String(n).padStart(2, '0')}: ${POOL_SIZE} distinct sorted boards, each with exactly ${n} sets`, () => {
      const rows = parse(sql)
      expect(rows).toHaveLength(POOL_SIZE)
      expect(new Set(rows.map((r) => r.ids.join(','))).size).toBe(POOL_SIZE)
      for (const { n: rowN, ids } of rows) {
        expect(rowN).toBe(n)
        expect(ids).toHaveLength(12)
        expect(new Set(ids).size).toBe(12)
        expect(ids).toEqual([...ids].sort((a, b) => a - b))
        for (const id of ids) expect(id >= 0 && id <= 80).toBe(true)
        const cards = ids.map(cardFromId)
        expect(countSets(cards)).toBe(n)
        expect(enumerateSetsBrute(cards)).toHaveLength(n)
      }
    })

    it(`pool-${String(n).padStart(2, '0')}: boardFromPool keeps N for every board`, () => {
      parse(sql).forEach(({ ids }, i) => {
        const board = boardFromPool(i % 2 ? 'B' : 'C', ids, (i * 2654435761) >>> 0)
        expect(board.sets).toHaveLength(n)
      })
    })
  }
})
