import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCrane, getCrane, getCranesInBounds, normalizeApiBaseUrl } from './client'

const apiSummary = {
  id: '019f6854-fcc3-7831-b1ee-d642e12732cc',
  projectName: 'Harbor Tower',
  status: 'inactive',
  city: 'Seattle',
  neighborhood: 'Belltown',
  addedAt: '2026-07-23T12:00:00Z',
  lat: 47.61,
  lng: -122.34,
  photos: 2,
  contribs: 3,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('crane API contract adapter', () => {
  it('normalizes configured API base URLs and rejects missing configuration', () => {
    expect(normalizeApiBaseUrl(' https://api.example.test/// ')).toBe(
      'https://api.example.test',
    )
    expect(normalizeApiBaseUrl('/')).toBe('')
    expect(() => normalizeApiBaseUrl(undefined)).toThrow('VITE_API_URL is not configured')
    expect(() => normalizeApiBaseUrl('   ')).toThrow('VITE_API_URL is not configured')
  })

  it('normalizes backend list fields and statuses for the UI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ cranes: [apiSummary], truncated: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const result = await getCranesInBounds({ north: 48, south: 47, east: -122, west: -123 })

    expect(result).toEqual({
      cranes: [
        {
          id: apiSummary.id,
          name: 'Harbor Tower',
          status: 'gone',
          city: 'Seattle',
          neighborhood: 'Belltown',
          addedAt: '2026-07-23T12:00:00Z',
          lat: 47.61,
          lng: -122.34,
          photos: 2,
          contribs: 3,
        },
      ],
      truncated: true,
    })
  })

  it('uses a stable display name for a nullable projectName', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...apiSummary, projectName: null, imgs: [], links: [] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(getCrane(apiSummary.id)).resolves.toMatchObject({
      name: 'Unnamed crane',
      status: 'gone',
      imgs: [],
      links: [],
    })
  })

  it('translates UI fields back to the backend create contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...apiSummary, projectName: 'Harbor Tower' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createCrane({
      name: '  Harbor Tower  ',
      lat: apiSummary.lat,
      lng: apiSummary.lng,
      status: 'gone',
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      lat: apiSummary.lat,
      lng: apiSummary.lng,
      projectName: 'Harbor Tower',
      status: 'inactive',
    })
  })
})
