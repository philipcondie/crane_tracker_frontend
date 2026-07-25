// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCrane } from '../api/client'
import type { CraneSummary } from '../types'
import { useCraneCreation } from './useCraneCreation'

vi.mock('../api/client', () => ({
  createCrane: vi.fn(),
}))

const input = { name: 'Tower', lat: 47.6, lng: -122.3, status: 'active' as const }
const crane: CraneSummary = {
  id: 'crane-1',
  name: 'Tower',
  status: 'active',
  city: 'Seattle',
  neighborhood: null,
  addedAt: '2026-07-23T12:00:00Z',
  lat: input.lat,
  lng: input.lng,
  photos: 0,
  contribs: 0,
}

afterEach(() => {
  vi.mocked(createCrane).mockReset()
})

describe('useCraneCreation', () => {
  it('coalesces same-frame submissions into one request', async () => {
    let resolve!: (value: CraneSummary) => void
    vi.mocked(createCrane).mockReturnValue(
      new Promise<CraneSummary>((done) => {
        resolve = done
      }),
    )
    const { result } = renderHook(() => useCraneCreation())

    let first!: Promise<CraneSummary | null>
    let second!: Promise<CraneSummary | null>
    act(() => {
      first = result.current.createOnce(input)
      second = result.current.createOnce(input)
    })

    expect(createCrane).toHaveBeenCalledTimes(1)
    await expect(second).resolves.toBeNull()

    await act(async () => resolve(crane))
    await expect(first).resolves.toEqual(crane)
    expect(result.current.creating).toBe(false)
  })

  it('re-enables creation after a failed request', async () => {
    vi.mocked(createCrane)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(crane)
    const { result } = renderHook(() => useCraneCreation())

    await act(async () => {
      await expect(result.current.createOnce(input)).rejects.toThrow('offline')
    })
    expect(result.current.creating).toBe(false)
    expect(result.current.isCreating()).toBe(false)

    await act(async () => {
      await expect(result.current.createOnce(input)).resolves.toEqual(crane)
    })
    expect(createCrane).toHaveBeenCalledTimes(2)
  })
})
