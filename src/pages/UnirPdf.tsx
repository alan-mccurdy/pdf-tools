import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { savePdf } from '../utils/pdfHelpers'

interface MergeItem { name: string; bytes: Uint8Array; pages: number }

export default function UnirPdf() {
  const [items, setItems] = useState<MergeItem[]>([])
  const [loading, setLoading] = useState(false)

  const handleFiles = async (files: File[]) => {
    const newItems: MergeItem[] = []
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const doc = await PDFDocument.load(bytes)
      newItems.push({ name: file.name, bytes, pages: doc.getPageCount() })
    }
    setItems(prev => [...prev, ...newItems])
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const handleDownload = async () => {
    if (items.length < 2) return
    setLoading(true)
    try {
      const merged = await PDFDocument.create()
      for (const item of items) {
        const src = await PDFDocument.load(item.bytes)
        const copied = await merged.copyPages(src, src.getPageIndices())
        copied.forEach(p => merged.addPage(p))
      }
      await savePdf(merged, 'unido.pdf')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Unir PDFs Online Gratis"
      description="Combina multiples archivos PDF en uno solo. Ordena y descarga."
      keyword="Unir PDFs"
    >
      <PDFUploader multiple onFiles={handleFiles} />

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between glass-card !rounded-xl px-4 py-3">
              <span className="text-sm text-gray-300">{idx + 1}. {item.name} ({item.pages} pag.)</span>
              <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 text-sm transition-colors">
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <DownloadButton
        onClick={handleDownload}
        disabled={items.length < 2}
        loading={loading}
        label={`Unir y descargar (${items.length} archivos)`}
      />
    </PDFToolLayout>
  )
}
