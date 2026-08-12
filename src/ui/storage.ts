import type { GameRecord } from '../game/telemetry'

/**
 * Slice-1 telemetry transport: append-only game records in localStorage. The
 * records are the exact pure shape from telemetry.ts — in slice 3 this file is
 * swapped for a POST to the server and nothing else changes.
 */

const KEY = 'set.telemetry.v1'

export function loadRecords(): GameRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GameRecord[]) : []
  } catch {
    return []
  }
}

export function saveRecord(record: GameRecord): void {
  try {
    const all = loadRecords()
    all.push(record)
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Storage full or unavailable — a practice record is not worth crashing over.
  }
}
