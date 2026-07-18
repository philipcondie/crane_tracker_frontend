import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCranes } from '../store'
import { PillNav } from '../components/PillNav'
import { PinGlyph } from '../components/PhotoBits'
import { relDate } from '../utils'

type Filter = 'all' | 'active' | 'gone'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'active', label: 'ACTIVE' },
  { key: 'gone', label: 'GONE' },
]

export default function FeedPage() {
  const { cranes } = useCranes()
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()

  const items = useMemo(
    () =>
      cranes
        .filter((c) => filter === 'all' || c.status === filter)
        .sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : b.id - a.id)),
    [cranes, filter],
  )

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">▲ CRANE TRACKER</span>
        <PillNav />
      </header>
      <main className="page-main">
        <h1 className="page-heading" style={{ margin: 0 }}>
          Recently spotted
        </h1>
        <div className="page-sub">
          {items.length} CRANE{items.length === 1 ? '' : 'S'} · NEWEST FIRST · TAP A CARD TO SEE IT ON THE MAP
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'chip active' : 'chip'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {items.map((c) => (
          <button key={c.id} className="feed-card" onClick={() => navigate(`/?crane=${c.id}`)}>
            <div className="feed-thumb hatch">
              {c.imgs.length ? (
                <img src={c.imgs[0]} alt={c.name} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PinGlyph size={20} gone={c.status === 'gone'} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="panel-title" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t-body)', marginTop: 4, letterSpacing: '.04em' }}>
                {c.city}
                {c.neighborhood ? ` · ${c.neighborhood}` : ''}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--t-mut)', marginTop: 3, letterSpacing: '.04em' }}>
                added {relDate(c.addedAt)}
              </div>
            </div>
            <span className={c.status === 'active' ? 'badge active' : 'badge gone'}>
              ● {c.status === 'active' ? 'ACTIVE' : 'GONE'}
            </span>
          </button>
        ))}
        {!items.length && (
          <div style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: 'var(--t-mut)', letterSpacing: '.06em' }}>
            NOTHING HERE YET
          </div>
        )}
      </main>
    </div>
  )
}
