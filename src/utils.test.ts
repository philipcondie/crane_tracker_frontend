import { describe, expect, it } from 'vitest'
import {
  PHOTO_INPUT_MAX_BYTES,
  PHOTO_OUTPUT_MAX_BYTES,
  validatePhotoFile,
} from './utils'

describe('photo file validation', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ])('accepts %s for preprocessing', (type) => {
    expect(validatePhotoFile({ type, size: PHOTO_INPUT_MAX_BYTES })).toBeNull()
  })

  it('rejects unsupported MIME types', () => {
    expect(validatePhotoFile({ type: 'image/svg+xml', size: 1024 })).toBe(
      'unsupported-type',
    )
  })

  it('allows a supported input above 10 MB so preprocessing can reduce it', () => {
    expect(
      validatePhotoFile({ type: 'image/jpeg', size: PHOTO_OUTPUT_MAX_BYTES + 1 }),
    ).toBeNull()
  })

  it('rejects supported inputs larger than the 30 MB defensive limit', () => {
    expect(
      validatePhotoFile({ type: 'image/jpeg', size: PHOTO_INPUT_MAX_BYTES + 1 }),
    ).toBe(
      'input-too-large',
    )
  })
})
