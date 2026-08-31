import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import PageSelector from '../components/PDF/PageSelector'
import DownloadButton from '../components/PDF/DownloadButton'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { savePdf } from '../utils/pdfHelpers'

export default function EliminarPaginas() {
  const { pdfDoc, pages, fileName, load } = usePdfDocument()
  const [toDelete, setToDelete] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!pdfDoc || !toDelete.length) return
    setLoading(true)
    try {
      const newDoc = await PDFDocument.create()
      const keepIndices = pages
        .map(p => p.index)
        .filter(i => !toDelete.includes(i))
      const copied = await newDoc.copyPages(pdfDoc, keepIndices)
      copied.forEach(p => newDoc.addPage(p))
      await savePdf(newDoc, `sin-paginas-${fileName}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PDFToolLayout
      title="Eliminar Paginas de PDF"
      description="Selecciona y elimina paginas especificas de tu PDF."
      keyword="Eliminar Paginas"
    >
      <PDFUploader onFiles={f => f[0] && load(f[0])} />
      {pages.length > 0 && (
        <>
          <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>Selecciona las paginas que quieres ELIMINAR:</p>
          <PageSelector pages={pages} selected={toDelete} onSelect={setToDelete} />
          <DownloadButton
            onClick={handleDownload}
            disabled={!toDelete.length}
            loading={loading}
            label={`Eliminar ${toDelete.length} pagina(s) y descargar`}
          />
        </>
      )}
    </PDFToolLayout>
  )
}
