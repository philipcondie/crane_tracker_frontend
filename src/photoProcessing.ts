export const PHOTO_OUTPUT_MAX_BYTES = 10 * 1024 * 1024
export const PHOTO_INPUT_MAX_BYTES = 30 * 1024 * 1024
export const PHOTO_MAX_DIMENSION = 2560
export const PHOTO_WEBP_QUALITY = 0.82

export const PHOTO_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export type PhotoSelectionIssue =
  | 'unsupported-type'
  | 'input-too-large'
  | 'output-too-large'
  | 'too-many'
  | 'unreadable'

export class PhotoProcessingError extends Error {
  issue: PhotoSelectionIssue

  constructor(issue: PhotoSelectionIssue) {
    super(issue)
    this.name = 'PhotoProcessingError'
    this.issue = issue
  }
}

export function validatePhotoFile(
  file: Pick<File, 'size' | 'type'>,
): 'unsupported-type' | 'input-too-large' | null {
  if (!PHOTO_ALLOWED_MIME_TYPES.has(file.type)) return 'unsupported-type'
  if (file.size > PHOTO_INPUT_MAX_BYTES) return 'input-too-large'
  return null
}

function outputName(originalName: string, extension: 'webp' | 'jpg'): string {
  const base = originalName.replace(/\.[^.]*$/, '') || 'photo'
  return `${base}.${extension}`
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const quality of [PHOTO_WEBP_QUALITY, 0.72, 0.62]) {
    const blob = await canvasBlob(canvas, 'image/webp', quality)
    if (blob?.type === 'image/webp' && blob.size <= PHOTO_OUTPUT_MAX_BYTES) return blob
  }

  // JPEG is the compatibility fallback when a browser cannot encode WebP.
  const jpegCanvas = document.createElement('canvas')
  jpegCanvas.width = canvas.width
  jpegCanvas.height = canvas.height
  const context = jpegCanvas.getContext('2d')
  if (!context) throw new PhotoProcessingError('unreadable')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height)
  context.drawImage(canvas, 0, 0)
  for (const quality of [PHOTO_WEBP_QUALITY, 0.72, 0.62]) {
    const blob = await canvasBlob(jpegCanvas, 'image/jpeg', quality)
    if (blob?.type === 'image/jpeg' && blob.size <= PHOTO_OUTPUT_MAX_BYTES) return blob
  }
  throw new PhotoProcessingError('output-too-large')
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    const { heicTo } = await import('heic-to/csp')
    return heicTo({
      blob: file,
      type: 'bitmap',
      options: { imageOrientation: 'from-image' },
    })
  }
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

/**
 * Normalize a selected image for upload. Small browser-native photos remain
 * byte-for-byte unchanged; HEIC/HEIF and oversized dimensions are converted.
 */
export async function processPhotoFile(file: File): Promise<File> {
  const validationIssue = validatePhotoFile(file)
  if (validationIssue) throw new PhotoProcessingError(validationIssue)

  // Preserve GIF bytes and animation. Animated resizing requires a different
  // pipeline, so GIFs still have to fit the backend's final 10 MB limit.
  if (file.type === 'image/gif') {
    if (file.size > PHOTO_OUTPUT_MAX_BYTES) {
      throw new PhotoProcessingError('output-too-large')
    }
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await decodeBitmap(file)
  } catch {
    throw new PhotoProcessingError('unreadable')
  }

  try {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
    const needsResize =
      bitmap.width > PHOTO_MAX_DIMENSION || bitmap.height > PHOTO_MAX_DIMENSION
    if (!isHeic && !needsResize && file.size <= PHOTO_OUTPUT_MAX_BYTES) return file

    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoProcessingError('unreadable')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await encodeCanvas(canvas)
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], outputName(file.name, extension), {
      type: blob.type,
      lastModified: file.lastModified,
    })
  } finally {
    bitmap.close()
  }
}
