import type { ChangeEvent, CSSProperties } from 'react'
import type { CraneDetail } from '../types'
import { readFilesAsDataUrls } from '../utils'

export function wrapIndex(idx: number, len: number): number {
  return len ? ((idx % len) + len) % len : 0
}

/** Crosshair glyph on a light square — used in the welcome legend and photo placeholders */
export function PinGlyph({ size = 22, gone = false }: { size?: number; gone?: boolean }) {
  const color = gone ? '#9aa7b5' : '#16324f'
  const bar = Math.round(size * 0.72)
  const off = Math.round((size - bar) / 2)
  const mid = Math.round(size / 2) - 1
  const ring = Math.round(size * 0.45)
  const ringOff = Math.round((size - ring) / 2)
  const box: CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    background: '#e9ebed',
    borderRadius: 3,
    position: 'relative',
  }
  return (
    <div style={box}>
      <div style={{ position: 'absolute', left: mid, top: off, width: 2, height: bar, background: color }} />
      <div style={{ position: 'absolute', left: off, top: mid, width: bar, height: 2, background: color }} />
      <div
        style={{
          position: 'absolute',
          left: ringOff,
          top: ringOff,
          width: ring,
          height: ring,
          border: `2px solid ${color}`,
          borderRadius: '50%',
          background: 'rgba(22,50,79,.16)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

interface PhotoBoxProps {
  crane: CraneDetail
  idx: number
  height: number
  onPrev?: () => void
  onNext?: () => void
}

/** Photo carousel frame: hatched placeholder, session image if uploaded, ‹ › paging */
export function PhotoBox({ crane, idx, height, onPrev, onNext }: PhotoBoxProps) {
  const len = crane.imgs.length
  const pos = wrapIndex(idx, len)
  const label = len ? `${pos + 1} / ${len}` : `01 / ${crane.photos || 1}`
  return (
    <div className="photo-box hatch" style={{ height }}>
      {len > 0 && <img src={crane.imgs[pos]} alt={crane.name} />}
      <span className="photo-tag">PHOTO {label}</span>
      {len > 1 && onPrev && onNext && (
        <>
          <button className="photo-arrow" style={{ left: 8 }} onClick={onPrev} aria-label="Previous photo">
            ‹
          </button>
          <button className="photo-arrow" style={{ right: 8 }} onClick={onNext} aria-label="Next photo">
            ›
          </button>
        </>
      )}
    </div>
  )
}

interface ThumbStripProps {
  imgs: string[]
  onFiles: (urls: string[]) => void
  onRemove: (i: number) => void
  w: number
  h: number
}

/** Staged upload thumbnails with ✕ remove and a dashed ADD PHOTO tile (max 3) */
export function ThumbStrip({ imgs, onFiles, onRemove, w, h }: ThumbStripProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    readFilesAsDataUrls(input.files, 3 - imgs.length, onFiles)
    input.value = ''
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {imgs.map((url, i) => (
        <div key={i} className="thumb" style={{ width: w, height: h }}>
          <img src={url} alt={`upload ${i + 1}`} />
          <button className="thumb-x" onClick={() => onRemove(i)} aria-label="Remove photo">
            ✕
          </button>
        </div>
      ))}
      {imgs.length < 3 && (
        <label className="add-photo" style={{ width: w, height: h }}>
          <span>＋</span>ADD PHOTO
          <input type="file" accept="image/*" multiple onChange={handleChange} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  )
}
