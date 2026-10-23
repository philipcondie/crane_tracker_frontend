// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, adminLogin, adminLogout, deletePhoto, getPhotos } from '../api/client'
import type { CranePhoto } from '../types'
import AdminPhotosPage from './AdminPhotosPage'

vi.mock('../api/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/client')>(),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
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

async function renderPage(signIn = true) {
  const result = render(
    <MemoryRouter initialEntries={['/admin/photos']}>
      <AdminPhotosPage />
    </MemoryRouter>,
  )
  if (signIn) {
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy())
  }
  return result
}

beforeEach(() => {
  vi.mocked(adminLogin).mockReset().mockResolvedValue({ access_token: 'token', token_type: 'bearer', expires_in: 3600 })
  vi.mocked(adminLogout).mockReset().mockResolvedValue(undefined)
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

    await renderPage()

    expect(await screen.findByRole('heading', { name: 'first-crane.jpg' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'second-crane.heic' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Image unavailable' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'View on map' })[0].getAttribute('href')).toBe(
      '/?crane=crane-1',
    )
    expect(screen.getByText('End of archive')).toBeTruthy()
  })

  it('loads the next page on demand and deduplicates photo IDs', async () => {
    vi.mocked(getPhotos)
      .mockResolvedValueOnce({ photos: [firstPhoto], end: false })
      .mockResolvedValueOnce({ photos: [firstPhoto, secondPhoto], end: true })

    await renderPage()
    await screen.findByRole('heading', { name: 'first-crane.jpg' })
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await screen.findByRole('heading', { name: 'second-crane.heic' })
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
    expect(getPhotos).toHaveBeenNthCalledWith(
      2,
      'token',
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

    await renderPage()
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
    expect(screen.getByRole('button', { name: 'Close delete confirmation' }).hasAttribute('disabled')).toBe(true)

    await act(async () => finishDelete())

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'first-crane.jpg' })).toBeNull())
    expect(deletePhoto).toHaveBeenCalledWith('token', firstPhoto.craneId, firstPhoto.id)
  })

  it('keeps the card and presents the API error when deletion fails', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
    vi.mocked(deletePhoto).mockRejectedValue(new Error('Photo is still being processed'))

    await renderPage()
    await screen.findByRole('heading', { name: 'first-crane.jpg' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The photo could not be deleted')
    expect(screen.getByRole('heading', { name: 'first-crane.jpg' })).toBeTruthy()
  })

  it('offers a retry when the initial archive request fails', async () => {
    vi.mocked(getPhotos)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ photos: [], end: true })

    await renderPage()

    expect(await screen.findByText('Could not load the photo archive.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'No photos to review' })).toBeTruthy()
    expect(getPhotos).toHaveBeenCalledTimes(2)
  })
})

describe('admin authentication', () => {
  it('gates the feed and handles invalid credentials and rate limiting', async () => {
    vi.mocked(adminLogin).mockRejectedValueOnce(new ApiError(401, 'bad')).mockRejectedValueOnce(new ApiError(429, 'slow'))
    await renderPage(false)
    expect(getPhotos).not.toHaveBeenCalled()
    for (const message of ['Invalid username or password.', 'Too many requests. Please wait and try again.']) {
      fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByText(message)).toBeTruthy()
    }
  })
  it('returns to sign-in when the protected feed expires', async () => {
    vi.mocked(getPhotos).mockRejectedValue(new ApiError(401, 'expired'))
    await renderPage(false)
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeTruthy()
  })
  it('clears authentication even if logout fails', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [], end: true })
    vi.mocked(adminLogout).mockRejectedValue(new Error('offline'))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('heading', { name: 'Admin sign-in' })).toBeTruthy()
    expect(adminLogout).toHaveBeenCalledWith('token')
  })
  it('removes a stale photo after a 404', async () => {
    vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
    vi.mocked(deletePhoto).mockRejectedValue(new ApiError(404, 'gone'))
    await renderPage()
    await screen.findByRole('heading', { name: firstPhoto.originalFilename })
    fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    expect(within(screen.getByRole('alertdialog')).getByRole('img').getAttribute('src')).toBe(firstPhoto.url)
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(await screen.findByText(/That photo is no longer available/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: firstPhoto.originalFilename })).toBeNull()
  })
})

it('prevents overlapping pagination and expires the session on later pages', async () => {
  let rejectPage!: (reason: unknown) => void
  vi.mocked(getPhotos).mockResolvedValueOnce({ photos: [firstPhoto], end: false }).mockReturnValueOnce(new Promise((_, reject) => { rejectPage = reject }))
  await renderPage()
  await screen.findByRole('heading', { name: firstPhoto.originalFilename })
  const more = screen.getByRole('button', { name: 'Load more' })
  fireEvent.click(more); fireEvent.click(more)
  expect(getPhotos).toHaveBeenCalledTimes(2)
  await act(async () => rejectPage(new ApiError(401, 'expired')))
  expect(await screen.findByRole('heading', { name: 'Admin sign-in' })).toBeTruthy()
})

it('opens a keyboard accessible preview and restores focus on Escape', async () => {
  vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
  await renderPage()
  const trigger = await screen.findByRole('button', { name: `Preview ${firstPhoto.originalFilename}` })
  trigger.focus(); fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('img').getAttribute('src')).toBe(firstPhoto.url)
  const close = within(dialog).getByRole('button', { name: 'Close preview' })
  expect(document.activeElement).toBe(close)
  fireEvent.keyDown(close, { key: 'Tab' })
  expect(document.activeElement).toBe(close)
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('expires authentication when deletion returns 401', async () => {
  vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
  vi.mocked(deletePhoto).mockRejectedValue(new ApiError(401, 'expired'))
  await renderPage()
  await screen.findByRole('heading', { name: firstPhoto.originalFilename })
  fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
  expect(await screen.findByText('Your session expired. Please sign in again.')).toBeTruthy()
})

it('can load older photos after deleting the entire loaded page', async () => {
  vi.mocked(getPhotos)
    .mockResolvedValueOnce({ photos: [firstPhoto], end: false })
    .mockResolvedValueOnce({ photos: [secondPhoto], end: true })
  vi.mocked(deletePhoto).mockResolvedValue(undefined)
  await renderPage()
  await screen.findByRole('heading', { name: firstPhoto.originalFilename })
  fireEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(await screen.findByRole('heading', { name: secondPhoto.originalFilename })).toBeTruthy()
  expect(getPhotos).toHaveBeenLastCalledWith('token', { cursor: firstPhoto.id }, expect.any(AbortSignal))
})

it('closes both photo dialogs with their labeled × buttons', async () => {
  vi.mocked(getPhotos).mockResolvedValue({ photos: [firstPhoto], end: true })
  await renderPage()
  const preview = await screen.findByRole('button', { name: `Preview ${firstPhoto.originalFilename}` })
  preview.focus()
  fireEvent.click(preview)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close preview' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(preview)

  const remove = screen.getByRole('button', { name: 'Delete photo' })
  remove.focus()
  fireEvent.click(remove)
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close delete confirmation' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(document.activeElement).toBe(remove)
  expect(deletePhoto).not.toHaveBeenCalled()
})
