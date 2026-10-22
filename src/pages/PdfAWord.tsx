import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import { pdfToDocx } from '../utils/pdfToDocx'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function PdfAWord() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [pageCount, setPageCount] = useState(0)
  const [convertError, setConvertError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render preview
  useEffect(() => {
    if (!file) return
    const render = async () => {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setPageCount(pdf.numPages)
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport } as never).promise
    }
    setLoading(true)
    render().finally(() => setLoading(false))
  }, [file])

  const handleConvert = async () => {
    if (!file) return
    setConverting(true)
    setConvertError(null)
    try {
      // Lazy load docx library (~740KB)
      const docxModule = await import('docx')

      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const { blob } = await pdfToDocx(pdf, docxModule)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.pdf$/i, '') + '.docx'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err: any) {
      setConvertError(err.message || 'Error al convertir')
    } finally {
      setConverting(false)
    }
  }

  return (
    <PDFToolLayout
      title="PDF a Word Online Gratis"
      description="Convierte tus archivos PDF a Word (.docx) gratis. 100% en tu navegador, sin subir archivos."
      keyword="PDF a Word"
    >
      <PDFUploader onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4 space-y-4">
          {/* File info */}
          <div className="spatial-card-static p-4 flex items-center justify-between">
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {pageCount} pagina{pageCount !== 1 ? 's' : ''} — {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFile(null)}
                className="spatial-btn text-sm"
              >
                Quitar
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="spatial-btn-primary text-sm px-4 py-2"
              >
                {converting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Convirtiendo...
                  </span>
                ) : 'Descargar .docx'}
              </button>
            </div>
          </div>

          {convertError && (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              Error: {convertError}
            </div>
          )}

          {/* Preview */}
          <div className="spatial-card-static p-4">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              Vista previa (primera pagina)
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                <svg className="w-6 h-6 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando vista previa...
              </div>
            ) : (
              <div className="flex justify-center overflow-auto max-h-[500px] rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                <canvas ref={canvasRef} className="block" />
              </div>
            )}
          </div>
        </div>
      )}
    </PDFToolLayout>
  )
}
