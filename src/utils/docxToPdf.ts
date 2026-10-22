/**
 * DOCX -> PDF converter (browser, pdf-lib).
 *
 * Root-cause rewrite of the original inline implementation in WordAPdf.tsx:
 *  - Body children (paragraphs AND tables) are parsed sequentially so document
 *    order is preserved (the old code rendered ALL paragraphs first and ALL
 *    tables at the end, destroying layout).
 *  - word/styles.xml + docDefaults are resolved (sizes/bold/italic/alignment
 *    defined in styles were previously ignored -> "sin el formato del Word").
 *  - Line height is proportional to the run font size (was fixed 16pt).
 *  - Bold/italic tags are tri-state (was a self-closing-only regex).
 *  - Lists (numbering.xml) render bullet/decimal markers.
 *  - Tables wrap text per cell with dynamic row height and column grid widths.
 *  - Page size/margins come from sectPr.
 *  - Inline images (png/jpg) are embedded.
 *  - Text is sanitized to WinAnsi so standard fonts never throw.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

export function wXmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`))
  return m ? m[1] : null
}

/** Tri-state boolean property: `<w:b/>`=on, `<w:b w:val="0"/>`=off, absent=null. */
function triState(xml: string, tag: 'b' | 'i' | 'u'): boolean | null {
  // NOTE: Word writes `<w:b/>` (no space before />), so the attrs group must
  // be optional and the slash must be optional too.
  const m = xml.match(new RegExp(`<w:${tag}(?:\\s[^>]*)?/?>`))
  if (!m) return null
  const full = m[0]
  const val = attr(full, 'w:val')
  if (val !== null && /^(0|false|none|auto)$/i.test(val)) return false
  return true
}

function halfPoints(xml: string, tag: 'sz' | 'szCs'): number | null {
  const m = xml.match(new RegExp(`<w:${tag}\\b[^>]*w:val="([\\d.]+)"`))
  return m ? Math.round(parseFloat(m[1])) : null
}

function valOf(xml: string, re: RegExp): string | null {
  const m = xml.match(re)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// WinAnsi sanitization (standard 14 fonts throw on unsupported code points)
// ---------------------------------------------------------------------------

const CP1252_EXTRA = new Map<string, string>([
  ['\u20AC', '\u0080'], ['\u201A', '\u0082'], ['\u0192', '\u0083'], ['\u201E', '\u0084'],
  ['\u2026', '\u0085'], ['\u2020', '\u0086'], ['\u2021', '\u0087'], ['\u02C6', '\u0088'],
  ['\u2030', '\u0089'], ['\u0160', '\u008A'], ['\u2039', '\u008B'], ['\u0152', '\u008C'],
  ['\u017D', '\u008E'], ['\u2018', '\u0091'], ['\u2019', '\u0092'], ['\u201C', '\u0093'],
  ['\u201D', '\u0094'], ['\u2022', '\u0095'], ['\u2013', '\u0096'], ['\u2014', '\u0097'],
  ['\u02DC', '\u0098'], ['\u2122', '\u0099'], ['\u0161', '\u009A'], ['\u203A', '\u009B'],
  ['\u0153', '\u009C'], ['\u017E', '\u009E'], ['\u0178', '\u009F'],
])

/** Strip/replace characters pdf-lib's WinAnsiEncoding cannot encode. */
export function winAnsiSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp <= 0x7E || (cp >= 0xA0 && cp <= 0xFF)) { out += ch; continue }
    if (CP1252_EXTRA.has(ch)) { out += ch; continue }
    if (ch === '\n' || ch === '\r' || ch === '\t') { out += ' '; continue }
    out += '' // drop unsupported glyphs (emoji, CJK, exotic symbols)
  }
  return out
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

function wFmtColor(hex: string | null | undefined): RGB {
  const h = (hex || '000000').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2) || '00', 16) / 255
  const g = parseInt(full.slice(2, 4) || '00', 16) / 255
  const b = parseInt(full.slice(4, 6) || '00', 16) / 255
  return rgb(r, g, b)
}

// ---------------------------------------------------------------------------
// styles.xml
// ---------------------------------------------------------------------------

export interface WStyle {
  name: string | null
  basedOn: string | null
  size: number | null        // points
  bold: boolean | null
  italic: boolean | null
  color: string | null
  font: string | null        // ascii font name
  align: string | null       // left|right|center|both
  spBefore: number | null    // pt
  spAfter: number | null
  indLeft: number | null
  indRight: number | null
  indFirst: number | null
  isHeading: boolean
}

const EMPTY_STYLE: WStyle = {
  name: null, basedOn: null, size: null, bold: null, italic: null, color: null,
  font: null, align: null, spBefore: null, spAfter: null,
  indLeft: null, indRight: null, indFirst: null, isHeading: false,
}

