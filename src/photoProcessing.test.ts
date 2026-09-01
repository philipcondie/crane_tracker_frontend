// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const { heicToMock } = vi.hoisted(() => ({ heicToMock: vi.fn() }))
vi.mock('heic-to/csp', () => ({ heicTo: heicToMock }))

import {
  PHOTO_OUTPUT_MAX_BYTES,
  PhotoProcessingError,
  processPhotoFile,
} from './photoProcessing'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  heicToMock.mockReset()
})

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

function mockCanvasEncoding() {
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback, type) => callback(new Blob(['compressed'], { type: type ?? 'image/png' })),
  )
  return context
}

describe('photo preprocessing', () => {
  it('keeps a small browser-native image byte-for-byte unchanged', async () => {
    const decoded = bitmap(1200, 800)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(decoded))
    const file = new File(['photo'], 'site.jpg', { type: 'image/jpeg' })

    await expect(processPhotoFile(file)).resolves.toBe(file)
    expect(decoded.close).toHaveBeenCalledOnce()
  })

  it('resizes oversized dimensions and produces a WebP upload file', async () => {
    const decoded = bitmap(4000, 2000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(decoded))
    const context = mockCanvasEncoding()
    const file = new File(['photo'], 'site.jpg', { type: 'image/jpeg' })

    const processed = await processPhotoFile(file)

    expect(processed).not.toBe(file)
    expect(processed.name).toBe('site.webp')
    expect(processed.type).toBe('image/webp')
    expect(context.drawImage).toHaveBeenCalledWith(decoded, 0, 0, 2560, 1280)
  })

  it('uses the lazy HEIC decoder before encoding to WebP', async () => {
    const decoded = bitmap(1200, 800)
    heicToMock.mockResolvedValue(decoded)
    mockCanvasEncoding()
    const file = new File(['photo'], 'iphone.heic', { type: 'image/heic' })

    const processed = await processPhotoFile(file)

    expect(heicToMock).toHaveBeenCalledWith({
      blob: file,
      type: 'bitmap',
      options: { imageOrientation: 'from-image' },
    })
    expect(processed.name).toBe('iphone.webp')
    expect(processed.type).toBe('image/webp')
  })

  it('preserves GIFs and rejects one that still exceeds 10 MB', async () => {
    const small = new File(['gif'], 'animation.gif', { type: 'image/gif' })
    await expect(processPhotoFile(small)).resolves.toBe(small)

    const large = new File(
      [new Uint8Array(PHOTO_OUTPUT_MAX_BYTES + 1)],
      'animation.gif',
      { type: 'image/gif' },
    )
    const error = await processPhotoFile(large).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PhotoProcessingError)
    expect(error).toMatchObject({ issue: 'output-too-large' })
  })
})
