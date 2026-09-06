import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePhoto, getPhotos } from '../api/client'
import type { CranePhoto } from '../types'

type LoadState = 'initial' | 'ready' | 'loading-more' | 'error'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatUploadedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

interface PhotoCardProps {
  photo: CranePhoto
  onDelete: (photo: CranePhoto) => void
}

function PhotoCard({ photo, onDelete }: PhotoCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(photo.url) && !imageFailed

  return (
    <article className="admin-photo-card">
      <div className={hasImage ? 'admin-photo-frame' : 'admin-photo-frame unavailable'}>
        {hasImage ? (
          <img
            src={photo.url ?? undefined}
            alt={photo.originalFilename || 'Uploaded crane photo'}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="admin-photo-missing" role="img" aria-label="Image unavailable">
            <span aria-hidden="true">△</span>
            Image unavailable
          </div>
        )}
        <span className="admin-photo-date">{formatUploadedAt(photo.addedAt)}</span>
      </div>

      <div className="admin-photo-info">
        <h2 title={photo.originalFilename}>{photo.originalFilename || 'Untitled upload'}</h2>
        <dl>
          <div>
            <dt>Crane</dt>
            <dd title={photo.craneId}>{photo.craneId}</dd>
          </div>
          <div>
            <dt>File type</dt>
            <dd>{photo.contentType || 'Unknown'}</dd>
          </div>
        </dl>
        <div className="admin-photo-actions">
          <Link to={`/?crane=${encodeURIComponent(photo.craneId)}`}>View on map</Link>
          <button type="button" onClick={() => onDelete(photo)}>
            Delete photo
          </button>
        </div>
      </div>
    </article>
  )
}

interface DeleteDialogProps {
  photo: CranePhoto
  deleting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

function DeleteDialog({ photo, deleting, error, onCancel, onConfirm }: DeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [deleting, onCancel])

  return (
    <div className="admin-dialog-scrim" onMouseDown={deleting ? undefined : onCancel}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-photo-title"
        aria-describedby="delete-photo-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-dialog-mark" aria-hidden="true">×</div>
        <div>
          <h2 id="delete-photo-title">Delete this photo?</h2>
          <p id="delete-photo-description">
            <strong>{photo.originalFilename || 'This upload'}</strong> will be permanently removed.
            This cannot be undone.
          </p>
          {error && <p className="admin-dialog-error" role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={deleting}>
              Keep photo
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="btn btn-danger admin-confirm-delete"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<CranePhoto[]>([])
  const [end, setEnd] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('initial')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<CranePhoto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const cursorRef = useRef<string | undefined>(undefined)
  const loadingRef = useRef(false)
  const pageControllerRef = useRef<AbortController | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadingRef.current = true
    cursorRef.current = undefined
    setPhotos([])
    setEnd(false)
    setLoadError(null)
    setLoadState('initial')

    void getPhotos({}, controller.signal)
      .then((result) => {
        cursorRef.current = result.photos.at(-1)?.id
        setPhotos(result.photos)
        setEnd(result.end || result.photos.length === 0)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(errorMessage(error, 'Could not load the photo archive.'))
        setLoadState('error')
      })
      .finally(() => {
        if (!controller.signal.aborted) loadingRef.current = false
      })

    return () => {
      controller.abort()
      loadingRef.current = false
    }
  }, [reloadKey])

  useEffect(() => () => pageControllerRef.current?.abort(), [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || end || !cursorRef.current) return
    const controller = new AbortController()
    pageControllerRef.current = controller
    loadingRef.current = true
    setLoadError(null)
    setLoadState('loading-more')

    try {
      const result = await getPhotos({ cursor: cursorRef.current }, controller.signal)
      cursorRef.current = result.photos.at(-1)?.id ?? cursorRef.current
      setPhotos((current) => {
        const known = new Set(current.map((photo) => photo.id))
        return [...current, ...result.photos.filter((photo) => !known.has(photo.id))]
      })
      setEnd(result.end || result.photos.length === 0)
      setLoadState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setLoadError(errorMessage(error, 'Could not load more photos.'))
      setLoadState('error')
    } finally {
      if (pageControllerRef.current === controller) {
        pageControllerRef.current = null
        loadingRef.current = false
      }
    }
  }, [end])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || end || loadState !== 'ready') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: '500px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [end, loadMore, loadState])

  const requestDelete = (photo: CranePhoto) => {
    setDeleteError(null)
    setPendingDelete(photo)
  }

  const closeDelete = useCallback(() => {
    if (deleting) return
    setPendingDelete(null)
    setDeleteError(null)
  }, [deleting])

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePhoto(pendingDelete.craneId, pendingDelete.id)
      setPhotos((current) => current.filter((photo) => photo.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(errorMessage(error, 'The photo could not be deleted. Try again.'))
    } finally {
      setDeleting(false)
    }
  }

  const initialError = loadState === 'error' && photos.length === 0
  const pageError = loadState === 'error' && photos.length > 0

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link className="admin-brand" to="/" aria-label="Return to Crane Tracker map">
          <span aria-hidden="true">▲</span>
          <span>Crane Tracker</span>
        </Link>
        <span className="admin-header-context">Photo archive</span>
      </header>

      <main className="admin-main">
        <section className="admin-intro">
          <div>
            <p className="admin-kicker">Site image review</p>
            <h1>Uploaded photos</h1>
            <p className="admin-summary">
              Review every image submitted to the map. Newest uploads appear first.
            </p>
          </div>
          <div className="admin-tally" aria-live="polite">
            <strong>{photos.length}</strong>
            <span>loaded</span>
          </div>
        </section>

        <aside className="admin-security-note" role="note">
          <span aria-hidden="true">!</span>
          <p><strong>Access controls are not configured.</strong> Anyone with this address can use these tools.</p>
        </aside>

        {loadState === 'initial' && (
          <div className="admin-status" role="status">
            <span className="admin-loader" aria-hidden="true" />
            Loading photo archive…
          </div>
        )}

        {initialError && (
          <div className="admin-status admin-status-error" role="alert">
            <strong>Photo archive unavailable</strong>
            <span>{loadError}</span>
            <button type="button" className="btn btn-outline" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        )}

        {loadState !== 'initial' && !initialError && photos.length === 0 && (
          <div className="admin-empty">
            <span aria-hidden="true">△</span>
            <h2>No photos to review</h2>
            <p>New uploads will appear here automatically.</p>
          </div>
        )}

        {photos.length > 0 && (
          <section className="admin-photo-grid" aria-label="Uploaded photos">
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onDelete={requestDelete} />
            ))}
          </section>
        )}

        <div ref={sentinelRef} className="admin-scroll-sentinel" aria-hidden="true" />

        {loadState === 'loading-more' && (
          <div className="admin-page-status" role="status">
            <span className="admin-loader" aria-hidden="true" />
            Loading older photos…
          </div>
        )}

        {pageError && (
          <div className="admin-page-status admin-page-error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadMore()}>Try again</button>
          </div>
        )}

        {end && photos.length > 0 && (
          <div className="admin-end">End of archive</div>
        )}
      </main>

      {pendingDelete && (
        <DeleteDialog
          photo={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={closeDelete}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}
