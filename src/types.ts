export type CraneStatus = 'active' | 'gone'

/**
 * Lightweight shape for map pins, feed cards, and stats — every scalar field,
 * but none of the heavy per-crane arrays. This is what a viewport/list query
 * should return once there's a backend.
 */
export interface CraneSummary {
  id: number
  name: string
  status: CraneStatus
  city: string
  neighborhood?: string
  /** ISO date (YYYY-MM-DD) the crane was first logged */
  addedAt: string
  lat: number
  lng: number
  /** Reported photo count (seed data has no real images) */
  photos: number
  contribs: number
}

/**
 * Full record loaded when a single crane is opened — adds the arrays that are
 * wasteful to ship for every pin. Fetch this on selection, by id.
 */
export interface CraneDetail extends CraneSummary {
  /** Session-uploaded photos as data URLs */
  imgs: string[]
  links: string[]
}
