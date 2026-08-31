import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// --- Word XML parsing functions (ported from original editor-pdf.html) ---
function wXmlDecode(s: string): string {
  return s.replace(/</g, '<').replace(/>/g, '>').replace(/&/g, '&').replace(/"/g, '"').replace(/&apos;/g, "'")
}

function wFmtColor(hex: string) {
  const h = (hex || '000000').replace('#', '')
  const r = parseInt(h.slice(0, 2) || '00', 16) / 255
  const g = parseInt(h.slice(2, 4) || '00', 16) / 255
  const b = parseInt(h.slice(4, 6) || '00', 16) / 255
  return rgb(r, g, b)
}

interface WRun {
  text: string
  bold: boolean
  italic: boolean
  size: number
  color: string
}

function wParseRuns(block: string): WRun[] {
  const out: WRun[] = []
  const re = /<w:r\b[\s\S]*?<\/w:r>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    const r = m[0]
    const bold = /<w:b\b[^>]*\/>/i.test(r)
    const italic = /<w:i\b[^>]*\/>/i.test(r)
    const sz = r.match(/<w:sz\b[^>]*w:val="([\d.]+)"/i)
    const size = sz ? parseInt(sz[1], 10) / 2 : 11
    const col = r.match(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"[\s/>]/i)
    const color = col ? col[1] : '000000'
    const tms = [...r.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    if (tms.length === 0) continue
    for (let ti = 0; ti < tms.length; ti++) {
      if (ti > 0 && /<w:tab\b/i.test(r.slice(0, tms[ti].index)))
        out.push({ text: ' ', bold, italic, size, color })
      out.push({ text: wXmlDecode(tms[ti][1]), bold, italic, size, color })
    }
  }
  return out
}

interface WParagraph {
  align: string
  runs: WRun[]
  pageBreak: boolean
  spBefore: number
  spAfter: number
  indLeft: number
  indRight: number
  indFirst: number
  indHang: number
  isList: boolean
}

function wParseParagraph(block: string): WParagraph {
  const jc = block.match(/<w:jc\b[^>]*w:val="([^"]+)"/i)
  const align = jc ? jc[1].toLowerCase() : 'left'
  const pageBreak = /<w:br\b[^>]*type="page"/i.test(block)
  const spacingBefore = block.match(/<w:spacing\b[^>]*w:before="([\d.]+)"/i)
  const spBefore = spacingBefore ? parseInt(spacingBefore[1], 10) / 20 : 0
  const spacingAfter = block.match(/<w:spacing\b[^>]*w:after="([\d.]+)"/i)
  const spAfter = spacingAfter ? parseInt(spacingAfter[1], 10) / 20 : 0
  const indent = block.match(/<w:ind\b[^>]*w:left="([\d.]+)"/i)
  const indLeft = indent ? parseInt(indent[1], 10) / 20 : 0
  const indentRight = block.match(/<w:ind\b[^>]*w:right="([\d.]+)"/i)
  const indRight = indentRight ? parseInt(indentRight[1], 10) / 20 : 0
  const indentFirst = block.match(/<w:ind\b[^>]*w:firstLine="([\d.]+)"/i)
  const indFirst = indentFirst ? parseInt(indentFirst[1], 10) / 20 : 0
  const indentHanging = block.match(/<w:ind\b[^>]*w:hanging="([\d.]+)"/i)
  const indHang = indentHanging ? parseInt(indentHanging[1], 10) / 20 : 0
  const isList = /<w:numPr\b/i.test(block)
  return { align, runs: wParseRuns(block), pageBreak, spBefore, spAfter, indLeft, indRight, indFirst, indHang, isList }
}

function wParseCell(tc: string): WParagraph[] {
  const paras: WParagraph[] = []
  const re = /<w:p\b[\s\S]*?<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tc)) !== null) paras.push(wParseParagraph(m[0]))
  return paras
}

