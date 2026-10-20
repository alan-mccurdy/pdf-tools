import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, degrees } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { getClientXY, computeResize, RESIZE_HANDLES, resizeHandleStyle, usePinchZoom } from '../utils/pointer'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PlacedImage {
  id: string
  x: number; y: number; width: number; height: number
  page: number; imgBytes: Uint8Array
  imgSrc: string
  /** CSS-clockwise degrees */
  rotation?: number
}

/** Unified touch/mouse coordinates + resize math live in utils/pointer. */

export default function InsertarImagenes() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [images, setImages] = useState<PlacedImage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startImgX: number; startImgY: number } | null>(null)
  const [scale, setScale] = useState(1.5)
  const imgIdCounterRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())

  // ── Undo / Redo (same snapshot approach as EditarPdf) ──
  const [history, setHistory] = useState<PlacedImage[][]>([])
  const [redoStack, setRedoStack] = useState<PlacedImage[][]>([])

  const pushHistory = useCallback(() => {
    // Snapshot the CURRENT state before the action mutates it
    setHistory(h => [...(h.length >= 50 ? h.slice(h.length - 49) : h), images])
    setRedoStack([])
  }, [images])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setRedoStack(s => (s.length >= 50 ? s.slice(s.length - 49) : [...s, images]))
    setHistory(h => h.slice(0, -1))
    setImages(prev)
    setSelectedId(null)
  }, [history, images])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setHistory(h => (h.length >= 50 ? h.slice(h.length - 49) : [...h, images]))
    setRedoStack(s => s.slice(0, -1))
    setImages(next)
    setSelectedId(null)
  }, [redoStack, images])

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (desktop; phones use the toolbar buttons)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // Two-finger pinch-zoom on the canvas (phone/tablet); desktop keeps the slider
  const pinch = usePinchZoom(scale, setScale, 0.5, 3)

  useEffect(() => {
    if (!pdfFile) return
    const render = async () => {
      const bytes = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setTotalPages(pdf.numPages)
      const page = await pdf.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport } as never).promise
    }
    render()
  }, [pdfFile, currentPage, scale])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  // Placed images are stored in scaled overlay px — rescale them on zoom so
  // they stay anchored to the page. Without this, changing the slider after
  // placing drifts every image on screen AND exports at the wrong PDF coords
  // (export divides by the current scale). Same effect as EditarPdf's.
  const lastScaleRef = useRef(scale)
  useEffect(() => {
    const prev = lastScaleRef.current
    if (prev === scale) return
    const r = scale / prev
    setImages(prevImgs => prevImgs.map(img => ({
      ...img,
      x: img.x * r,
      y: img.y * r,
      width: img.width * r,
      height: img.height * r,
    })))
    lastScaleRef.current = scale
  }, [scale])

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgFile) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const bytes = new Uint8Array(await imgFile.arrayBuffer())
    const imgSrc = URL.createObjectURL(new Blob([bytes]))
    objectUrlsRef.current.add(imgSrc)
    const id = `img-${++imgIdCounterRef.current}`
    pushHistory()
    setImages(prev => [...prev, { id, x: x - 75, y: y - 75, width: 150, height: 150, page: currentPage, imgBytes: bytes, imgSrc, rotation: 0 }])
    setSelectedId(id)
  }

  const handleImageMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const img = images.find(i => i.id === id)
    if (!img) return
    pushHistory() // undo restores the pre-drag position
    const rect = canvasRef.current!.getBoundingClientRect()
    setDragging({ id, offsetX: e.clientX - rect.left - img.x, offsetY: e.clientY - rect.top - img.y })
  }

  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation()
    const img = images.find(i => i.id === id)
    if (!img) return
    pushHistory() // undo restores the pre-resize geometry
    setResizing({ id, handle, startX: e.clientX, startY: e.clientY, startW: img.width, startH: img.height, startImgX: img.x, startImgY: img.y })
  }

  // ── Touch paths (window-level so the drag survives leaving the element) ──

  const handleImageTouchStart = (e: React.TouchEvent, id: string) => {
    e.stopPropagation()
    if (e.touches.length > 1) return // pinch, not drag
    const img = images.find(i => i.id === id)
    if (!img) return
    setSelectedId(id)
    pushHistory() // undo restores the pre-drag position
    const rect = canvasRef.current!.getBoundingClientRect()
    const offsetX = e.touches[0].clientX - rect.left - img.x
    const offsetY = e.touches[0].clientY - rect.top - img.y
    const move = (ev: TouchEvent) => {
      if (ev.touches.length > 1) return // second finger = pinch, freeze the drag
      ev.preventDefault() // block page scroll while dragging
      const c = getClientXY(ev)
      const r = canvasRef.current!.getBoundingClientRect()
      setImages(prev => prev.map(i =>
        i.id === id ? { ...i, x: c.clientX - r.left - offsetX, y: c.clientY - r.top - offsetY } : i
      ))
    }
    const up = () => {
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', up)
  }

  const handleResizeTouchStart = (e: React.TouchEvent, id: string, handle: string) => {
    e.stopPropagation()
    if (e.touches.length > 1) return // pinch, not resize
    const img = images.find(i => i.id === id)
    if (!img) return
    pushHistory() // undo restores the pre-resize geometry
    const t = e.touches[0]
    const start = { x: t.clientX, y: t.clientY }
    const s = { w: img.width, h: img.height, ix: img.x, iy: img.y }
    const move = (ev: TouchEvent) => {
      if (ev.touches.length > 1) return // second finger = pinch, freeze the resize
      ev.preventDefault()
      const c = getClientXY(ev)
      const next = computeResize(handle, c.clientX - start.x, c.clientY - start.y, s, ev.shiftKey)
      setImages(prev => prev.map(i => (i.id === id ? { ...i, ...next } : i)))
    }
    const up = () => {
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', up)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging && !resizing) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (dragging) {
      setImages(prev => prev.map(img =>
        img.id === dragging.id
          ? { ...img, x: mouseX - dragging.offsetX, y: mouseY - dragging.offsetY }
          : img
      ))
    }

    if (resizing) {
      const next = computeResize(
        resizing.handle,
        e.clientX - resizing.startX,
        e.clientY - resizing.startY,
        { w: resizing.startW, h: resizing.startH, ix: resizing.startImgX, iy: resizing.startImgY },
        e.shiftKey,
      )
      setImages(prev => prev.map(img => (img.id === resizing.id ? { ...img, ...next } : img)))
    }
  }, [dragging, resizing])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setResizing(null)
  }, [])

  const handleDeleteImage = (id: string) => {
    // No URL.revokeObjectURL here: undo must be able to restore the image.
    // URLs are revoked on "Limpiar todo" and on unmount.
    pushHistory()
    setImages(prev => prev.filter(img => img.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleDuplicateImage = (id: string) => {
    const img = images.find(i => i.id === id)
    if (!img) return
    pushHistory()
    const newId = `img-${++imgIdCounterRef.current}`
    setImages(prev => [...prev, { ...img, id: newId, x: img.x + 16, y: img.y + 16 }])
    setSelectedId(newId)
  }

  const handleRotateImage = (id: string) => {
    pushHistory()
    setImages(prev => prev.map(i =>
      i.id === id ? { ...i, rotation: ((i.rotation ?? 0) + 90) % 360 } : i
    ))
  }

  const handleDownload = async () => {
    if (!pdfFile || !images.length) return
    setLoading(true)
    try {
      const bytes = await pdfFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(bytes)

      for (const img of images) {
        let embedded: Awaited<ReturnType<typeof pdfDoc.embedPng>>
        if (img.imgBytes[0] === 0x89) {
          embedded = await pdfDoc.embedPng(img.imgBytes)
        } else {
          embedded = await pdfDoc.embedJpg(img.imgBytes)
        }
        const page = pdfDoc.getPage(img.page)
        const { height } = page.getSize()
        // Rotate around the image CENTER to match the CSS preview (which
        // rotates around 50% 50%). pdf-lib rotates around the lower-left
        // (x,y) of the drawn rect, CCW in degrees; CSS rotation is CW —
        // so A = 360 - cssRotation and the origin is back-projected:
        //   origin = center − R(A)·(W/2, H/2)
        const W = img.width / scale
        const H = img.height / scale
        const cx = img.x / scale + W / 2
        const cy = height - img.y / scale - H / 2
        const A = (360 - ((img.rotation ?? 0) % 360)) % 360
        const rad = (A * Math.PI) / 180
        page.drawImage(embedded, {
          x: cx - (W / 2) * Math.cos(rad) + (H / 2) * Math.sin(rad),
          y: cy - (W / 2) * Math.sin(rad) - (H / 2) * Math.cos(rad),
          width: W,
          height: H,
          rotate: degrees(A),
        })
      }

      const newBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(newBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `con-imagenes-${pdfFile.name}`
      a.click()
    } finally {
      setLoading(false)
    }
  }

  const currentImages = images.filter(img => img.page === currentPage)

  return (
    <PDFToolLayout
      title="Insertar Imagenes en PDF"
      description="Agrega imagenes o firmas a tu PDF. Arrastra, redimensiona y posiciona donde quieras."
      keyword="Insertar Imagenes"
    >
      <div className="space-y-4">
        <PDFUploader onFiles={f => f[0] && setPdfFile(f[0])} />

        <div>
          <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Selecciona la imagen a insertar:</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files?.[0] && setImgFile(e.target.files[0])}
            className="text-sm"
          />
        </div>
      </div>

      {pdfFile && (
        <div className="mt-4">
          {/* Zoom slider + undo/redo */}
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Zoom:</label>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="flex-1 max-w-[200px]"
            />
            <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{scale.toFixed(1)}x</span>
            <button
              className="spatial-btn-icon"
              onClick={undo}
              disabled={history.length === 0}
              title="Deshacer (Ctrl+Z)"
              style={{ opacity: history.length === 0 ? 0.4 : 1 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
              </svg>
            </button>
            <button
              className="spatial-btn-icon"
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Rehacer (Ctrl+Shift+Z)"
              style={{ opacity: redoStack.length === 0 ? 0.4 : 1 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" />
              </svg>
            </button>
          </div>

          {/* touchAction pan-y keeps single-finger page scroll; pinch is ours */}
          <div
            className="relative inline-block"
            style={{ touchAction: 'pan-y' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            {...pinch}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded-lg cursor-crosshair"
            />

            {currentImages.map(img => (
              <div
                key={img.id}
                className={`absolute ${selectedId === img.id ? 'ring-2 ring-[var(--accent)]' : ''}`}
                style={{ left: img.x, top: img.y, width: img.width, height: img.height, touchAction: 'none' }}
                onClick={e => { e.stopPropagation(); setSelectedId(img.id) }}
                onMouseDown={e => handleImageMouseDown(e, img.id)}
                onTouchStart={e => handleImageTouchStart(e, img.id)}
              >
                <img
                  src={img.imgSrc}
                  alt="Placed"
                  className="w-full h-full object-contain pointer-events-none"
                  style={{ transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined }}
                  draggable={false}
                />

                {selectedId === img.id && (
                  <>
                    {/* Resize handles */}
                    {RESIZE_HANDLES.map(h => (
                      <div
                        key={h}
                        className="absolute w-3 h-3 bg-[var(--accent)] rounded-full cursor-pointer touch-hit"
                        style={resizeHandleStyle(h)}
                        onMouseDown={e => handleResizeMouseDown(e, img.id, h)}
                        onTouchStart={e => handleResizeTouchStart(e, img.id, h)}
                      />
                    ))}

                    {/* Rotate 90° */}
                    <button
                      className="absolute -top-2 -right-8 w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center hover:bg-sky-600 z-10 touch-hit"
                      title="Rotar 90 grados"
                      onClick={e => { e.stopPropagation(); handleRotateImage(img.id) }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5" />
                      </svg>
                    </button>

                    {/* Duplicate */}
                    <button
                      className="absolute -top-2 -right-14 w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center hover:bg-sky-600 z-10 touch-hit"
                      title="Duplicar"
                      onClick={e => { e.stopPropagation(); handleDuplicateImage(img.id) }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>

                    {/* Delete button */}
                    <button
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-10 touch-hit"
                      onClick={e => { e.stopPropagation(); handleDeleteImage(img.id) }}
                    >
                      X
                    </button>

                    {/* Size label */}
                    <div className="absolute -bottom-5 left-0 text-xs px-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      {Math.round(img.width)}x{Math.round(img.height)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {currentImages.length === 0 && imgFile && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Haz clic en el PDF para colocar la imagen
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="spatial-btn text-sm"
              >
                Anterior
              </button>
              <span className="text-sm self-center" style={{ color: 'var(--text-secondary)' }}>
                Pagina {currentPage + 1} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="spatial-btn text-sm"
              >
                Siguiente
              </button>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <DownloadButton
              onClick={handleDownload}
              disabled={!images.length}
              loading={loading}
              label={`Descargar con ${images.length} imagen(es)`}
            />
            {images.length > 0 && (
              <button
                onClick={() => {
                  // Keep the object URLs alive so undo can restore them;
                  // they are all revoked by the unmount cleanup below.
                  pushHistory()
                  setImages([])
                  setSelectedId(null)
                }}
                className="spatial-btn text-sm"
              >
                Limpiar todo
              </button>
            )}
          </div>
        </div>
      )}
    </PDFToolLayout>
  )
}
