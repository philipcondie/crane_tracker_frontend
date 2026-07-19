import type { CraneDetail, CraneStatus, CraneSummary } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL

/** Geographic query window. north > south, east > west. */
export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

/** What the app hands us to create a crane. `name` maps to the API's `projectName`. */
export interface NewCraneInput {
  name: string
  lat: number
  lng: number
  status: CraneStatus
}

/** Raw JSON body the create endpoint expects. */
interface CraneCreateBody {
  lat: number
  lng: number
  projectName: string | null
  status: CraneStatus
}

/** Thrown on any non-2xx response so callers can distinguish API failures from network errors. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  return res.json() as Promise<T>
}

/** POST /cranes — create a crane, returns its summary. */
export async function createCrane(input: NewCraneInput): Promise<CraneSummary> {
  const body: CraneCreateBody = {
    lat: input.lat,
    lng: input.lng,
    projectName: input.name.trim() || null,
    status: input.status,
  }
  const res = await fetch(`${BASE_URL}/cranes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parse<CraneSummary>(res)
}

/** GET /cranes/{id} — full detail for a single crane. */
export async function getCrane(id: string, signal?: AbortSignal): Promise<CraneDetail> {
  const res = await fetch(`${BASE_URL}/cranes/${encodeURIComponent(id)}`, { signal })
  return parse<CraneDetail>(res)
}

/**
 * Response envelope for a bounds query. The server caps how many cranes it will
 * return for one viewport, so a zoomed-out query can come back incomplete —
 * `truncated` is how it says so, and the only signal the client gets.
 */
export interface CranesInBoundsResponse {
  cranes: CraneSummary[]
  truncated: boolean
}

/** GET /cranes?north&south&east&west — summaries within a viewport. */
export async function getCranesInBounds(
  bounds: Bounds,
  signal?: AbortSignal,
): Promise<CranesInBoundsResponse> {
  const q = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
  })
  const res = await fetch(`${BASE_URL}/cranes?${q}`, { signal })
  return parse<CranesInBoundsResponse>(res)
}
