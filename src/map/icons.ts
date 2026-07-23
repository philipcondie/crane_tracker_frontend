import L from 'leaflet'
import type { CraneStatus } from '../types'

/** Blueprint crosshair pin, matching the prototype's divIcon */
export function craneIcon(status: CraneStatus, selected: boolean): L.DivIcon {
  const color = status === 'active' ? '#16324f' : '#9aa7b5'
  const sz = selected ? 30 : 24
  const c = sz / 2
  const ring = selected ? 'box-shadow:0 0 0 4px #2aa9d440, 0 0 9px #2aa9d4;' : ''
  const html = `<div style="position:relative;width:${sz}px;height:${sz}px">
    <div style="position:absolute;left:${c - 1}px;top:0;width:2px;height:${sz}px;background:${color};box-shadow:0 0 2px rgba(0,0,0,.5)"></div>
    <div style="position:absolute;left:0;top:${c - 1}px;width:${sz}px;height:2px;background:${color};box-shadow:0 0 2px rgba(0,0,0,.5)"></div>
    <div style="position:absolute;left:${c - 7}px;top:${c - 7}px;width:14px;height:14px;border:2px solid ${color};border-radius:50%;background:rgba(22,50,79,.16);${ring}"></div>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [c, c] })
}

/**
 * Cluster bubble, drawn in the same blueprint language as craneIcon: navy ink,
 * cyan ring, hairline crosshair ticks bleeding out of the circle.
 *
 * Size steps with count rather than scaling continuously — three fixed sizes
 * stay legible and keep the icon anchor arithmetic exact, where a continuous
 * ramp would produce half-pixel centres and blur the ring.
 */
export function clusterIcon(count: number): L.DivIcon {
  const sz = count < 10 ? 32 : count < 100 ? 40 : 48
  const c = sz / 2
  const label = count < 1000 ? String(count) : `${Math.floor(count / 1000)}k+`
  const html = `<div style="position:relative;width:${sz}px;height:${sz}px">
    <div style="position:absolute;left:${c - 1}px;top:-4px;width:2px;height:${sz + 8}px;background:#16324f;opacity:.35"></div>
    <div style="position:absolute;left:-4px;top:${c - 1}px;width:${sz + 8}px;height:2px;background:#16324f;opacity:.35"></div>
    <div style="position:absolute;left:0;top:0;width:${sz}px;height:${sz}px;border:2px solid #16324f;border-radius:50%;background:rgba(233,235,237,.92);box-shadow:0 0 0 3px rgba(42,169,212,.25);display:flex;align-items:center;justify-content:center;font:600 ${count < 100 ? 12 : 11}px ui-monospace,SFMono-Regular,Menlo,monospace;color:#16324f;letter-spacing:.02em">${label}</div>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [c, c] })
}

/** Dashed cyan teardrop for the draggable "new crane" marker */
export function tempIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [34, 40],
    iconAnchor: [17, 36],
    html: `<div style="position:relative;width:34px;height:40px">
      <div style="position:absolute;left:4px;top:0;width:26px;height:26px;border:2.5px dashed #2aa9d4;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:rgba(42,169,212,.18)"></div>
      <div style="position:absolute;left:13px;top:30px;width:8px;height:4px;border-radius:50%;background:rgba(0,0,0,.25)"></div>
    </div>`,
  })
}