function parseStyleBlock(block: string): WStyle & { id: string; type: string | null } {
  const id = attr(block, 'w:styleId') || ''
  const type = attr(block, 'w:type')
  const name = valOf(block, /<w:name\b[^>]*w:val="([^"]+)"/)
  const basedOn = valOf(block, /<w:basedOn\b[^>]*w:val="([^"]+)"/)
  const pPr = block.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1] || ''
  const rPr = block.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] || ''
  const sz = halfPoints(rPr, 'sz')
  const spacingTag = pPr.match(/<w:spacing\b[^>]*\/?>/)?.[0] || ''
  const before = valOf(spacingTag, /w:before="([\d.]+)"/)
  const after = valOf(spacingTag, /w:after="([\d.]+)"/)
  const jc = valOf(pPr, /<w:jc\b[^>]*w:val="([^"]+)"/)
  const indTag = pPr.match(/<w:ind\b[^>]*\/?>/)?.[0] || ''
  const indLeftRaw = valOf(indTag, /w:left="([\d.]+)"/)
  const indRightRaw = valOf(indTag, /w:right="([\d.]+)"/)
  const indFirstRaw = valOf(indTag, /w:firstLine="([\d.]+)"/)
  const font = valOf(rPr, /<w:rFonts\b[^>]*w:ascii="([^"]+)"/)
  const color = valOf(rPr, /<w:color\b[^>]*w:val="([0-9A-Fa-f]{3,8})"/)
  return {
    id, type,
    name, basedOn,
    size: sz ? sz / 2 : null,
    bold: triState(rPr, 'b'),
    italic: triState(rPr, 'i'),
    color: color && !/^auto$/i.test(color) ? color : null,
    font,
    align: jc ? jc.toLowerCase() : null,
    spBefore: before ? parseInt(before, 10) / 20 : null,
    spAfter: after ? parseInt(after, 10) / 20 : null,
    indLeft: indLeftRaw ? parseInt(indLeftRaw, 10) / 20 : null,
    indRight: indRightRaw ? parseInt(indRightRaw, 10) / 20 : null,
    indFirst: indFirstRaw ? parseInt(indFirstRaw, 10) / 20 : null,
    isHeading: name !== null && /^heading\s*\d*$/i.test(name),
  }
}

export function parseStylesXml(xml: string): {
  styles: Map<string, WStyle>
  defaults: WStyle
} {
  const styles = new Map<string, WStyle>()
  const re = /<w:style\b[\s\S]*?<\/w:style>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const s = parseStyleBlock(m[0])
    if (s.id) styles.set(s.id, { ...s })
  }
  // docDefaults
  const defaults: WStyle = { ...EMPTY_STYLE }
  const rPrDefault = xml.match(/<w:rPrDefault>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1]
  if (rPrDefault) {
    const sz = halfPoints(rPrDefault, 'sz')
    if (sz) defaults.size = sz / 2
    defaults.bold = triState(rPrDefault, 'b')
    defaults.italic = triState(rPrDefault, 'i')
    const color = valOf(rPrDefault, /<w:color\b[^>]*w:val="([0-9A-Fa-f]{3,8})"/)
    if (color && !/^auto$/i.test(color)) defaults.color = color
    defaults.font = valOf(rPrDefault, /<w:rFonts\b[^>]*w:ascii="([^"]+)"/)
  }
  const pPrDefault = xml.match(/<w:pPrDefault>[\s\S]*?<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1]
  if (pPrDefault) {
    const jc = valOf(pPrDefault, /<w:jc\b[^>]*w:val="([^"]+)"/)
    if (jc) defaults.align = jc.toLowerCase()
  }
  return { styles, defaults }
}

/** Resolve a style chain (basedOn) into one merged style. */
export function resolveStyleChain(
  startId: string | null | undefined,
  styles: Map<string, WStyle>,
): WStyle {
  const merged: WStyle = { ...EMPTY_STYLE }
  const seen = new Set<string>()
  let id = startId
  const chain: WStyle[] = []
  while (id && styles.has(id) && !seen.has(id)) {
    seen.add(id)
    const st = styles.get(id)!
    chain.push(st)
    id = st.basedOn
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const st = chain[i]
    if (st.size !== null) merged.size = st.size
    if (st.bold !== null) merged.bold = st.bold
    if (st.italic !== null) merged.italic = st.italic
    if (st.color !== null) merged.color = st.color
    if (st.font !== null) merged.font = st.font
    if (st.align !== null) merged.align = st.align
    if (st.spBefore !== null) merged.spBefore = st.spBefore
    if (st.spAfter !== null) merged.spAfter = st.spAfter
    if (st.indLeft !== null) merged.indLeft = st.indLeft
    if (st.indRight !== null) merged.indRight = st.indRight
    if (st.indFirst !== null) merged.indFirst = st.indFirst
    if (st.isHeading) merged.isHeading = true
    if (st.name && !merged.name) merged.name = st.name
  }
  return merged
}

// ---------------------------------------------------------------------------
// numbering.xml  (numId -> levels with numFmt)
// ---------------------------------------------------------------------------

export interface WNumbering {
  /** numId -> ilvl -> numFmt ('bullet' | 'decimal' | other) */
  numFormats: Map<number, Map<number, string>>
}

