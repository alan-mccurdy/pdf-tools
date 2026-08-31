import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function ComprimirPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState(0.5)
  const [loading, setLoading] = useState(false)
  const [originalSize, setOriginalSize] = useState(0)

  const handleFiles = (files: File[]) => {
    if (files[0]) {
      setFile(files[0])
      setOriginalSize(files[0].size)
    }
  }

  const handleDownload = async () => {
    if (!file) return
    setLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const newPdf = await PDFDocument.create()

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: quality * 2 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise

        const imgData = canvas.toDataURL('image/jpeg', quality)
        const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0))
        const img = await newPdf.embedJpg(imgBytes)
        const newPage = newPdf.addPage([page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height])
        newPage.drawImage(img, { x: 0, y: 0, width: newPage.getWidth(), height: newPage.getHeight() })
      }

      const compressedBytes = await newPdf.save()
      const blob = new Blob([compressedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprimido-${file.name}`
      a.click()

      alert(`Original: ${(originalSize / 1024).toFixed(0)} KB\nComprimido: ${(compressedBytes.length / 1024).toFixed(0)} KB`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Comprimir PDF Online Gratis"
      description="Reduce el tamano de tu PDF manteniendo la calidad. Gratis y sin subir archivos."
      keyword="Comprimir PDF"
    >
      <PDFUploader onFiles={handleFiles} />

      {file && (
        <div className="mt-4 space-y-4">
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm">
            Tamano original: <strong>{(originalSize / 1024).toFixed(0)} KB</strong>
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Calidad: {Math.round(quality * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={quality}
              onChange={e => setQuality(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Mas compression</span>
              <span>Mejor calidad</span>
            </div>
          </div>

          <DownloadButton onClick={handleDownload} loading={loading} />
        </div>
      )}
    </PDFToolLayout>
  )
}
