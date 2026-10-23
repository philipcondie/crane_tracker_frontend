// Browser smoke test with API responses stubbed to the documented contract.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const executablePath = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync)
assert(executablePath, 'Chrome or Chromium is required')
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
const base = process.env.APP_URL ?? 'http://localhost:5199'
mkdirSync('/tmp/crane-verify', { recursive: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ct_seen_v1', '1')
    window.apiRequests = []
    const crane = { id: 'crane-1', projectName: 'Harbor Tower', status: 'active', city: 'Seattle', neighborhood: 'Belltown', addedAt: '2026-10-01T12:00:00Z', lat: 47.62, lng: -122.34, photos: 1, contribs: 1 }
    const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#1c3f63"/><path d="M400 550V80H700M100 120H700" stroke="#58d3ef" stroke-width="18" fill="none"/></svg>')
    const photo = { id: 'photo-1', craneId: crane.id, url: image, originalFilename: 'harbor.jpg', contentType: 'image/jpeg', addedAt: crane.addedAt }
    const realFetch = window.fetch.bind(window)
    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
      if (!url.pathname.startsWith('/cranes') && !url.pathname.startsWith('/admin')) return realFetch(input, options)
      window.apiRequests.push({ path: url.pathname, method: options.method ?? 'GET', auth: new Headers(options.headers).get('Authorization') })
      const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
      if (url.pathname === '/admin/login') return json({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 })
      if (url.pathname === '/admin/logout' || options.method === 'DELETE') return new Response(null, { status: 204 })
      if (url.pathname === '/cranes/photos') return json({ photos: [photo], end: true })
      if (options.method === 'POST' && url.pathname.endsWith('/photos')) return json(photo)
      if (options.method === 'POST' && url.pathname === '/cranes') return json(crane)
      if (url.pathname === '/cranes') return json({ cranes: [crane], truncated: false })
      return json({ ...crane, photoItems: [photo], links: [] })
    }
  })
  const clickText = async text => {
    const button = await page.waitForFunction(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text), {}, text)
    await button.asElement().click()
  }
  await page.goto(`${base}/admin`)
  await page.waitForSelector('#admin-username')
  assert.equal((await page.evaluate(() => window.apiRequests)).length, 0)
  await page.screenshot({ path: '/tmp/crane-verify/admin-signin.png' })
  await page.type('#admin-username', 'admin')
  await page.type('#admin-password', 'password')
  await clickText('Sign in')
  await page.waitForSelector('.admin-photo-card')
  await page.screenshot({ path: '/tmp/crane-verify/admin-grid-desktop.png' })
  await page.click('.admin-preview-button')
  await page.waitForSelector('[role="dialog"]')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close preview')
  await page.click('[aria-label="Close preview"]')
  assert.equal(await page.$('[role="dialog"]'), null)
  await clickText('Delete photo')
  await page.waitForSelector('[role="alertdialog"] img')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close delete confirmation')
  await page.screenshot({ path: '/tmp/crane-verify/admin-delete-desktop.png' })
  await page.click('[aria-label="Close delete confirmation"]')
  assert.equal(await page.$('[role="alertdialog"]'), null)
  await page.setViewport({ width: 390, height: 780 })
  await page.screenshot({ path: '/tmp/crane-verify/admin-grid-mobile.png' })
  await clickText('Delete photo')
  await page.screenshot({ path: '/tmp/crane-verify/admin-delete-mobile.png' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await clickText('Delete permanently')
  await page.waitForFunction(() => document.body.textContent.includes('No photos to review'))
  const protectedRequests = await page.evaluate(() => window.apiRequests.filter(r => r.path === '/cranes/photos' || r.method === 'DELETE'))
  assert(protectedRequests.every(r => r.auth === 'Bearer test-token'))
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).then(text => text.includes('test-token')), false)
  await page.reload()
  await page.waitForSelector('#admin-username')
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${base}/?crane=crane-1`)
  await page.waitForFunction(() => document.body.textContent.includes('Harbor Tower'))
  assert.equal(await page.$('#admin-username'), null)
  await page.click('[aria-label="Add a crane"]')
  const placement = await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => /PLACE|CONTINUE/.test(b.textContent)))
  await placement.asElement().click()
  await page.waitForSelector('input[type="file"]')
  // A real PNG is processed by the existing anonymous photo selection flow.
  await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
    canvas.getContext('2d').fillRect(0, 0, 32, 32)
    const bytes = Uint8Array.from(atob(canvas.toDataURL().split(',')[1]), c => c.charCodeAt(0))
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'crane.png', { type: 'image/png' }))
    const input = document.querySelector('input[type="file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('.thumb img')
  await page.type('input[placeholder="e.g. Harbor Point Tower"]', 'Anonymous crane')
  await clickText('SUBMIT CRANE')
  await page.waitForFunction(() => window.apiRequests.some(r => r.method === 'POST' && r.path.endsWith('/photos')))
  const publicRequests = await page.evaluate(() => window.apiRequests.filter(r => r.path.startsWith('/cranes')))
  assert(publicRequests.every(r => r.auth === null))
  await page.screenshot({ path: '/tmp/crane-verify/public-anonymous.png' })
  console.log('Desktop/mobile admin review, keyboard dialogs, reload sign-in, and anonymous view/create/upload passed.')
} finally {
  await browser.close()
}
