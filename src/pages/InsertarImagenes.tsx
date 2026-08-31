import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PlacedImage {
  id: string
  x: number; y: number; width: number; height: number
  page: number; imgBytes: Uint8Array
  imgSrc: string
}

let imgIdCounter = 0

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!pdfFile) return
    const render = async () => {
      const bytes = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setTotalPages(pdf.numPages)
      const page = await pdf.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport } as never).promise
    }
    render()
  }, [pdfFile, currentPage])

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgFile) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const bytes = new Uint8Array(await imgFile.arrayBuffer())
    const imgSrc = URL.createObjectURL(new Blob([bytes]))
    const id = `img-${++imgIdCounter}`
    setImages(prev => [...prev, { id, x: x - 75, y: y - 75, width: 150, height: 150, page: currentPage, imgBytes: bytes, imgSrc }])
    setSelectedId(id)
  }

  const handleImageMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const img = images.find(i => i.id === id)
    if (!img) return
    const rect = canvasRef.current!.getBoundingClientRect()
    setDragging({ id, offsetX: e.clientX - rect.left - img.x, offsetY: e.clientY - rect.top - img.y })
  }

  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation()
    const img = images.find(i => i.id === id)
    if (!img) return
    setResizing({ id, handle, startX: e.clientX, startY: e.clientY, startW: img.width, startH: img.height, startImgX: img.x, startImgY: img.y })
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
      const dx = e.clientX - resizing.startX
      const dy = e.clientY - resizing.startY
      const minSize = 30

      setImages(prev => prev.map(img => {
        if (img.id !== resizing.id) return img
        let newW = resizing.startW
        let newH = resizing.startH
        let newX = resizing.startImgX
        let newY = resizing.startImgY

        if (resizing.handle.includes('e')) newW = Math.max(minSize, resizing.startW + dx)
        if (resizing.handle.includes('w')) {
          newW = Math.max(minSize, resizing.startW - dx)
          newX = resizing.startImgX + (resizing.startW - newW)
        }
        if (resizing.handle.includes('s')) newH = Math.max(minSize, resizing.startH + dy)
        if (resizing.handle.includes('n')) {
          newH = Math.max(minSize, resizing.startH - dy)
          newY = resizing.startImgY + (resizing.startH - newH)
        }

        // Lock aspect ratio with shift
        if (e.shiftKey) {
          const aspect = resizing.startW / resizing.startH
          if (Math.abs(dx) > Math.abs(dy)) {
            newH = newW / aspect
          } else {
            newW = newH * aspect
          }
        }

        return { ...img, x: newX, y: newY, width: newW, height: newH }
      }))
    }
  }, [dragging, resizing])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setResizing(null)
  }, [])

  const handleDeleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
    if (selectedId === id) setSelectedId(null)
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
        page.drawImage(embedded, {
          x: img.x / 1.5,
          y: height - img.y / 1.5 - img.height / 1.5,
          width: img.width / 1.5,
          height: img.height / 1.5,
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
          <div
            className="relative inline-block"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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
                style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
                onClick={e => { e.stopPropagation(); setSelectedId(img.id) }}
                onMouseDown={e => handleImageMouseDown(e, img.id)}
              >
                <img
                  src={img.imgSrc}
                  alt="Placed"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />

                {selectedId === img.id && (
                  <>
                    {/* Resize handles */}
                    {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(h => (
                      <div
                        key={h}
                        className="absolute w-3 h-3 bg-[var(--accent)] rounded-full cursor-pointer"
                        style={{
                          top: h.includes('n') ? -6 : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                          left: h.includes('w') ? -6 : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                          cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : h === 'ne' || h === 'sw' ? 'nesw-resize' : h === 'n' || h === 's' ? 'ns-resize' : 'ew-resize',
                        }}
                        onMouseDown={e => handleResizeMouseDown(e, img.id, h)}
                      />
                    ))}

                    {/* Delete button */}
                    <button
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-10"
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
                onClick={() => { setImages([]); setSelectedId(null) }}
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
