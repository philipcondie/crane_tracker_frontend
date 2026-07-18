const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
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

/** Read up to `max` images from a file input as data URLs (session-only storage). */
export function readFilesAsDataUrls(fileList: FileList | null, max: number, cb: (urls: string[]) => void): void {
  const files = Array.from(fileList ?? []).slice(0, max)
  if (!files.length) {
    cb([])
    return
  }
  const out: (string | null)[] = new Array(files.length).fill(null)
  let left = files.length
  files.forEach((file, i) => {
    const reader = new FileReader()
    const done = () => {
      if (--left === 0) cb(out.filter((u): u is string => Boolean(u)))
    }
    reader.onload = () => {
      out[i] = typeof reader.result === 'string' ? reader.result : null
      done()
    }
    reader.onerror = done
    reader.readAsDataURL(file)
  })
}
