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
            <label className="text-sm text-gray-400">Rotacion:</label>
            {[90, 180, 270].map(deg => (
              <button
                key={deg}
                onClick={() => setRotation(deg)}
                className={`px-4 py-2 rounded-xl border transition-all duration-200
                  ${rotation === deg ? 'bg-blue-500/20 border-blue-400/50 text-blue-300' : 'glass-card !rounded-xl text-gray-400 hover:text-white'}`}
              >
                {deg}°
              </button>
            ))}
          </div>

          <div className="flex gap-4 items-center">
            <label className="text-sm text-gray-400">Aplicar a:</label>
            <button
              onClick={() => setApplyTo('all')}
              className={`px-4 py-2 rounded-xl border transition-all duration-200
                ${applyTo === 'all' ? 'bg-blue-500/20 border-blue-400/50 text-blue-300' : 'glass-card !rounded-xl text-gray-400 hover:text-white'}`}
            >
              Todas
            </button>
            <button
              onClick={() => setApplyTo('selected')}
              className={`px-4 py-2 rounded-xl border transition-all duration-200
                ${applyTo === 'selected' ? 'bg-blue-500/20 border-blue-400/50 text-blue-300' : 'glass-card !rounded-xl text-gray-400 hover:text-white'}`}
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
                    ${selected.includes(p.index) ? 'bg-blue-500/20 border-blue-400/50 text-blue-300' : 'glass-card !rounded-xl text-gray-400 hover:text-white'}`}
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
