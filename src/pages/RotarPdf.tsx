import { useState, useEffect } from 'react'
import { degrees } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { savePdf } from '../utils/pdfHelpers'

export default function RotarPdf() {
  const { pdfDoc, pages, fileName, load } = usePdfDocument()
  const [rotation, setRotation] = useState(90)
  const [applyTo, setApplyTo] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [thumbnails, setThumbnails] = useState<string[]>([])

  // Render thumbnails for each page
  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return
    let cancelled = false
    const render = async () => {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
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

  const handleDownload = async () => {
    if (!pdfDoc) return
    setLoading(true)
    try {
      const pdfBytes = await pdfDoc.save()
      const newDoc = await import('pdf-lib').then(m => m.PDFDocument.load(pdfBytes))
      const pagesToRotate = applyTo === 'all'
        ? pages.map(p => p.index)
        : selected

      pagesToRotate.forEach(idx => {
        newDoc.getPage(idx).setRotation(degrees(rotation))
      })
      await savePdf(newDoc, `rotado-${fileName}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Rotar PDF Online Gratis"
      description="Rota las paginas de tu PDF 90, 180 o 270 grados."
      keyword="Rotar PDF"
    >
      <PDFUploader onFiles={f => f[0] && load(f[0])} />
      {pages.length > 0 && (
        <div className="mt-4 space-y-4">
          {/* Rotation selector with visual preview */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>
              Rotacion
            </label>
            <div className="flex gap-3">
              {[0, 90, 180, 270].map(deg => (
                <button
                  key={deg}
                  onClick={() => setRotation(deg)}
                  className={`spatial-btn text-sm flex flex-col items-center gap-1 px-4 py-3 ${
                    rotation === deg ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''
                  }`}
                  style={rotation === deg ? { background: 'var(--accent-soft)' } : {}}
                >
                  <svg
                    className="w-5 h-5 transition-transform duration-300"
                    style={{ transform: `rotate(${deg}deg)` }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{deg}°</span>
                </button>
              ))}
            </div>
          </div>

          {/* Apply to: all or selected */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>
              Aplicar a
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setApplyTo('all')}
                className={`spatial-btn text-sm ${applyTo === 'all' ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''}`}
                style={applyTo === 'all' ? { background: 'var(--accent-soft)' } : {}}
              >
                Todas las paginas
              </button>
              <button
                onClick={() => setApplyTo('selected')}
                className={`spatial-btn text-sm ${applyTo === 'selected' ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''}`}
                style={applyTo === 'selected' ? { background: 'var(--accent-soft)' } : {}}
              >
                Seleccionar paginas
              </button>
            </div>
          </div>

          {/* Page thumbnails with rotation preview */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>
              Paginas {applyTo === 'selected' ? '(click para seleccionar)' : ''}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {pages.map((p, idx) => {
                const isSelected = selected.includes(p.index)
                const showAsRotated = applyTo === 'all' || isSelected
                return (
                  <button
                    key={p.index}
                    onClick={() => {
                      if (applyTo === 'selected') {
                        setSelected(s =>
                          s.includes(p.index) ? s.filter(i => i !== p.index) : [...s, p.index]
                        )
                      }
                    }}
                    className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      applyTo === 'selected' && isSelected
                        ? 'border-[var(--accent-strong)] ring-2 ring-[var(--accent)]'
                        : 'border-[var(--border-default)] hover:border-[var(--accent)]'
                    }`}
                    style={{ background: 'var(--surface-2)' }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[3/4] flex items-center justify-center overflow-hidden"
                      style={{ background: 'var(--surface-1)' }}>
                      {thumbnails[idx] ? (
                        <img
                          src={thumbnails[idx]}
                          alt={`Page ${p.index + 1}`}
                          className="w-full h-full object-contain transition-transform duration-300"
                          style={{
                            transform: showAsRotated ? `rotate(${rotation}deg)` : undefined
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ color: 'var(--text-tertiary)' }}>
                          <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Page number badge */}
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: applyTo === 'selected' && isSelected ? 'var(--accent)' : 'var(--surface-3)',
                        color: applyTo === 'selected' && isSelected ? 'white' : 'var(--text-secondary)'
                      }}>
                      {p.index + 1}
                    </div>

                    {/* Rotation indicator */}
                    {showAsRotated && rotation !== 0 && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        {rotation}°
                      </div>
                    )}

                    {/* Selection checkmark */}
                    {applyTo === 'selected' && isSelected && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)' }}>
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

          <DownloadButton onClick={handleDownload} loading={loading} />
        </div>
      )}
    </PDFToolLayout>
  )
}
