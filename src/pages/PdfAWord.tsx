import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'


pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface TextLine {
  text: string
  fontSize: number
  bold: boolean
  italic: boolean
  y: number
}

export default function PdfAWord() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [pageCount, setPageCount] = useState(0)
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
    try {
      // Lazy load docx library (~740KB)
      const docxModule = await import('docx')
      const { Document, Packer, Paragraph, TextRun, convertInchesToTwip } = docxModule

      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const allLines: TextLine[] = []

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()

        // Group text items into lines by Y-coordinate
        const items = textContent.items.filter((item: any) => item.str && item.str.trim() && item.transform) as any[]
        const lineMap = new Map<number, any[]>()

        for (const item of items) {
          const y = Math.round(item.transform[5])
          if (!lineMap.has(y)) lineMap.set(y, [])
          lineMap.get(y)!.push(item)
        }

        // Sort lines top-to-bottom
        const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a)

        for (const y of sortedY) {
          const lineItems = lineMap.get(y)!.sort((a: any, b: any) => a.transform[4] - b.transform[4])
          const lineText = lineItems.map((item: any) => item.str).join(' ')

          // Detect formatting from font name
          const fontName = lineItems[0]?.fontName || ''
          const fontSize = Math.round(lineItems[0]?.height || 12)
          const bold = /bold/i.test(fontName) || /bold/i.test(lineItems[0]?.font?.name || '')
          const italic = /italic|oblique/i.test(fontName) || /italic/i.test(lineItems[0]?.font?.name || '')

          allLines.push({ text: lineText, fontSize, bold, italic, y })
        }

        // Add page break between pages (except last)
        if (i < pdf.numPages) {
          allLines.push({ text: '', fontSize: 12, bold: false, italic: false, y: -1 })
        }
      }

      // Build docx paragraphs
      const paragraphs = allLines.map(line => {
        if (line.text === '') {
          return new Paragraph({ spacing: { after: convertInchesToTwip(0.2) } })
        }

        const runs = [new TextRun({
          text: line.text,
          bold: line.bold,
          italics: line.italic,
          size: line.fontSize * 2, // half-points
          font: 'Arial',
        })]

        return new Paragraph({
          children: runs,
          spacing: { after: convertInchesToTwip(0.1) },
        })
      })

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.pdf$/i, '') + '.docx'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err: any) {
      alert('Error al convertir: ' + err.message)
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
