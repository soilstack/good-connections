import { formatTime } from './format'

interface AbandonDialogProps {
  elapsedMs: number
  foundCount: number
  totalSets: number
  showDenominator: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Give-up confirmation. States exactly what is being lost. The clock is still
 * running behind this dialog — opening it is not a free thinking break.
 */
export function AbandonDialog({
  elapsedMs,
  foundCount,
  totalSets,
  showDenominator,
  onConfirm,
  onCancel,
}: AbandonDialogProps) {
  const progress = showDenominator ? `${foundCount} of ${totalSets}` : `${foundCount}`
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Give up?">
      <div className="dialog">
        <h2>Give up this game?</h2>
        <p className="muted">
          You will lose this attempt after <strong>{formatTime(elapsedMs)}</strong> with{' '}
          <strong>{progress}</strong> {foundCount === 1 ? 'set' : 'sets'} found. The clock is still
          running.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Keep playing
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Give up
          </button>
        </div>
      </div>
    </div>
  )
}
