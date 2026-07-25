import { describe, expect, it } from 'vitest'
import { withoutCraneParam } from './searchParams'

describe('withoutCraneParam', () => {
  it('clears a failed crane deep link without discarding unrelated parameters', () => {
    const current = new URLSearchParams('crane=missing&lat=47.6&z=13')

    const result = withoutCraneParam(current)

    expect(result.toString()).toBe('lat=47.6&z=13')
    expect(current.get('crane')).toBe('missing')
  })
})
