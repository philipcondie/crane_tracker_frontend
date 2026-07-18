import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { useCranes } from '../store'
import { useIsMobile } from '../hooks/useIsMobile'
import { fmtLatLng } from '../utils'
import { craneIcon, tempIcon } from '../map/icons'
import { SEATTLE_CENTER } from '../data/seed'
import { PillNav } from '../components/PillNav'
import { WelcomeOverlay } from '../components/WelcomeOverlay'
import {
  AddFormPanel,
  AddHintPanel,
  ContributePanel,
  DetailRail,
  DetailSheet,
  EmptyPanel,
  type AddFormValues,
} from '../components/CranePanels'

type PanelMode = 'detail' | 'addhint' | 'addform' | 'contribute'

const WELCOME_KEY = 'ct_seen_v1'

function seenWelcome(): boolean {
  try {
    return Boolean(localStorage.getItem(WELCOME_KEY))
  } catch {
    return false
  }
}

export default function MapPage() {
  const { cranes, addCrane, reportGone, contribute } = useCranes()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()

  const [selId, setSelId] = useState(() => cranes[0]?.id ?? 0)
  const [panel, setPanel] = useState<PanelMode>('detail')
  const [sat, setSat] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [temp, setTemp] = useState<{ lat: number; lng: number } | null>(null)
  const [toast, setToast] = useState('')
  const [inView, setInView] = useState(1)
  const [welcome, setWelcome] = useState(() => !seenWelcome())
  const [photoIdx, setPhotoIdx] = useState(0)
  const [draft, setDraft] = useState<string[]>([])
  const [cdraft, setCdraft] = useState<string[]>([])
  const [cLink, setCLink] = useState('')
  const [form, setForm] = useState<AddFormValues>({ name: '', note: '' })

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<{ muted: L.TileLayer; sat: L.TileLayer } | null>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
  const tempMkRef = useRef<L.Marker | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  // Latest values for Leaflet event handlers registered once on mount
  const panelRef = useRef(panel)
  panelRef.current = panel
  const cranesRef = useRef(cranes)
  cranesRef.current = cranes

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
    (id: number) => {
      removeTemp()
      setSelId(id)
      setPanel('detail')
      setTemp(null)
      setExpanded(false)
      setPhotoIdx(0)
    },
    [removeTemp],
  )

  const recount = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    setInView(cranesRef.current.filter((c) => bounds.contains([c.lat, c.lng])).length)
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
    const craneParam = Number(params.get('crane'))
    const latParam = Number(params.get('lat'))
    const lngParam = Number(params.get('lng'))
    if (craneParam) {
      const target = cranesRef.current.find((c) => c.id === craneParam)
      if (target) {
        center = [target.lat, target.lng]
        zoom = 15
        setSelId(target.id)
        setExpanded(true)
      }
    } else if (Number.isFinite(latParam) && Number.isFinite(lngParam) && params.get('lat')) {
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
    map.on('click', (e: L.LeafletMouseEvent) => {
      const mode = panelRef.current
      if (mode === 'addhint' || mode === 'addform') moveTemp(e.latlng)
    })
    map.on('moveend', recount)
    mapRef.current = map
    layersRef.current = { muted, sat: satLayer }
    if (params.get('crane') || params.get('lat')) setParams({}, { replace: true })
    const t = window.setTimeout(() => {
      map.invalidateSize()
      recount()
    }, 150)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(toastTimer.current)
      map.remove()
      mapRef.current = null
      layersRef.current = null
      markersRef.current.clear()
      tempMkRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep markers in sync with crane data and selection
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const crane of cranes) {
      let mk = markersRef.current.get(crane.id)
      if (!mk) {
        mk = L.marker([crane.lat, crane.lng]).addTo(map)
        mk.on('click', () => selectCrane(crane.id))
        markersRef.current.set(crane.id, mk)
      }
      mk.setIcon(craneIcon(crane.status, crane.id === selId))
    }
  }, [cranes, selId, selectCrane])

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

  const sel = cranes.find((c) => c.id === selId) ?? cranes[0]
  const empty = panel === 'detail' && inView === 0 && !welcome
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

  const submitCrane = () => {
    if (!temp) return
    const crane = addCrane({ ...form, lat: temp.lat, lng: temp.lng, imgs: draft })
    removeTemp()
    setSelId(crane.id)
    setPanel('detail')
    setTemp(null)
    setExpanded(true)
    setDraft([])
    setPhotoIdx(0)
    flash('CRANE ADDED ✓')
  }

  const openContribute = () => {
    setPanel('contribute')
    setCdraft([])
    setCLink('')
  }

  const submitContribute = () => {
    contribute(sel.id, cdraft, cLink)
    setPanel('detail')
    setCdraft([])
    setCLink('')
    setPhotoIdx(0)
    flash(cdraft.length ? 'PHOTOS ADDED — THANKS!' : 'ADDED — THANKS!')
  }

  const handleReportGone = () => {
    reportGone(sel.id)
    flash('MARKED AS GONE')
  }

  const showNearest = () => {
    const map = mapRef.current
    if (!map) return
    const center = map.getCenter()
    let best = null
    let bd = Infinity
    for (const c of cranes) {
      const d = (c.lat - center.lat) ** 2 + (c.lng - center.lng) ** 2
      if (d < bd) {
        bd = d
        best = c
      }
    }
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
        return (
          <ContributePanel
            mobile={isMobile}
            craneName={sel.name}
            draft={cdraft}
            onFiles={(urls) => setCdraft((d) => [...d, ...urls].slice(0, 3))}
            onRemoveDraft={(i) => setCdraft((d) => d.filter((_, j) => j !== i))}
            link={cLink}
            onLinkChange={setCLink}
            onSubmit={submitContribute}
            onBack={() => setPanel('detail')}
          />
        )
      default:
        if (empty) return <EmptyPanel mobile={isMobile} onAdd={startAdd} onNearest={showNearest} />
        return isMobile ? (
          <DetailSheet
            crane={sel}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            photoIdx={photoIdx}
            onPrev={() => setPhotoIdx((i) => i - 1)}
            onNext={() => setPhotoIdx((i) => i + 1)}
            onContribute={openContribute}
            onReportGone={handleReportGone}
          />
        ) : (
          <DetailRail
            crane={sel}
            photoIdx={photoIdx}
            onPrev={() => setPhotoIdx((i) => i - 1)}
            onNext={() => setPhotoIdx((i) => i + 1)}
            onContribute={openContribute}
            onReportGone={handleReportGone}
          />
        )
    }
  })()

  let sheetHeight = '120px'
  if (panel === 'detail') sheetHeight = empty ? '224px' : expanded ? '64%' : '120px'
  else if (panel === 'addhint') sheetHeight = '184px'
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