export function parseNumberingXml(xml: string): WNumbering {
  const abstracts = new Map<string, Map<number, string>>()
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g
  let am: RegExpExecArray | null
  while ((am = absRe.exec(xml)) !== null) {
    const levels = new Map<number, string>()
    const lvlRe = /<w:lvl\b[^>]*w:ilvl="(\d+)"[\s\S]*?<\/w:lvl>/g
    let lm: RegExpExecArray | null
    while ((lm = lvlRe.exec(am[0])) !== null) {
      const fmt = valOf(lm[0], /<w:numFmt\b[^>]*w:val="([^"]+)"/) || 'bullet'
      levels.set(parseInt(lm[1], 10), fmt)
    }
    abstracts.set(am[1], levels)
  }
  const numFormats = new Map<number, Map<number, string>>()
  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[\s\S]*?<\/w:num>/g
  let nm: RegExpExecArray | null
  while ((nm = numRe.exec(xml)) !== null) {
    const absId = valOf(nm[0], /<w:abstractNumId\b[^>]*w:val="(\d+)"/)
    if (absId && abstracts.has(absId)) numFormats.set(parseInt(nm[1], 10), abstracts.get(absId)!)
  }
  return { numFormats }
}

// ---------------------------------------------------------------------------
// document.xml parsing (sequential blocks)
// ---------------------------------------------------------------------------

export interface WRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  size: number            // points
  color: string
  font: string | null     // raw word font name (resolved to base family later)
}

export interface WImage {
  data: Uint8Array
  width: number   // pt
  height: number  // pt
  mime: 'png' | 'jpeg'
}

export interface WParagraph {
  kind: 'p'
  align: string
  runs: WRun[]
  images: WImage[]
  breaks: boolean[]       // per-run soft line breaks after run index? simpler: explicit lines
  pageBreakBefore: boolean
  hasPageBreak: boolean
  spBefore: number
  spAfter: number
  indLeft: number
  indRight: number
  indFirst: number
  lineSpacing: number | null // pt (exact line spacing)
  numId: number | null
  ilvl: number
  isHeading: boolean
  raw: string             // original <w:p> xml (for debugging / future)
}

export interface WTable {
  kind: 'tbl'
  rows: WParagraph[][][]
  grid: number[]          // column widths in twips (from tblGrid)
  cellShades: (string | null)[][]  // w:shd fill per cell
}

export type WBlock = WParagraph | WTable

export interface WDocument {
  blocks: WBlock[]
  page: { width: number; height: number; margin: { top: number; right: number; bottom: number; left: number } }
}

