import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PlacedImage {
  x: number; y: number; width: number; height: number; page: number; imgBytes: Uint8Array
}

export default function InsertarImagenes() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [images, setImages] = useState<PlacedImage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!pdfFile) return
    const render = async () => {
      const bytes = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setTotalPages(pdf.numPages)
      const page = await pdf.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport } as never).promise
    }
    render()
  }, [pdfFile, currentPage])

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgFile) return alert('Primero selecciona una imagen')
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const bytes = new Uint8Array(await imgFile.arrayBuffer())
    setImages(prev => [...prev, { x, y, width: 150, height: 150, page: currentPage, imgBytes: bytes }])
  }

  const handleDownload = async () => {
    if (!pdfFile || !images.length) return
    setLoading(true)
    try {
      const bytes = await pdfFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(bytes)

      for (const img of images) {
        let embedded: Awaited<ReturnType<typeof pdfDoc.embedPng>>
        if (img.imgBytes[0] === 0x89) {
          embedded = await pdfDoc.embedPng(img.imgBytes)
        } else {
          embedded = await pdfDoc.embedJpg(img.imgBytes)
        }
        const page = pdfDoc.getPage(img.page)
        const { height } = page.getSize()
        page.drawImage(embedded, {
          x: img.x / 1.5,
          y: height - img.y / 1.5 - img.height / 1.5,
          width: img.width / 1.5,
          height: img.height / 1.5,
        })
      }

      const newBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(newBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `con-imagenes-${pdfFile.name}`
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Insertar Imagenes en PDF"
      description="Agrega imagenes o firmas a tu PDF. Arrastra y posiciona donde quieras."
      keyword="Insertar Imagenes"
    >
      <div className="space-y-4">
        <PDFUploader onFiles={f => f[0] && setPdfFile(f[0])} />

        <div>
          <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Selecciona la imagen a insertar:</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files?.[0] && setImgFile(e.target.files[0])}
            className="text-sm"
          />
        </div>
      </div>

      {pdfFile && (
        <div className="mt-4">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded-lg cursor-crosshair"
            />
            {images.filter(img => img.page === currentPage).map((img, i) => (
              <div
                key={i}
                className="absolute border-2 border-dashed border-blue-400 pointer-events-none"
                style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="spatial-btn text-sm"
              >
                Anterior
              </button>
              <span className="text-sm self-center" style={{ color: 'var(--text-secondary)' }}>
                Pagina {currentPage + 1} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="spatial-btn text-sm"
              >
                Siguiente
              </button>
            </div>
          )}

          <DownloadButton
            onClick={handleDownload}
            disabled={!images.length}
            loading={loading}
            label={`Descargar con ${images.length} imagen(es)`}
          />
        </div>
      )}
    </PDFToolLayout>
  )
}
