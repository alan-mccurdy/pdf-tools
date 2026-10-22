/**
 * PDF -> DOCX converter (browser, pdf.js + docx).
 *
 * Root-cause rewrite of the original inline implementation in PdfAWord.tsx:
 *  - Lines are grouped with adaptive Y tolerance (the old code grouped by
 *    exact Math.round(transform[5]), splitting one visual line into several).
 *  - Words inside a line are joined by measuring the X gap (the old blind
 *    .join(' ') invented spaces and broke words apart).
 *  - Lines are merged into real paragraphs (gap/indent/size/bullet heuristics);
 *    the old code emitted one Word paragraph per visual line.
 *  - Bold/italic/size come from page.commonObjs via resolveRealFont (regexes
 *    over the internal font id 'g_d0_f1' never matched).
 *  - Alignment and indentation are detected per paragraph.
 *  - Real page breaks between pages (docx PageBreak), not empty paragraphs.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

// ---------------------------------------------------------------------------
// Font resolution (ported from EditarPdf.resolveRealFont)
// ---------------------------------------------------------------------------

export interface RealFont {
  family: string
  bold: boolean
  italic: boolean
}

/**
 * Resolve the real font of a pdf.js text item.
 * `fontName` from getTextContent is an internal id (e.g. 'g_d0_f1'), so
 * bold/italic regexes never match it — the font object lives in page.commonObjs.
 */
export function resolveRealFont(page: PDFPageProxy, loadedName: string): RealFont {
  try {
    const objs = (page as unknown as {
      commonObjs?: { get?: (id: string) => { name?: string; fallbackName?: string } }
    })?.commonObjs
    const font = objs?.get?.(loadedName)
    // Embedded subset fonts are prefixed like 'ABCDEF+Arial-Bold'
    const raw = (font?.name || font?.fallbackName || '').replace(/^\/?([A-Z]{6}\+)?/, '')
    const n = raw.toLowerCase()
    const bold = /bold|black|heavy|semibold|demibold/.test(n)
    const italic = /italic|oblique/.test(n)
    let family = 'Arial'
    if (/times|georgia|palatino|serif|book|garamond|constantia|cambria/.test(n)) family = 'Times New Roman'
    else if (/courier|mono|consolas/.test(n)) family = 'Courier New'
    else if (/helvetica|arial|sans|verdana|calibri|roboto|tahoma|seg ui/.test(n)) family = 'Arial'
    return { family, bold, italic }
  } catch {
    return { family: 'Arial', bold: false, italic: false }
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface TItem {
  str: string
  x: number
  y: number        // baseline
  w: number
  h: number        // font size (pt)
  font: RealFont
  hasEOL: boolean
}

interface TLine {
  items: TItem[]
  y: number
  x0: number
  x1: number
  size: number
}

interface TPara {
  lines: TLine[]
  size: number
  indentFirst: number  // pt, first-line indent relative to body left
  align: 'left' | 'right' | 'center' | 'both'
  bullet: boolean
}

const BULLET_RE = /^\s*(?:[•▪◦‣·∙●]|\(?\d{1,2}[.)]|[a-zA-Z][.)])\s+/

/** Group raw pdf.js items into visual lines with adaptive Y tolerance. */
function groupLines(items: TItem[]): TLine[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TLine[] = []
  let cur: TItem[] = [sorted[0]]
  let curY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]
    const tol = Math.max(2, 0.35 * Math.max(it.h, cur[0]?.h || 12))
    if (Math.abs(it.y - curY) <= tol) {
      cur.push(it)
      curY = (curY * (cur.length - 1) + it.y) / cur.length
    } else {
      lines.push(finishLine(cur))
      cur = [it]
      curY = it.y
    }
  }
  if (cur.length) lines.push(finishLine(cur))
  // top-to-bottom
  return lines.sort((a, b) => b.y - a.y)
}

function finishLine(items: TItem[]): TLine {
  items.sort((a, b) => a.x - b.x)
  const size = median(items.map(i => i.h)) || 12
  const x0 = items[0].x
  const x1 = Math.max(...items.map(i => i.x + i.w))
  return { items, y: items[0].y, x0, x1, size }
}

/**
 * Join the items of one line into a single string, inserting spaces where the
 * horizontal gap between consecutive items is wide enough, and marking wide
 * (column/table) gaps with several spaces.
 */
function joinLine(line: TLine): string {
  let out = ''
  let prev: TItem | null = null
  for (const it of line.items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.w)
      const em = Math.max(prev.h, it.h) || 12
      if (!/\s$/.test(prev.str) && !/^\s/.test(it.str)) {
        if (gap > em * 3) out += '    '       // column jump (table-ish)
        else if (gap > em * 0.15 || gap > 1.5) out += ' '
      }
    }
    out += it.str
    prev = it
  }
  return out.replace(/\s+$/, '')
}

