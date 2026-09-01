import { describe, expect, it } from 'vitest'
import { CARTO_ATTRIBUTION, cartoRasterTileUrl } from './basemaps'

describe('CARTO basemap configuration', () => {
  it('trims and URL-encodes the configured key', () => {
    expect(cartoRasterTileUrl(' key/with spaces+symbols ')).toBe(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' +
        '?key=key%2Fwith%20spaces%2Bsymbols',
    )
  })

  it('rejects missing configuration', () => {
    expect(() => cartoRasterTileUrl(undefined)).toThrow(
      'VITE_CARTO_BASEMAP_KEY is not configured',
    )
    expect(() => cartoRasterTileUrl('   ')).toThrow(
      'VITE_CARTO_BASEMAP_KEY is not configured',
    )
  })

  it('keeps the required OpenStreetMap and CARTO attribution links', () => {
    expect(CARTO_ATTRIBUTION).toContain('openstreetmap.org/copyright')
    expect(CARTO_ATTRIBUTION).toContain('carto.com/attributions')
  })
})
