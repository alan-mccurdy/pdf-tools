import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import PageSelector from '../components/PDF/PageSelector'
import DownloadButton from '../components/PDF/DownloadButton'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { savePdf } from '../utils/pdfHelpers'

export default function SepararPdf() {
  const { pdfDoc, pages, fileName, load } = usePdfDocument()
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!pdfDoc || !selected.length) return
    setLoading(true)
    try {
      const newDoc = await PDFDocument.create()
      const copied = await newDoc.copyPages(pdfDoc, selected)
      copied.forEach(p => newDoc.addPage(p))
      await savePdf(newDoc, `separado-${fileName}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Separar PDF Online Gratis"
      description="Extrae paginas especificas de un PDF y descargalas como archivo nuevo."
      keyword="Separar PDF"
    >
      <PDFUploader onFiles={f => f[0] && load(f[0])} />
      {pages.length > 0 && (
        <>
          <p className="text-sm text-gray-400 mt-4">Selecciona las paginas que quieres extraer:</p>
          <PageSelector pages={pages} selected={selected} onSelect={setSelected} />
          <DownloadButton
            onClick={handleDownload}
            disabled={!selected.length}
            loading={loading}
            label={`Descargar ${selected.length} pagina(s)`}
          />
        </>
      )}
    </PDFToolLayout>
  )
}
