import { useState, useEffect } from 'react'
import type { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PageThumbnailGridProps {
  pdfDoc: PDFDocument
  pages: { index: number; width: number; height: number }[]
  selected: number[]
  onSelect: (indices: number[]) => void
  label?: string
}

export default function PageThumbnailGrid({
  pdfDoc,
  pages,
  selected,
  onSelect,
  label = 'Click para seleccionar paginas',
}: PageThumbnailGridProps) {
  const [thumbnails, setThumbnails] = useState<string[]>([])

  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return
    let cancelled = false

    const render = async () => {
      const bytes = await pdfDoc.save()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const urls: string[] = []

      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1)
        const viewport = page.getViewport({ scale: 0.3 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport } as any).promise
        urls.push(canvas.toDataURL('image/png'))
      }

      if (!cancelled) setThumbnails(urls)
    }

    render()
    return () => { cancelled = true }
  }, [pdfDoc, pages])

  const toggle = (idx: number) => {
    onSelect(
      selected.includes(idx)
        ? selected.filter(i => i !== idx)
        : [...selected, idx]
    )
  }

  return (
    <div className="mt-4">
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {pages.map((p) => {
          const isSelected = selected.includes(p.index)
          return (
            <button
              key={p.index}
              onClick={() => toggle(p.index)}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-[var(--accent-strong)] ring-2 ring-[var(--accent)]'
                  : 'border-[var(--border-default)] hover:border-[var(--accent)]'
              }`}
              style={{ background: 'var(--surface-2)' }}
            >
              {/* Thumbnail */}
              <div
                className="aspect-[3/4] flex items-center justify-center overflow-hidden"
                style={{ background: 'var(--surface-1)' }}
              >
                {thumbnails[p.index] ? (
                  <img
                    src={thumbnails[p.index]}
                    alt={`Page ${p.index + 1}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Page number badge */}
              <div
                className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: isSelected ? 'var(--accent)' : 'var(--surface-3)',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                }}
              >
                {p.index + 1}
              </div>

              {/* Selection checkmark */}
              {isSelected && (
                <div
                  className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)' }}
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
