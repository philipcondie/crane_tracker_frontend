// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCranesInBounds, type Bounds } from '../api/client'
import type { CraneSummary } from '../types'
import { useCranesInBounds } from './useCranesInBounds'

vi.mock('../api/client', () => ({
  getCranesInBounds: vi.fn(),
}))

const oldBounds: Bounds = { north: 48, south: 47, east: -122, west: -123 }
const newBounds: Bounds = { north: 49, south: 48, east: -121, west: -122 }

function summary(id: string): CraneSummary {
  return {
    id,
    name: id,
    status: 'active',
    city: null,
    neighborhood: null,
    addedAt: '2026-07-23T12:00:00Z',
    lat: 47.6,
    lng: -122.3,
    photos: 0,
    contribs: 0,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(getCranesInBounds).mockReset()
})

describe('useCranesInBounds', () => {
  it('aborts an older viewport request and keeps the newest result', async () => {
    vi.useFakeTimers()
    const pending: Array<{
      bounds: Bounds
      resolve: (value: { cranes: CraneSummary[]; truncated: boolean }) => void
    }> = []
    vi.mocked(getCranesInBounds).mockImplementation(
      (bounds, signal) =>
        new Promise((resolve, reject) => {
          pending.push({ bounds, resolve })
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const { result, rerender, unmount } = renderHook(
      ({ bounds }) => useCranesInBounds(bounds),
      { initialProps: { bounds: oldBounds } },
    )

    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(pending).toHaveLength(1)
    expect(pending[0].bounds).toEqual(oldBounds)

    rerender({ bounds: newBounds })
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(pending).toHaveLength(2)
    expect(pending[1].bounds).toEqual(newBounds)

    await act(async () => {
      pending[1].resolve({ cranes: [summary('new')], truncated: false })
      await Promise.resolve()
    })

    expect(result.current.cranes.map((crane) => crane.id)).toEqual(['new'])
    expect(result.current.error).toBeNull()
    unmount()
  })
})
