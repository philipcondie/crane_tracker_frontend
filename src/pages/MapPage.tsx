import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet.markercluster'
import { createCrane, type Bounds } from '../api/client'
import { useCranesInBounds } from '../hooks/useCranesInBounds'
import { useCraneDetail } from '../hooks/useCraneDetail'
import { useIsMobile } from '../hooks/useIsMobile'
import { fmtLatLng } from '../utils'
import { clusterIcon, craneIcon, tempIcon } from '../map/icons'
import { SEATTLE_CENTER } from '../data/seed'
import { PillNav } from '../components/PillNav'
import { WelcomeOverlay } from '../components/WelcomeOverlay'
import {
  AddFormPanel,
  AddHintPanel,
  ContributePanel,
  DetailError,
  DetailLoading,
  DetailRail,
  DetailSheet,
  EmptyPanel,
  type AddFormValues,
} from '../components/CranePanels'
import type { CraneDetail, CraneSummary } from '../types'

type PanelMode = 'detail' | 'addhint' | 'addform' | 'contribute'

const WELCOME_KEY = 'ct_seen_v1'

// Contribute (photos/links) and status updates have no backend endpoints yet, so
// their controls render disabled rather than claiming a success that never
// persists. Flip to true once POST /contribute and PATCH /cranes/{id} exist.
const WRITES_ENABLED = false

// How long the truncation banner lingers after results stop being truncated.
// Comfortably longer than the 350ms fetch debounce in useCranesInBounds, so a
// pan across dense areas rides through on one banner instead of strobing.
const TRUNC_LINGER_MS = 1500

function seenWelcome(): boolean {
  try {
    return Boolean(localStorage.getItem(WELCOME_KEY))
  } catch {
    return false
  }
}

/** Read the map's current viewport as API bounds. */
function boundsOf(map: L.Map): Bounds {
  const b = map.getBounds()
  return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
}

function sameBounds(a: Bounds | null, b: Bounds): boolean {
  return !!a && a.north === b.north && a.south === b.south && a.east === b.east && a.west === b.west
}

/** The crane nearest to a lat/lng, by squared degree distance. Null if none. */
function nearestTo(lat: number, lng: number, cranes: CraneSummary[]): CraneSummary | null {
  let best: CraneSummary | null = null
  let bd = Infinity
  for (const c of cranes) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2
    if (d < bd) {
      bd = d
      best = c
    }
  }
  return best
}