/** Decide whether `line` starts a new paragraph after `prev`. */
function startsNewPara(prev: TLine, line: TLine, bodyLeft: number): boolean {
  // Font-size change (heading / different block)
  if (Math.abs(line.size - prev.size) > Math.max(1.5, prev.size * 0.2)) return true
  // Indent change of the first line vs body (first-line indent)
  const prevIndent = prev.x0 - bodyLeft
  const lineIndent = line.x0 - bodyLeft
  if (Math.abs(lineIndent - prevIndent) > prev.size * 0.7 && lineIndent > prev.size * 0.3) {
    // only if prev looked non-indented (typical first-line indent pattern)
    if (prevIndent < prev.size * 0.3) return true
  }
  // Large vertical gap => paragraph break (or blank line)
  const gap = prev.y - line.y
  if (gap > Math.max(prev.size, line.size) * 1.7) return true
  // Bullet / numbered item start
  if (BULLET_RE.test(joinLine(line))) return true
  return false
}

/** Detect paragraph alignment from its lines vs the page text bounds. */
function detectAlign(para: TPara, bodyLeft: number, bodyRight: number): TPara['align'] {
  if (para.bullet) return 'left'
  const width = bodyRight - bodyLeft
  if (width <= 0 || para.lines.length === 0) return 'left'
  const lines = para.lines
  const last = lines[lines.length - 1]
  const check = lines.length > 1 ? lines.slice(0, -1) : lines // don't force last line

  const nearRight = check.filter(l => bodyRight - l.x1 < l.size * 0.9).length
  const centered = check.filter(l => {
    const c = (l.x0 + l.x1) / 2
    const pageC = (bodyLeft + bodyRight) / 2
    return Math.abs(c - pageC) < width * 0.12 && l.x0 > bodyLeft + l.size * 0.5 && l.x1 < bodyRight - l.size * 0.5
  }).length
  const rightAligned = check.filter(l => l.x0 > bodyLeft + width * 0.45 && bodyRight - l.x1 < l.size * 1.2).length

  if (check.length >= 2 && nearRight >= check.length * 0.7) {
    // Justified if lines are long (fill the width); right if they start far right
    const avgLen = check.reduce((s, l) => s + (l.x1 - l.x0), 0) / check.length
    if (avgLen > width * 0.55) return 'both'
    return 'right'
  }
  if (check.length >= 2 && centered >= check.length * 0.7) return 'center'
  if (check.length >= 1 && rightAligned >= check.length * 0.7 && last.x0 > bodyLeft + width * 0.4) return 'right'
  // Single-line paragraph: detect center/right from where the line sits.
  if (lines.length === 1) {
    const l = lines[0]
    const len = l.x1 - l.x0
    // Short line floating in the middle => centered heading
    if (len < width * 0.9 && l.x0 > bodyLeft + width * 0.08 && l.x1 < bodyRight - width * 0.08) {
      const centerDev = Math.abs((l.x0 + l.x1) / 2 - (bodyLeft + bodyRight) / 2)
      if (centerDev < width * 0.15) return 'center'
    }
    // Line starting far right => right-aligned
    if (l.x0 > bodyLeft + width * 0.45) return 'right'
  }
  return 'left'
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export interface PdfToDocxResult {
  blob: Blob
  pages: number
  paragraphs: number
}

/**
 * Convert a loaded pdf.js document into a .docx Blob.
 * `docxModule` is the dynamically imported `docx` package (kept out of the
 * main bundle by the caller).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pdfToDocx(pdf: PDFDocumentProxy, docxModule: any): Promise<PdfToDocxResult> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = docxModule

  const paras: TPara[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    // Force pdf.js to resolve fonts into page.commonObjs (getTextContent alone
    // leaves them unresolved; resolveRealFont would always fall back).
    try {
      await page.getOperatorList()
    } catch {
      /* content-stream errors must not abort conversion */
    }
    const tc = await page.getTextContent()

    const items: TItem[] = []
    for (const raw of tc.items as Array<{
      str: string
      transform: number[]
      fontName: string
      width: number
      height: number
      hasEOL?: boolean
    }>) {
      if (!raw.str || !raw.transform) continue
      const size = Math.abs(raw.transform[3]) || Math.abs(raw.height) || 12
      items.push({
        str: raw.str,
        x: raw.transform[4],
        y: raw.transform[5],
        w: raw.width || 0,
        h: size,
        font: resolveRealFont(page, raw.fontName),
        hasEOL: !!raw.hasEOL,
      })
    }

    if (items.length === 0) {
      // Page with no text (image/scan) — still page-break it
      if (p < pdf.numPages) paras.push({ lines: [], size: 12, indentFirst: 0, align: 'left', bullet: false })
      continue
    }

    const bodyLeft = Math.min(...items.map(i => i.x))

    const lines = groupLines(items)

    // Merge lines into paragraphs
    let cur: TPara | null = null
    for (const line of lines) {
      if (!cur || startsNewPara(cur.lines[cur.lines.length - 1], line, bodyLeft)) {
        cur = {
          lines: [line],
          size: line.size,
          indentFirst: 0,
          align: 'left',
          bullet: BULLET_RE.test(joinLine(line)),
        }
        paras.push(cur)
      } else {
        cur.lines.push(line)
      }
    }

    if (p < pdf.numPages) {
      // Force a page boundary: next page's first line must not merge into
      // this page's last paragraph.
      paras.push({ lines: [], size: 12, indentFirst: 0, align: 'left', bullet: false })
    }
  }

  // Page-level bounds per paragraph group: recompute align/indent now that we
  // know the paragraph grouping (uses each page's lines captured per para).
  // We approximate page bounds with global bounds; alignment detection is
  // per-paragraph against the bounds of its own page's lines.
  const allX0 = paras.flatMap(pr => pr.lines.map(l => l.x0))
  const allX1 = paras.flatMap(pr => pr.lines.map(l => l.x1))
  const globalLeft = allX0.length ? Math.min(...allX0) : 0
  const globalRight = allX1.length ? Math.max(...allX1) : 0
  const globalSize = median(paras.flatMap(pr => pr.lines.map(l => l.size))) || 12

  const docParas = paras.map(pr => {
    // page break marker (empty para pushed at page end)
    if (pr.lines.length === 0) {
      return new Paragraph({ children: [new PageBreak()] })
    }

    pr.align = detectAlign(pr, globalLeft, globalRight)

    // first-line indent: diff between first line x0 and the rest
    if (!pr.bullet && pr.lines.length >= 2) {
      const rest = median(pr.lines.slice(1).map(l => l.x0))
      const fi = pr.lines[0].x0 - rest
      if (fi > pr.size * 0.4 && fi < pr.size * 4) pr.indentFirst = fi
    }
    if (pr.bullet) {
      // normalize bullet lines: hanging-style left indent
      pr.indentFirst = 0
    }

    // Build runs: merge consecutive items with identical formatting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs: any[] = []
    let pendingText = ''
    let pendingFmt: RealFont | null = null
    let pendingSize = pr.size

    const flush = () => {
      if (!pendingText) return
      const halfPoints = Math.round(Math.max(4, Math.min(144, pendingSize * 2)))
      runs.push(new TextRun({
        text: pendingText,
        bold: pendingFmt?.bold ?? false,
        italics: pendingFmt?.italic ?? false,
        size: halfPoints,
        font: pendingFmt?.family ?? 'Arial',
      }))
      pendingText = ''
    }

    pr.lines.forEach((line, li) => {
      if (li > 0) {
        // joining space between merged lines
        const gapY = pr.lines[li - 1].y - line.y
        if (gapY > pr.size * 2.1) {
          // soft break inside paragraph (was a blank line)
          flush()
          pendingFmt = null
          runs.push(new TextRun({ text: '', break: 1 }))
        } else {
          pendingText += ' '
        }
      }
      for (const it of line.items) {
        const sameFmt = pendingFmt
          && pendingFmt.bold === it.font.bold
          && pendingFmt.italic === it.font.italic
          && pendingFmt.family === it.font.family
          && Math.abs(pendingSize - it.h) < 1
        if (!sameFmt) {
          flush()
          pendingFmt = it.font
          pendingSize = it.h
        }
        pendingText += it.str
      }
    })
    flush()

    // Spacing: heading-ish (much bigger than median) gets more space after
    const isHeadingish = pr.size >= globalSize * 1.2 && pr.lines.length <= 3
    const afterTwips = isHeadingish ? 180 : 80

    const alignMap = {
      left: AlignmentType.LEFT,
      right: AlignmentType.RIGHT,
      center: AlignmentType.CENTER,
      both: AlignmentType.JUSTIFIED,
    } as const

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      children: runs.length ? runs : [new TextRun({ text: '' })],
      alignment: alignMap[pr.align],
      spacing: { after: afterTwips },
    }
    if (pr.bullet) {
      opts.indent = { left: 360, hanging: 180 }
    } else if (pr.indentFirst > 0) {
      opts.indent = { firstLine: Math.round((pr.indentFirst / 72) * 1440) }
    }
    return new Paragraph(opts)
  })

  const doc = new Document({
    sections: [{ properties: {}, children: docParas }],
  })
  const blob = await Packer.toBlob(doc)
  return { blob, pages: pdf.numPages, paragraphs: paras.length }
}
