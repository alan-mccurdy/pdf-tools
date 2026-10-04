import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { savePdf } from '../utils/pdfHelpers'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface MergeItem { name: string; bytes: Uint8Array; pages: number; thumbnail?: string }

export default function UnirPdf() {
  const [items, setItems] = useState<MergeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const handleFiles = async (files: File[]) => {
    const newItems: MergeItem[] = []
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const doc = await PDFDocument.load(bytes)
      // Render first page as thumbnail
      let thumbnail: string | undefined
      try {
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport } as any).promise
        thumbnail = canvas.toDataURL('image/png')
      } catch { /* ignore thumbnail errors */ }
      newItems.push({ name: file.name, bytes, pages: doc.getPageCount(), thumbnail })
    }
    setItems(prev => [...prev, ...newItems])
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx) }
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return }
    const updated = [...items]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(idx, 0, moved)
    setItems(updated)
    setDragIdx(null)
    setOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const updated = [...items]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    setItems(updated)
  }
  const moveDown = (idx: number) => {
    if (idx >= items.length - 1) return
    const updated = [...items]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    setItems(updated)
  }

  const handleDownload = async () => {
    if (items.length < 2) return
    setLoading(true)
    try {
      const merged = await PDFDocument.create()
      for (const item of items) {
        const src = await PDFDocument.load(item.bytes)
        const copied = await merged.copyPages(src, src.getPageIndices())
        copied.forEach(p => merged.addPage(p))
      }
      await savePdf(merged, 'unido.pdf')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Unir PDFs Online Gratis"
      description="Combina multiples archivos PDF en uno solo. Ordena y descarga."
      keyword="Unir PDFs"
    >
      <PDFUploader multiple onFiles={handleFiles} />

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Arrastra para reordenar o usa las flechas
          </p>
          {items.map((item, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between spatial-card-static px-4 py-3 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                dragIdx === idx ? 'opacity-50 scale-[0.98]' : ''
              } ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? 'ring-2 ring-[var(--accent)]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono w-5 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {idx + 1}
                </span>
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-10 h-14 object-contain rounded flex-shrink-0"
                    style={{ background: 'var(--surface-1)' }}
                  />
                ) : (
                  <div
                    className="w-10 h-14 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'var(--surface-1)', color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>({item.pages} pag.)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="spatial-btn-icon !p-1 disabled:opacity-30"
                  title="Mover arriba"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1}
                  className="spatial-btn-icon !p-1 disabled:opacity-30"
                  title="Mover abajo"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button onClick={() => removeItem(idx)} className="spatial-btn-danger text-sm !py-1 !px-3">
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DownloadButton
        onClick={handleDownload}
        disabled={items.length < 2}
        loading={loading}
        label={`Unir y descargar (${items.length} archivos)`}
      />
    </PDFToolLayout>
  )
}