function parseParagraph(block: string, styles: Map<string, WStyle>, defaults: WStyle): WParagraph {
  const pStyleId = valOf(block, /<w:pStyle\b[^>]*w:val="([^"]+)"/)
  const styleChain = resolveStyleChain(pStyleId, styles)

  const jc = valOf(block, /<w:jc\b[^>]*w:val="([^"]+)"/)
  const align = (jc ? jc.toLowerCase() : styleChain.align) || 'left'

  const spacingTag = block.match(/<w:spacing\b[^>]*\/?>/)?.[0] || ''
  const before = valOf(spacingTag, /w:before="([\d.]+)"/)
  const after = valOf(spacingTag, /w:after="([\d.]+)"/)
  const line = valOf(spacingTag, /w:line="([\d.]+)"/)
  const lineRule = valOf(spacingTag, /w:lineRule="([^"]+)"/)
  // Word's built-in Normal style applies 8pt (160 twips) after-spacing when
  // neither the paragraph, its style chain, nor docDefaults specify it.
  const spBefore = before !== null ? parseInt(before, 10) / 20 : (styleChain.spBefore ?? defaults.spBefore ?? 0)
  const spAfter = after !== null ? parseInt(after, 10) / 20 : (styleChain.spAfter ?? defaults.spAfter ?? 8)
  const lineSpacing = line && lineRule !== 'auto' && lineRule !== null ? parseInt(line, 10) / 20 : null

  const indTag = block.match(/<w:ind\b[^>]*\/?>/)?.[0] || ''
  const indLeftV = valOf(indTag, /w:left="([\d.]+)"/) ?? valOf(indTag, /w:start="([\d.]+)"/)
  const indRightV = valOf(indTag, /w:right="([\d.]+)"/) ?? valOf(indTag, /w:end="([\d.]+)"/)
  const indFirstV = valOf(indTag, /w:firstLine="([\d.]+)"/)
  const indLeft = indLeftV !== null ? parseInt(indLeftV, 10) / 20 : (styleChain.indLeft ?? 0)
  const indRight = indRightV !== null ? parseInt(indRightV, 10) / 20 : (styleChain.indRight ?? 0)
  const indFirst = indFirstV !== null ? parseInt(indFirstV, 10) / 20 : (styleChain.indFirst ?? 0)

  const numIdStr = valOf(block, /<w:numId\b[^>]*w:val="(\d+)"/)
  const ilvlStr = valOf(block, /<w:ilvl\b[^>]*w:val="(\d+)"/)

  const hasPageBreak = /<w:br\b[^>]*type="page"/i.test(block)
  const pageBreakBefore = /<w:pageBreakBefore\s*\/?>/.test(block)

  // Runs: keep document order; also capture explicit <w:br> line breaks as
  // separate marker runs, and images.
  const runs: WRun[] = []
  const images: WImage[] = []
  const rStyleId = valOf(block, /<w:rStyle\b[^>]*w:val="([^"]+)"/)
  const charStyle = rStyleId ? resolveStyleChain(rStyleId, styles) : null

  const defaultSize = styleChain.size ?? defaults.size ?? 11
  const defaultBold = styleChain.bold ?? defaults.bold ?? false
  const defaultItalic = styleChain.italic ?? defaults.italic ?? false
  const defaultColor = styleChain.color ?? defaults.color ?? '000000'
  const defaultFont = styleChain.font ?? defaults.font ?? null

  // Walk run segments in order (also grabs breaks between runs)
  const segRe = /<w:r\b[\s\S]*?<\/w:r>|<w:br\b[^>]*\/?>/g
  let sm: RegExpExecArray | null
  while ((sm = segRe.exec(block)) !== null) {
    const seg = sm[0]
    if (seg.startsWith('<w:br')) {
      if (!/type="page"/i.test(seg)) {
        runs.push({ text: '\n', bold: false, italic: false, underline: false, size: defaultSize, color: defaultColor, font: null })
      }
      continue
    }
    const rPr = seg.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] || ''
    const directBold = triState(rPr, 'b')
    const directItalic = triState(rPr, 'i')
    const szHp = halfPoints(rPr, 'sz') ?? halfPoints(rPr, 'szCs')
    const colorTag = valOf(rPr, /<w:color\b[^>]*w:val="([0-9A-Fa-f]{3,8})"/)
    const font = valOf(rPr, /<w:rFonts\b[^>]*w:ascii="([^"]+)"/)
    const bold = directBold ?? charStyle?.bold ?? defaultBold
    const italic = directItalic ?? charStyle?.italic ?? defaultItalic
    const size = szHp ? szHp / 2 : (charStyle?.size ?? defaultSize)
    const color = colorTag && !/^auto$/i.test(colorTag) ? colorTag : (charStyle?.color ?? defaultColor)
    const effFont = font ?? charStyle?.font ?? defaultFont

    // underline (direct only — char styles rarely used for u in practice)
    const uTag = rPr.match(/<w:u\b[^>]*\/?>/)?.[0] || ''
    const uVal = uTag ? (attr(uTag, 'w:val') || 'single') : null
    const under = uVal !== null && !/^(none|none)$/i.test(uVal)

    const tms = [...seg.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    for (let ti = 0; ti < tms.length; ti++) {
      if (ti > 0) {
        runs.push({ text: ' ', bold, italic, underline: under, size, color, font: effFont })
      }
      runs.push({ text: wXmlDecode(tms[ti][1]), bold, italic, underline: under, size, color, font: effFont })
    }

    // Inline images (w:drawing) — handled by caller with media map via placeholder
    if (/<w:drawing>/.test(seg)) {
      const drawing = seg.match(/<w:drawing>([\s\S]*?)<\/w:drawing>/)?.[1] || ''
      const rId = valOf(drawing, /r:embed="([^"]+)"/)
      const cx = valOf(drawing, /<wp:extent\b[^>]*cx="(\d+)"/)
      const cy = valOf(drawing, /<wp:extent\b[^>]*cy="(\d+)"/)
      if (rId) {
        runs.push({ text: `\u0000IMG:${rId}:${cx || ''}:${cy || ''}\u0000`, bold: false, italic: false, underline: false, size, color, font: null })
      }
    }
  }
  void images

  return {
    kind: 'p',
    align,
    runs,
    images,
    breaks: [],
    pageBreakBefore,
    hasPageBreak,
    spBefore,
    spAfter,
    indLeft,
    indRight,
    indFirst,
    lineSpacing,
    numId: numIdStr !== null ? parseInt(numIdStr, 10) : null,
    ilvl: ilvlStr !== null ? parseInt(ilvlStr, 10) : 0,
    isHeading: styleChain.isHeading,
    raw: block,
  }
}

function parseCell(cellXml: string, styles: Map<string, WStyle>, defaults: WStyle): { paras: WParagraph[]; shade: string | null } {
  const paras: WParagraph[] = []
  const re = /<w:p\b[\s\S]*?<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cellXml)) !== null) paras.push(parseParagraph(m[0], styles, defaults))
  const shd = valOf(cellXml, /<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{3,8})"/)
  return { paras, shade: shd && !/auto/i.test(shd) ? shd : null }
}