function wParseTable(block: string) {
  const rows: WParagraph[][][] = []
  const tr = /<w:tr\b[\s\S]*?<\/w:tr>/g
  let tm: RegExpExecArray | null
  while ((tm = tr.exec(block)) !== null) {
    const row: WParagraph[][] = []
    const tc = /<w:tc\b[\s\S]*?<\/w:tc>/g
    let cm: RegExpExecArray | null
    while ((cm = tc.exec(tm[0])) !== null) row.push(wParseCell(cm[0]))
    rows.push(row)
  }
  return { rows }
}

function wParseDocxXml(xmlText: string) {
  const bodyMatch = xmlText.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/)
  const body = bodyMatch ? bodyMatch[1] : xmlText
  const paras: WParagraph[] = []
  const tables: ReturnType<typeof wParseTable>[] = []
  const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (/<w:tbl/.test(m[0])) tables.push(wParseTable(m[0]))
    else paras.push(wParseParagraph(m[0]))
  }
  return { paragraphs: paras, tables }
}

async function wDocxToPdf(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  let xmlText: string | null = null
  for (const path of Object.keys(zip.files)) {
    if (path.toLowerCase() === 'word/document.xml') {
      xmlText = await zip.files[path].async('string')
      break
    }
  }
  if (!xmlText) throw new Error('Documento Word invalido: no se encontro document.xml')

  const parsed = wParseDocxXml(xmlText)
  const pdfDoc = await PDFDocument.create()
  const PW = 595, PH = 842, M = 72, CW = PW - 2 * M, LH = 16
  let page = pdfDoc.addPage([PW, PH])
  let curY = PH - M

  const f = {
    normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    bi: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  }
  const pick = (r: WRun) => {
    if (r.bold && r.italic) return f.bi
    if (r.bold) return f.bold
    if (r.italic) return f.italic
    return f.normal
  }
  const nl = () => {
    if (curY - LH < M) { page = pdfDoc.addPage([PW, PH]); curY = PH - M }
  }

  const wrapRuns = (runs: WRun[], maxW: number): WRun[][] => {
    const lines: WRun[][] = []
    let words: WRun[] = []
    let curW = 0
    for (const r of runs) {
      const font = pick(r)
      const fsz = Number(r.size || 11)
      const toks = (r.text || '').split(/(\s+)/)
      for (let i = 0; i < toks.length; i++) {
        const w = toks[i]
        if (!w) continue
        const tw = font.widthOfTextAtSize(w, fsz)
        if (words.length > 0 && curW + tw > maxW) {
          lines.push(words)
          words = []
          curW = 0
        }
        words.push({ ...r, txt: w } as WRun & { txt: string })
        curW += tw
      }
    }
    if (words.length) lines.push(words)
    return lines
  }

  const lineWidth = (ln: (WRun & { txt: string })[]) => {
    let t = 0
    for (const it of ln) t += pick(it).widthOfTextAtSize(it.txt, Number(it.size || 11))
    return t
  }

  // Process paragraphs
  for (const para of parsed.paragraphs) {
    if (para.pageBreak) { page = pdfDoc.addPage([PW, PH]); curY = PH - M }
    curY -= (para.spBefore || 0)
    const effectiveIndent = M + (para.indLeft || 0) + (para.indFirst || 0) - (para.indHang || 0)
    const maxW = CW - (para.indLeft || 0) - (para.indRight || 0) - (para.indFirst || 0) + (para.indHang || 0)
    const lines = wrapRuns(para.runs, Math.max(50, maxW))
    for (const ln of lines) {
      nl()
      const typedLn = ln as (WRun & { txt: string })[]
      let x = effectiveIndent
      if (para.align === 'right') x = effectiveIndent + maxW - lineWidth(typedLn)
      else if (para.align === 'center') x = effectiveIndent + (maxW - lineWidth(typedLn)) / 2
      let cx = x
      for (const it of typedLn) {
        const font = pick(it)
        const fsz = Number(it.size || 11)
        page.drawText(it.txt, { x: cx, y: curY, font, size: fsz, color: wFmtColor(it.color) })
        cx += font.widthOfTextAtSize(it.txt, fsz)
      }
      curY -= LH
    }
    curY -= (para.spAfter || 0)
  }

  // Process tables
  for (const tbl of parsed.tables) {
    const nR = tbl.rows.length
    if (!nR) continue
    const nC = tbl.rows[0].length
    if (!nC) continue
    const cellW = CW / nC
    const cellH = 28
    for (let ri = 0; ri < nR; ri++) {
      nl()
      const y0 = curY - cellH
      for (let ci = 0; ci < nC; ci++) {
        const cell = tbl.rows[ri][ci] || []
        page.drawRectangle({
          x: M + ci * cellW, y: y0, width: cellW, height: cellH,
          borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1), borderWidth: 0.5,
        })
        let cy = y0 + cellH - 8
        for (const p of cell) {
          for (const r of p.runs) {
            const font = pick(r)
            const fsz = Number(r.size || 10)
            page.drawText(r.text, { x: M + ci * cellW + 4, y: cy, font, size: fsz, color: wFmtColor(r.color) })
            cy -= 12
          }
        }
      }
      curY -= cellH
    }
  }

  return await pdfDoc.save()
}

