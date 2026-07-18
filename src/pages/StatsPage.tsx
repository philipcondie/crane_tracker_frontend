import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCranes } from '../store'
import { PillNav } from '../components/PillNav'
import { daysSince } from '../utils'
import type { CraneSummary } from '../types'

interface CityRow {
  city: string
  active: number
  lat: number
  lng: number
}

interface Hotspot {
  label: string
  count: number
  lat: number
  lng: number
}

function cityLeaderboard(cranes: CraneSummary[]): CityRow[] {
  const byCity = new Map<string, CraneSummary[]>()
  for (const c of cranes) {
    if (c.status !== 'active') continue
    const list = byCity.get(c.city) ?? []
    list.push(c)
    byCity.set(c.city, list)
  }
  return [...byCity.entries()]
    .map(([city, list]) => ({
      city,
      active: list.length,
      lat: list.reduce((s, c) => s + c.lat, 0) / list.length,
      lng: list.reduce((s, c) => s + c.lng, 0) / list.length,
    }))
    .sort((a, b) => b.active - a.active)
    .slice(0, 10)
}

/** Cluster active cranes on a ~4km grid and rank the densest cells */
function hotspots(cranes: CraneSummary[]): Hotspot[] {
  const cells = new Map<string, CraneSummary[]>()
  for (const c of cranes) {
    if (c.status !== 'active') continue
    const key = `${Math.round(c.lat / 0.04)}:${Math.round(c.lng / 0.04)}`
    const list = cells.get(key) ?? []
    list.push(c)
    cells.set(key, list)
  }
  return [...cells.values()]
    .map((list) => {
      const anchor = list[0]
      return {
        label: anchor.neighborhood ? `${anchor.city} — ${anchor.neighborhood}` : anchor.city,
        count: list.length,
        lat: list.reduce((s, c) => s + c.lat, 0) / list.length,
        lng: list.reduce((s, c) => s + c.lng, 0) / list.length,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/** Hours since the (pretend) nightly 3 AM recompute */
function hoursSinceNightly(): number {
  const now = new Date()
  const run = new Date(now)
  run.setHours(3, 0, 0, 0)
  if (run > now) run.setDate(run.getDate() - 1)
  return Math.max(1, Math.floor((now.getTime() - run.getTime()) / 3600000))
}

export default function StatsPage() {
  const { cranes } = useCranes()
  const navigate = useNavigate()

  const { total, active, recent, cities, board, spots } = useMemo(() => {
    const activeList = cranes.filter((c) => c.status === 'active')
    return {
      total: cranes.length,
      active: activeList.length,
      recent: cranes.filter((c) => daysSince(c.addedAt) <= 30).length,
      cities: new Set(cranes.map((c) => c.city)).size,
      board: cityLeaderboard(cranes),
      spots: hotspots(cranes),
    }
  }, [cranes])

  const viewOnMap = (lat: number, lng: number, z = 13) => navigate(`/?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&z=${z}`)

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">▲ CRANE TRACKER</span>
        <PillNav />
      </header>
      <main className="page-main">
        <h1 className="page-heading" style={{ margin: 0 }}>
          The big picture
        </h1>
        <div className="page-sub">NUMBERS RECOMPUTED NIGHTLY · LAST UPDATED {hoursSinceNightly()} HOURS AGO</div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-num">{total}</div>
            <div className="stat-label">CRANES TRACKED — ALL TIME</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--cyan)' }}>
              {active}
            </div>
            <div className="stat-label">CURRENTLY ACTIVE</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{recent}</div>
            <div className="stat-label">ADDED IN LAST 30 DAYS</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{cities}</div>
            <div className="stat-label">CITIES REPRESENTED</div>
          </div>
        </div>

        <div className="section-title">CITY LEADERBOARD — ACTIVE CRANES</div>
        <div className="board">
          {board.map((row, i) => (
            <div key={row.city} className="board-row">
              <span className="board-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="board-name">{row.city}</span>
              <span className="board-count">{row.active}</span>
              <button className="board-link" onClick={() => viewOnMap(row.lat, row.lng, 12)}>
                VIEW ON MAP ↗
              </button>
            </div>
          ))}
        </div>

        <div className="section-title">CONSTRUCTION HOTSPOTS</div>
        <div className="board">
          {spots.map((spot) => (
            <div key={spot.label} className="board-row">
              <span className="board-rank">▲</span>
              <span className="board-name">{spot.label}</span>
              <span className="board-count">{spot.count}</span>
              <button className="board-link" onClick={() => viewOnMap(spot.lat, spot.lng, 14)}>
                VIEW ON MAP ↗
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
