import type { CraneDetail } from '../types'
import { fmtDate, fmtLatLng } from '../utils'
import { PhotoBox, ThumbStrip } from './PhotoBits'

/* ---------- detail ---------- */

interface DetailProps {
  crane: CraneDetail
  photoIdx: number
  onPrev: () => void
  onNext: () => void
  onContribute: () => void
  onReportGone: () => void
}

export function DetailRail({ crane, photoIdx, onPrev, onNext, onContribute, onReportGone }: DetailProps) {
  return (
    <div className="panel-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        {crane.status === 'active' ? (
          <span className="status-active">● ACTIVE</span>
        ) : (
          <span className="status-gone">● GONE</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--t-mut)' }}>CRANE</span>
      </div>
      <PhotoBox crane={crane} idx={photoIdx} height={150} onPrev={onPrev} onNext={onNext} />
      <div className="panel-title" style={{ fontSize: 21, letterSpacing: '.02em', marginTop: 15, lineHeight: 1.15 }}>
        {crane.name}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--t-body)', lineHeight: 2.05, marginTop: 11, letterSpacing: '.04em' }}>
        <div>AREA&nbsp;&nbsp;—&nbsp;&nbsp;{crane.city}{crane.neighborhood ? ` · ${crane.neighborhood}` : ''}</div>
        <div>COORD —&nbsp;&nbsp;{fmtLatLng(crane.lat, crane.lng)}</div>
        <div>SEEN&nbsp;&nbsp;—&nbsp;&nbsp;{fmtDate(crane.addedAt)}</div>
        <div style={{ color: 'var(--t-mut)' }}>
          {crane.photos} PHOTOS · {crane.contribs} CONTRIBUTORS
        </div>
        <ArticleLinks links={crane.links} />
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-outline" onClick={onContribute}>
        ＋ ADD PHOTO / INFO
      </button>
      {crane.status === 'active' && (
        <button className="btn btn-danger" style={{ marginTop: 9 }} onClick={onReportGone}>
          REPORT AS GONE
        </button>
      )}
    </div>
  )
}

function ArticleLinks({ links }: { links: string[] }) {
  if (!links.length) {
    return <div style={{ color: 'var(--t-mut)' }}>NO ARTICLE LINKS YET</div>
  }
  return (
    <div>
      {links.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          ↗ ARTICLE LINK{links.length > 1 ? ` ${i + 1}` : 'S'}
        </a>
      ))}
    </div>
  )
}

interface DetailSheetProps extends DetailProps {
  expanded: boolean
  onToggle: () => void
}