export default function MapPage() {
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()

  // Viewport bounds drive the crane fetch. Null until the map has initialized.
  const [bounds, setBounds] = useState<Bounds | null>(null)
  // Bumped after a write that doesn't move the map, to force a refetch of the
  // unchanged viewport (see useCranesInBounds).
  const [refetchToken, setRefetchToken] = useState(0)
  const { cranes, loading, error, truncated, addOptimistic } = useCranesInBounds(
    bounds,
    refetchToken,
  )

  const [showTruncated, setShowTruncated] = useState(false)
  const truncTimer = useRef<number | undefined>(undefined)

  /**
   * Latches the truncation banner so panning doesn't strobe it. Deliberately
   * asymmetric: showing is immediate (a user who just zoomed out should learn
   * straight away that pins are missing), hiding waits out TRUNC_LINGER_MS.
   *
   * The pending hide is cancelled whenever truncation comes back, so a stretch
   * of alternating results holds one steady banner instead of blinking. Only a
   * full quiet period — the user actually zoomed in far enough — clears it.
   */
  useEffect(() => {
    if (truncated) {
      window.clearTimeout(truncTimer.current)
      truncTimer.current = undefined
      setShowTruncated(true)
      return
    }
    // Don't start the countdown on a request still in flight: mid-pan the hook
    // reports truncated=false simply because nothing has come back yet, and
    // treating that as "resolved" is the flicker we're suppressing.
    if (loading || showTruncated === false || truncTimer.current !== undefined) return
    truncTimer.current = window.setTimeout(() => {
      truncTimer.current = undefined
      setShowTruncated(false)
    }, TRUNC_LINGER_MS)
  }, [truncated, loading, showTruncated])

  // Unmount-only: a pending hide firing after teardown would setState on a dead
  // component. The show path clears this timer itself.
  useEffect(() => () => window.clearTimeout(truncTimer.current), [])

  const [selId, setSelId] = useState<string | null>(() => params.get('crane'))
  // Full detail for the selected crane (imgs/links); summary is the fallback header.
  const { crane: detail, loading: detailLoading, error: detailError } = useCraneDetail(selId)

  // A crane opened via ?crane={id} needs the map centered on it once its coords
  // arrive. This holds that pending id; cleared after the one-shot recenter so
  // later pin-clicks don't yank the map around.
  const pendingCenterId = useRef<string | null>(params.get('crane'))

  // Latch so the first-load auto-select runs exactly once. After that, selection
  // is entirely user-driven (panning never re-picks).
  const didAutoSelect = useRef(false)

  const [panel, setPanel] = useState<PanelMode>('detail')
  const [sat, setSat] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [temp, setTemp] = useState<{ lat: number; lng: number } | null>(null)
  const [toast, setToast] = useState('')
  const [welcome, setWelcome] = useState(() => !seenWelcome())
  const [photoIdx, setPhotoIdx] = useState(0)
  const [draft, setDraft] = useState<string[]>([])
  const [cdraft, setCdraft] = useState<string[]>([])
  const [cLink, setCLink] = useState('')
  const [form, setForm] = useState<AddFormValues>({ name: '', note: '' })

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<{ muted: L.TileLayer; sat: L.TileLayer } | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const tempMkRef = useRef<L.Marker | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  // Latest values for Leaflet event handlers registered once on mount
  const panelRef = useRef(panel)
  panelRef.current = panel

  // Marker click handlers are bound once, when a marker is first created, and
  // are never re-bound. Routing through a ref keeps them calling the current
  // selectCrane instead of the closure captured at creation time.
  const selectCraneRef = useRef<(id: string) => void>(() => {})

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  const removeTemp = useCallback(() => {
    if (tempMkRef.current && mapRef.current) {
      mapRef.current.removeLayer(tempMkRef.current)
    }
    tempMkRef.current = null
  }, [])

  const selectCrane = useCallback(
    (id: string) => {
      removeTemp()
      setSelId(id)
      setPanel('detail')
      setTemp(null)
      setExpanded(false)
      setPhotoIdx(0)
    },
    [removeTemp],
  )
  selectCraneRef.current = selectCrane

  // Returning the previous object when the viewport is numerically unchanged
  // lets React bail out of the render, so a pan that lands back where it started
  // doesn't restart the debounce and refetch identical data.
  const syncBounds = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const next = boundsOf(map)
    setBounds((prev) => (sameBounds(prev, next) ? prev : next))
  }, [])

  const moveTemp = useCallback((latlng: L.LatLng) => {
    tempMkRef.current?.setLatLng(latlng)
    setTemp({ lat: latlng.lat, lng: latlng.lng })
  }, [])

  const dropTemp = useCallback(
    (latlng: L.LatLng) => {
      const map = mapRef.current
      if (!map) return
      removeTemp()
      const mk = L.marker(latlng, { icon: tempIcon(), draggable: true, zIndexOffset: 1000 }).addTo(map)
      mk.on('dragend', () => {
        const ll = mk.getLatLng()
        setTemp({ lat: ll.lat, lng: ll.lng })
      })
      tempMkRef.current = mk
      setTemp({ lat: latlng.lat, lng: latlng.lng })
    },
    [removeTemp],
  )

  // Map bootstrap
  useEffect(() => {
    const map = L.map(mapEl.current!, { zoomControl: false })
    let center: [number, number] = SEATTLE_CENTER
    let zoom = 13
    const latParam = Number(params.get('lat'))
    const lngParam = Number(params.get('lng'))
    if (Number.isFinite(latParam) && Number.isFinite(lngParam) && params.get('lat')) {
      center = [latParam, lngParam]
      zoom = Number(params.get('z')) || 13
    }
    map.setView(center, zoom)
    const muted = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '© OpenStreetMap, © CARTO',
    })
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' },
    )
    muted.addTo(map)

    // Cluster group owns every crane marker; nothing is added to the map
    // directly (see the marker-sync effect). Options worth knowing:
    //   disableClusteringAtZoom — past z17 the viewport is small enough that
    //     real pins are both affordable and more useful than a bubble.
    //   chunkedLoading — a dense viewport can deliver hundreds of markers at
    //     once; chunking yields to the event loop so the map stays responsive
    //     instead of locking up mid-pan.
    //   maxClusterRadius — tighter than the 80px default. These are physical
    //     structures a few blocks apart, and the loose default merges cranes
    //     users read as distinct landmarks.
    const clusters = L.markerClusterGroup({
      disableClusteringAtZoom: 17,
      chunkedLoading: true,
      maxClusterRadius: 40,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => clusterIcon(cluster.getChildCount()),
    })
    clusters.addTo(map)
    clusterRef.current = clusters

    map.on('click', (e: L.LeafletMouseEvent) => {
      const mode = panelRef.current
      if (mode === 'addhint' || mode === 'addform') moveTemp(e.latlng)
    })
    // Every pan/zoom updates the bounds, which re-triggers the (debounced) fetch
    // — unless the viewport is numerically identical, which syncBounds filters.
    map.on('moveend', syncBounds)
    mapRef.current = map
    layersRef.current = { muted, sat: satLayer }
    // Only strip the positional params here. `crane` is deliberately left in the
    // URL until its detail actually loads (see the recenter effect) so a failed
    // or slow deep-link fetch is still reloadable/retryable.
    if (params.get('lat')) setParams({}, { replace: true })
    const t = window.setTimeout(() => {
      map.invalidateSize()
      syncBounds()
    }, 150)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(toastTimer.current)
      map.remove()
      mapRef.current = null
      layersRef.current = null
      clusterRef.current = null
      markersRef.current.clear()
      tempMkRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep markers in sync with fetched cranes and selection. Remove stale markers
  // for cranes that fell out of the viewport.
  useEffect(() => {
    const map = mapRef.current
    const clusters = clusterRef.current
    if (!map || !clusters) return
    const seen = new Set<string>()
    // Batch the adds: addLayers() clusters one pass over the whole set, where
    // repeated addLayer() calls re-cluster on every insert.
    const added: L.Marker[] = []
    for (const crane of cranes) {
      seen.add(crane.id)
      let mk = markersRef.current.get(crane.id)
      if (!mk) {
        const id = crane.id
        mk = L.marker([crane.lat, crane.lng])
        mk.on('click', () => selectCraneRef.current(id))
        markersRef.current.set(id, mk)
        added.push(mk)
      }
      mk.setIcon(craneIcon(crane.status, crane.id === selId))
    }
    if (added.length) clusters.addLayers(added)
    const stale: L.Marker[] = []
    for (const [id, mk] of markersRef.current) {
      if (!seen.has(id)) {
        stale.push(mk)
        markersRef.current.delete(id)
      }
    }
    // Must go through the group, not map.removeLayer: a marker inside a cluster
    // isn't on the map, so removing it there is a no-op that leaks the pin.
    if (stale.length) clusters.removeLayers(stale)
  }, [cranes, selId])

  // Base layer swap
  useEffect(() => {
    const map = mapRef.current
    const layers = layersRef.current
    if (!map || !layers) return
    if (sat) {
      map.removeLayer(layers.muted)
      layers.sat.addTo(map)
    } else {
      map.removeLayer(layers.sat)
      layers.muted.addTo(map)
    }
  }, [sat])

  // First-load auto-select: once cranes land in the initial viewport and nothing
  // is selected, open the one nearest the map center so the panel isn't blank.
  // Latched to run once — panning afterward never changes the selection.
  useEffect(() => {
    if (didAutoSelect.current || selId || cranes.length === 0) return
    const map = mapRef.current
    if (!map) return
    didAutoSelect.current = true
    const center = map.getCenter()
    const best = nearestTo(center.lat, center.lng, cranes)
    if (best) setSelId(best.id) // select only — don't move the map on load
  }, [cranes, selId])

  // One-shot recenter for a deep-linked crane: once its detail (and coords)
  // arrive, glide the map to it and open the panel expanded, then consume the
  // pending flag so ordinary pin-clicks never move the map.
  useEffect(() => {
    if (!detail || pendingCenterId.current !== detail.id) return
    pendingCenterId.current = null
    mapRef.current?.setView([detail.lat, detail.lng], 15)
    setExpanded(true)
    // The deep link has now been honoured, so retire it from the URL. Until this
    // point ?crane= stays put, keeping a slow or failed load reloadable.
    setParams({}, { replace: true })
  }, [detail, setParams])

  // The selected summary from the viewport set, and the crane shown in the panel:
  // prefer the fetched detail, fall back to the summary while detail loads.
  const selSummary: CraneSummary | undefined = cranes.find((c) => c.id === selId)
  const shown: CraneDetail | null =
    detail ?? (selSummary ? { ...selSummary, imgs: [], links: [] } : null)

  const inView = cranes.length
  // Empty-region CTA only when nothing is selected — a deep-linked crane can be
  // open while its viewport happens to return zero pins.
  const empty = panel === 'detail' && !loading && inView === 0 && !welcome && !selId
  const tempCoords = temp ? fmtLatLng(temp.lat, temp.lng) : '—'

  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1')
    } catch {
      /* private browsing */
    }
    setWelcome(false)
  }

  const startAdd = () => {
    const map = mapRef.current
    if (!map) return
    dropTemp(map.getCenter())
    setPanel('addhint')
    setDraft([])
    setForm({ name: '', note: '' })
  }

  const cancelAdd = () => {
    removeTemp()
    setPanel('detail')
    setTemp(null)
    setDraft([])
  }

  const submitCrane = async () => {
    if (!temp) return
    try {
      const crane = await createCrane({
        name: form.name,
        lat: temp.lat,
        lng: temp.lng,
        status: 'active',
      })
      // Insert before removing the temp marker: React commits both in one pass,
      // so the real pin is already on the map when the placeholder goes. Doing
      // it the other way leaves a gap until the refetch lands, which is the
      // flicker this avoids.
      addOptimistic(crane)
      removeTemp()
      setSelId(crane.id)
      setPanel('detail')
      setTemp(null)
      setExpanded(true)
      setDraft([])
      setPhotoIdx(0)
      // The map hasn't moved, so syncBounds alone would be a no-op — bump the
      // token to refetch this same viewport, reconciling the optimistic pin
      // against the server's list.
      setRefetchToken((t) => t + 1)
      flash('CRANE ADDED ✓')
    } catch (err) {
      flash('COULD NOT ADD CRANE')
      console.error(err)
    }
  }

  const openContribute = () => {
    setPanel('contribute')
    setCdraft([])
    setCLink('')
  }

  const submitContribute = () => {
    // TODO(backend): POST photos/links to a contribute endpoint once it exists.
    setPanel('detail')
    setCdraft([])
    setCLink('')
    setPhotoIdx(0)
    // Unreachable while WRITES_ENABLED is false, but don't claim success if it
    // ever is reached before the endpoint lands.
    flash('NOT YET AVAILABLE')
  }

  const handleReportGone = () => {
    // TODO(backend): PATCH /cranes/{id} status once the update endpoint exists.
    flash('NOT YET AVAILABLE')
  }

  const showNearest = () => {
    const map = mapRef.current
    if (!map) return
    const center = map.getCenter()
    const best = nearestTo(center.lat, center.lng, cranes)
    if (best) {
      map.setView([best.lat, best.lng], 14)
      selectCrane(best.id)
    }
  }

  const panelBody = (() => {
    switch (panel) {
      case 'addhint':
        return <AddHintPanel mobile={isMobile} coords={tempCoords} onPlace={() => setPanel('addform')} onCancel={cancelAdd} />
      case 'addform':
        return (
          <AddFormPanel
            mobile={isMobile}
            coords={tempCoords}
            values={form}
            onChange={setForm}
            draft={draft}
            onFiles={(urls) => setDraft((d) => [...d, ...urls].slice(0, 3))}
            onRemoveDraft={(i) => setDraft((d) => d.filter((_, j) => j !== i))}
            onSubmit={submitCrane}
            onCancel={cancelAdd}
          />
        )
      case 'contribute':
        return shown ? (
          <ContributePanel
            mobile={isMobile}
            craneName={shown.name}
            draft={cdraft}
            onFiles={(urls) => setCdraft((d) => [...d, ...urls].slice(0, 3))}
            onRemoveDraft={(i) => setCdraft((d) => d.filter((_, j) => j !== i))}
            link={cLink}
            onLinkChange={setCLink}
            onSubmit={submitContribute}
            onBack={() => setPanel('detail')}
          />
        ) : null
      default:
        // A failed detail fetch is surfaced even when a summary fallback exists:
        // the fallback fabricates empty imgs/links, so silently rendering it
        // would show "5 PHOTOS" beside an empty gallery with no error shown.
        if (selId && detailError) {
          return <DetailError mobile={isMobile} onDismiss={() => setSelId(null)} />
        }
        if (selId && !shown && detailLoading) return <DetailLoading mobile={isMobile} />
        if (empty) return <EmptyPanel mobile={isMobile} onAdd={startAdd} onNearest={showNearest} />
        if (!shown) return null
        return isMobile ? (
          <DetailSheet
            crane={shown}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            photoIdx={photoIdx}
            onPrev={() => setPhotoIdx((i) => i - 1)}
            onNext={() => setPhotoIdx((i) => i + 1)}
            onContribute={openContribute}
            onReportGone={handleReportGone}
            writesEnabled={WRITES_ENABLED}
          />
        ) : (
          <DetailRail
            crane={shown}
            photoIdx={photoIdx}
            onPrev={() => setPhotoIdx((i) => i - 1)}
            onNext={() => setPhotoIdx((i) => i + 1)}
            onContribute={openContribute}
            onReportGone={handleReportGone}
            writesEnabled={WRITES_ENABLED}
          />
        )
    }
  })()

  // A selected crane showing the loading or error placeholder needs sheet room
  // rather than the 120px stub. The error case applies even when a summary
  // fallback exists, since DetailError now takes precedence over it.
  const pendingDetail =
    panel === 'detail' && selId != null && (detailError != null || !shown)

  let sheetHeight = '120px'
  if (panel === 'detail') {
    if (pendingDetail) sheetHeight = '48%'
    else sheetHeight = empty ? '224px' : expanded ? '64%' : '120px'
  } else if (panel === 'addhint') sheetHeight = '184px'
  else sheetHeight = '78%'

  const fabHidden = isMobile && panel !== 'detail'

  return (
    <div className="map-page">
      <div ref={mapEl} className={sat ? 'map-host sat' : 'map-host'} />
      <div className="blueprint-grid" />
      <PillNav floating railOffset={!isMobile} round={isMobile} />

      {!fabHidden && (
        <button
          className={empty ? 'fab fab-pulse' : 'fab'}
          style={isMobile ? { right: 14, bottom: 172 } : { left: 16, bottom: 74 }}
          onClick={startAdd}
          aria-label="Add a crane"
        >
          +
        </button>
      )}

      <button
        className="map-btn"
        style={isMobile ? { left: 14, top: 60, fontSize: 9, padding: '6px 9px' } : { left: 16, bottom: 18 }}
        onClick={() => setSat((s) => !s)}
      >
        ◫ {isMobile ? (sat ? 'SATELLITE' : 'MAP') : `VIEW: ${sat ? 'SATELLITE' : 'MAP'} ⇄`}
      </button>

      {error && (
        <div
          className="toast"
          style={
            isMobile
              ? { left: '50%', top: 96, transform: 'translateX(-50%)' }
              : { left: 'calc(50% - 157px)', bottom: 56, transform: 'translateX(-50%)' }
          }
        >
          COULD NOT LOAD CRANES
        </div>
      )}

      {/*
        Truncation is a property of what's on screen right now, not an event, so
        this is a persistent banner rather than a timed toast: it stays until a
        zoom-in actually resolves it. Driven by the latched `showTruncated`, not
        raw `truncated`, to survive the gaps between fetches while panning.
        `!error` because a failed fetch renders its own banner in the same slot
        and truncation is meaningless alongside it.
      */}
      {showTruncated && !error && (
        <div
          className="toast"
          style={
            isMobile
              ? { left: '50%', top: 96, transform: 'translateX(-50%)' }
              : { left: 'calc(50% - 157px)', bottom: 56, transform: 'translateX(-50%)' }
          }
        >
          RESULTS TRUNCATED — ZOOM IN TO SEE ALL CRANES
        </div>
      )}

      {toast && (
        <div
          className="toast"
          style={
            isMobile
              ? { left: '50%', top: 60, transform: 'translateX(-50%)' }
              : { left: 'calc(50% - 157px)', bottom: 20, transform: 'translateX(-50%)' }
          }
        >
          {toast}
        </div>
      )}

      {welcome && (
        <WelcomeOverlay
          mobile={isMobile}
          onDismiss={dismissWelcome}
          onAdd={() => {
            dismissWelcome()
            startAdd()
          }}
        />
      )}

      {isMobile ? (
        <div className="sheet" style={{ height: sheetHeight }}>
          {panelBody}
        </div>
      ) : (
        <aside className="rail">{panelBody}</aside>
      )}
    </div>
  )
}