function parseTable(block: string, styles: Map<string, WStyle>, defaults: WStyle): WTable {
  const grid: number[] = []
  const gridRe = /<w:gridCol\b[^>]*w:w="(\d+)"/g
  let gm: RegExpExecArray | null
  while ((gm = gridRe.exec(block)) !== null) grid.push(parseInt(gm[1], 10))

  const rows: WParagraph[][][] = []
  const cellShades: (string | null)[][] = []
  const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g
  let tm: RegExpExecArray | null
  while ((tm = trRe.exec(block)) !== null) {
    const row: WParagraph[][] = []
    const shades: (string | null)[] = []
    const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g
    let cm: RegExpExecArray | null
    while ((cm = tcRe.exec(tm[0])) !== null) {
      const cell = parseCell(cm[0], styles, defaults)
      row.push(cell.paras)
      shades.push(cell.shade)
    }
    rows.push(row)
    cellShades.push(shades)
  }
  return { kind: 'tbl', rows, grid, cellShades }
}

function parseSectPr(body: string): WDocument['page'] {
  const defaultPage = {
    width: 612, height: 792, // Letter
    margin: { top: 72, right: 72, bottom: 72, left: 72 },
  }
  const sect = body.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]
  if (!sect) return defaultPage
  const pgSz = sect.match(/<w:pgSz\b[^>]*\/?>/)?.[0]
  const pgMar = sect.match(/<w:pgMar\b[^>]*\/?>/)?.[0]
  const w = pgSz ? attr(pgSz, 'w:w') : null
  const h = pgSz ? attr(pgSz, 'w:h') : null
  const tw = (v: string | null, def: number) => (v ? parseInt(v, 10) / 20 : def)
  return {
    width: w ? parseInt(w, 10) / 20 : defaultPage.width,
    height: h ? parseInt(h, 10) / 20 : defaultPage.height,
    margin: {
      top: tw(pgMar ? attr(pgMar, 'w:top') : null, 72),
      right: tw(pgMar ? attr(pgMar, 'w:right') : null, 72),
      bottom: tw(pgMar ? attr(pgMar, 'w:bottom') : null, 72),
      left: tw(pgMar ? attr(pgMar, 'w:left') : null, 72),
    },
  }
}

export function parseDocumentXml(
  xmlText: string,
  styles: Map<string, WStyle>,
  defaults: WStyle,
): WDocument {
  const bodyMatch = xmlText.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/)
  const body = bodyMatch ? bodyMatch[1] : xmlText
  const blocks: WBlock[] = []
  const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m[0].startsWith('<w:tbl')) blocks.push(parseTable(m[0], styles, defaults))
    else blocks.push(parseParagraph(m[0], styles, defaults))
  }
  return { blocks, page: parseSectPr(body) }
}

// ---------------------------------------------------------------------------
// Media resolution (rIds -> bytes)
// ---------------------------------------------------------------------------

