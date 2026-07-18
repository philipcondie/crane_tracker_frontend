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
