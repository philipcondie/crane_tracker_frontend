import type { CraneDetail, CraneStatus, CraneSummary } from '../types'

const CONFIGURED_BASE_URL = import.meta.env.VITE_API_URL

export function normalizeApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error('VITE_API_URL is not configured')
  }
  return trimmed.replace(/\/+$/, '')
}

function apiUrl(path: `/${string}`): string {
  return `${normalizeApiBaseUrl(CONFIGURED_BASE_URL)}${path}`
}

type ApiCraneStatus = 'active' | 'inactive'

interface ApiCraneSummary {
  id: string
  projectName: string | null
  status: ApiCraneStatus
  city: string | null
  neighborhood: string | null
  addedAt: string
  lat: number
  lng: number
  photos: number
  contribs: number
}

interface ApiCraneDetail extends ApiCraneSummary {
  imgs: string[]
  links: string[]
}

interface ApiCranesInBoundsResponse {
  cranes: ApiCraneSummary[]
  truncated: boolean
}

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
  /**
   * Set once the user has seen and dismissed a possible-duplicate warning, to
   * tell the backend to create the crane anyway. Absent/false on the first
   * attempt, which is what lets the backend answer with a 409 (see
   * DuplicateCraneError).
   */
  overrideDuplicateWarning?: boolean
}

/** Raw JSON body the create endpoint expects. */
interface CraneCreateBody {
  lat: number
  lng: number
  projectName: string | null
  overrideDuplicateWarning: boolean
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

/**
 * The backend answered a create with 409: it thinks this crane may duplicate an
 * existing one. Not a failure — a checkpoint. The user can re-submit with
 * `overrideDuplicateWarning: true` to create it anyway. Modelled as its own type
 * so callers branch on it structurally instead of sniffing status codes.
 */
export class DuplicateCraneError extends ApiError {
  constructor(message: string) {
    super(409, message)
    this.name = 'DuplicateCraneError'
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  return res.json() as Promise<T>
}

function fromApiStatus(status: ApiCraneStatus): CraneStatus {
  return status === 'active' ? 'active' : 'gone'
}

/** Translate the backend's public wire shape into the UI's domain language. */
function fromApiCraneSummary(crane: ApiCraneSummary): CraneSummary {
  const { projectName, status, ...rest } = crane
  return {
    ...rest,
    name: projectName?.trim() || 'Unnamed crane',
    status: fromApiStatus(status),
  }
}

function fromApiCraneDetail(crane: ApiCraneDetail): CraneDetail {
  const { imgs, links, ...summary } = crane
  return { ...fromApiCraneSummary(summary), imgs, links }
}

/**
 * POST /cranes — create a crane, returns its summary. A 409 means the backend
 * suspects a duplicate; it surfaces as DuplicateCraneError so the caller can
 * confirm with the user and retry with `overrideDuplicateWarning: true`.
 */
export async function createCrane(input: NewCraneInput): Promise<CraneSummary> {
  const body: CraneCreateBody = {
    lat: input.lat,
    lng: input.lng,
    projectName: input.name.trim() || null,
    overrideDuplicateWarning: input.overrideDuplicateWarning ?? false,
  }
  const res = await fetch(apiUrl('/cranes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 409) {
    const msg = await res.text().catch(() => '')
    throw new DuplicateCraneError(msg || 'This looks like it may already be on the map.')
  }
  return fromApiCraneSummary(await parse<ApiCraneSummary>(res))
}

/**
 * POST /cranes/{id}/report — cast a "this crane is gone" report. A report is a
 * vote, not a state change: the backend tallies reports across users and only
 * flips the crane's status once enough have come in, so this returns nothing
 * (204) and callers must not assume the crane is now gone. Refetch to learn the
 * current status.
 */
export async function reportCraneGone(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/cranes/${encodeURIComponent(id)}/report`), {
    method: 'POST',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
}

/** GET /cranes/{id} — full detail for a single crane. */
export async function getCrane(id: string, signal?: AbortSignal): Promise<CraneDetail> {
  const res = await fetch(apiUrl(`/cranes/${encodeURIComponent(id)}`), { signal })
  return fromApiCraneDetail(await parse<ApiCraneDetail>(res))
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
  const res = await fetch(apiUrl(`/cranes?${q}`), { signal })
  const data = await parse<ApiCranesInBoundsResponse>(res)
  return { cranes: data.cranes.map(fromApiCraneSummary), truncated: data.truncated }
}
