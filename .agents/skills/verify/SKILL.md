---
name: verify
description: Build, launch, and drive the Crane Tracker frontend to verify changes end-to-end.
---

# Verifying Crane Tracker (Vite + React + Leaflet)

## Build / launch

```bash
npm run build                 # tsc -b && vite build (type check + bundle)
npm run dev -- --port 5199    # dev server (run in background)
```

## Drive

Headless Chrome via puppeteer-core (devDependency) with the system browser at
`/usr/bin/google-chrome` — no Playwright download needed:

```bash
mkdir -p /tmp/crane-verify
node scripts/drive.mjs        # full desktop + mobile flow sweep, screenshots to /tmp/crane-verify
```

`scripts/drive.mjs` covers: welcome overlay (localStorage `ct_seen_v1`), pin
selection, satellite toggle, add-crane flow (FAB → drag hint → form → submit →
toast), report-as-gone, contribute, empty-region state (jump via
`/?lat=47.552&lng=-122.108&z=13`), feed filters + fly-to-map, stats leaderboard
+ view-on-map, and the mobile bottom-sheet variants at 390×780.

## Gotchas

- Map tiles come from carto.com / arcgisonline.com — needs network; allow
  ~1.2s after navigation before screenshotting so tiles land.
- The welcome overlay only shows when `ct_seen_v1` is absent from
  localStorage; clear it to re-test first-run.
- Crane data is in-memory only (resets on reload) — cross-page flows must
  happen without a full page reload, or re-seed expectations.
