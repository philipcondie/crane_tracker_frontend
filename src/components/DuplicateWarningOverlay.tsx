interface Props {
  mobile: boolean
  /** The name the user gave the pending crane, for a more concrete warning. */
  craneName: string
  /** Message from the backend's 409, if any; falls back to generic copy. */
  message?: string
  submitting: boolean
  /** Create the crane anyway (re-submits with the duplicate override set). */
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Shown when the backend answers a create with 409 (possible duplicate). Lets
 * the user confirm they really mean to add it, at which point the caller
 * re-submits with `overrideDuplicateWarning: true`. Reuses the welcome modal's
 * scrim/card so it reads as part of the same surface.
 */
export function DuplicateWarningOverlay({ mobile, craneName, message, submitting, onConfirm, onCancel }: Props) {
  const label = craneName.trim() || 'this crane'
  return (
    <div
      className={mobile ? 'welcome-scrim mobile' : 'welcome-scrim'}
      onClick={submitting ? undefined : onCancel}
    >
      <div className="welcome-card" onClick={(e) => e.stopPropagation()}>
        {mobile && <div className="sheet-handle" style={{ marginBottom: 14 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mobile ? 12 : 15 }}>
          <span style={{ fontSize: mobile ? 10.5 : 11, letterSpacing: '.12em', color: 'var(--danger)', fontWeight: 700 }}>
            ⚠ POSSIBLE DUPLICATE
          </span>
          <span style={{ fontSize: mobile ? 9 : 10, letterSpacing: '.14em', color: 'var(--t-mut)' }}>CHECK FIRST</span>
        </div>
        <div style={{ fontSize: mobile ? 16 : 20, lineHeight: 1.2, color: 'var(--t-bright)', letterSpacing: '.01em', textWrap: 'pretty' }}>
          A crane may already be pinned near here.
        </div>
        <div style={{ fontSize: mobile ? 10.5 : 11.5, lineHeight: mobile ? 1.7 : 1.8, color: 'var(--t-body)', marginTop: mobile ? 9 : 12, letterSpacing: '.02em', textWrap: 'pretty' }}>
          {message || `We found an existing crane close to where you placed ${label}. If it's the same one, skip adding it. If it's genuinely a different crane, you can add it anyway.`}
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: mobile ? 15 : 18, borderRadius: mobile ? 9 : 5 }}
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? 'ADDING CRANE…' : 'ADD ANYWAY'}
        </button>
        <button
          className="btn btn-quiet"
          style={{ marginTop: mobile ? 8 : 9, borderRadius: mobile ? 9 : 5, padding: 11 }}
          onClick={onCancel}
          disabled={submitting}
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}
