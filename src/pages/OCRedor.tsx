import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import { extractTextFromImage, closeOCR } from '../utils/ocrService'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function OCRedor() {
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [pages, setPages] = useState<Array<{ url: string; text: string }>>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFile = useCallback((file: File) => {
    setFile(file)
    setExtractedText('')
    setPages([])
  }, [])

  const handleOCR = useCallback(async () => {
    if (!file) return
    
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const totalPages = pdf.numPages
      
      const newPages = []
      
      for (let i = 0; i < Math.min(totalPages, 10); i++) {
        const page = await pdf.getPage(i + 1)
        const viewport = page.getViewport({ scale: 2 })
        
        if (canvasRef.current) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          // Render page to canvas
          const renderContext = {
            canvasContext: ctx,
            viewport: viewport
          }
          await page.render(renderContext as any).promise
          
          const imageData = canvas.toDataURL('image/png')
          const text = await extractTextFromImage(imageData)
          
          newPages.push({ url: imageData, text })
        }
      }
      
      setPages(newPages)
      
      const allText = newPages.map(p => p.text).join('\n\n')
      setExtractedText(allText)
      
    } catch (err) {
      console.error('OCR error:', err)
      alert('Error processing document. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [file])

  const handleDownload = useCallback(() => {
    const blob = new Blob([extractedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name || 'document'}-ocr.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [extractedText, file])

  useEffect(() => {
    return () => {
      closeOCR()
    }
  }, [])

  return (
    <PDFToolLayout
      title="OCR - Extraer texto de PDFs escaneados"
      description="Convierte texto de PDFs escaneados o imágenes a texto editable. Usa OCR avanzado."
      keyword="OCR PDF"
    >
      <PDFUploader 
        accept=".pdf,image/png,image/jpeg,image/jpg" 
        onFiles={files => files[0] && handleFile(files[0])} 
      />

      {file && (
        <div className="mt-6 space-y-4">
          <div className="spatial-card-static px-4 py-3">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              <strong>Archivo:</strong> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          </div>

          <button
            onClick={handleOCR}
            disabled={loading}
            className="spatial-btn-primary"
          >
            {loading ? 'Procesando...' : 'Extraer texto con OCR'}
          </button>

          <canvas
            ref={canvasRef}
            className="hidden"
          />

          {pages.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Resultados del OCR
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pages.map((page, idx) => (
                  <div key={idx} className="spatial-card-static px-4 py-3">
                    <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Pagina {idx + 1}
                    </h4>
                    <img
                      src={page.url}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                    <p className="text-xs line-clamp-3" style={{ color: 'var(--text-tertiary)' }}>
                      {page.text}
                    </p>
                  </div>
                ))}
              </div>

              {extractedText && (
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Texto completo extraido
                  </h3>
                  <div className="spatial-card-static px-4 py-3 overflow-x-auto">
                    <pre className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                      {extractedText}
                    </pre>
                  </div>
                  
                  <button
                    onClick={handleDownload}
                    className="spatial-btn-success mt-4"
                  >
                    Descargar como .txt
                  </button>
                </div>
              )}
            </div>
          )}

          {loading && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Inicializando OCR... Esto puede tardar unos segundos.
            </p>
          )}
        </div>
      )}
    </PDFToolLayout>
  )
}