import { PDFDocument } from 'pdf-lib'

export interface PdfPage {
  index: number
  width: number
  height: number
}

export async function loadPdf(file: File): Promise<{ doc: PDFDocument; pages: PdfPage[] }> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  const pages = doc.getPages().map((p, i) => ({
    index: i,
    width: p.getWidth(),
    height: p.getHeight(),
  }))
  return { doc, pages }
}

export async function savePdf(doc: PDFDocument, filename: string): Promise<void> {
  const bytes = await doc.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
