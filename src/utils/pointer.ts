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
