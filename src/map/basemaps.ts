const CARTO_LIGHT_RASTER_URL =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Build CARTO's browser-facing raster URL without ever hard-coding the project key. */
export function cartoRasterTileUrl(value: string | undefined): string {
  const key = value?.trim()
  if (!key) throw new Error('VITE_CARTO_BASEMAP_KEY is not configured')
  return `${CARTO_LIGHT_RASTER_URL}?key=${encodeURIComponent(key)}`
}
