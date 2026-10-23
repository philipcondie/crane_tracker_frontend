export type CraneStatus = 'active' | 'gone'

export interface CranePhoto {
  id: string
  craneId: string
  url: string | null
  originalFilename: string
  contentType: string
  addedAt: string
}

/**
 * Lightweight shape for map pins, feed cards, and stats — every scalar field,
 * but none of the heavy per-crane arrays. This is what a viewport/list query
 * should return once there's a backend.
 */
export interface CraneSummary {
  id: string
  name: string
  status: CraneStatus
  /** Null when geocoding fails or returns a partial address; never omitted. */
  city: string | null
  neighborhood: string | null
  /** ISO timestamp the crane was first logged; displayed as date-only. */
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
  /** Public photo URLs returned by the API. */
  imgs: string[]
  /** Full metadata for the same photos, in backend response order. */
  photoItems: CranePhoto[]
  links: string[]
}

/** A browser-selected photo plus its data URL used for the staged preview. */
export interface PhotoDraft {
  file: File
  previewUrl: string
}
