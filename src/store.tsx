import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { CraneDetail, CraneSummary } from './types'
import { seedCranes } from './data/seed'
import { todayISO } from './utils'

export interface NewCraneInput {
  name: string
  note: string
  lat: number
  lng: number
  imgs: string[]
}

interface CraneStore {
  cranes: CraneDetail[]
  addCrane: (input: NewCraneInput) => CraneDetail
  reportGone: (id: number) => void
  contribute: (id: number, imgs: string[], link?: string) => void
}

const Ctx = createContext<CraneStore | null>(null)

// Only needs scalar location fields — a summary is enough.
function nearestCity(lat: number, lng: number, cranes: CraneSummary[]): string {
  let best: CraneSummary | null = null
  let bd = Infinity
  for (const c of cranes) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2
    if (d < bd) {
      bd = d
      best = c
    }
  }
  // ~0.5° away from every known crane means we can't guess the city
  return best && bd < 0.25 ? best.city : 'Uncharted'
}

export function CraneProvider({ children }: { children: ReactNode }) {
  const [cranes, setCranes] = useState<CraneDetail[]>(seedCranes)

  const addCrane = useCallback((input: NewCraneInput): CraneDetail => {
    const crane: CraneDetail = {
      id: Math.max(...cranes.map((c) => c.id)) + 1,
      name: input.name.trim() || 'Unnamed crane',
      status: 'active',
      city: nearestCity(input.lat, input.lng, cranes),
      addedAt: todayISO(),
      lat: input.lat,
      lng: input.lng,
      photos: input.imgs.length,
      contribs: 1,
      imgs: input.imgs,
      links: /^https?:\/\//.test(input.note.trim()) ? [input.note.trim()] : [],
    }
    setCranes((prev) => [...prev, crane])
    return crane
  }, [cranes])

  const reportGone = useCallback((id: number) => {
    setCranes((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'gone' } : c)))
  }, [])

  const contribute = useCallback((id: number, imgs: string[], link?: string) => {
    setCranes((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              imgs: [...c.imgs, ...imgs],
              photos: c.photos + imgs.length,
              contribs: c.contribs + 1,
              links: link && /^https?:\/\//.test(link) ? [...c.links, link] : c.links,
            }
          : c,
      ),
    )
  }, [])

  const store = useMemo(
    () => ({ cranes, addCrane, reportGone, contribute }),
    [cranes, addCrane, reportGone, contribute],
  )
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useCranes(): CraneStore {
  const store = useContext(Ctx)
  if (!store) throw new Error('useCranes must be used within CraneProvider')
  return store
}
