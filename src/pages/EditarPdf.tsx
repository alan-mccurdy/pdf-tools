import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface TextBlock {
  x: number; y: number; text: string; page: number; size: number
}

export default function EditarPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [blocks, setBlocks] = useState<TextBlock[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!file) return
    const render = async () => {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setTotalPages(pdf.numPages)
      const page = await pdf.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise
    }
    render()
  }, [file, currentPage])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const text = prompt('Escribe el texto:')
    if (text) {
      setBlocks(prev => [...prev, { x, y, text, page: currentPage, size: 14 }])
    }
  }

  const handleDownload = async () => {
    if (!file) return
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(bytes)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

      for (const block of blocks) {
        const page = pdfDoc.getPage(block.page)
        const { height } = page.getSize()
        page.drawText(block.text, {
          x: block.x / 1.5,
          y: height - block.y / 1.5,
          font,
          size: block.size,
          color: rgb(0, 0, 0),
        })
      }

      const newBytes = await pdfDoc.save()
      const blob = new Blob([newBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `editado-${file.name}`
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Editar PDF Online Gratis"
      description="Escribe texto sobre las paginas de tu PDF. Gratis y sin subir archivos."
      keyword="Editar PDF"
    >
      <PDFUploader onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded-lg cursor-crosshair"
            />
            {blocks.filter(b => b.page === currentPage).map((b, i) => (
              <div
                key={i}
                className="absolute text-black text-sm bg-yellow-200/80 px-1 rounded pointer-events-none"
                style={{ left: b.x, top: b.y, fontSize: b.size }}
              >
                {b.text}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-3">
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

          <DownloadButton
            onClick={handleDownload}
            disabled={!blocks.length}
            loading={loading}
            label={`Descargar con ${blocks.length} texto(s) agregado(s)`}
          />
        </div>
      )}
    </PDFToolLayout>
  )
}
