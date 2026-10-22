import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { docxToPdf } from '../utils/docxToPdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// --- Preview renderer ---
async function renderPdfPreview(pdfBytes: Uint8Array, canvas: HTMLCanvasElement, pageNum: number = 1) {
  const typedArray = new Uint8Array(pdfBytes)
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2.0 })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport } as never).promise
  return pdf.numPages
}

export default function WordAPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const [totalPreviewPages, setTotalPreviewPages] = useState(0)
  const [convertError, setConvertError] = useState<string | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const showPreview = useCallback(async (bytes: Uint8Array, pageNum: number = 1) => {
    if (!previewRef.current) return
    const total = await renderPdfPreview(bytes, previewRef.current, pageNum)
    setTotalPreviewPages(total)
  }, [])

  const handleConvert = async () => {
    if (!file) return
    setConvertError(null)
    setLoading(true)
    try {
      const bytes = await docxToPdf(file)
      setPdfBytes(bytes)
      setPreviewPage(1)
    } catch (err: any) {
      setConvertError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pdfBytes && previewRef.current) {
      showPreview(pdfBytes, 1)
    }
  }, [pdfBytes, showPreview])

  const handleDownload = () => {
    if (!pdfBytes || !file) return
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.docx$/i, '') + '.pdf'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const changePreviewPage = async (delta: number) => {
    const newPage = previewPage + delta
    if (newPage < 1 || newPage > totalPreviewPages) return
    setPreviewPage(newPage)
    if (pdfBytes) await showPreview(pdfBytes, newPage)
  }

  return (
    <PDFToolLayout
      title="Convertir Word a PDF Online"
      description="Convierte archivos .docx a PDF gratis, directo en tu navegador. Mantiene formato, colores y diseno."
      keyword="Word a PDF"
    >
      <PDFUploader accept=".docx" onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4 glass-card !rounded-xl px-4 py-3 flex items-center justify-between glass-fallback">
          <span className="text-sm text-white/90">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
          <button onClick={() => { setFile(null); setPdfBytes(null); setTotalPreviewPages(0) }} className="glass-fallback-destructive hover:text-red-300">
            Quitar
          </button>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <DownloadButton
          onClick={handleConvert}
          disabled={!file}
          loading={loading}
          label={pdfBytes ? 'Reconvertir' : 'Convertir a PDF'}
        />
        {pdfBytes && (
          <button
            onClick={handleDownload}
            className="glass-fallback-success glass-fallback-hover mt-6 px-6 py-3 text-lg"
          >
            Descargar PDF
          </button>
        )}
      </div>

      {convertError && (
        <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          Error: {convertError}
        </div>
      )}

      {/* PDF Preview */}
      {pdfBytes && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Vista previa</h3>
            {totalPreviewPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePreviewPage(-1)}
                  disabled={previewPage <= 1}
                  className="px-3 py-1 glass-fallback-interactive rounded disabled:opacity-40 text-sm"
                >
                  Anterior
                </button>
                <span className="text-sm text-white/70">
                  Pagina {previewPage} de {totalPreviewPages}
                </span>
                <button
                  onClick={() => changePreviewPage(1)}
                  disabled={previewPage >= totalPreviewPages}
                  className="px-3 py-1 glass-fallback-interactive rounded disabled:opacity-40 text-sm"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
          <div className="glass-card !rounded-xl overflow-auto max-h-[600px] flex justify-center p-4">
            <canvas ref={previewRef} className="shadow-lg rounded" style={{ display: 'block', maxWidth: '100%' }} />
          </div>
        </div>
      )}
    </PDFToolLayout>
  )
}
