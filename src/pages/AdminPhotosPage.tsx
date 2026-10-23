import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, adminLogin, adminLogout, deletePhoto, getPhotos } from '../api/client'
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
  onPreview: (photo: CranePhoto) => void
}

function PhotoCard({ photo, onDelete, onPreview }: PhotoCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(photo.url) && !imageFailed

  return (
    <article className="admin-photo-card">
      <div className={hasImage ? 'admin-photo-frame' : 'admin-photo-frame unavailable'}>
        {hasImage ? (
          <button className="admin-preview-button" type="button" onClick={() => onPreview(photo)} aria-label={`Preview ${photo.originalFilename}`}><img
            src={photo.url ?? undefined}
            alt={photo.originalFilename || 'Uploaded crane photo'}
            loading="lazy"
            onError={() => setImageFailed(true)}
          /></button>
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
  const dialogRef = useModal(onCancel, deleting)

  return (
    <div className="admin-dialog-scrim" onMouseDown={deleting ? undefined : onCancel}>
      <div
        className="admin-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-photo-title"
        aria-describedby="delete-photo-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="admin-dialog-mark" aria-label="Close delete confirmation" onClick={onCancel} disabled={deleting}>×</button>
        <div>
          <h2 id="delete-photo-title">Delete this photo?</h2>
          <p id="delete-photo-description">
            <strong>{photo.originalFilename || 'This upload'}</strong> will be permanently removed.
            This cannot be undone.
          </p>
          {photo.url && <img className="admin-dialog-photo" src={photo.url} alt={photo.originalFilename} />}
          {error && <p className="admin-dialog-error" role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={deleting}>
              Keep photo
            </button>
            <button
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

function useModal(onClose: () => void, busy = false) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => { if (opener?.isConnected) opener.focus() }
  }, [])
  useEffect(() => {
    const node = ref.current
    const focusable = () => Array.from(node?.querySelectorAll<HTMLButtonElement>('button:not(:disabled), a[href]') ?? [])
    if (busy) node?.focus()
    else focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose() }
      if (event.key === 'Tab') {
        const items = focusable()
        if (!items.length) { event.preventDefault(); node?.focus(); return }
        const next = event.shiftKey ? items.at(-1) : items[0]
        if (!node?.contains(document.activeElement) || document.activeElement === (event.shiftKey ? items[0] : items.at(-1))) {
          event.preventDefault(); next?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [onClose, busy])
  return ref
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.status === 429
    ? 'Too many requests. Please wait and try again.' : fallback
}

export default function AdminPhotosPage() {
  const [token, setToken] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const expire = useCallback(() => { setToken(null); setMessage('Your session expired. Please sign in again.') }, [])
  const signOut = () => {
    const current = token
    setToken(null)
    setMessage(null)
    if (current) void adminLogout(current).catch(() => {})
  }
  if (!token) return <AdminSignIn message={message} onSignIn={setToken} />
  return <PhotoReview token={token} onExpired={expire} onSignOut={signOut} />
}

function AdminSignIn({ message, onSignIn }: { message: string | null; onSignIn: (token: string) => void }) {
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link className="admin-brand" to="/">▲ Crane Tracker</Link>
      </header>
      <main className="admin-main admin-signin">
        <h1>Admin sign-in</h1>
        <p>Sign in to review uploaded photos.</p>
        {message && <p role="status">{message}</p>}
        <form onSubmit={async (event) => {
          event.preventDefault()
          if (submitting.current) return
          submitting.current = true
          setBusy(true)
          setError(null)
          const form = event.currentTarget
          const data = new FormData(form)
          try {
            const session = await adminLogin(String(data.get('username')), String(data.get('password')))
            form.reset()
            onSignIn(session.access_token)
          } catch (error) {
            form.reset()
            setError(error instanceof ApiError && error.status === 401
              ? 'Invalid username or password.'
              : errorMessage(error, 'Could not sign in. Please try again.'))
          } finally {
            submitting.current = false
            setBusy(false)
          }
        }}>
          <label htmlFor="admin-username">Username</label>
          <input id="admin-username" name="username" autoComplete="off" required disabled={busy} />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autoComplete="off" required disabled={busy} />
          {error && <p role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}

function Preview({ photo, onClose }: { photo: CranePhoto; onClose: () => void }) {
  const ref = useModal(onClose)
  return (
    <div className="admin-dialog-scrim" onMouseDown={onClose}>
      <div
        ref={ref}
        className="admin-dialog admin-preview"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="admin-preview-header">
          <h2 id="preview-title">{photo.originalFilename}</h2>
          <button type="button" className="admin-dialog-mark" aria-label="Close preview" onClick={onClose}>×</button>
        </div>
        <img src={photo.url ?? undefined} alt={photo.originalFilename} />
      </div>
    </div>
  )
}

function PhotoReview({ token, onExpired, onSignOut }: { token: string; onExpired: () => void; onSignOut: () => void }) {
  const [preview, setPreview] = useState<CranePhoto | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const [notice, setNotice] = useState<string | null>(null)
  const deletingRef = useRef(false)
  const removedRef = useRef(new Set<string>())
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
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

  useEffect(() => {
    const controller = new AbortController()
    loadingRef.current = true
    cursorRef.current = undefined
    setPhotos([])
    setEnd(false)
    setLoadError(null)
    setLoadState('initial')

    void getPhotos(token, {}, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        cursorRef.current = result.photos.at(-1)?.id
        setPhotos(Array.from(new Map(result.photos.map(photo => [photo.id, photo])).values()))
        setEnd(result.end || result.photos.length === 0)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) { onExpired(); return }
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
  }, [reloadKey, token, onExpired])

  useEffect(() => () => pageControllerRef.current?.abort(), [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || end || !cursorRef.current) return
    const controller = new AbortController()
    pageControllerRef.current = controller
    loadingRef.current = true
    setLoadError(null)
    setLoadState('loading-more')

    try {
      const result = await getPhotos(token, { cursor: cursorRef.current }, controller.signal)
      if (controller.signal.aborted) return
      cursorRef.current = result.photos.at(-1)?.id ?? cursorRef.current
      setPhotos((current) => {
        const known = new Set(current.map((photo) => photo.id))
        return [...current, ...result.photos.filter((photo) => {
          if (known.has(photo.id) || removedRef.current.has(photo.id)) return false
          known.add(photo.id); return true
        })]
      })
      setEnd(result.end || result.photos.length === 0)
      setLoadState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 401) { onExpired(); return }
      setLoadError(errorMessage(error, 'Could not load more photos.'))
      setLoadState('error')
    } finally {
      if (pageControllerRef.current === controller) {
        pageControllerRef.current = null
        loadingRef.current = false
      }
    }
  }, [end, token, onExpired])

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
    if (!pendingDelete || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePhoto(token, pendingDelete.craneId, pendingDelete.id)
      if (!mountedRef.current) return
      removedRef.current.add(pendingDelete.id)
      setPhotos((current) => current.filter((photo) => photo.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof ApiError && error.status === 401) { onExpired(); return }
      if (error instanceof ApiError && error.status === 404) {
        removedRef.current.add(pendingDelete.id)
        setPhotos(current => current.filter(photo => photo.id !== pendingDelete.id))
        setPendingDelete(null); setNotice('That photo is no longer available. It has been removed from this list.'); return
      }
      setDeleteError(errorMessage(error, 'The photo could not be deleted. Try again.'))
    } finally {
      deletingRef.current = false
      if (mountedRef.current) setDeleting(false)
    }
  }

  const initialError = loadState === 'error' && !cursorRef.current
  const pageError = loadState === 'error' && Boolean(cursorRef.current)

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link className="admin-brand" to="/" aria-label="Return to Crane Tracker map">
          <span aria-hidden="true">▲</span>
          <span>Crane Tracker</span>
        </Link>
        <span className="admin-header-context">Photo review</span>
        <button className="btn btn-quiet" onClick={onSignOut}>Sign out</button>
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

        {notice && <p role="status">{notice}</p>}

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
            <p>New uploads will appear when you return to this screen.</p>
          </div>
        )}

        {photos.length > 0 && (
          <section className="admin-photo-grid" aria-label="Uploaded photos">
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onDelete={requestDelete} onPreview={setPreview} />
            ))}
          </section>
        )}

        {!end && cursorRef.current && (
          <div className="admin-page-status">
            <button className="btn btn-outline" disabled={loadState === 'loading-more'} onClick={() => void loadMore()}>
              Load more
            </button>
          </div>
        )}

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

      {preview && <Preview photo={preview} onClose={closePreview} />}
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
