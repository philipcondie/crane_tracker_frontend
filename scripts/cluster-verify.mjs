// Clustering verification. The real backend (localhost:8000) isn't running, so
// GET /cranes is stubbed in-page with dense synthetic cranes around Seattle.
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:5199'
const OUT = '/tmp/crane-verify'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('console', (m) => m.type() === 'error' && log('  [console.error]', m.text()))
page.on('pageerror', (e) => log('  [pageerror]', e.message))

// 600 cranes in a tight Seattle box -> guaranteed clustering at z13.
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('ct_seen_v1', '1')
  // Must satisfy the full CraneSummary shape: DetailRail calls fmtDate(addedAt)
  // on the auto-selected crane, and a missing field crashes the render tree
  // before the map ever paints.
  const CRANES = Array.from({ length: 600 }, (_, i) => ({
    id: `c${i}`,
    name: `Crane ${i}`,
    status: i % 5 === 0 ? 'gone' : 'active',
    city: 'Seattle',
    neighborhood: `Zone ${i % 12}`,
    addedAt: `2026-0${(i % 7) + 1}-1${i % 9}`,
    lat: 47.6205 + (Math.sin(i * 12.9898) * 0.5) * 0.09,
    lng: -122.34 + (Math.sin(i * 78.233) * 0.5) * 0.12,
    photos: i % 4,
    contribs: i % 6,
  }))
  const realFetch = window.fetch.bind(window)
  window.fetch = async (url, opts) => {
    // url may be a Request object or URL, not just a string — Vite's HMR client
    // passes non-string inputs, and assuming .includes() on them is what broke
    // the page before the map could mount.
    const u = typeof url === 'string' ? url : url?.url ?? String(url ?? '')
    if (u.includes('/cranes?')) {
      const q = new URL(u, location.origin).searchParams
      const [n, s, e, w] = ['north', 'south', 'east', 'west'].map((k) => Number(q.get(k)))
      const inBox = CRANES.filter((c) => c.lat <= n && c.lat >= s && c.lng <= e && c.lng >= w)
      return new Response(JSON.stringify({ cranes: inBox, truncated: false }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (/\/cranes\/[^?]+$/.test(u)) {
      const id = u.split('/').pop()
      const c = CRANES.find((x) => x.id === id) ?? CRANES[0]
      return new Response(JSON.stringify({ ...c, imgs: [], links: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return realFetch(url, opts)
  }
})

const counts = () =>
  page.evaluate(() => ({
    clusters: document.querySelectorAll('.leaflet-marker-icon .cluster-probe, .marker-cluster').length,
    // Our clusters are plain divIcons; identify them by the "k+"/digit bubble markup.
    bubbles: [...document.querySelectorAll('.leaflet-marker-icon')].filter((el) =>
      /border-radius:50%/.test(el.innerHTML) && /^\d+k?\+?$/.test(el.textContent.trim()),
    ).length,
    pins: [...document.querySelectorAll('.leaflet-marker-icon')].filter(
      (el) => el.textContent.trim() === '',
    ).length,
    total: document.querySelectorAll('.leaflet-marker-icon').length,
  }))

log('\n=== 1. City zoom (z13) — expect clusters ===')
await page.goto(`${BASE}/?lat=47.6205&lng=-122.34&z=13`, { waitUntil: 'networkidle2' })
await sleep(2000)
let c = await counts()
log('  ', JSON.stringify(c))
await page.screenshot({ path: `${OUT}/cluster-1-z13.png` })

log('\n=== 2. Click a cluster — expect it to break apart ===')
const before = c.total
await page.evaluate(() => {
  const bubble = [...document.querySelectorAll('.leaflet-marker-icon')].find(
    (el) => /border-radius:50%/.test(el.innerHTML) && /^\d+k?\+?$/.test(el.textContent.trim()),
  )
  bubble?.click()
})
await sleep(1800)
c = await counts()
log('   after click:', JSON.stringify(c), `(was total=${before})`)
await page.screenshot({ path: `${OUT}/cluster-2-expanded.png` })

log('\n=== 3. Deep zoom (z18) — expect individual pins, no bubbles ===')
await page.goto(`${BASE}/?lat=47.6205&lng=-122.34&z=18`, { waitUntil: 'networkidle2' })
await sleep(2000)
c = await counts()
log('  ', JSON.stringify(c))
await page.screenshot({ path: `${OUT}/cluster-3-z18.png` })

log('\n=== 4. Selection: click a pin at z18, check detail panel ===')
await page.evaluate(() => {
  const pin = [...document.querySelectorAll('.leaflet-marker-icon')].find(
    (el) => el.textContent.trim() === '',
  )
  pin?.click()
})
await sleep(1200)
const panel = await page.evaluate(() => {
  const el = document.querySelector('.rail, .sheet')
  return el ? el.textContent.trim().slice(0, 120) : '(no panel)'
})
log('   panel:', panel)
await page.screenshot({ path: `${OUT}/cluster-4-selected.png` })

log('\n=== 5. Pan at city zoom — clusters should re-form, no leaked pins ===')
await page.goto(`${BASE}/?lat=47.6205&lng=-122.34&z=12`, { waitUntil: 'networkidle2' })
await sleep(1800)
const z12 = await counts()
await page.evaluate(() => {
  const m = document.querySelector('.leaflet-container')
  if (!m) throw new Error('map container never mounted')
  const r = m.getBoundingClientRect()
  return new Promise((res) => {
    const ev = (t, x, y) =>
      m.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: x, clientY: y }))
    ev('mousedown', r.width / 2, r.height / 2)
    ev('mousemove', r.width / 2 - 220, r.height / 2 - 140)
    ev('mouseup', r.width / 2 - 220, r.height / 2 - 140)
    setTimeout(res, 100)
  })
})
await sleep(2200)
const panned = await counts()
log('   before pan:', JSON.stringify(z12))
log('   after pan: ', JSON.stringify(panned))
await page.screenshot({ path: `${OUT}/cluster-5-panned.png` })

await browser.close()
log('\nScreenshots in', OUT)
