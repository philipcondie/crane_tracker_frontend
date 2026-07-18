// Verification driver: exercises the running app in headless Chrome.
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:5199'
const OUT = '/tmp/crane-verify'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})

async function clickByText(page, text, tag = '*') {
  const clicked = await page.evaluate(
    (t, tg) => {
      const els = [...document.querySelectorAll(tg)]
      const el = els.find((e) => e.textContent.trim().startsWith(t) && e.children.length < 4)
      if (el) {
        el.click()
        return true
      }
      return false
    },
    text,
    tag,
  )
  if (!clicked) throw new Error(`no element with text: ${text}`)
}

const textOf = (page, sel) => page.$eval(sel, (e) => e.textContent).catch(() => null)
const bodyHas = (page, t) => page.evaluate((x) => document.body.innerText.includes(x), t)

// ---------- desktop ----------
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await sleep(1200)

  log('welcome overlay visible:', await bodyHas(page, 'The cranes reshaping the skyline'))
  await page.screenshot({ path: `${OUT}/01-desktop-welcome.png` })

  await clickByText(page, 'START EXPLORING', 'button')
  await sleep(400)
  log('welcome dismissed:', !(await bodyHas(page, 'START EXPLORING')))
  log('detail rail shows crane:', await bodyHas(page, 'SOUTH LAKE UNION'))
  await page.screenshot({ path: `${OUT}/02-desktop-map.png` })

  // click a different pin (Rainier Square at 47.6105,-122.336)
  const pins = await page.$$('.leaflet-marker-icon')
  log('pin count:', pins.length)
  // select pin nearest bottom-center-left: just click each until rail name changes
  for (const pin of pins) {
    const box = await pin.boundingBox()
    if (!box) continue
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await sleep(250)
    if (await bodyHas(page, 'RAINIER SQUARE')) break
  }
  log('pin click selected Rainier Square:', await bodyHas(page, 'RAINIER SQUARE'))

  // satellite toggle
  await clickByText(page, '◫ VIEW: MAP', 'button')
  await sleep(900)
  log('sat toggle label now SATELLITE:', await bodyHas(page, 'VIEW: SATELLITE'))
  await page.screenshot({ path: `${OUT}/03-desktop-sat.png` })
  await clickByText(page, '◫ VIEW: SATELLITE', 'button')
  await sleep(400)

  // add-crane flow
  await page.click('.fab')
  await sleep(400)
  log('add hint panel:', await bodyHas(page, 'DROP THE PIN ON THE CRANE'))
  log('temp pin coords shown:', await bodyHas(page, 'PINNED AT'))
  // tap a new map spot to move temp pin
  await page.mouse.click(300, 500)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/04-desktop-addhint.png` })
  await clickByText(page, 'PLACE HERE →', 'button')
  await sleep(300)
  await page.type('input[placeholder="e.g. Harbor Point Tower"]', 'Verification Test Tower')
  await page.select('select.ct-in', 'Luffing jib')
  await page.type('input[placeholder="https:// …"]', 'https://example.com/article')
  await page.screenshot({ path: `${OUT}/05-desktop-addform.png` })
  await clickByText(page, 'SUBMIT CRANE', 'button')
  await sleep(400)
  log('toast CRANE ADDED:', await bodyHas(page, 'CRANE ADDED ✓'))
  log('new crane in rail:', await bodyHas(page, 'VERIFICATION TEST TOWER'))
  log('article link rendered:', await bodyHas(page, '↗ ARTICLE LINK'))
  const newPins = await page.$$('.leaflet-marker-icon')
  log('pin count after add:', newPins.length)
  await page.screenshot({ path: `${OUT}/06-desktop-added.png` })

  // report as gone
  await clickByText(page, 'REPORT AS GONE', 'button')
  await sleep(300)
  log('toast MARKED AS GONE:', await bodyHas(page, 'MARKED AS GONE'))
  log('status flipped to GONE:', await bodyHas(page, '● GONE'))
  log('report button hidden after gone:', !(await bodyHas(page, 'REPORT AS GONE')))
  await page.screenshot({ path: `${OUT}/07-desktop-gone.png` })

  // contribute flow
  await clickByText(page, '＋ ADD PHOTO / INFO', 'button')
  await sleep(300)
  log('contribute panel:', await bodyHas(page, 'ADD TO THIS CRANE'))
  await clickByText(page, 'SUBMIT CONTRIBUTION', 'button')
  await sleep(300)
  log('contribute toast:', await bodyHas(page, 'ADDED — THANKS!'))

  // empty region: pan far away via feed->stats->map? use map drag: jump via URL
  await page.goto(`${BASE}/?lat=47.552&lng=-122.108&z=13`, { waitUntil: 'networkidle2' })
  await sleep(1200)
  log('empty region panel:', await bodyHas(page, 'NOTHING PINNED HERE YET'))
  await page.screenshot({ path: `${OUT}/08-desktop-empty.png` })
  await clickByText(page, '← SHOW NEAREST CRANE', 'button')
  await sleep(800)
  log('nearest crane selected:', !(await bodyHas(page, 'NOTHING PINNED HERE YET')))

  // feed page
  await page.goto(`${BASE}/feed`, { waitUntil: 'networkidle2' })
  await sleep(400)
  log('feed heading:', await bodyHas(page, 'RECENTLY SPOTTED'))
  await page.screenshot({ path: `${OUT}/09-desktop-feed.png` })
  await clickByText(page, 'GONE', 'button')
  await sleep(300)
  const goneOnly = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('.feed-card .badge')]
    return badges.length > 0 && badges.every((b) => b.textContent.includes('GONE'))
  })
  log('gone filter shows only gone:', goneOnly)
  await clickByText(page, 'ALL', 'button')
  await sleep(200)
  // click first card -> should land on map with that crane selected
  const firstCard = await page.$eval('.feed-card .panel-title', (e) => e.textContent.trim())
  await page.click('.feed-card')
  await sleep(1500)
  log('feed card navigated to map, selected:', firstCard, '->', await bodyHas(page, firstCard.toUpperCase()))
  await page.screenshot({ path: `${OUT}/10-desktop-flyto.png` })

  // stats page
  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle2' })
  await sleep(400)
  log('stats heading:', await bodyHas(page, 'THE BIG PICTURE'))
  log('leaderboard has Seattle:', await bodyHas(page, 'Seattle'))
  log('hotspots section:', await bodyHas(page, 'CONSTRUCTION HOTSPOTS'))
  await page.screenshot({ path: `${OUT}/11-desktop-stats.png`, fullPage: true })
  // view on map from leaderboard
  await clickByText(page, 'VIEW ON MAP ↗', 'button')
  await sleep(1200)
  log('view-on-map landed on map:', await page.evaluate(() => location.pathname === '/'))
  await page.screenshot({ path: `${OUT}/12-desktop-viewonmap.png` })

  // 🔍 probe: submit crane with empty name
  await page.click('.fab')
  await sleep(300)
  await clickByText(page, 'PLACE HERE →', 'button')
  await sleep(300)
  await clickByText(page, 'SUBMIT CRANE', 'button')
  await sleep(400)
  log('probe empty-name submit -> fallback name:', await bodyHas(page, 'UNNAMED CRANE'))

  // 🔍 probe: welcome does not reappear after reload
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await sleep(800)
  log('probe welcome suppressed on reload:', !(await bodyHas(page, 'START EXPLORING')))

  await page.close()
}

// ---------- mobile ----------
{
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true })
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await sleep(1200)
  // welcome suppressed (same profile); clear to see mobile welcome
  await page.evaluate(() => localStorage.removeItem('ct_seen_v1'))
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1000)
  log('mobile welcome sheet:', await bodyHas(page, 'The cranes reshaping the skyline'))
  await page.screenshot({ path: `${OUT}/20-mobile-welcome.png` })
  await clickByText(page, 'START EXPLORING', 'button')
  await sleep(400)
  log('mobile collapsed sheet hint:', await bodyHas(page, 'TAP FOR PHOTOS'))
  await page.screenshot({ path: `${OUT}/21-mobile-map.png` })

  // expand sheet
  await page.tap('.sheet-handle')
  await sleep(500)
  log('mobile sheet expanded (coord visible):', await bodyHas(page, 'COORD —'))
  await page.screenshot({ path: `${OUT}/22-mobile-expanded.png` })

  // mobile add flow
  await page.tap('.sheet-handle')
  await sleep(400)
  await page.tap('.fab')
  await sleep(400)
  log('mobile add hint:', await bodyHas(page, 'DRAG THE PIN TO THE CRANE'))
  await clickByText(page, 'PLACE HERE →', 'button')
  await sleep(300)
  await page.type('input[placeholder="project name / nickname"]', 'Mobile Test Crane')
  await page.screenshot({ path: `${OUT}/23-mobile-form.png` })
  await clickByText(page, 'SUBMIT CRANE', 'button')
  await sleep(500)
  log('mobile crane added toast:', await bodyHas(page, 'CRANE ADDED ✓'))
  log('mobile new crane detail:', await bodyHas(page, 'MOBILE TEST CRANE'))
  await page.screenshot({ path: `${OUT}/24-mobile-added.png` })

  await page.close()
}

await browser.close()
log('DONE')
