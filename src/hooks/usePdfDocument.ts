import { useState, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { loadPdf, type PdfPage } from '../utils/pdfHelpers'

export function usePdfDocument() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null)
  const [pages, setPages] = useState<PdfPage[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (file: File) => {
    setLoading(true)
    try {
      const { doc, pages: p } = await loadPdf(file)
      setPdfDoc(doc)
      setPages(p)
      setFileName(file.name)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setPdfDoc(null)
    setPages([])
    setFileName('')
  }, [])

  return { pdfDoc, pages, fileName, loading, load, reset }
}
