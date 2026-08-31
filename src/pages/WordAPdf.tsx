import { useState } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

export default function WordAPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConvert = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buf)
      let xmlText: string | null = null
      for (const path of Object.keys(zip.files)) {
        if (path.toLowerCase() === 'word/document.xml') {
          xmlText = await zip.files[path].async('string')
          break
        }
      }
      if (!xmlText) throw new Error('Documento Word invalido')

      // Simplified Word-to-PDF conversion
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const page = pdfDoc.addPage([595, 842])
      const text = xmlText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const lines = text.match(/.{1,80}/g) || []
      let y = 800
      for (const line of lines) {
        if (y < 50) break
        page.drawText(line, { x: 72, y, font, size: 11, color: rgb(0, 0, 0) })
        y -= 16
      }

      const bytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.docx$/i, '') + '.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Convertir Word a PDF Online"
      description="Convierte archivos .docx a PDF gratis, directo en tu navegador."
      keyword="Word a PDF"
    >
      <PDFUploader accept=".docx" onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4 bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
          <button onClick={() => setFile(null)} className="text-red-400 hover:text-red-300 text-sm">
            Quitar
          </button>
        </div>
      )}

      <DownloadButton
        onClick={handleConvert}
        disabled={!file}
        loading={loading}
        label="Convertir a PDF"
      />
    </PDFToolLayout>
  )
}
