import { useRef } from 'react'
import type React from 'react'

/**
 * Unified touch/mouse coordinates for editor drag/resize handlers.
 * Touch listeners must be attached at window level (the finger routinely
 * leaves the element while dragging) with { passive: false } so
 * preventDefault can block page scroll.
 */
export const getClientXY = (
  e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
) => {
  if ('touches' in e && e.touches.length > 0) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
  }
  if ('changedTouches' in e && e.changedTouches.length > 0) {
    return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
  }
  return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY }
}

/**
 * 8-direction resize math shared by mouse and touch paths.
 * Free-form by default; pass lockAspect (shift on desktop) to keep the ratio.
 */
export const computeResize = (
  handle: string,
  dx: number,
  dy: number,
  s: { w: number; h: number; ix: number; iy: number },
  lockAspect: boolean,
) => {
  const minSize = 30
  let newW = s.w
  let newH = s.h
  let newX = s.ix
  let newY = s.iy

  if (handle.includes('e')) newW = Math.max(minSize, s.w + dx)
  if (handle.includes('w')) {
    newW = Math.max(minSize, s.w - dx)
    newX = s.ix + (s.w - newW)
  }
  if (handle.includes('s')) newH = Math.max(minSize, s.h + dy)
  if (handle.includes('n')) {
    newH = Math.max(minSize, s.h - dy)
    newY = s.iy + (s.h - newH)
  }

  if (lockAspect) {
    const aspect = s.w / s.h
    if (Math.abs(dx) > Math.abs(dy)) {
      newH = newW / aspect
    } else {
      newW = newH * aspect
    }
  }

  return { x: newX, y: newY, width: newW, height: newH }
}

/** CSS for the 8 resize handles (position offsets per handle name). */
export const RESIZE_HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const

export const resizeHandleStyle = (h: string): React.CSSProperties => ({
  top: h.includes('n') ? -6 : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
  left: h.includes('w') ? -6 : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
  cursor:
    h === 'nw' || h === 'se' ? 'nwse-resize'
    : h === 'ne' || h === 'sw' ? 'nesw-resize'
    : h === 'n' || h === 's' ? 'ns-resize'
    : 'ew-resize',
  touchAction: 'none',
})

/**
 * Two-finger pinch-zoom for the PDF canvas. Attach the returned handlers to
 * the canvas WRAPPER div (style it touchAction: 'pan-y' — that keeps
 * single-finger vertical page scroll working while the browser itself cannot
 * page-zoom, because 'pinch-zoom' is not listed in touch-action).
 * Multi-touch guards elsewhere (overlay tap-to-create, drag/resize window
 * listeners) must ignore events with >1 touches so a pinch never creates
 * boxes or teleports elements.
 */
export function usePinchZoom(
  scale: number,
  setScale: React.Dispatch<React.SetStateAction<number>>,
  min = 0.5,
  max = 3,
) {
  const start = useRef<{ dist: number; scale: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) { start.current = null; return }
    e.preventDefault()
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    start.current = { dist: Math.hypot(dx, dy) || 1, scale }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !start.current) return
    e.preventDefault()
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const next = start.current.scale * (Math.hypot(dx, dy) / start.current.dist)
    setScale(Math.min(max, Math.max(min, next)))
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) start.current = null
  }
  return { onTouchStart, onTouchMove, onTouchEnd }
}

/**
 * Eraser hit-test: is point (px,py) within radius r of any segment of the
 * polyline (or the point itself for single-point strokes)?
 */
export const strokeHitTest = (
  points: { x: number; y: number }[],
  px: number,
  py: number,
  r: number,
) => {
  if (points.length === 0) return false
  if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y) <= r
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2))
    if (Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)) <= r) return true
  }
  return false
}