async function loadMedia(zip: JSZip, docRelsXml: string): Promise<Map<string, { data: Uint8Array; mime: 'png' | 'jpeg' }>> {
  const map = new Map<string, { data: Uint8Array; mime: 'png' | 'jpeg' }>()
  const re = /<Relationship\b[^>]*\/?>/g
  let m: RegExpExecArray | null
  const base = 'word/'
  while ((m = re.exec(docRelsXml)) !== null) {
    const tag = m[0]
    const id = attr(tag, 'Id')
    const target = attr(tag, 'Target')
    const type = attr(tag, 'Type') || ''
    if (!id || !target) continue
    if (!/image$/.test(type)) continue
    const path = target.startsWith('/') ? target.slice(1) : base + target.replace(/^\.\.\//, '')
    const norm = path.replace(/word\/\.\.\//g, '')
    const file = zip.files[norm] || zip.files[path] || zip.files['word/' + target.replace(/^.\//, '')]
    if (!file) continue
    const data = await file.async('uint8array')
    const mime: 'png' | 'jpeg' = /\.png$/i.test(target) || data[1] === 0x50 ? 'png' : 'jpeg'
    map.set(id, { data, mime })
  }
  return map
}

// ---------------------------------------------------------------------------
// Font family mapping (Word font names -> standard 14)
// ---------------------------------------------------------------------------

type FontKey = 'normal' | 'bold' | 'italic' | 'bi'

function mapFontFamily(name: string | null): 'helvetica' | 'times' | 'courier' {
  if (!name) return 'helvetica'
  const n = name.toLowerCase()
  if (/times|georgia|palatino|garamond|book antiqua|serif|cambria|constantia/.test(n)) return 'times'
  if (/courier|consolas|mono|menlo|calibri mono/.test(n)) return 'courier'
  return 'helvetica' // arial, calibri, verdana, tahoma, helvetica, seg ui...
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export async function docxToPdf(file: File | { arrayBuffer(): Promise<ArrayBuffer>; name: string }): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)

  const findFile = (want: string) => {
    for (const path of Object.keys(zip.files)) {
      if (path.toLowerCase() === want.toLowerCase()) return zip.files[path]
    }
    return null
  }

  const docFile = findFile('word/document.xml')
  if (!docFile) throw new Error('Documento Word inválido: no se encontró document.xml')
  const xmlText = await docFile.async('string')

  const stylesFile = findFile('word/styles.xml')
  const { styles, defaults } = stylesFile
    ? parseStylesXml(await stylesFile.async('string'))
    : { styles: new Map<string, WStyle>(), defaults: { ...EMPTY_STYLE } }

  const numberingFile = findFile('word/numbering.xml')
  const numbering = numberingFile
    ? parseNumberingXml(await numberingFile.async('string'))
    : { numFormats: new Map<number, Map<number, string>>() }

  const relsFile = findFile('word/_rels/document.xml.rels')
  const media = relsFile ? await loadMedia(zip, await relsFile.async('string')) : new Map()

  const doc = parseDocumentXml(xmlText, styles, defaults)
  const { width: PW, height: PH, margin: MG } = doc.page
  const contentWidth = PW - MG.left - MG.right

  const pdfDoc = await PDFDocument.create()
  const fonts = new Map<string, PDFFont>()
  const getFont = async (family: 'helvetica' | 'times' | 'courier', key: FontKey): Promise<PDFFont> => {
    const mapKey = family + '|' + key
    const cached = fonts.get(mapKey)
    if (cached) return cached
    const table = {
      helvetica: {
        normal: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold,
        italic: StandardFonts.HelveticaOblique, bi: StandardFonts.HelveticaBoldOblique,
      },
      times: {
        normal: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold,
        italic: StandardFonts.TimesRomanItalic, bi: StandardFonts.TimesRomanBoldItalic,
      },
      courier: {
        normal: StandardFonts.Courier, bold: StandardFonts.CourierBold,
        italic: StandardFonts.CourierOblique, bi: StandardFonts.CourierBoldOblique,
      },
    } as const
    const f = await pdfDoc.embedFont(table[family][key])
    fonts.set(mapKey, f)
    return f
  }

  let page: PDFPage = pdfDoc.addPage([PW, PH])
  let curY = PH - MG.top
  const bottomLimit = () => MG.bottom

  const newPage = () => {
    page = pdfDoc.addPage([PW, PH])
    curY = PH - MG.top
  }
  const ensureSpace = (needed: number) => {
    if (curY - needed < bottomLimit()) newPage()
  }

  // Resolve an image marker run to an embedded image
  const embeddedImages = new Map<string, { src: Awaited<ReturnType<PDFDocument['embedPng']>>; w: number; h: number }>()

  // list counters: key numId:ilvl -> current decimal value
  const counters = new Map<string, number>()

  const markerRe = /^\u0000IMG:([^:]+):(\d*):(\d*)\u0000$/

  interface Token { text: string; w: number; font: PDFFont; size: number; color: RGB; underline: boolean; isBreak: boolean; img?: { id: string; cx: number; cy: number } }

  const buildLineTokens = async (runs: WRun[]): Promise<Token[]> => {
    const tokens: Token[] = []
    for (const r of runs) {
      const imgM = r.text.match(markerRe)
      if (imgM) {
        tokens.push({
          text: '', w: 0, font: await getFont('helvetica', 'normal'), size: 1, color: rgb(0, 0, 0),
          underline: false, isBreak: false,
          img: { id: imgM[1], cx: imgM[2] ? parseInt(imgM[2], 10) / 12700 : 0, cy: imgM[3] ? parseInt(imgM[3], 10) / 12700 : 0 },
        })
        continue
      }
      if (r.text === '\n') {
        tokens.push({
          text: '\n', w: 0, font: await getFont('helvetica', 'normal'), size: r.size, color: rgb(0, 0, 0),
          underline: false, isBreak: true,
        })
        continue
      }
      const family = mapFontFamily(r.font)
      const key: FontKey = r.bold && r.italic ? 'bi' : r.bold ? 'bold' : r.italic ? 'italic' : 'normal'
      const font = await getFont(family, key)
      const size = Math.max(1, Math.min(200, r.size || 11))
      const raw = winAnsiSafe(r.text)
      if (!raw) continue
      tokens.push({ text: raw, w: font.widthOfTextAtSize(raw, size), font, size, color: wFmtColor(r.color), underline: r.underline, isBreak: false })
    }
    return tokens
  }

  /** Wrap tokens into lines not exceeding maxW; soft breaks at \n tokens. */
  const wrapTokens = (tokens: Token[], maxW: number): Token[][] => {
    const lines: Token[][] = []
    let line: Token[] = []
    let lineW = 0
    for (const t of tokens) {
      if (t.isBreak) {
        lines.push(line)
        line = []
        lineW = 0
        continue
      }
      if (t.img) {
        if (line.length) { lines.push(line); line = []; lineW = 0 }
        lines.push([t])
        continue
      }
      // split token by spaces for wrapping
      const parts = t.text.split(/(\s+)/)
      for (const part of parts) {
        if (!part) continue
        const partW = t.font.widthOfTextAtSize(part, t.size)
        if (/\s/.test(part)) {
          if (line.length === 0) continue // no leading spaces
          line.push({ ...t, text: part, w: partW })
          lineW += partW
          continue
        }
        if (lineW + partW > maxW && line.length > 0) {
          lines.push(line)
          line = []
          lineW = 0
        }
        line.push({ ...t, text: part, w: partW })
        lineW += partW
      }
    }
    if (line.length) lines.push(line)
    return lines
  }

  const lineWidth = (line: Token[]) => line.reduce((s, t) => s + t.w, 0)

  const drawLine = (line: Token[], x: number, y: number) => {
    let cx = x
    for (const t of line) {
      if (t.img) continue
      page.drawText(t.text, { x: cx, y, font: t.font, size: t.size, color: t.color })
      if (t.underline) {
        const th = Math.max(0.5, t.size / 16)
        page.drawRectangle({ x: cx, y: y - t.size * 0.18, width: t.w, height: th, color: t.color })
      }
      cx += t.w
    }
  }

  const drawImage = async (tok: Token, x: number, lineH: number) => {
    const img = tok.img!
    const rec = embeddedImages.get(img.id)
    let src = rec?.src
    if (!src) {
      const m = media.get(img.id)
      if (!m) return
      src = m.mime === 'png' ? await pdfDoc.embedPng(m.data) : await pdfDoc.embedJpg(m.data)
      embeddedImages.set(img.id, { src, w: 0, h: 0 })
    }
    let w = img.cx
    let h = img.cy
    if (!w || !h) {
      // unknown extent: fit into content width keeping aspect
      const nat = (src as { width: number; height: number })
      w = Math.min(contentWidth, nat.width)
      h = w * (nat.height / nat.width)
    }
    const maxW = contentWidth
    if (w > maxW) { h = h * (maxW / w); w = maxW }
    ensureSpace(Math.max(h, lineH))
    page.drawImage(src, { x, y: curY - h, width: w, height: h })
    curY -= h + 4
  }

  const markerForList = (para: WParagraph): string => {
    if (para.numId === null) return ''
    const levels = numbering.numFormats.get(para.numId)
    const fmt = levels?.get(para.ilvl) ?? 'bullet'
    const key = `${para.numId}:${para.ilvl}`
    if (fmt === 'bullet') {
      return '\u2022  '
    }
    // decimal counters reset handled per numId (ilvl chains approximated)
    if (fmt === 'decimal' || fmt === 'lowerLetter' || fmt === 'upperLetter' || fmt === 'lowerRoman' || fmt === 'upperRoman') {
      const cur = (counters.get(key) ?? 0) + 1
      counters.set(key, cur)
      if (fmt === 'decimal') return `${cur}.  `
      if (fmt === 'lowerLetter') return `${String.fromCharCode(96 + ((cur - 1) % 26) + 1)}.  `
      if (fmt === 'upperLetter') return `${String.fromCharCode(64 + ((cur - 1) % 26) + 1)}.  `
      return `${cur}.  `
    }
    return '\u2022  '
  }

  const renderParagraph = async (para: WParagraph, overrideAlign?: string) => {
    if (para.pageBreakBefore) newPage()

    curY -= para.spBefore

    const listPrefix = markerForList(para)
    const indentBase = MG.left + para.indLeft
    const firstIndent = para.numId !== null ? 18 : para.indFirst
    const maxW = Math.max(50, contentWidth - para.indLeft - para.indRight)

    // Split runs into paragraph lines first (prefix on first line), then wrap
    let runs = para.runs
    if (listPrefix) {
      runs = [{ text: listPrefix, bold: false, italic: false, underline: false, size: para.runs[0]?.size ?? 11, color: para.runs[0]?.color ?? '000000', font: para.runs[0]?.font ?? null }, ...runs]
    }

    const tokens = await buildLineTokens(runs)
    const lines = wrapTokens(tokens, maxW - firstIndent)

    const align = overrideAlign ?? para.align
    const hasContent = lines.some(l => l.length > 0) || para.runs.length > 0

    if (!hasContent) {
      const size = para.runs[0]?.size ?? 11
      ensureSpace(size * 1.3)
      curY -= size * 1.3
      curY -= para.spAfter
      return
    }

    let lineIdx = 0
    for (const line of lines) {
      const imgTok = line.find(t => t.img)
      if (imgTok && line.length === 1) {
        await drawImage(imgTok, indentBase, 12)
        lineIdx++
        continue
      }
      if (line.length === 0) {
        // blank line
        const size = 11
        ensureSpace(size * 1.3)
        curY -= size * 1.3
        lineIdx++
        continue
      }
      const maxSize = line.reduce((m, t) => Math.max(m, t.size), 11)
      const lineH = para.lineSpacing ?? Math.max(maxSize * 1.25, maxSize + 3)
      ensureSpace(lineH)

      const wLine = lineWidth(line)
      let x = indentBase + (lineIdx === 0 ? firstIndent : 0)
      const availW = maxW - (lineIdx === 0 ? firstIndent : 0)
      if (align === 'right') x = indentBase + availW - wLine
      else if (align === 'center') x = indentBase + (availW - wLine) / 2
      else if (align === 'both' || align === 'justify') {
        // stretch inter-word spaces to fill the line (except last line)
        const isLast = lineIdx === lines.length - 1
        if (!isLast && line.length > 1) {
          const spaces = line.filter(t => /^\s+$/.test(t.text))
          const gap = availW - wLine
          if (spaces.length > 0 && gap > 0) {
            const extra = gap / spaces.length
            let cx = x
            for (const t of line) {
              drawLine([t], cx, curY)
              cx += t.w + (/^\s+$/.test(t.text) ? extra : 0)
            }
            curY -= lineH
            lineIdx++
            continue
          }
        }
      }

      drawLine(line, x, curY)
      curY -= lineH
      lineIdx++
    }

    curY -= para.spAfter
  }

  // number counter reset: when a new list starts (numId seen first time in a
  // non-consecutive position we can't easily detect; approximate by resetting
  // when paragraph has numId but previous block wasn't the same numId)
  let lastNumId: number | null = null

  for (const block of doc.blocks) {
    if (block.kind === 'tbl') {
      await renderTable(block)
      lastNumId = null
      continue
    }
    if (block.numId !== null && block.numId !== lastNumId) {
      // fresh list: reset its decimal counters
      for (const k of [...counters.keys()]) {
        if (k.startsWith(block.numId + ':')) counters.delete(k)
      }
    }
    lastNumId = block.numId
    await renderParagraph(block)
  }

  async function renderTable(tbl: WTable) {
    const nC = Math.max(1, ...tbl.rows.map(r => r.length))
    // column widths from grid (twips) or equal split
    let colW: number[]
    const gridTotal = tbl.grid.reduce((s, g) => s + g, 0)
    if (tbl.grid.length >= nC && gridTotal > 0) {
      colW = tbl.grid.slice(0, nC).map(g => (g / gridTotal) * contentWidth)
      // if grid narrower/wider than content, scale
      const sum = colW.reduce((s, w) => s + w, 0)
      if (Math.abs(sum - contentWidth) > 1) colW = colW.map(w => (w / sum) * contentWidth)
    } else {
      colW = Array.from({ length: nC }, () => contentWidth / nC)
    }

    const PAD_X = 4
    const PAD_Y = 3

    // Pre-measure every row height (wrap cells)
    interface CellPlan { lines: Token[][]; shade: string | null }
    interface RowPlan { cells: CellPlan[]; height: number }
    const rowPlans: RowPlan[] = []

    for (const row of tbl.rows) {
      const cells: CellPlan[] = []
      let rowH = 0
      for (let ci = 0; ci < nC; ci++) {
        const cellParas = row[ci] || []
        const tokens: Token[] = []
        for (const p of cellParas) {
          for (const r of p.runs) {
            tokens.push(...await buildLineTokens([r]))
          }
          tokens.push({ text: '\n', w: 0, font: await getFont('helvetica', 'normal'), size: 10, color: rgb(0, 0, 0), underline: false, isBreak: true })
        }
        // drop trailing break
        while (tokens.length && tokens[tokens.length - 1].isBreak) tokens.pop()
        const w = Math.max(30, colW[ci] - 2 * PAD_X)
        const lines = wrapTokens(tokens, w)
        const cellMaxSize = lines.reduce((m, l) => Math.max(m, l.reduce((s, t) => Math.max(s, t.size), 10)), 10)
        const lh = cellMaxSize * 1.25
        rowH = Math.max(rowH, lines.length * lh + 2 * PAD_Y, lh + 2 * PAD_Y)
        cells.push({ lines, shade: null })
      }
      // apply parsed shades
      row.forEach((_, ci) => {
        if (cells[ci]) cells[ci].shade = tbl.cellShades[rowPlans.length]?.[ci] ?? null
      })
      rowPlans.push({ cells, height: rowH })
    }

    // Draw rows with page-break handling (row is atomic)
    for (const rp of rowPlans) {
      if (curY - rp.height < bottomLimit()) newPage()
      const y0 = curY - rp.height
      let x = MG.left
      for (let ci = 0; ci < nC; ci++) {
        const cell = rp.cells[ci]
        const w = colW[ci]
        const shadeHex = cell?.shade
        page.drawRectangle({
          x, y: y0, width: w, height: rp.height,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
          color: shadeHex ? wFmtColor(shadeHex) : rgb(1, 1, 1),
        })
        if (cell) {
          const maxSize = cell.lines.reduce((m, l) => Math.max(m, l.reduce((s, t) => Math.max(s, t.size), 10)), 10)
          const lh = maxSize * 1.25
          let cy = y0 + rp.height - PAD_Y - maxSize // baseline of first line
          for (const line of cell.lines) {
            let cx = x + PAD_X
            for (const t of line) {
              if (!t.isBreak && !t.img) {
                page.drawText(t.text, { x: cx, y: cy, font: t.font, size: t.size, color: t.color })
                cx += t.w
              }
            }
            cy -= lh
          }
        }
        x += w
      }
      curY = y0
      curY -= 6 // spacing after table
    }
  }

  return await pdfDoc.save()
}
