import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface TextBox {
  id: number
  x: number
  y: number
  text: string
  page: number
  fontSize: number
  fontColor: string
}

export default function EditarPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [boxes, setBoxes] = useState<TextBox[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [fontColor, setFontColor] = useState('#000000')
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [scale, setScale] = useState(1.5)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const dragRef = useRef<{ id: number; startX: number; startY: number; boxX: number; boxY: number } | null>(null)

  // Render current PDF page
  useEffect(() => {
    if (!file) return
    const render = async () => {
      const bytes = await file.arrayBuffer()
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
  }, [file, currentPage, scale])

  // Handle click on overlay to create text box
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't create box if clicking on existing box or its children
    if ((e.target as HTMLElement).closest('.txt-box')) return
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = nextId.current++
    setBoxes(prev => [...prev, { id, x, y, text: '', page: currentPage, fontSize, fontColor }])
    setSelectedBox(id)
  }, [currentPage, fontSize, fontColor])

  // Delete a text box
  const deleteBox = useCallback((id: number) => {
    setBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedBox(prev => prev === id ? null : prev)
  }, [])

  // Update text content
  const updateText = useCallback((id: number, text: string) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, text } : b))
  }, [])

  // Start dragging
  const handleDragStart = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const box = boxes.find(b => b.id === id)
    if (!box) return
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, boxX: box.x, boxY: box.y }
    setSelectedBox(id)

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setBoxes(prev => prev.map(b =>
        b.id === dragRef.current!.id
          ? { ...b, x: dragRef.current!.boxX + dx, y: dragRef.current!.boxY + dy }
          : b
      ))
    }

    const handleUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [boxes])

  // Build final PDF with text burned in
  const handleDownload = async () => {
    if (!file) return
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(bytes)
      const fonts = {
        Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        'Helvetica-Bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      }

      const pageBoxes = boxes.filter(b => b.page === currentPage)
      for (const box of pageBoxes) {
        if (!box.text.trim()) continue
        const page = pdfDoc.getPage(box.page)
        const { height } = page.getSize()
        const font = fonts.Helvetica
        page.drawText(box.text, {
          x: box.x / scale,
          y: height - box.y / scale - box.fontSize,
          font,
          size: box.fontSize,
          color: hexToRgb(box.fontColor),
        })
      }

      const newBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(newBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `editado-${file.name}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentBoxes = boxes.filter(b => b.page === currentPage)

  return (
    <PDFToolLayout
      title="Editar PDF Online Gratis"
      description="Escribe y edita texto directamente sobre las paginas de tu PDF. Gratis y sin subir archivos a servidores."
      keyword="Editar PDF"
    >
      <PDFUploader onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Tamano:</label>
              <input
                type="number"
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                min={6}
                max={72}
                className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Color:</label>
              <input
                type="color"
                value={fontColor}
                onChange={e => setFontColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Zoom:</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={scale}
                onChange={e => setScale(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-xs text-gray-500">{(scale * 100).toFixed(0)}%</span>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              Click en la pagina para agregar texto
            </div>
          </div>

          {/* PDF + Overlay */}
          <div className="relative inline-block border border-gray-700 rounded-xl overflow-hidden">
            <canvas ref={canvasRef} className="block" />
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              onClick={handleOverlayClick}
            >
              {currentBoxes.map(box => (
                <div
                  key={box.id}
                  className={`txt-box absolute group ${selectedBox === box.id ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ left: box.x, top: box.y }}
                  onClick={e => { e.stopPropagation(); setSelectedBox(box.id) }}
                >
                  {/* Drag handle */}
                  <div
                    className="absolute -top-5 left-0 px-1.5 py-0.5 bg-gray-900 text-white text-[9px] rounded-t cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={e => handleDragStart(e, box.id)}
                  >
                    Arrastrar
                  </div>
                  {/* Delete button */}
                  <button
                    className="absolute -top-5 right-0 w-4 h-4 bg-red-500 text-white text-[10px] rounded-t opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    onClick={e => { e.stopPropagation(); deleteBox(box.id) }}
                  >
                    X
                  </button>
                  {/* Editable text */}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="min-w-[60px] min-h-[20px] px-1 py-0.5 border border-dashed border-gray-400 bg-white/70 backdrop-blur-sm text-black outline-none focus:border-blue-500 whitespace-pre"
                    style={{ fontSize: box.fontSize, fontFamily: 'Helvetica, Arial, sans-serif' }}
                    onInput={e => updateText(box.id, (e.target as HTMLDivElement).textContent || '')}
                    onFocus={() => setSelectedBox(box.id)}
                  >
                    {box.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Page navigation */}
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-400 self-center">
                Pagina {currentPage + 1} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}

          {/* Download */}
          <DownloadButton
            onClick={handleDownload}
            disabled={!boxes.some(b => b.text.trim())}
            loading={loading}
            label={`Descargar con ${boxes.length} texto(s)`}
          />
        </div>
      )}
    </PDFToolLayout>
  )
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
