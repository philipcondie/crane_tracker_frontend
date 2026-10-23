import type { PhotoDraft } from './types'
import {
  PhotoProcessingError,
  processPhotoFile,
  validatePhotoFile,
  type PhotoSelectionIssue,
} from './photoProcessing'

export {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_INPUT_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_OUTPUT_MAX_BYTES,
  PHOTO_WEBP_QUALITY,
  validatePhotoFile,
  type PhotoSelectionIssue,
} from './photoProcessing'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
}

/**
 * Join city and neighborhood for display. The API returns explicit null for
 * either field when geocoding fails or returns a partial address, so all four
 * combinations are routine. Returns null when there's nothing to show, letting
 * each caller decide between a placeholder and dropping the row.
 */
export function fmtArea(city: string | null, neighborhood: string | null): string | null {
  const parts = [city, neighborhood].filter((p): p is string => Boolean(p?.trim()))
  return parts.length ? parts.join(' · ') : null
}

/**
 * Parse an ISO string that may be date-only (YYYY-MM-DD) or a full timestamp.
 * A bare date is anchored at local noon so day-boundary math stays stable across
 * timezones; a full timestamp is parsed as-is.
 */
function parseISO(iso: string): Date {
  return new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
}

/** Date-only display, e.g. "Jun 1, 2026" — drops any time component. */
export function fmtDate(iso: string): string {
  const d = parseISO(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function relDate(iso: string): string {
  const then = parseISO(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - parseISO(iso).getTime()) / 86400000)
}

/** Keep the selected files for upload and read data URLs for their staged previews. */
export function readFilesAsPhotoDrafts(
  fileList: FileList | null,
  max: number,
  cb: (drafts: PhotoDraft[]) => void,
  onIssues?: (issues: PhotoSelectionIssue[]) => void,
  onProcessing?: (processing: boolean) => void,
): void {
  const issues = new Set<PhotoSelectionIssue>()
  const eligible = Array.from(fileList ?? []).filter((file) => {
    const issue = validatePhotoFile(file)
    if (issue) issues.add(issue)
    return issue == null
  })
  if (eligible.length > max) issues.add('too-many')
  onIssues?.([...issues])

  const files = eligible.slice(0, max)
  if (!files.length) {
    cb([])
    return
  }

  const readPreview = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('FileReader returned no preview'))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  onProcessing?.(true)
  void (async () => {
    const drafts: PhotoDraft[] = []
    for (const file of files) {
      try {
        const processed = await processPhotoFile(file)
        drafts.push({ file: processed, previewUrl: await readPreview(processed) })
      } catch (error) {
        issues.add(
          error instanceof PhotoProcessingError ? error.issue : 'unreadable',
        )
      }
    }
    onIssues?.([...issues])
    cb(drafts)
    onProcessing?.(false)
  })()
}
