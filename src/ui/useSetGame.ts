import { useCallback, useEffect, useRef, useState } from 'react'
import type { Board } from '../game/board'
import { isSet, type Triple } from '../game/set'
import {
  GameRecorder,
  deriveStats,
  MODE_C_BASE_PENALTY_MS,
  type GameContext,
  type GameRecord,
  type GameStats,
} from '../game/telemetry'

/**
 * All the play-time state for one fixed-board game, wired to the pure
 * GameRecorder. The React layer stays thin: every rule (what is a set, which
 * sets exist) comes from the pure modules; this hook only tracks selection,
 * feedback, the clock, and end-of-game.
 */

const FEEDBACK_MS = 650

export type FeedbackKind = 'valid' | 'invalid' | 'duplicate'
export interface Feedback {
  kind: FeedbackKind
  cards: readonly number[]
}

export interface SetGameState {
  selected: readonly number[]
  found: ReadonlySet<number>
  foundCount: number
  totalSets: number
  status: 'playing' | 'ended'
  endReason: 'completed' | 'abandoned' | null
  feedback: Feedback | null
  abandonOpen: boolean
  elapsedMs: number
  record: GameRecord | null
  stats: GameStats | null
  /** Solution sets not found, revealed on end (practice reveals immediately). */
  missedSets: Triple[]
  /** Transient message, e.g. Mode C's "didn't find all" penalty notice. */
  notice: string | null
  toggleCard: (i: number) => void
  /** Mode C: declare "done". Completes if all found, else penalises. */
  pressDone: () => void
  openAbandon: () => void
  cancelAbandon: () => void
  confirmAbandon: () => void
}

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // Deterministic-enough fallback for environments without crypto.randomUUID.
    return `g-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  }
}

function findSetIndex(sets: readonly Triple[], sorted: Triple): number {
  return sets.findIndex((s) => s[0] === sorted[0] && s[1] === sorted[1] && s[2] === sorted[2])
}

export interface UseSetGameOptions {
  board: Board
  player: string
  context: GameContext
}

export function useSetGame({ board, player, context }: UseSetGameOptions): SetGameState {
  const recorderRef = useRef<GameRecorder | null>(null)
  if (recorderRef.current === null) {
    recorderRef.current = new GameRecorder({
      id: makeId(),
      player,
      context,
      mode: board.mode,
      totalSets: board.sets.length,
      now: () => Date.now(),
    })
  }
  const recorder = recorderRef.current

  const [selected, setSelected] = useState<number[]>([])
  const [found, setFound] = useState<Set<number>>(() => new Set())
  const [status, setStatus] = useState<'playing' | 'ended'>('playing')
  const [endReason, setEndReason] = useState<'completed' | 'abandoned' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [abandonOpen, setAbandonOpen] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [record, setRecord] = useState<GameRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const feedbackTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const penaltyRef = useRef(0) // accumulated Mode C penalty, mirrors the recorder
  const failedDonesRef = useRef(0)

  // Live clock (includes any Mode C penalty). Keeps running while playing —
  // including while the abandon prompt is open, so it is never a free break.
  useEffect(() => {
    if (status !== 'playing') return
    const start = recorder.startTimeMs()
    const tick = () => setElapsedMs(Date.now() - start + penaltyRef.current)
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [status, recorder])

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  const flash = useCallback((kind: FeedbackKind, cards: readonly number[]) => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    setFeedback({ kind, cards })
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }, [])

  const finish = useCallback(
    (reason: 'completed' | 'abandoned') => {
      recorder.end(reason)
      const rec = recorder.record()
      setStatus('ended')
      setEndReason(reason)
      setRecord(rec)
      const last = rec.events[rec.events.length - 1]
      setElapsedMs(last ? last.t_ms : 0)
    },
    [recorder],
  )

  const evaluate = useCallback(
    (triple: [number, number, number]) => {
      const s = [...triple].sort((a, b) => a - b)
      const sorted: [number, number, number] = [s[0]!, s[1]!, s[2]!]
      const [a, b, c] = sorted
      if (!isSet(board.cards[a]!, board.cards[b]!, board.cards[c]!)) {
        recorder.setInvalid(sorted)
        flash('invalid', sorted)
        return
      }
      const setIndex = findSetIndex(board.sets, sorted)
      if (found.has(setIndex)) {
        recorder.setDuplicate(sorted, setIndex)
        flash('duplicate', sorted)
        return
      }
      recorder.setValid(sorted, setIndex)
      const next = new Set(found)
      next.add(setIndex)
      setFound(next)
      flash('valid', sorted)
      // Modes A/B end the instant the last set is found. Mode C never
      // auto-ends — the player must declare "done".
      if (board.mode !== 'C' && next.size === board.sets.length) finish('completed')
    },
    [board, found, recorder, flash, finish],
  )

  const toggleCard = useCallback(
    (i: number) => {
      if (status !== 'playing' || abandonOpen) return
      if (selected.includes(i)) {
        recorder.cardDeselect(i)
        setSelected(selected.filter((x) => x !== i))
        return
      }
      if (selected.length >= 3) return
      recorder.cardSelect(i)
      const next = [...selected, i]
      if (next.length < 3) {
        setSelected(next)
        return
      }
      evaluate(next as [number, number, number])
      setSelected([])
    },
    [status, abandonOpen, selected, recorder, evaluate],
  )

  const openAbandon = useCallback(() => {
    if (status !== 'playing') return
    recorder.abandonPrompt()
    setAbandonOpen(true)
  }, [status, recorder])

  const cancelAbandon = useCallback(() => {
    recorder.abandonCancel()
    setAbandonOpen(false)
  }, [recorder])

  const confirmAbandon = useCallback(() => {
    setAbandonOpen(false)
    finish('abandoned')
  }, [finish])

  // Mode C: declare "done". Completes if every set is found; otherwise records a
  // premature done, adds an escalating penalty (5s, then doubling), and tells
  // the player only that they missed some — never how many.
  const pressDone = useCallback(() => {
    if (status !== 'playing' || abandonOpen) return
    if (found.size === board.sets.length) {
      recorder.doneAttempt(true)
      finish('completed')
      return
    }
    recorder.doneAttempt(false)
    const penalty = MODE_C_BASE_PENALTY_MS * 2 ** failedDonesRef.current
    recorder.addPenalty(penalty)
    failedDonesRef.current += 1
    penaltyRef.current += penalty
    setElapsedMs(Date.now() - recorder.startTimeMs() + penaltyRef.current)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    setNotice(`You didn’t find all — +${penalty / 1000}s`)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1800)
  }, [status, abandonOpen, found, board, recorder, finish])

  const missedSets =
    status === 'ended' ? board.sets.filter((_, idx) => !found.has(idx)) : []

  return {
    selected,
    found,
    foundCount: found.size,
    totalSets: board.sets.length,
    status,
    endReason,
    feedback,
    abandonOpen,
    elapsedMs,
    record,
    stats: record ? deriveStats(record) : null,
    missedSets,
    notice,
    toggleCard,
    pressDone,
    openAbandon,
    cancelAbandon,
    confirmAbandon,
  }
}
