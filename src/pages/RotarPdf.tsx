import { useState } from 'react'
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
          <div className="flex gap-4 items-center">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Rotacion:</label>
            {[90, 180, 270].map(deg => (
              <button
                key={deg}
                onClick={() => setRotation(deg)}
                className={`spatial-btn text-sm ${rotation === deg ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''}`}
                style={rotation === deg ? { background: 'var(--accent-soft)' } : {}}
              >
                {deg}°
              </button>
            ))}
          </div>

          <div className="flex gap-4 items-center">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aplicar a:</label>
            <button
              onClick={() => setApplyTo('all')}
              className={`spatial-btn text-sm ${applyTo === 'all' ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''}`}
              style={applyTo === 'all' ? { background: 'var(--accent-soft)' } : {}}
            >
              Todas
            </button>
            <button
              onClick={() => setApplyTo('selected')}
              className={`spatial-btn text-sm ${applyTo === 'selected' ? '!border-[var(--accent-strong)] !text-[var(--accent)]' : ''}`}
              style={applyTo === 'selected' ? { background: 'var(--accent-soft)' } : {}}
            >
              Seleccionar
            </button>
          </div>

          {applyTo === 'selected' && (
            <div className="flex flex-wrap gap-2">
              {pages.map(p => (
                <button
                  key={p.index}
                  onClick={() => setSelected(s =>
                    s.includes(p.index) ? s.filter(i => i !== p.index) : [...s, p.index]
                  )}
                  className={`w-12 h-12 rounded-xl border text-sm transition-all duration-200
                    ${selected.includes(p.index) ? 'border-[var(--accent-strong)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    style={selected.includes(p.index) ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-strong)' } : { background: 'var(--surface-2)', borderColor: 'var(--border-default)' }}
                >
                  {p.index + 1}
                </button>
              ))}
            </div>
          )}

          <DownloadButton onClick={handleDownload} loading={loading} />
        </div>
      )}
    </PDFToolLayout>
  )
}