export function DetailSheet({ crane, expanded, onToggle, photoIdx, onPrev, onNext, onContribute, onReportGone }: DetailSheetProps) {
  const cover = crane.imgs.length ? crane.imgs[0] : null
  return (
    <div style={{ padding: '12px 16px 18px', height: '100%', overflow: 'auto' }}>
      <div onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
          <div
            className="hatch"
            style={{ width: 56, height: 56, flexShrink: 0, border: '1px solid var(--line2)', borderRadius: 5, overflow: 'hidden' }}
          >
            {cover && <img src={cover} alt={crane.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="panel-title" style={{ fontSize: 16, lineHeight: 1.15 }}>
              {crane.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--t-body)', marginTop: 4, letterSpacing: '.04em' }}>
              {crane.city} · {fmtDate(crane.addedAt)}
            </div>
            <div
              className={crane.status === 'active' ? 'status-active' : 'status-gone'}
              style={{ fontSize: 10, marginTop: 4, letterSpacing: '.08em' }}
            >
              ● {crane.status === 'active' ? 'ACTIVE' : 'GONE'}
            </div>
          </div>
        </div>
      </div>
      {expanded ? (
        <div style={{ marginTop: 14 }}>
          <PhotoBox crane={crane} idx={photoIdx} height={130} onPrev={onPrev} onNext={onNext} />
          <div style={{ fontSize: 10.5, color: 'var(--t-body)', lineHeight: 2, marginTop: 12, letterSpacing: '.04em' }}>
            <div>COORD — {fmtLatLng(crane.lat, crane.lng)}</div>
            <ArticleLinks links={crane.links} />
          </div>
          <button className="btn round btn-outline" style={{ marginTop: 12, padding: 13 }} onClick={onContribute}>
            ＋ ADD PHOTO / INFO
          </button>
          {crane.status === 'active' && (
            <button className="btn round btn-danger" style={{ marginTop: 9, padding: 11 }} onClick={onReportGone}>
              REPORT AS GONE
            </button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--t-mut)', marginTop: 12, letterSpacing: '.06em' }}>
          ▲ TAP FOR PHOTOS &amp; LINKS ▲
        </div>
      )}
    </div>
  )
}

/* ---------- empty region ---------- */

interface EmptyProps {
  mobile: boolean
  onAdd: () => void
  onNearest: () => void
}

export function EmptyPanel({ mobile, onAdd, onNearest }: EmptyProps) {
  if (mobile) {
    return (
      <div style={{ padding: '12px 16px 18px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 10.5, letterSpacing: '.1em', color: 'var(--t-soft)', marginBottom: 6 }}>
          ○ 0 CRANES IN VIEW
        </div>
        <div className="panel-title" style={{ fontSize: 15, textWrap: 'pretty' }}>
          Nothing pinned here yet
        </div>
        <div style={{ fontSize: 10, color: 'var(--t-body)', lineHeight: 1.6, marginTop: 6, textWrap: 'pretty' }}>
          Spot a crane in this area? You'd be the first to log it.
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn round btn-quiet" style={{ flex: 1, fontSize: 10.5 }} onClick={onNearest}>
            ← NEAREST
          </button>
          <button className="btn round btn-primary" style={{ flex: 1.7, padding: 12 }} onClick={onAdd}>
            ＋ PIN A CRANE HERE
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="panel-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--t-soft)' }}>○ 0 CRANES IN VIEW</span>
        <span style={{ fontSize: 11, color: 'var(--t-mut)' }}>REGION</span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 150,
          border: '1px dashed var(--line2)',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 11,
          color: '#3d5d7d',
        }}
      >
        <div style={{ position: 'relative', width: 34, height: 34, opacity: 0.65 }}>
          <div style={{ position: 'absolute', left: 16, top: 0, width: 2, height: 34, background: '#3d5d7d' }} />
          <div style={{ position: 'absolute', left: 0, top: 16, width: 34, height: 2, background: '#3d5d7d' }} />
          <div style={{ position: 'absolute', left: 9, top: 9, width: 16, height: 16, border: '2px solid #3d5d7d', borderRadius: '50%' }} />
        </div>
        <span style={{ fontSize: 9, letterSpacing: '.1em' }}>EMPTY AREA</span>
      </div>
      <div className="panel-title" style={{ fontSize: 19, marginTop: 16, textWrap: 'pretty' }}>
        Nothing pinned here yet
      </div>
      <div style={{ fontSize: 11, color: 'var(--t-body)', lineHeight: 1.8, marginTop: 11, letterSpacing: '.03em', textWrap: 'pretty' }}>
        If there's a crane up in this area, you'd be the first to log it. Pins you add show up for everyone.
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary" onClick={onAdd}>
        ＋ PIN A CRANE HERE
      </button>
      <button className="btn btn-quiet" style={{ marginTop: 9, padding: 11 }} onClick={onNearest}>
        ← SHOW NEAREST CRANE
      </button>
    </div>
  )
}

/* ---------- add: hint ---------- */

interface AddHintProps {
  mobile: boolean
  coords: string
  onPlace: () => void
  onCancel: () => void
}

export function AddHintPanel({ mobile, coords, onPlace, onCancel }: AddHintProps) {
  if (mobile) {
    return (
      <div style={{ padding: '14px 16px 18px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" style={{ marginBottom: 12 }} />
        <div className="panel-title" style={{ fontSize: 14 }}>
          Drag the pin to the crane
        </div>
        <div style={{ fontSize: 10, color: 'var(--t-body)', marginTop: 6, letterSpacing: '.03em' }}>
          PINNED AT <span style={{ color: 'var(--cyan)' }}>{coords}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn round btn-quiet" style={{ flex: 1 }} onClick={onCancel}>
            CANCEL
          </button>
          <button className="btn round btn-primary" style={{ flex: 1.6, padding: 12 }} onClick={onPlace}>
            PLACE HERE →
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="panel-col">
      <div className="status-active" style={{ marginBottom: 14 }}>
        ● NEW CRANE
      </div>
      <div className="panel-title" style={{ fontSize: 18 }}>
        Drop the pin on the crane
      </div>
      <div style={{ fontSize: 11, color: 'var(--t-body)', lineHeight: 1.8, marginTop: 12, letterSpacing: '.03em' }}>
        Drag the dashed marker on the map, or tap a new spot, until it sits on the crane's exact location.
      </div>
      <div style={{ marginTop: 16, border: '1px solid var(--line2)', borderRadius: 4, padding: '11px 12px', fontSize: 10.5, color: 'var(--t-body)', letterSpacing: '.04em' }}>
        PINNED AT
        <br />
        <span style={{ color: 'var(--cyan)', fontSize: 13 }}>{coords}</span>
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary" onClick={onPlace}>
        PLACE HERE →
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={onCancel}>
        CANCEL
      </button>
    </div>
  )
}

/* ---------- add: form ---------- */

export interface AddFormValues {
  name: string
  note: string
}

interface AddFormProps {
  mobile: boolean
  coords: string
  values: AddFormValues
  onChange: (values: AddFormValues) => void
  draft: string[]
  onFiles: (urls: string[]) => void
  onRemoveDraft: (i: number) => void
  onSubmit: () => void
  onCancel: () => void
}

export function AddFormPanel({ mobile, coords, values, onChange, draft, onFiles, onRemoveDraft, onSubmit, onCancel }: AddFormProps) {
  const set = (patch: Partial<AddFormValues>) => onChange({ ...values, ...patch })
  const thumbW = mobile ? 78 : 74
  const thumbH = mobile ? 62 : 58
  return (
    <div className={mobile ? '' : 'panel-scroll'} style={mobile ? { padding: '12px 16px 18px', height: '100%', overflow: 'auto' } : undefined}>
      {mobile ? (
        <>
          <div className="sheet-handle" />
          <div className="panel-title" style={{ fontSize: 16, marginBottom: 12 }}>
            New crane
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="panel-title" style={{ fontSize: 18 }}>
            New crane
          </span>
          <button style={{ fontSize: 14, color: 'var(--t-mut)' }} onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
      )}
      <div className="label">PHOTOS — {draft.length} / 3</div>
      <ThumbStrip imgs={draft} onFiles={onFiles} onRemove={onRemoveDraft} w={thumbW} h={thumbH} />
      {!mobile && <div className="label">PROJECT NAME / NICKNAME</div>}
      <input
        className="ct-in"
        placeholder={mobile ? 'project name / nickname' : 'e.g. Harbor Point Tower'}
        value={values.name}
        onChange={(e) => set({ name: e.target.value })}
        style={{ marginBottom: mobile ? 10 : 14 }}
      />
      {!mobile && (
        <>
          <div className="label">ARTICLE LINK / NOTE (OPTIONAL)</div>
          <input
            className="ct-in"
            placeholder="https:// …"
            value={values.note}
            onChange={(e) => set({ note: e.target.value })}
            style={{ marginBottom: 16 }}
          />
        </>
      )}
      <div className="label" style={{ letterSpacing: '.05em', marginBottom: mobile ? 12 : 14 }}>
        LOCATION — {coords} (FROM THE PIN)
      </div>
      <button className={mobile ? 'btn round btn-primary' : 'btn btn-primary'} onClick={onSubmit}>
        SUBMIT CRANE
      </button>
      <button className="btn btn-ghost" style={{ padding: 10 }} onClick={onCancel}>
        CANCEL
      </button>
    </div>
  )
}

/* ---------- contribute ---------- */

interface ContributeProps {
  mobile: boolean
  craneName: string
  draft: string[]
  onFiles: (urls: string[]) => void
  onRemoveDraft: (i: number) => void
  link: string
  onLinkChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}

export function ContributePanel({ mobile, craneName, draft, onFiles, onRemoveDraft, link, onLinkChange, onSubmit, onBack }: ContributeProps) {
  if (mobile) {
    return (
      <div style={{ padding: '12px 16px 18px', height: '100%', overflow: 'auto' }}>
        <div className="sheet-handle" style={{ marginBottom: 12 }} />
        <button style={{ fontSize: 11, color: 'var(--cyan)' }} onClick={onBack}>
          ← {craneName}
        </button>
        <div className="panel-title" style={{ fontSize: 16, margin: '8px 0 12px' }}>
          Add to this crane
        </div>
        <div className="label" style={{ letterSpacing: '.06em', marginBottom: 6 }}>
          ADD PHOTOS — {draft.length} / 3
        </div>
        <ThumbStrip imgs={draft} onFiles={onFiles} onRemove={onRemoveDraft} w={78} h={60} />
        <input
          className="ct-in"
          placeholder="＋ article link or note"
          value={link}
          onChange={(e) => onLinkChange(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <button className="btn round btn-primary" onClick={onSubmit}>
          SUBMIT CONTRIBUTION
        </button>
      </div>
    )
  }
  return (
    <div className="panel-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <button style={{ fontSize: 11, color: 'var(--cyan)', letterSpacing: '.03em', textAlign: 'left' }} onClick={onBack}>
          ← {craneName}
        </button>
        <button style={{ fontSize: 14, color: 'var(--t-mut)' }} onClick={onBack} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="panel-title" style={{ fontSize: 18, margin: '8px 0 4px' }}>
        Add to this crane
      </div>
      <div style={{ height: 1, background: 'var(--line2)', margin: '10px 0 14px' }} />
      <div className="label">ADD PHOTOS — {draft.length} / 3</div>
      <ThumbStrip imgs={draft} onFiles={onFiles} onRemove={onRemoveDraft} w={74} h={54} />
      <div className="label">ARTICLE LINK / NOTE (OPTIONAL)</div>
      <input
        className="ct-in"
        placeholder="＋ article link"
        value={link}
        onChange={(e) => onLinkChange(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary" onClick={onSubmit}>
        SUBMIT CONTRIBUTION
      </button>
    </div>
  )
}
