import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  DuplicateCraneError,
  createCrane,
  getCrane,
  getCranesInBounds,
  normalizeApiBaseUrl,
  reportCraneGone,
  uploadCranePhoto,
} from './client'

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

const apiPhoto = {
  id: 'photo-uuid',
  craneId: apiSummary.id,
  url: 'https://photos.example/site.jpg',
  originalFilename: 'site.jpg',
  contentType: 'image/jpeg',
  addedAt: '2026-07-29T17:59:00Z',
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
        new Response(
          JSON.stringify({
            ...apiSummary,
            projectName: null,
            photoItems: [apiPhoto],
            links: [],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(getCrane(apiSummary.id)).resolves.toMatchObject({
      name: 'Unnamed crane',
      status: 'gone',
      imgs: [apiPhoto.url],
      photoItems: [apiPhoto],
      links: [],
    })
  })

  it('derives display image URLs from photoItems in the backend detail response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...apiSummary,
            photoItems: [apiPhoto, { ...apiPhoto, id: 'pending-photo', url: null }],
            links: [],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(getCrane(apiSummary.id)).resolves.toMatchObject({
      imgs: [apiPhoto.url],
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
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      lat: apiSummary.lat,
      lng: apiSummary.lng,
      projectName: 'Harbor Tower',
      overrideDuplicateWarning: false,
    })
  })

  it('raises DuplicateCraneError on a 409 so callers can offer "add anyway"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('A crane already exists nearby', { status: 409 })),
    )

    const err = await createCrane({ name: 'Dup Tower', lat: 47.6, lng: -122.3 }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(DuplicateCraneError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, message: 'A crane already exists nearby' })
  })

  it('forwards overrideDuplicateWarning so a confirmed create bypasses the check', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...apiSummary, projectName: 'Dup Tower' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createCrane({
      name: 'Dup Tower',
      lat: apiSummary.lat,
      lng: apiSummary.lng,
      overrideDuplicateWarning: true,
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({ overrideDuplicateWarning: true })
  })

  it('POSTs a gone report to the crane report endpoint and tolerates a 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(reportCraneGone(apiSummary.id)).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(new RegExp(`/cranes/${apiSummary.id}/report$`))
    expect(init?.method).toBe('POST')
  })

  it('throws ApiError when a gone report is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('crane not found', { status: 404 })),
    )

    const err = await reportCraneGone(apiSummary.id).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 404, message: 'crane not found' })
  })

  it('uploads one photo as multipart form data without setting Content-Type', async () => {
    const metadata = {
      id: 'photo-id',
      craneId: apiSummary.id,
      url: 'https://images.example.test/site.jpg',
      originalFilename: 'site.jpg',
      contentType: 'image/jpeg',
      addedAt: '2026-07-29T17:59:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(metadata), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['photo bytes'], 'site.jpg', { type: 'image/jpeg' })

    await expect(uploadCranePhoto(apiSummary.id, file)).resolves.toEqual(metadata)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(new RegExp(`/cranes/${apiSummary.id}/photos$`))
    expect(init?.method).toBe('POST')
    expect(init?.headers).toBeUndefined()
    expect(init?.body).toBeInstanceOf(FormData)
    const body = init?.body
    if (!(body instanceof FormData)) throw new Error('Expected a FormData request body')
    expect(body.get('photo')).toBe(file)
  })

  it('surfaces photo upload status errors through ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('photo exceeds 10 MB', { status: 413 })),
    )
    const file = new File(['photo bytes'], 'large.jpg', { type: 'image/jpeg' })

    const err = await uploadCranePhoto(apiSummary.id, file).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 413, message: 'photo exceeds 10 MB' })
  })
})
