import { PinGlyph } from './PhotoBits'

interface Props {
  mobile: boolean
  onDismiss: () => void
  onAdd: () => void
}

export function WelcomeOverlay({ mobile, onDismiss, onAdd }: Props) {
  return (
    <div className={mobile ? 'welcome-scrim mobile' : 'welcome-scrim'} onClick={onDismiss}>
      <div className="welcome-card" onClick={(e) => e.stopPropagation()}>
        {mobile && <div className="sheet-handle" style={{ marginBottom: 14 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mobile ? 12 : 15 }}>
          <span style={{ fontSize: mobile ? 10.5 : 11, letterSpacing: '.12em', color: 'var(--cyan)', fontWeight: 700 }}>
            ▲ CRANE TRACKER
          </span>
          <span style={{ fontSize: mobile ? 9 : 10, letterSpacing: '.14em', color: 'var(--t-mut)' }}>SEATTLE</span>
        </div>
        <div style={{ fontSize: mobile ? 17 : 22, lineHeight: 1.2, color: 'var(--t-bright)', letterSpacing: '.01em', textWrap: 'pretty' }}>
          The cranes reshaping the skyline — on one map.
        </div>
        <div style={{ fontSize: mobile ? 10.5 : 11.5, lineHeight: mobile ? 1.7 : 1.8, color: 'var(--t-body)', marginTop: mobile ? 9 : 12, letterSpacing: '.02em', textWrap: 'pretty' }}>
          Every pin is a working construction crane a neighbor spotted and logged. Watch the skyline change, one crane
          at a time.
        </div>
        {mobile ? (
          <div style={{ display: 'flex', gap: 18, marginTop: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PinGlyph size={18} />
              <span style={{ fontSize: 9.5, color: 'var(--t-pale)', letterSpacing: '.04em' }}>ACTIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PinGlyph size={18} gone />
              <span style={{ fontSize: 9.5, color: 'var(--t-body)', letterSpacing: '.04em' }}>GONE</span>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--line)', borderRadius: 5, padding: '12px 13px', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <PinGlyph />
              <span style={{ fontSize: 10.5, color: 'var(--t-pale)', letterSpacing: '.03em' }}>
                <b style={{ color: 'var(--t-bright)' }}>ACTIVE</b> — still standing
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <PinGlyph gone />
              <span style={{ fontSize: 10.5, color: 'var(--t-body)', letterSpacing: '.03em' }}>
                <b style={{ color: '#c3cfdb' }}>GONE</b> — came down
              </span>
            </div>
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ marginTop: mobile ? 15 : 18, borderRadius: mobile ? 9 : 5 }}
          onClick={onDismiss}
        >
          START EXPLORING
        </button>
        <button
          className="btn btn-outline"
          style={{ marginTop: mobile ? 8 : 9, borderRadius: mobile ? 9 : 5, padding: 11 }}
          onClick={onAdd}
        >
          ＋ PIN MY FIRST CRANE
        </button>
      </div>
    </div>
  )
}
