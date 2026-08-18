import { describe, expect, it } from 'vitest'
import { formatClock, formatCountdown, nextMidnightMs } from './time'

/** Wall-clock reading of an instant in a zone, as "YYYY-MM-DD HH:mm". */
function wallClock(timezone: string, atMs: number): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(atMs)
  const get = (t: string) => p.find((x) => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

describe('nextMidnightMs', () => {
  it('lands on midnight in the target zone, not the runner’s', () => {
    // 2026-08-18T09:30Z = 17:30 in Singapore.
    const now = Date.parse('2026-08-18T09:30:00Z')
    const next = nextMidnightMs('Asia/Singapore', now)!
    expect(wallClock('Asia/Singapore', next)).toBe('2026-08-19 00:00')
    expect(next).toBeGreaterThan(now)
  })

  it('is strictly in the future even one second before midnight', () => {
    // 15:59:59Z = 23:59:59 in Singapore on the 18th.
    const now = Date.parse('2026-08-18T15:59:59Z')
    const next = nextMidnightMs('Asia/Singapore', now)!
    expect(next - now).toBe(1000)
    expect(wallClock('Asia/Singapore', next)).toBe('2026-08-19 00:00')
  })

  it('rolls over month and year boundaries', () => {
    const next = nextMidnightMs('UTC', Date.parse('2026-12-31T23:00:00Z'))!
    expect(wallClock('UTC', next)).toBe('2027-01-01 00:00')
  })

  it('gets the wall clock right across a DST change', () => {
    // London goes GMT+1 → GMT+0 at 02:00 local on 2026-10-25. Standing just
    // before that on the 24th, the next midnight is 25 hours away, not 24.
    const now = Date.parse('2026-10-24T22:00:00Z') // 23:00 BST on the 24th
    const next = nextMidnightMs('Europe/London', now)!
    expect(wallClock('Europe/London', next)).toBe('2026-10-25 00:00')
    // Midnight is still BST; the change happens at 02:00, later that day.
    expect(next - now).toBe(60 * 60 * 1000)

    // And from inside the 25th, the following midnight is 25 hours out.
    const after = nextMidnightMs('Europe/London', next)!
    expect(wallClock('Europe/London', after)).toBe('2026-10-26 00:00')
    expect(after - next).toBe(25 * 60 * 60 * 1000)
  })

  it('handles a zone west of UTC', () => {
    // 2026-08-18T09:30Z = 05:30 in New York.
    const next = nextMidnightMs('America/New_York', Date.parse('2026-08-18T09:30:00Z'))!
    expect(wallClock('America/New_York', next)).toBe('2026-08-19 00:00')
  })

  it('returns null for an unknown zone instead of throwing', () => {
    expect(nextMidnightMs('Mars/Olympus_Mons', Date.now())).toBeNull()
  })
})

describe('formatCountdown', () => {
  it('shows hours and minutes above an hour', () => {
    expect(formatCountdown(7 * 3600_000 + 12 * 60_000 + 30_000)).toBe('7h 12m')
  })
  it('shows minutes and seconds inside the last hour', () => {
    expect(formatCountdown(12 * 60_000 + 5_000)).toBe('12m 05s')
  })
  it('shows bare seconds inside the last minute', () => {
    expect(formatCountdown(9_000)).toBe('9s')
  })
  it('collapses non-positive to “now”', () => {
    expect(formatCountdown(0)).toBe('now')
    expect(formatCountdown(-5)).toBe('now')
  })
})

describe('formatClock', () => {
  /** An instant at a given time on the runner's own clock, so these hold in any TZ. */
  const localAt = (h: number, m = 0) => {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }

  it('names the two hours people have words for', () => {
    expect(formatClock(localAt(0))).toBe('midnight')
    expect(formatClock(localAt(12))).toBe('noon')
  })
  it('drops :00 on the hour', () => {
    expect(formatClock(localAt(15))).toBe('3 pm')
    expect(formatClock(localAt(9))).toBe('9 am')
  })
  it('keeps the minutes when there are any', () => {
    expect(formatClock(localAt(15, 30))).toBe('3:30 pm')
    expect(formatClock(localAt(0, 5))).toBe('12:05 am')
    expect(formatClock(localAt(12, 1))).toBe('12:01 pm')
  })
})

describe('a league whose day rolls at 3pm Singapore time', () => {
  // Etc/GMT+7 is UTC-7 (POSIX inverts the sign) and never observes DST, so its
  // local midnight is 15:00 in Singapore all year — which is how a non-midnight
  // rollover is configured without a schema change.
  it('rolls over at 15:00 SGT in both January and July', () => {
    const inSGT = (ms: number) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }).format(ms)
    for (const iso of ['2026-01-15T00:00:00Z', '2026-07-15T00:00:00Z']) {
      expect(inSGT(nextMidnightMs('Etc/GMT+7', Date.parse(iso))!)).toBe('15:00')
    }
  })
})
