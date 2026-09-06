// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePhoto, getPhotos } from '../api/client'
import type { CranePhoto } from '../types'
import AdminPhotosPage from './AdminPhotosPage'

vi.mock('../api/client', () => ({
  deletePhoto: vi.fn(),
  getPhotos: vi.fn(),
}))

const firstPhoto: CranePhoto = {
  id: 'photo-1',
  craneId: 'crane-1',
  url: 'https://images.example.test/one.jpg',
  originalFilename: 'first-crane.jpg',
  contentType: 'image/jpeg',
  addedAt: '2026-08-20T18:10:00Z',
}

const secondPhoto: CranePhoto = {
  id: 'photo-2',
  craneId: 'crane-2',
  url: null,
  originalFilename: 'second-crane.heic',
  contentType: 'image/heic',
  addedAt: '2026-08-19T16:05:00Z',
}

let intersectionCallback: IntersectionObserverCallback | undefined

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '500px 0px'
  readonly scrollMargin = '0px'
  readonly thresholds = [0]

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback
  }

  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/photos']}>
      <AdminPhotosPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
  intersectionCallback = undefined
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.mocked(getPhotos).mockReset()
  vi.mocked(deletePhoto).mockReset()
})

describe('AdminPhotosPage', () => {
  it('renders moderation metadata and an unavailable-image placeholder', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto, secondPhoto], end: true })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'first-crane.jpg' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'second-crane.heic' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Image unavailable' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'View on map' })[0].getAttribute('href')).toBe(
      '/?crane=crane-1',
    )
    expect(screen.getByText('End of archive')).toBeTruthy()
  })

  it('loads the next page at the sentinel and deduplicates photo IDs', async () => {
    vi.mocked(getPhotos)
      .mockResolvedValueOnce({ photos: [firstPhoto], end: false })
      .mockResolvedValueOnce({ photos: [firstPhoto, secondPhoto], end: true })

    renderPage()
    await screen.findByRole('heading', { name: 'first-crane.jpg' })
    expect(intersectionCallback).toBeTypeOf('function')

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    await screen.findByRole('heading', { name: 'second-crane.heic' })
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
    expect(getPhotos).toHaveBeenNthCalledWith(
      2,
      { cursor: firstPhoto.id },
      expect.any(AbortSignal),
    )
    expect(screen.getByText('End of archive')).toBeTruthy()
  })

  it('requires confirmation and removes a photo only after deletion succeeds', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
    let finishDelete!: () => void
    vi.mocked(deletePhoto).mockReturnValue(
      new Promise<void>((resolve) => {
        finishDelete = resolve
      }),
    )

    renderPage()
    await screen.findByRole('heading', { name: 'first-crane.jpg' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/cannot be undone/i)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep photo' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(deletePhoto).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(screen.getByRole('heading', { name: 'first-crane.jpg' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Deleting…' }).hasAttribute('disabled')).toBe(true)

    await act(async () => finishDelete())

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'first-crane.jpg' })).toBeNull())
    expect(deletePhoto).toHaveBeenCalledWith(firstPhoto.craneId, firstPhoto.id)
  })

  it('keeps the card and presents the API error when deletion fails', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
    vi.mocked(deletePhoto).mockRejectedValue(new Error('Photo is still being processed'))

    renderPage()
    await screen.findByRole('heading', { name: 'first-crane.jpg' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Photo is still being processed')
    expect(screen.getByRole('heading', { name: 'first-crane.jpg' })).toBeTruthy()
  })

  it('offers a retry when the initial archive request fails', async () => {
    vi.mocked(getPhotos)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ photos: [], end: true })

    renderPage()

    expect(await screen.findByText('Service unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'No photos to review' })).toBeTruthy()
    expect(getPhotos).toHaveBeenCalledTimes(2)
  })
})