// --- Preview renderer ---
async function renderPdfPreview(pdfBytes: Uint8Array, canvas: HTMLCanvasElement, pageNum: number = 1) {
  const typedArray = new Uint8Array(pdfBytes)
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2.0 })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport } as never).promise
  return pdf.numPages
}

export default function WordAPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [previewPage, setPreviewPage] = useState(1)
  const [totalPreviewPages, setTotalPreviewPages] = useState(0)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const showPreview = useCallback(async (bytes: Uint8Array, pageNum: number = 1) => {
    if (!previewRef.current) return
    const total = await renderPdfPreview(bytes, previewRef.current, pageNum)
    setTotalPreviewPages(total)
  }, [])

  const handleConvert = async () => {
    if (!file) return
    setLoading(true)
    try {
      const bytes = await wDocxToPdf(file)
      setPdfBytes(bytes)
      setPreviewPage(1)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pdfBytes && previewRef.current) {
      showPreview(pdfBytes, 1)
    }
  }, [pdfBytes, showPreview])

  const handleDownload = () => {
    if (!pdfBytes || !file) return
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.docx$/i, '') + '.pdf'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const changePreviewPage = async (delta: number) => {
    const newPage = previewPage + delta
    if (newPage < 1 || newPage > totalPreviewPages) return
    setPreviewPage(newPage)
    if (pdfBytes) await showPreview(pdfBytes, newPage)
  }

  return (
    <PDFToolLayout
      title="Convertir Word a PDF Online"
      description="Convierte archivos .docx a PDF gratis, directo en tu navegador. Mantiene formato, colores y diseno."
      keyword="Word a PDF"
    >
      <PDFUploader accept=".docx" onFiles={f => f[0] && setFile(f[0])} />

      {file && (
        <div className="mt-4 glass-card !rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-300">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
          <button onClick={() => { setFile(null); setPdfBytes(null); setTotalPreviewPages(0) }} className="text-red-400 hover:text-red-300 text-sm transition-colors">
            Quitar
          </button>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <DownloadButton
          onClick={handleConvert}
          disabled={!file}
          loading={loading}
          label={pdfBytes ? 'Reconvertir' : 'Convertir a PDF'}
        />
        {pdfBytes && (
          <button
            onClick={handleDownload}
            className="glass-btn-success mt-6 px-6 py-3 text-lg"
          >
            Descargar PDF
          </button>
        )}
      </div>

      {/* PDF Preview */}
      {pdfBytes && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Vista previa</h3>
            {totalPreviewPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changePreviewPage(-1)}
                  disabled={previewPage <= 1}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40 text-sm"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-400">
                  Pagina {previewPage} de {totalPreviewPages}
                </span>
                <button
                  onClick={() => changePreviewPage(1)}
                  disabled={previewPage >= totalPreviewPages}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40 text-sm"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
          <div className="glass-card !rounded-xl overflow-auto max-h-[600px] flex justify-center p-4">
            <canvas ref={previewRef} className="shadow-lg rounded" style={{ display: 'block', maxWidth: '100%' }} />
          </div>
        </div>
      )}
    </PDFToolLayout>
  )
}
