import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'
import { extractWordsFromImage, type OcrWordBox } from '../utils/ocrService'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

/* ── Types ──────────────────────────────────────────────── */

interface TextBox {
  id: number
  x: number
  y: number
  width: number
  text: string
  page: number
  fontSize: number
  fontFamily: string
  fontColor: string
  highlightColor: string
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
}

interface ImageBox {
  id: number
  x: number
  y: number
  width: number
  height: number
  src: string
  page: number
}

interface DrawStroke {
  id: number
  points: { x: number; y: number }[]
  color: string
  size: number
  page: number
}

interface ExistingTextItem {
  id: number
  text: string
  originalText: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontColor: string
  bold: boolean
  italic: boolean
  page: number
  edited: boolean
  // Fillable field detection
  isFillable?: boolean
  fillableType?: 'underscore' | 'dots' | 'checkbox' | 'brackets' | ''
  /** 'text' = from the PDF text layer, 'ocr' = recognized from a scanned page */
  source?: 'text' | 'ocr'
}

/** Native AcroForm field (widget annotation) shown as a real input over the page. */
interface FormField {
  name: string
  type: 'Tx' | 'Btn' | 'Radio'
  // Overlay coords (CSS px at the scale the field was extracted)
  x: number
  y: number
  width: number
  height: number
  value: string      // Tx: current text
  checked: boolean   // Btn/Radio: current checked state
  exportValue?: string // Radio: value exported when this option is selected
  page: number
  touched: boolean
  /** Natural (never-moved) position — used to white-out the scan when the field is relocated */
  origX?: number
  origY?: number
  /** Scale the coords above were extracted at (re-map offsets on zoom/page re-extract) */
  extractScale?: number
  /** User dragged the field away from its natural position */
  moved?: boolean
  /** User removed the field — hidden in preview, white-out + off-page widget in export */
  hidden?: boolean
  /** Text alignment from the annotation's /Q (default left when the PDF declares none) */
  align?: 'left' | 'center' | 'right'
  /** Telmex scan: printed oval this checkbox must sit on, in PDF coords
   *  [x1, y1, x2, y2] (bottom-up). Set on page 0 of the 1187×1536 Telmex form
   *  and used to snap both the preview overlay and the exported widget rect. */
  ovalPdf?: [number, number, number, number]
}

interface EditorState {
  boxes: TextBox[]
  images: ImageBox[]
  strokes: DrawStroke[]
  existingTexts?: ExistingTextItem[]
  formFields?: FormField[]
}

/* ── Telmex scan form (Formato_Telmex_editable.pdf) ─────── */

// The scan prints checkbox ovals that do NOT line up with the AcroForm widget
// rects (the widgets sit ~50pt above their ovals). These are the oval rects in
// PDF coords [x1, y1, x2, y2] (bottom-up) on page 0 of the 1187×1536 form.
const TELMEX_PAGE_VIEW: [number, number, number, number] = [0, 0, 1187, 1536]
const TELMEX_OVAL_RECTS: Record<string, [number, number, number, number]> = {
  persona_fisica: [447.5, 1209.5, 491.5, 1239.5],
  persona_moral: [665.5, 1210.5, 709.5, 1240.5],
  servicio_fijo: [950, 1056, 996, 1078],
  movil_mpp: [595, 1025, 639, 1049],
  movil_cpp: [950, 1023, 996, 1045],
  numero_no_geografico: [950, 992, 996, 1014],
  donador_axtel: [105, 852, 127, 872],
  donador_maxcom: [105, 818, 127, 838],
  donador_marcatel: [105, 782, 127, 802],
  donador_alestra: [105, 748, 127, 768],
  donador_otro: [105, 712, 127, 732],
  receptor_telmex_local: [639, 852, 661, 872],
  receptor_telmex_800_900: [639, 798, 661, 818],
}

/* ── IndexedDB persistence ──────────────────────────────── */

const DB_NAME = 'pdf-editor'
const DB_STORE = 'documents'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveState(fileName: string, state: EditorState) {
  try {
    const db = await openDB()
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(state, fileName)
  } catch { /* silent */ }
}

async function loadState(fileName: string): Promise<EditorState | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(DB_STORE, 'readonly')
    return await new Promise((resolve) => {
      const req = tx.objectStore(DB_STORE).get(fileName)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

/* ── Font helpers ───────────────────────────────────────── */

const FONT_FAMILIES = [
  'Helvetica', 'Arial', 'Times New Roman', 'Courier New',
  'Georgia', 'Verdana', 'Impact', 'Comic Sans MS',
  'Trebuchet MS', 'Palatino',
]

const HIGHLIGHT_COLORS = [
  { name: 'Ninguno', value: '' },
  { name: 'Amarillo', value: '#fef08a' },
  { name: 'Verde claro', value: '#bbf7d0' },
  { name: 'Azul claro', value: '#bfdbfe' },
  { name: 'Rosa claro', value: '#fbcfe8' },
  { name: 'Naranja claro', value: '#fed7aa' },
]

function fontToPdfLib(fontFamily: string, bold = false, italic = false): StandardFonts {
  const map: Record<string, StandardFonts> = {
    'Helvetica': StandardFonts.Helvetica,
    'Arial': StandardFonts.Helvetica,
    'Times New Roman': StandardFonts.TimesRoman,
    'Courier New': StandardFonts.Courier,
    'Georgia': StandardFonts.TimesRoman,
    'Verdana': StandardFonts.Helvetica,
    'Impact': StandardFonts.HelveticaBold,
    'Comic Sans MS': StandardFonts.Helvetica,
    'Trebuchet MS': StandardFonts.Helvetica,
    'Palatino': StandardFonts.TimesRoman,
  }
  const base = map[fontFamily] || StandardFonts.Helvetica
  // Apply bold/italic variants of the resolved base font
  if (base === StandardFonts.Helvetica) {
    if (bold && italic) return StandardFonts.HelveticaBoldOblique
    if (bold) return StandardFonts.HelveticaBold
    if (italic) return StandardFonts.HelveticaOblique
  } else if (base === StandardFonts.TimesRoman) {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
  } else if (base === StandardFonts.Courier) {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
  }
  return base
}

/**
 * Resolve the real font of a pdf.js text item.
 * `fontName` from getTextContent is an internal id (e.g. 'g_d0_f1'), so bold/italic
 * regexes never match it — the actual font object lives in page.commonObjs.
 */
function resolveRealFont(page: unknown, loadedName: string): { family: string; bold: boolean; italic: boolean } {
  try {
    const objs = (page as { commonObjs?: { get?: (id: string) => { name?: string; fallbackName?: string } } })?.commonObjs
    const font = objs?.get?.(loadedName)
    // Embedded subset fonts are prefixed like 'ABCDEF+Arial-Bold'
    const raw = (font?.name || font?.fallbackName || '').replace(/^\/?([A-Z]{6}\+)?/, '')
    const n = raw.toLowerCase()
    const bold = /bold|black|heavy|semibold|demibold/.test(n)
    const italic = /italic|oblique/.test(n)
    let family = 'Helvetica'
    if (/helvetica|arial|sans|verdana|calibri|roboto|tahoma/.test(n)) family = 'Helvetica'
    else if (/times|georgia|palatino|serif|book/.test(n)) family = 'Times New Roman'
    else if (/courier|mono|consolas/.test(n)) family = 'Courier New'
    return { family, bold, italic }
  } catch {
    return { family: 'Helvetica', bold: false, italic: false }
  }
}

/** Group OCR word boxes into per-line editable items (overlay coords at `scale`). */
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

let measureCtx: CanvasRenderingContext2D | null | undefined
/** Width of `text` rendered in Helvetica at `fontSizePx` (preview units). */
function measureTextPx(text: string, fontSizePx: number): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  measureCtx.font = `${fontSizePx}px Helvetica`
  return measureCtx.measureText(text).width
}

function groupWordsToItems(
  words: OcrWordBox[],
  scale: number,
  page: number,
  makeId: () => number,
): ExistingTextItem[] {
  if (!words.length) return []

  type Group = { ySum: number; n: number; h: number; words: OcrWordBox[] }
  const groups: Group[] = []
  const sorted = [...words].sort((a, b) => a.y0 - b.y0)
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2
    const h = w.y1 - w.y0
    let g = groups.find(gr => Math.abs(gr.ySum / gr.n - cy) < Math.max(gr.h, h) * 0.6)
    if (!g) {
      g = { ySum: cy, n: 1, h, words: [w] }
      groups.push(g)
    } else {
      g.ySum += cy
      g.n += 1
      g.h = Math.max(g.h, h)
      g.words.push(w)
    }
  }

  const items: ExistingTextItem[] = []
  for (const g of groups) {
    g.words.sort((a, b) => a.x0 - b.x0)

    // Split the line into columns: table cells sit side by side with wide
    // gaps, and merging them into one item painted a white box across
    // neighbouring cells (the "original layout moves/disappears" bug).
    const medHGroup = median(g.words.map(w => w.y1 - w.y0))
    const cols: OcrWordBox[][] = [[]]
    let lineEnd: number | null = null
    for (const w of g.words) {
      if (lineEnd !== null) {
        const colWords = cols[cols.length - 1]
        const textSoFar = colWords.map(c => c.text).join('')
        const avgCharW = textSoFar.length ? (lineEnd - colWords[0].x0) / textSoFar.length : 10
        if (w.x0 - lineEnd > Math.max(24, 2.2 * medHGroup, 3 * avgCharW)) cols.push([])
      }
      cols[cols.length - 1].push(w)
      lineEnd = Math.max(lineEnd ?? 0, w.x1)
    }

    for (const col of cols) {
      let text = ''
      let prevEnd = 0
      for (const w of col) {
        const gap = w.x0 - prevEnd
        // Insert a space when the horizontal gap between words is wider than a
        // letter but narrower than a full word gap (~0.28em). 0.35 glued words
        // like "ELQUELLAMA"; thresholds below ~0.10 start splitting letters.
        // Gap is compared against THIS word's height: group maxH can be 2x
        // inflated by outlier bboxes and glued words like TELÉFONOSDEMÉXICO.
        if (text) text += gap > Math.max(1, (w.y1 - w.y0) * 0.12) ? ' ' : ''
        text += w.text
        prevEnd = Math.max(prevEnd, w.x1)
      }
      if (!text.trim()) continue

      // Item-level sanity: mostly-symbol text (form graphics) or an item where
      // most words are not confidently read is junk — drop it from the layer.
      const compact = text.replace(/\s+/gu, '')
      const alnum = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0
      if (!compact || alnum / compact.length < 0.5) continue
      const highConf = col.filter(w => w.confidence >= 80).length / col.length
      if (highConf <= 0.5) continue

      const inkTop = Math.min(...col.map(w => w.y0))
      const inkBottom = Math.max(...col.map(w => w.y1))
      const x0 = Math.min(...col.map(w => w.x0))
      const boxW = Math.max(prevEnd - x0, 10)
      // Font size from the MEDIAN word height: tesseract sometimes returns
      // 1.5–2x inflated bboxes for a word (e.g. MAXCOM h=32 vs the real ~17),
      // and max() turned that into giant text overflowing the cell.
      const fontSizePx = median(col.map(w => w.y1 - w.y0)) * 1.05
      // Fit-to-width: Helvetica renders wider than the scanned original;
      // never exceed the OCR box or the item taps neighbouring cells.
      const predicted = measureTextPx(text, fontSizePx)
      const fittedPx = predicted > 0
        ? fontSizePx * Math.min(1, Math.max(0.4, boxW / predicted))
        : fontSizePx
      // Raw font size in PDF points (preview multiplies by scale, export uses raw)
      const fontSize = fittedPx / scale
      const height = fittedPx * 1.3
      items.push({
        id: makeId(),
        text,
        originalText: text,
        x: x0,
        y: inkTop - (height - (inkBottom - inkTop)) / 2,
        width: boxW,
        height,
        fontSize,
        fontFamily: 'Helvetica',
        fontColor: '#000000',
        bold: false,
        italic: false,
        page,
        edited: false,
        source: 'ocr',
      })
    }
  }
  return items
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

/* ── Component ──────────────────────────────────────────── */

interface TextEditorProps {
  value: string
  className?: string
  style?: CSSProperties
  onInput: (text: string) => void
  onFocus?: () => void
}

/**
 * Uncontrolled contentEditable.
 *
 * The text must NOT be rendered as React children: on every keystroke the
 * state updates, React re-writes the DOM text and the caret jumps back to
 * position 0, scrambling what the user types. The text is written to the
 * DOM once on mount and re-synced only when `value` changes externally
 * (undo/redo, IndexedDB state restore, font/style updates).
 */
function TextEditor({ value, className, style, onInput, onFocus }: TextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== value) {
      el.textContent = value
    }
  }, [value])

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={style}
      onInput={e => onInput((e.target as HTMLDivElement).textContent || '')}
      onFocus={onFocus}
    />
  )
}

export default function EditarPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [boxes, setBoxes] = useState<TextBox[]>([])
  const [images, setImages] = useState<ImageBox[]>([])
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [scale, setScale] = useState(1.5)
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [existingTexts, setExistingTexts] = useState<ExistingTextItem[]>([])
  const [selectedExisting, setSelectedExisting] = useState<number | null>(null)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  // File whose persisted state has finished loading. The extraction/save
  // effects are gated on identity (hydratedFile === file): without that
  // gate their async completions race loadState's restore and the last
  // writer wins, so element positions flip between uploads of the same PDF.
  const [hydratedFile, setHydratedFile] = useState<File | null>(null)

  // Toolbar state
  const [fontSize, setFontSize] = useState(14)
  const [fontFamily, setFontFamily] = useState('Helvetica')
  const [fontColor, setFontColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left')
  const [mode, setMode] = useState<'text' | 'draw' | 'image'>('text')
  // Show the rendered PDF page behind the extracted text.
  // Default ON: replacement mode — design visible, OCR text in editable
  // white patches on top of the original text. OFF = text-only view.
  const [showBackground, setShowBackground] = useState(true)
  const [drawColor, setDrawColor] = useState('#7dd3fc')
  const [drawSize, setDrawSize] = useState(2)
  const [showSaved, setShowSaved] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const sigDrawing = useRef(false)
  const sigPoints = useRef<{ x: number; y: number }[]>([])

  // Undo/Redo
  const [history, setHistory] = useState<EditorState[]>([])
  const [redoStack, setRedoStack] = useState<EditorState[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const nextId = useRef(1)
  const isDrawing = useRef(false)
  const currentStroke = useRef<{ x: number; y: number }[]>([])
  const dragRef = useRef<{ id: number; startX: number; startY: number; boxX: number; boxY: number } | null>(null)
  const imgDragRef = useRef<{ id: number; startX: number; startY: number; imgX: number; imgY: number } | null>(null)
  const existingDragRef = useRef<{ id: number; startX: number; startY: number; itemX: number; itemY: number } | null>(null)
  const fieldDragRef = useRef<{ key: string; startX: number; startY: number; fx: number; fy: number } | null>(null)
  const fileRef = useRef(file)
  fileRef.current = file
  const newBoxRef = useRef<number | null>(null)
  const boxRefsMap = useRef<Map<number, HTMLDivElement>>(new Map())
  // OCR bookkeeping: pages already OCR'd (per file), and in-flight jobs
  const ocrDoneRef = useRef<Set<string>>(new Set())
  const ocrInFlightRef = useRef<Set<string>>(new Set())
  const lastScaleRef = useRef<number | null>(null)

  /**
   * Render the page to an offscreen canvas and OCR it (scanned pages without
   * a text layer). Word boxes are grouped into per-line editable items.
   * Results are cached per file+page; zoom is handled by the rescale effect,
   * or by a ratio correction if OCR finishes after the user zoomed.
   */
  const runOcr = async (pageNum: number, sc: number) => {
    const f = fileRef.current
    if (!f) return
    const key = `${f.name}:${pageNum}`
    if (ocrDoneRef.current.has(key) || ocrInFlightRef.current.has(key)) return
    ocrInFlightRef.current.add(key)
    setOcrLoading(true)
    try {
      const bytes = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const page = await pdf.getPage(pageNum + 1)
      const viewport = page.getViewport({ scale: sc })
      const off = document.createElement('canvas')
      off.width = Math.ceil(viewport.width)
      off.height = Math.ceil(viewport.height)
      const ctx = off.getContext('2d')
      if (!ctx) return
      // annotationMode DISABLE: widget appearances must NOT reach the OCR
      // image. ENABLE (the default) paints gray AP boxes over the scan —
      // they cover word prefixes ("NOMB" of "NOMBRE"), tesseract can't read
      // them, and the overlay item starts mid-word, leaving the covered
      // prefix as bare image pixels. The main canvas already renders with
      // DISABLE (see the render effect below) — OCR must see the same pixels.
      await page.render({ canvasContext: ctx, viewport, annotationMode: pdfjsLib.AnnotationMode.DISABLE } as never).promise
      const words = await extractWordsFromImage(off)
      let items = groupWordsToItems(words, sc, pageNum, () => nextId.current++)
      // If the user zoomed while OCR was running, map coords to the current scale
      const cur = lastScaleRef.current
      if (cur !== null && cur > 0 && cur !== sc) {
        const r = cur / sc
        items = items.map(it => ({ ...it, x: it.x * r, y: it.y * r, width: it.width * r, height: it.height * r }))
      }
      if (items.length) {
        setExistingTexts(prev => {
          // Preserve user-edited OCR items (e.g. restored from IndexedDB after a
          // reload). Match by normalized original text first (handles accents,
          // punctuation drift and coords saved at another scale/units), then by
          // position (same zoom). Adopt the fresh geometry so edits never end up
          // misaligned. Unmatched edits with junk geometry (tiny rects saved at
          // an old scale) or outside the page area are dropped.
          const norm = (s: string) =>
            (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
          const editedPrev = prev.filter(t => t.page === pageNum && t.source === 'ocr' && t.edited)
          const used = new Set<ExistingTextItem>()
          const merged = items.map(f => {
            let m: ExistingTextItem | undefined
            const fn = norm(f.originalText)
            if (fn) {
              const cands = editedPrev.filter(e => !used.has(e) && norm(e.originalText) === fn)
              if (cands.length === 1) {
                m = cands[0]
              } else if (cands.length > 1) {
                // Several edits share the text — nearest to the fresh box wins
                m = cands.reduce((best, e) =>
                  Math.hypot(e.x - f.x, e.y - f.y) < Math.hypot(best.x - f.x, best.y - f.y) ? e : best)
              }
            }
            if (!m) {
              m = editedPrev.find(e => !used.has(e) &&
                Math.abs(e.x - f.x) <= 4 && Math.abs(e.y - f.y) <= 4 && Math.abs(e.width - f.width) <= 6)
            }
            if (m) {
              used.add(m)
              return { ...m, x: f.x, y: f.y, width: f.width, height: f.height, fontSize: f.fontSize }
            }
            return f
          })
          const unmatched = editedPrev.filter(e => !used.has(e))
          const keepUnmatched = unmatched.filter(e =>
            e.width >= 8 && e.height >= 4 &&
            e.x >= -10 && e.y >= -10 && e.x <= viewport.width + 10 && e.y <= viewport.height + 10
          )
          // Don't stack OCR duplicates on top of real text-layer items (the
          // text layer wins: it is exact even when tesseract misreads it).
          const textItems = prev.filter(t => t.page === pageNum && t.source === 'text')
          const textNorms = new Set(textItems.map(t => norm(t.originalText)).filter(Boolean))
          const dupOfText = (f: ExistingTextItem) =>
            textNorms.has(norm(f.originalText)) ||
            textItems.some(t => Math.abs(t.x - f.x) <= 8 && Math.abs(t.y - f.y) <= 8)
          return [
            ...prev.filter(t => !(t.page === pageNum && t.source === 'ocr')),
            ...merged.filter(f => !dupOfText(f)),
            ...keepUnmatched,
          ]
        })
      }
      ocrDoneRef.current.add(key)
    } catch (err) {
      console.error('OCR failed:', err)
    } finally {
      ocrInFlightRef.current.delete(key)
      setOcrLoading(false)
    }
  }

  // OCR text items, boxes and images are stored in scaled overlay px —
  // rescale them on zoom (OCR cannot be re-extracted cheaply; boxes/images
  // would otherwise drift on screen AND export at the wrong coordinates).
  useEffect(() => {
    const prevScale = lastScaleRef.current
    if (prevScale !== null && prevScale > 0 && prevScale !== scale) {
      const r = scale / prevScale
      setExistingTexts(prev => prev.map(t =>
        t.source === 'ocr'
          ? { ...t, x: t.x * r, y: t.y * r, width: t.width * r, height: t.height * r }
          : t,
      ))
      setBoxes(prev => prev.map(b => ({ ...b, x: b.x * r, y: b.y * r, width: b.width * r })))
      setImages(prev => prev.map(i => ({ ...i, x: i.x * r, y: i.y * r, width: i.width * r, height: i.height * r })))
    }
    lastScaleRef.current = scale
  }, [scale])

  // Auto-fit zoom on load (small screens only): fit page width to the viewport
  // so the editor doesn't force a huge horizontal scroll on phones.
  const fitFileKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!file) return
    const key = `${file.name}:${file.size}`
    if (fitFileKeyRef.current === key) return
    fitFileKeyRef.current = key
    if (window.innerWidth >= 768) return // desktop keeps the 150% default
    let cancelled = false
    const fit = async () => {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        const page = await pdf.getPage(1)
        const pageWidth = page.getViewport({ scale: 1 }).width
        const available = Math.max(200, window.innerWidth - 56)
        // Floor to a 0.05 step so the value matches the zoom slider
        const target = Math.floor((available / pageWidth) * 20) / 20
        if (!cancelled) setScale(Math.min(1.5, Math.max(0.25, target)))
      } catch { /* keep default scale */ }
    }
    void fit()
    return () => { cancelled = true }
  }, [file])

  // Extract native AcroForm fields (widget annotations) for the current page
  useEffect(() => {
    if (!file) return
    if (hydratedFile !== file) return // merge over the restored fields, not before them
    let cancelled = false
    const load = async () => {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        const page = await pdf.getPage(currentPage + 1)
        const viewport = page.getViewport({ scale })
        const anns = (await page.getAnnotations()) as any[]
        const fields: FormField[] = []
        for (const a of anns) {
          if (a.subtype !== 'Widget') continue
          if (a.fieldType !== 'Tx' && a.fieldType !== 'Btn') continue
          if (!a.fieldName || !a.rect) continue
          if (a.fieldType === 'Btn' && a.pushButton) continue
          // rect is [x1,y1,x2,y2] in PDF coords — map both corners to viewport space
          const p1 = viewport.convertToViewportPoint(a.rect[0], a.rect[1]) as number[]
          const p2 = viewport.convertToViewportPoint(a.rect[2], a.rect[3]) as number[]
          let x = Math.min(p1[0], p2[0])
          let y = Math.min(p1[1], p2[1])
          let w = Math.abs(p2[0] - p1[0])
          let h = Math.abs(p2[1] - p1[1])
          if (w < 4 || h < 4) continue

          let type: FormField['type'] = 'Tx'
          let checked = false
          let exportValue: string | undefined
          if (a.fieldType === 'Btn') {
            if (a.radioButton) {
              type = 'Radio'
              // pdf.js exposes the per-option export value as /buttonValue
              // (a.fieldValue is the group's CURRENT value) — using the
              // wrong one leaves every option unchecked and collapses the
              // React keys into duplicates.
              exportValue = typeof a.exportValue === 'string' && a.exportValue
                ? a.exportValue
                : typeof a.buttonValue === 'string' && a.buttonValue
                  ? a.buttonValue
                  : undefined
              checked = !!a.fieldValue && !!exportValue && a.fieldValue === exportValue
            } else {
              type = 'Btn'
              // Non-'Off' covers every checkbox on-state (/Yes, /On, /1, …)
              checked = !!a.fieldValue && a.fieldValue !== 'Off'
            }
          }

          // Telmex scan: checkboxes render ON the printed oval, not on the
          // (misplaced) widget rect — snap overlay position and remember the
          // oval so the export can move the widget onto it too.
          let ovalPdf: FormField['ovalPdf']
          if (
            currentPage === 0 && type === 'Btn' &&
            Math.abs(page.view[2] - TELMEX_PAGE_VIEW[2]) < 1 &&
            Math.abs(page.view[3] - TELMEX_PAGE_VIEW[3]) < 1 &&
            TELMEX_OVAL_RECTS[a.fieldName]
          ) {
            const oval = TELMEX_OVAL_RECTS[a.fieldName]
            ovalPdf = oval
            const q1 = viewport.convertToViewportPoint(oval[0], oval[1]) as number[]
            const q2 = viewport.convertToViewportPoint(oval[2], oval[3]) as number[]
            x = Math.min(q1[0], q2[0])
            y = Math.min(q1[1], q2[1])
            w = Math.abs(q2[0] - q1[0])
            h = Math.abs(q2[1] - q1[1])
          }

          fields.push({
            name: a.fieldName,
            type,
            x, y, width: w, height: h,
            value: typeof a.fieldValue === 'string' && type === 'Tx' ? a.fieldValue : '',
            checked,
            exportValue,
            page: currentPage,
            touched: false,
            origX: x,
            origY: y,
            extractScale: scale,
            // /Q: 0=left, 1=center, 2=right — absent means left (PDF default)
            align: a.q === 1 ? 'center' : a.q === 2 ? 'right' : 'left',
            ovalPdf,
          })
        }
        if (cancelled) return
        setFormFields(prev => [
          ...prev.filter(f => f.page !== currentPage),
          // Preserve user edits when re-extracting (scale/page changes)
          ...fields.map(f => {
            const old = prev.find(o => o.page === f.page && o.name === f.name && o.type === f.type && o.exportValue === f.exportValue)
            if (!old) return f
            const merged: FormField = {
              ...f,
              ...(old.touched ? { value: old.value, checked: old.checked, touched: true } : {}),
              ...(old.hidden ? { hidden: true } : {}),
            }
            if (old.moved) {
              // Re-apply the drag offset relative to the new natural position,
              // scaled for zoom so the visual displacement stays proportional.
              const k = old.extractScale && scale ? scale / old.extractScale : 1
              const offX = (old.x - (old.origX ?? old.x)) * k
              const offY = (old.y - (old.origY ?? old.y)) * k
              merged.x = f.x + offX
              merged.y = f.y + offY
              merged.moved = true
            }
            return merged
          }),
        ])
      } catch {
        if (!cancelled) setFormFields(prev => prev.filter(f => f.page !== currentPage))
      }
    }
    load()
    return () => { cancelled = true }
  }, [file, currentPage, scale, hydratedFile])

  // Auto-focus newly created text box
  useEffect(() => {
    if (newBoxRef.current !== null) {
      const id = newBoxRef.current
      newBoxRef.current = null
      // Wait for React to render the contentEditable
      requestAnimationFrame(() => {
        const el = boxRefsMap.current.get(id)
        if (el) {
          const editable = el.querySelector('[contentEditable]') as HTMLElement
          if (editable) {
            editable.focus()
            // Place cursor at end
            const range = document.createRange()
            const sel = window.getSelection()
            if (editable.childNodes.length > 0) {
              range.setStartAfter(editable.childNodes[editable.childNodes.length - 1])
            } else {
              range.setStart(editable, 0)
            }
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }
      })
    }
  }, [boxes.length])

  // Save state on change (debounced)
  useEffect(() => {
    if (!file) return
    if (hydratedFile !== file) return // never write before the restore lands
    const timer = setTimeout(() => {
      saveState(file.name, { boxes, images, strokes, existingTexts, formFields })
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
    }, 500)
    return () => clearTimeout(timer)
  }, [boxes, images, strokes, existingTexts, formFields, file, hydratedFile])

  // Load persisted state when file changes. hydratedFile is set only after
  // this restore settles — the save/extraction effects wait for it, so the
  // restore can never be clobbered (or clobber fresh extractions) mid-race.
  useEffect(() => {
    if (!file) return
    let cancelled = false
    const applySaved = (saved: Awaited<ReturnType<typeof loadState>>) => {
      if (cancelled) return
      if (saved) {
        setBoxes(saved.boxes || [])
        setImages(saved.images || [])
        setStrokes(saved.strokes || [])
        setExistingTexts(saved.existingTexts || [])
        setFormFields(saved.formFields || [])
        // Update nextId
        const maxId = Math.max(
          ...saved.boxes.map(b => b.id),
          ...saved.images.map(i => i.id),
          ...saved.strokes.map(s => s.id),
          ...(saved.existingTexts || []).map(t => t.id),
          0,
        )
        nextId.current = maxId + 1
      } else {
        // Never-saved file: clear leftovers from the previous file so they
        // can't bleed into this one (positions would look randomly shifted).
        setBoxes([])
        setImages([])
        setStrokes([])
        setExistingTexts([])
        setFormFields([])
        nextId.current = 1
      }
    }
    loadState(file.name)
      .then(saved => applySaved(saved))
      .catch(() => applySaved(null))
      .finally(() => { if (!cancelled) setHydratedFile(file) })
    return () => { cancelled = true }
  }, [file])

  // Size the draw overlay to the main canvas and redraw strokes
  const redrawDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current
    const main = canvasRef.current
    if (!canvas || !main) return
    canvas.width = main.width
    canvas.height = main.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pageStrokes = strokes.filter(s => s.page === currentPage)
    for (const stroke of pageStrokes) {
      if (stroke.points.length < 2) continue
      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    }
  }, [strokes, currentPage])

  useEffect(() => { redrawDrawCanvas() }, [redrawDrawCanvas, scale])

  // Render current PDF page
  useEffect(() => {
    if (!file) return
    let cancelled = false
    let renderTask: { cancel(): void } | null = null
    const render = async () => {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        if (cancelled) return
        setTotalPages(pdf.numPages)
        const page = await pdf.getPage(currentPage + 1)
        if (cancelled) return
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        if (cancelled) return
        // annotationMode 0 (DISABLE): hide the scan's native widget
        // appearances — the overlay inputs below are the editor's UI, and
        // pdf.js's default ENABLE would paint gray AP squares under them.
        const task = page.render({ canvasContext: ctx, viewport, annotationMode: pdfjsLib.AnnotationMode.DISABLE } as never) as unknown as { promise: Promise<void>; cancel(): void }
        renderTask = task
        await task.promise
        if (!cancelled) {
          // Re-sync the drawing overlay now that the main canvas has its final size
          // (the draw effect runs synchronously and would otherwise keep the old size)
          redrawDrawCanvas()
        }
      } catch (err) {
        // Cancelling a render on rapid scale/page changes is expected
        if (!cancelled) console.error('PDF render failed:', err)
      }
    }
    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [file, currentPage, scale, redrawDrawCanvas])
  // Extract existing text items from PDF page with column/table/field detection
  useEffect(() => {
    if (!file) return
    if (hydratedFile !== file) return // restored items must be in the closure first (S2)
    const extract = async () => {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const page = await pdf.getPage(currentPage + 1)
      const textContent = await page.getTextContent()
      const items = textContent.items as any[]
      if (!items.length) {
        // Scanned page: no text layer. Keep any existing OCR items, clear stale
        // text-layer items, and run OCR over the rendered page image.
        setExistingTexts(prev => prev.filter(t => t.page !== currentPage || t.source === 'ocr'))
        void runOcr(currentPage, scale)
        return
      }

      // Get viewport height for Y-coordinate inversion (PDF y=0 is bottom, CSS top=0 is top)
      const viewport = page.getViewport({ scale })
      const viewportHeight = viewport.height

      // Filter valid items with position
      const validItems = items.filter(i => i.str?.trim() && i.transform).map(i => ({
        str: i.str,
        transform: i.transform,
        fontName: i.fontName || '',
        width: i.width || 0,
        height: i.height || 0,
        dir: i.dir || 'ltr',
      }))

      // Group by Y-coordinate (lines) with 3px tolerance
      const Y_TOLERANCE = 3
      const lines: { items: typeof validItems; y: number; minX: number; maxX: number }[] = []
      for (const item of validItems) {
        const tx = item.transform
        const itemY = tx[5]
        const existing = lines.find(l => Math.abs(l.y - itemY) < Y_TOLERANCE)
        if (existing) {
          existing.items.push(item)
          existing.minX = Math.min(existing.minX, tx[4])
          existing.maxX = Math.max(existing.maxX, tx[4])
        } else {
          lines.push({ items: [item], y: itemY, minX: tx[4], maxX: tx[4] })
        }
      }

      // Sort lines top to bottom (PDF y=0 is bottom, so higher y = higher on page)
      lines.sort((a, b) => b.y - a.y)

      // Within each line, detect columns by grouping items with large X gaps
      // A column break is when gap > 2x average char width
      const allItems = validItems
      const avgCharWidth = allItems.length > 0
        ? allItems.reduce((sum, i) => sum + (i.width || i.str.length * (Math.abs(i.transform[3]) || 12) * 0.6), 0) / allItems.length
        : 12 * 0.6
      const COL_GAP_THRESHOLD = avgCharWidth * 3  // 3x avg char width = column separator

      // Process each line: split into columns, detect fillable patterns
      const existingForPage = existingTexts.filter(t => t.page === currentPage)
      const existingMap = new Map(existingForPage.map(t => [t.originalText + '|' + Math.round(t.y) + '|' + Math.round(t.x), t]))

      const newItems: ExistingTextItem[] = []
      let id = nextId.current

      for (const line of lines) {
        // Sort items in line by X
        line.items.sort((a, b) => a.transform[4] - b.transform[4])

        // Split line into columns based on X gaps
        const columns: typeof line.items[] = []
        let currentCol: typeof line.items = []
        for (const item of line.items) {
          if (currentCol.length === 0) {
            currentCol = [item]
          } else {
            const last = currentCol[currentCol.length - 1]
            const gap = item.transform[4] - (last.transform[4] + (last.width || last.str.length * (Math.abs(last.transform[3]) || 12) * 0.6))
            if (gap > COL_GAP_THRESHOLD) {
              columns.push(currentCol)
              currentCol = [item]
            } else {
              currentCol.push(item)
            }
          }
        }
        if (currentCol.length) columns.push(currentCol)

        // Process each column as a separate text block
        for (const col of columns) {
          const combinedText = col.map(i => i.str).join(' ')
          const firstItem = col[0]
          const tx = firstItem.transform
          const fontSize = Math.abs(tx[3]) || 12
          const x = tx[4] * scale
          const y = viewportHeight - tx[5] * scale - fontSize * scale
          const lastItem = col[col.length - 1]
          const lastItemWidth = lastItem.width || lastItem.str.length * fontSize * 0.6
          const endX = (lastItem.transform[4] + lastItemWidth) * scale
          const width = Math.max(endX - x, 60)
          const height = fontSize * scale * 1.3

          // Detect fillable patterns in the text
          const isFillable = /_{3,}|\.{5,}|☐|\[\s*\]|□/.test(combinedText)
          const fillableType = combinedText.includes('_') ? 'underscore' :
                               combinedText.includes('.') ? 'dots' :
                               combinedText.includes('☐') ? 'checkbox' :
                               combinedText.includes('[') ? 'brackets' : ''

          const fontName = firstItem.fontName || ''
          // fontName is an internal id ('g_d0_f1') — resolve the real font via pdf.js internals
          const realFont = resolveRealFont(page, fontName)
          const isBold = realFont.bold || /bold/i.test(fontName)
          const isItalic = realFont.italic || /italic|oblique/i.test(fontName)

          // Check if this block was previously edited
          const key = combinedText + '|' + Math.round(y) + '|' + Math.round(x)
          const prev = existingMap.get(key)
          if (prev) {
            newItems.push({ ...prev, id: prev.id })
          } else {
            newItems.push({
              id: id++,
              text: combinedText,
              originalText: combinedText,
              x, y, width, height, fontSize,
              fontFamily: realFont.family,
              fontColor: '#000000',
              bold: isBold,
              italic: isItalic,
              page: currentPage,
              edited: false,
              source: 'text',
              // New fields for fillable detection
              isFillable,
              fillableType,
            } as ExistingTextItem)
          }
        }
      }
      nextId.current = id
      setExistingTexts(prev => {
        const other = prev.filter(t => t.page !== currentPage || t.source === 'ocr')
        return [...other, ...newItems]
      })
      // Sparse text layer: a re-opened edited export only carries the redrawn
      // strokes as real text — without running OCR too, the scanned rest of
      // the page would never get its editable layer back.
      if (validItems.length < 10) void runOcr(currentPage, scale)
    }
    extract().catch(() => {})
  }, [file, currentPage, scale, hydratedFile])

  // ── Undo/Redo ──────────────────────────────────────────

  const pushHistory = useCallback(() => {
    // Snapshot of the CURRENT (pre-action) state; new action clears redo future
    const state: EditorState = { boxes, images, strokes, existingTexts, formFields }
    setHistory(prev => {
      const newHist = prev.length >= 50 ? prev.slice(prev.length - 49) : [...prev]
      newHist.push(state)
      return newHist
    })
    setRedoStack([])
  }, [boxes, images, strokes, existingTexts, formFields])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const current: EditorState = { boxes, images, strokes, existingTexts, formFields }
    const prev = history[history.length - 1]
    setRedoStack(s => (s.length >= 50 ? s.slice(s.length - 49) : [...s, current]))
    setBoxes(prev.boxes)
    setImages(prev.images)
    setStrokes(prev.strokes)
    if (prev.existingTexts) setExistingTexts(prev.existingTexts)
    if (prev.formFields) setFormFields(prev.formFields)
    setHistory(h => h.slice(0, -1))
  }, [history, boxes, images, strokes, existingTexts, formFields])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const current: EditorState = { boxes, images, strokes, existingTexts, formFields }
    const next = redoStack[redoStack.length - 1]
    setHistory(h => (h.length >= 50 ? h.slice(h.length - 49) : [...h, current]))
    setBoxes(next.boxes)
    setImages(next.images)
    setStrokes(next.strokes)
    if (next.existingTexts) setExistingTexts(next.existingTexts)
    if (next.formFields) setFormFields(next.formFields)
    setRedoStack(s => s.slice(0, -1))
  }, [redoStack, boxes, images, strokes, existingTexts, formFields])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if (e.key === 'Delete' && selectedBox !== null) {
        pushHistory()
        setBoxes(prev => prev.filter(b => b.id !== selectedBox))
        setSelectedBox(null)
      }
      if (e.key === 'Delete' && selectedImage !== null) {
        pushHistory()
        setImages(prev => prev.filter(i => i.id !== selectedImage))
        setSelectedImage(null)
      }
      if (e.key === 'Delete' && selectedExisting !== null) {
        pushHistory()
        setExistingTexts(prev => prev.filter(t => t.id !== selectedExisting))
        setSelectedExisting(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedBox, selectedImage, selectedExisting, pushHistory])

  // ── Text box handlers ──────────────────────────────────

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'text') return
    if ((e.target as HTMLElement).closest('.editor-box')) return
    if ((e.target as HTMLElement).closest('.editor-image')) return
    if ((e.target as HTMLElement).closest('.existing-text')) return
    setSelectedField(null)
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = nextId.current++
    pushHistory()
    setBoxes(prev => [...prev, {
      id, x, y, width: 200, text: '', page: currentPage,
      fontSize, fontFamily, fontColor, highlightColor,
      bold, italic, underline, align,
    }])
    setSelectedBox(id)
    setSelectedImage(null)
    newBoxRef.current = id
  }, [mode, currentPage, fontSize, fontFamily, fontColor, highlightColor, bold, italic, underline, align, pushHistory])

  const updateBoxText = useCallback((id: number, text: string) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, text } : b))
  }, [])

  const updateBoxWidth = useCallback((id: number, width: number) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, width: Math.max(60, width) } : b))
  }, [])

  const deleteBox = useCallback((id: number) => {
    pushHistory()
    setBoxes(prev => prev.filter(b => b.id !== id))
    setSelectedBox(prev => prev === id ? null : prev)
  }, [pushHistory])

  // ── Existing text handlers ─────────────────────────────

  const updateExistingText = useCallback((id: number, text: string) => {
    setExistingTexts(prev => prev.map(t =>
      t.id === id ? { ...t, text, edited: text !== t.originalText } : t
    ))
  }, [])

  const applyToExisting = useCallback((id: number, updates: Partial<ExistingTextItem>) => {
    pushHistory()
    setExistingTexts(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, edited: true } : t
    ))
  }, [pushHistory])

  const deleteExisting = useCallback((id: number) => {
    pushHistory()
    setExistingTexts(prev => prev.filter(t => t.id !== id))
    setSelectedExisting(null)
  }, [pushHistory])

  // ── AcroForm field handlers ─────────────────────────────

  const updateFormField = useCallback((target: FormField, updates: Partial<FormField>) => {
    setFormFields(prev => prev.map(f =>
      f.page === target.page && f.name === target.name && f.type === target.type && f.exportValue === target.exportValue
        ? { ...f, ...updates, touched: true }
        : f,
    ))
  }, [])

  const toggleFormField = useCallback((target: FormField, checked: boolean) => {
    setFormFields(prev => prev.map(f => {
      if (f.page !== target.page || f.name !== target.name || f.type !== target.type) return f
      if (target.type === 'Radio') {
        // Radio groups: only the clicked option stays checked
        return f.exportValue === target.exportValue
          ? { ...f, checked: true, touched: true }
          : { ...f, checked: false }
      }
      return { ...f, checked, touched: true }
    }))
  }, [])

  // ── Image handlers ─────────────────────────────────────

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const id = nextId.current++
        const maxW = 300
        const w = Math.min(img.width, maxW)
        const h = (img.height / img.width) * w
        const canvas = canvasRef.current!
        const x = (canvas.width - w) / 2
        const y = (canvas.height - h) / 2
        pushHistory()
        setImages(prev => [...prev, { id, x, y, width: w, height: h, src: reader.result as string, page: currentPage }])
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [currentPage, pushHistory])

  const deleteImage = useCallback((id: number) => {
    pushHistory()
    setImages(prev => prev.filter(i => i.id !== id))
    setSelectedImage(null)
  }, [pushHistory])

  // ── Signature handlers ──────────────────────────────────

  const openSignature = useCallback(() => {
    setShowSignature(true)
    sigPoints.current = []
    // Clear signature canvas on next render
    requestAnimationFrame(() => {
      const canvas = sigCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        // Draw signature line
        ctx.strokeStyle = '#ccc'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(20, canvas.height - 30)
        ctx.lineTo(canvas.width - 20, canvas.height - 30)
        ctx.stroke()
      }
    })
  }, [])

  const sigMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    sigDrawing.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    sigPoints.current = [{ x: clientX - rect.left, y: clientY - rect.top }]
  }, [])

  const sigMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!sigDrawing.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left
    const y = clientY - rect.top
    sigPoints.current.push({ x, y })
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pts = sigPoints.current
    if (pts.length < 2) return
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
  }, [])

  const sigMouseUp = useCallback(() => {
    sigDrawing.current = false
  }, [])

  const placeSignature = useCallback(() => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    // Get signature as image (white background removed mentally — just crop)
    const dataUrl = canvas.toDataURL('image/png')
    const img = new Image()
    img.onload = () => {
      const id = nextId.current++
      const maxW = 200
      const w = Math.min(img.width, maxW)
      const h = (img.height / img.width) * w
      const canvasEl = canvasRef.current!
      const x = (canvasEl.width - w) / 2
      const y = canvasEl.height - h - 60 // Place near bottom
      pushHistory()
      setImages(prev => [...prev, { id, x, y, width: w, height: h, src: dataUrl, page: currentPage }])
      setShowSignature(false)
    }
    img.src = dataUrl
  }, [currentPage, pushHistory])

  // ── Drawing handlers ───────────────────────────────────

  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    isDrawing.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    currentStroke.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]
  }, [mode])

  const handleDrawMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || mode !== 'draw') return
    const rect = e.currentTarget.getBoundingClientRect()
    currentStroke.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    // Live preview
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pts = currentStroke.current
    if (pts.length >= 2) {
      const prev = pts[pts.length - 2]
      const curr = pts[pts.length - 1]
      ctx.beginPath()
      ctx.strokeStyle = drawColor
      ctx.lineWidth = drawSize
      ctx.lineCap = 'round'
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(curr.x, curr.y)
      ctx.stroke()
    }
  }, [mode, drawColor, drawSize])

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (currentStroke.current.length >= 2) {
      // Capture points BEFORE queueing: state updaters run deferred, after
      // currentStroke.current is cleared below (would save an empty stroke)
      const pts = [...currentStroke.current]
      pushHistory()
      setStrokes(prev => [...prev, {
        id: nextId.current++,
        points: pts,
        color: drawColor,
        size: drawSize,
        page: currentPage,
      }])
    }
    currentStroke.current = []
  }, [drawColor, drawSize, currentPage, pushHistory])

  // ── Drag handlers ──────────────────────────────────────

  const handleBoxDragStart = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const box = boxes.find(b => b.id === id)
    if (!box) return
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, boxX: box.x, boxY: box.y }
    setSelectedBox(id)
    setSelectedImage(null)

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setBoxes(prev => prev.map(b =>
        b.id === dragRef.current!.id
          ? { ...b, x: dragRef.current!.boxX + dx, y: dragRef.current!.boxY + dy }
          : b
      ))
    }
    const handleUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [boxes])

  const handleImageDragStart = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const img = images.find(i => i.id === id)
    if (!img) return
    imgDragRef.current = { id, startX: e.clientX, startY: e.clientY, imgX: img.x, imgY: img.y }
    setSelectedImage(id)
    setSelectedBox(null)

    const handleMove = (ev: MouseEvent) => {
      if (!imgDragRef.current) return
      const dx = ev.clientX - imgDragRef.current.startX
      const dy = ev.clientY - imgDragRef.current.startY
      setImages(prev => prev.map(i =>
        i.id === imgDragRef.current!.id
          ? { ...i, x: imgDragRef.current!.imgX + dx, y: imgDragRef.current!.imgY + dy }
          : i
      ))
    }
    const handleUp = () => {
      imgDragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [images])

  // ── Drag extracted text items (OCR/text-layer) ──────────
  const handleExistingDragStart = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const item = existingTexts.find(t => t.id === id)
    if (!item) return
    existingDragRef.current = { id, startX: e.clientX, startY: e.clientY, itemX: item.x, itemY: item.y }
    setSelectedExisting(id)
    setSelectedBox(null)
    setSelectedImage(null)
    setSelectedField(null)
    let pushed = false
    const handleMove = (ev: MouseEvent) => {
      if (!existingDragRef.current) return
      const dx = ev.clientX - existingDragRef.current.startX
      const dy = ev.clientY - existingDragRef.current.startY
      if (!pushed && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        // Snapshot the pre-drag state once real movement starts (keeps a
        // simple click from polluting the undo stack).
        pushed = true
        pushHistory()
      }
      if (!pushed) return
      setExistingTexts(prev => prev.map(t =>
        t.id === existingDragRef.current!.id
          ? { ...t, x: existingDragRef.current!.itemX + dx, y: existingDragRef.current!.itemY + dy }
          : t
      ))
    }
    const handleUp = () => {
      existingDragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [existingTexts, pushHistory])

  // ── Drag / hide native AcroForm fields ──────────────────
  const fieldKey = useCallback((f: FormField) => `${f.page}|${f.name}|${f.type}|${f.exportValue || ''}`, [])

  const handleFieldDragStart = useCallback((e: React.MouseEvent, f: FormField) => {
    e.stopPropagation()
    const key = fieldKey(f)
    fieldDragRef.current = { key, startX: e.clientX, startY: e.clientY, fx: f.x, fy: f.y }
    setSelectedField(key)
    setSelectedBox(null)
    setSelectedImage(null)
    setSelectedExisting(null)
    let pushed = false
    const handleMove = (ev: MouseEvent) => {
      if (!fieldDragRef.current) return
      const dx = ev.clientX - fieldDragRef.current.startX
      const dy = ev.clientY - fieldDragRef.current.startY
      if (!pushed && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        pushed = true
        pushHistory()
      }
      if (!pushed) return
      setFormFields(prev => prev.map(g =>
        fieldKey(g) === fieldDragRef.current!.key
          ? { ...g, x: fieldDragRef.current!.fx + dx, y: fieldDragRef.current!.fy + dy, moved: true }
          : g
      ))
    }
    const handleUp = () => {
      fieldDragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [pushHistory, fieldKey])

  const hideFormField = useCallback((f: FormField) => {
    pushHistory()
    const key = fieldKey(f)
    setFormFields(prev => prev.map(g =>
      fieldKey(g) === key ? { ...g, hidden: true, touched: true } : g
    ))
    setSelectedField(null)
  }, [pushHistory, fieldKey])

  // ── Apply formatting to selected box ───────────────────

  const applyToSelected = useCallback((updates: Partial<TextBox>) => {
    if (selectedBox !== null) {
      pushHistory()
      setBoxes(prev => prev.map(b => b.id === selectedBox ? { ...b, ...updates } : b))
    }
    if (selectedExisting !== null) {
      applyToExisting(selectedExisting, updates as Partial<ExistingTextItem>)
    }
  }, [selectedBox, selectedExisting, pushHistory, applyToExisting])

  // ── Download ───────────────────────────────────────────

  const handleDownload = async () => {
    if (!file) return
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(bytes)

      // AcroForm /Fields can drift from the real rendered widgets in page
      // /Annots: Apple-generated forms (e.g. Telmex's Formato_Telmex_editable)
      // point /Fields at orphan COPIES while viewers render /Annots, so
      // pdf-lib edits would land on invisible objects. Reconcile per field
      // name: an orphaned duplicate widget dict in /Fields (carries /Subtype
      // + /Rect) is replaced by the page's real widget; structured parents
      // (/Kids, no widget subtype) and already-shared refs are kept, and page
      // widgets missing from /Fields are appended. Healthy PDFs resolve to
      // the exact same refs (no-op).
      try {
        const acroForm = pdfDoc.catalog.AcroForm()
        if (acroForm) {
          const fieldsRaw = acroForm.get(PDFName.of('Fields'))
          const fieldsObj = fieldsRaw ? pdfDoc.context.lookup(fieldsRaw) : undefined
          const fields = fieldsObj instanceof PDFArray ? fieldsObj : undefined
          const pageWidgetByName = new Map<string, PDFRef>()
          for (const page of pdfDoc.getPages()) {
            const annotsRaw = page.node.get(PDFName.of('Annots'))
            const annotsObj = annotsRaw ? pdfDoc.context.lookup(annotsRaw) : undefined
            if (!(annotsObj instanceof PDFArray)) continue
            for (let i = 0; i < annotsObj.size(); i++) {
              // pdf-lib's lookupMaybe(ref, PDFRef) resolves the ref first and
              // then type-checks the TARGET (a PDFDict) — it throws. Use the
              // raw entry + instanceof instead.
              const ref = annotsObj.get(i)
              if (!(ref instanceof PDFRef)) continue
              const dict = pdfDoc.context.lookup(ref)
              if (!(dict instanceof PDFDict)) continue
              const t = dict.get(PDFName.of('T'))
              const name = t ? String(t) : ''
              if (name && !pageWidgetByName.has(name)) pageWidgetByName.set(name, ref)
            }
          }
          if (fields && pageWidgetByName.size > 0) {
            const seenNames = new Set<string>()
            const repaired = PDFArray.withContext(pdfDoc.context)
            let changed = false
            for (let i = 0; i < fields.size(); i++) {
              const ref = fields.get(i)
              if (!(ref instanceof PDFRef)) {
                repaired.push(ref)
                continue
              }
              const dict = pdfDoc.context.lookup(ref)
              const t = dict instanceof PDFDict ? dict.get(PDFName.of('T')) : undefined
              const name = t ? String(t) : ''
              if (name) seenNames.add(name)
              const pageRef = name ? pageWidgetByName.get(name) : undefined
              const isDuplicateWidget = dict instanceof PDFDict &&
                !!dict.get(PDFName.of('Subtype')) && !!dict.get(PDFName.of('Rect'))
              if (pageRef && isDuplicateWidget && pageRef.toString() !== ref.toString()) {
                repaired.push(pageRef) // orphan copy → the widget everyone renders
                changed = true
              } else {
                repaired.push(ref) // shared ref or structured parent — keep
              }
            }
            for (const [name, ref] of pageWidgetByName) {
              if (!seenNames.has(name)) {
                repaired.push(ref) // widget never registered in /Fields
                changed = true
              }
            }
            if (changed) acroForm.set(PDFName.of('Fields'), repaired)
          }
        }
      } catch { /* not repairable — continue with pdf-lib's view of the form */ }

      const fontCache: Record<string, PDFFont> = {}

      const getFont = async (name: string, isBold: boolean, isItalic: boolean) => {
        let key = name
        if (isBold) key += '-Bold'
        if (isItalic) key += '-Italic'
        if (!fontCache[key]) {
          const std = fontToPdfLib(name, isBold, isItalic)
          fontCache[key] = await pdfDoc.embedFont(std)
        }
        return fontCache[key]
      }

      // Fill native AcroForm fields (touched, moved, or hidden ones)
      if (formFields.some(f => f.touched || f.moved || f.hidden)) {
        const form = pdfDoc.getForm()
        for (const f of formFields) {
          if (!f.touched && !f.moved && !f.hidden) continue
          const wp = pdfDoc.getPage(f.page)
          const { height: wh } = wp.getSize()
          // Overlay → PDF coords (y flipped from the page top)
          const toPdfRect = (ox: number, oy: number) => ({
            x: ox / scale,
            y: wh - oy / scale - f.height / scale,
            width: f.width / scale,
            height: f.height / scale,
          })
          const getWidget = () => {
            const fld = f.type === 'Tx'
              ? form.getTextField(f.name)
              : f.type === 'Btn'
                ? form.getCheckBox(f.name)
                : form.getRadioGroup(f.name)
            return fld.acroField.getWidgets()[0]
          }

          // Hidden fields: white-out their current spot (and the natural one
          // if the field was dragged), then move the widget off-page so it
          // renders nowhere. pdf-lib's removeField() throws on this document
          // ("Could not find page for PDFRef"), so off-page is the fallback.
          if (f.hidden) {
            // Empty text boxes have nothing to erase — white-out here would
            // only destroy the printed design behind them (the user's
            // "hide a box and it eats the format" report). Filled boxes and
            // checkboxes keep the white-out so baked-in content doesn't show.
            const emptyTx = f.type === 'Tx' && f.value === ''
            if (!emptyTx) {
              try {
                wp.drawRectangle({ ...toPdfRect(f.x, f.y), color: rgb(1, 1, 1), borderWidth: 0 })
                if (f.moved && f.origX !== undefined && f.origY !== undefined) {
                  wp.drawRectangle({ ...toPdfRect(f.origX, f.origY), color: rgb(1, 1, 1), borderWidth: 0 })
                }
              } catch { /* page missing — skip whiteout */ }
            }
            try {
              const w = getWidget()
              const r = w.getRectangle()
              w.setRectangle({ x: -9999, y: -9999, width: r.width, height: r.height })
            } catch { /* field missing — nothing to hide */ }
            continue
          }

          // Relocated fields: put the widget where the user dropped it.
          if (f.moved) {
            try { getWidget().setRectangle(toPdfRect(f.x, f.y)) } catch { /* keep original rect */ }
            // Clear the natural spot when the scan had a baked-in value there.
            if (f.touched && f.origX !== undefined && f.origY !== undefined && (f.origX !== f.x || f.origY !== f.y)) {
              try { wp.drawRectangle({ ...toPdfRect(f.origX, f.origY), color: rgb(1, 1, 1), borderWidth: 0 }) } catch { /* skip */ }
            }
          }

          // Telmex oval snap: park the widget on its printed oval so the check
          // mark renders inside it (unless the user dragged it elsewhere, in
          // which case f.moved below moves it to the drop point instead).
          if (f.ovalPdf && !f.moved) {
            try {
              const [ox1, oy1, ox2, oy2] = f.ovalPdf
              getWidget().setRectangle({ x: ox1, y: oy1, width: ox2 - ox1, height: oy2 - oy1 })
            } catch { /* keep original rect */ }
          }

          if (!f.touched) continue

          // White-out the scan under the widget first (content streams render
          // below annotation appearances, so the value drawn next stays clean
          // instead of double-painting over baked-in sample text or cells).
          // Checkboxes keep the printed oval visible instead: their widget now
          // sits ON the oval, so a white patch here would erase the design.
          if (f.type !== 'Btn') {
            try {
              wp.drawRectangle({ ...toPdfRect(f.x, f.y), color: rgb(1, 1, 1), borderWidth: 0 })
            } catch { /* page missing — skip whiteout */ }
          }
          try {
            if (f.type === 'Tx') {
              const tf = form.getTextField(f.name)
              // Match the preview's alignment (annotation /Q when declared).
              // TextAlignment is a numeric enum: 0=Left, 1=Center, 2=Right.
              try {
                tf.setAlignment(f.align === 'center' ? 1 : f.align === 'right' ? 2 : 0)
              } catch { /* field without alignment support */ }
              // The Telmex form caps fecha at 6 chars ("ddmmyy") — an editor
              // must not silently drop longer real-world input ("05/10/2026").
              try {
                const ml = tf.getMaxLength()
                if (f.value.length > 0 && (ml === null || ml === undefined || f.value.length > ml)) {
                  tf.setMaxLength(f.value.length)
                }
              } catch { /* field without max-length support */ }
              tf.setText(f.value)
            } else if (f.type === 'Btn') {
              const cb = form.getCheckBox(f.name)
              if (f.checked) cb.check()
              else cb.uncheck()
            } else if (f.type === 'Radio' && f.checked && f.exportValue) {
              form.getRadioGroup(f.name).select(f.exportValue)
            }
          } catch { /* field name/type mismatch — skip */ }
        }
        try {
          // Recompute widget appearances so filled values are visible everywhere
          await form.updateFieldAppearances()
        } catch { /* keep original appearances */ }
      }

      // Telmex scan: neutralize the checkbox appearances and disable
      // NeedAppearances. With NeedAppearances=true, PDFium ignores APs and
      // regenerates gray fallback squares (the "chueca" export); with it off
      // it draws our APs — an empty Off (printed oval shows through) and a
      // blue check for Yes. /Border and /MK are stripped so no viewer paints
      // a fallback border box around the widget either.
      const ovalBtns = formFields.filter(f => f.ovalPdf && f.type === 'Btn')
      if (ovalBtns.length > 0) {
        try {
          const af = pdfDoc.catalog.AcroForm()
          if (af) af.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(false))
        } catch { /* no AcroForm — nothing to fix */ }
        const form2 = pdfDoc.getForm()
        const ctx = pdfDoc.context
        for (const f of ovalBtns) {
          try {
            const cb = form2.getCheckBox(f.name)
            const widget = cb.acroField.getWidgets()[0]
            // When no edits touched the field loop above (untouched export),
            // the widget still needs to move onto its printed oval.
            if (!f.moved && f.ovalPdf) {
              const [ox1, oy1, ox2, oy2] = f.ovalPdf
              widget.setRectangle({ x: ox1, y: oy1, width: ox2 - ox1, height: oy2 - oy1 })
            }
            widget.dict.delete(PDFName.of('Border'))
            widget.dict.delete(PDFName.of('MK'))
            // Resolve the existing AP first: it feeds the on-state detection
            // below and is reused (or created) to hold the rebuilt /N.
            const ap = widget.dict.get(PDFName.of('AP'))
            const apObj = ap ? pdfDoc.context.lookup(ap) : undefined
            // On-state name: checkboxes export /On, /1, /True… not only /Yes.
            // Prefer the widget's current /AS, then the old AP's non-Off key,
            // so the rebuilt AP always matches what /AS (and /V) point at.
            let onState = 'Yes'
            const asObj = widget.dict.get(PDFName.of('AS'))
            if (asObj instanceof PDFName && asObj.toString() !== '/Off') {
              onState = asObj.toString().replace(/^\//, '')
            } else if (apObj instanceof PDFDict) {
              const prevN = apObj.get(PDFName.of('N'))
              const prevNObj = prevN ? pdfDoc.context.lookup(prevN) : undefined
              if (prevNObj instanceof PDFDict) {
                for (const k of prevNObj.keys()) {
                  if (k.toString() !== '/Off') { onState = k.toString().replace(/^\//, ''); break }
                }
              }
            }
            // Blue check (#0369a1) drawn inside a 22×22 appearance BBox,
            // proportionally mapped to the widget rect by the viewer.
            const mkStream = (content: string) => ctx.register(ctx.stream(content, {
              Subtype: PDFName.of('Form'),
              BBox: ctx.obj([0, 0, 22, 22]),
              Resources: ctx.obj({}),
            }))
            const nDict = ctx.obj({}) as PDFDict
            nDict.set(PDFName.of('Off'), mkStream('q Q'))
            nDict.set(PDFName.of(onState), mkStream('q 0.012 0.412 0.631 RG 2.8 w 1 J 1 j 4.4 10.4 m 9.24 6 l 17.6 14.4 l S Q'))
            let apDict: PDFDict
            if (apObj instanceof PDFDict) {
              apDict = apObj
            } else {
              apDict = ctx.obj({}) as PDFDict
              widget.dict.set(PDFName.of('AP'), ctx.register(apDict))
            }
            apDict.set(PDFName.of('N'), ctx.register(nDict))
            apDict.delete(PDFName.of('D'))
            apDict.delete(PDFName.of('R'))
          } catch { /* field name mismatch — keep its appearance */ }
        }
      }

      // White-out and redraw edited existing text
      for (const item of existingTexts) {
        if (!item.edited || !item.text.trim()) continue
        const page = pdfDoc.getPage(item.page)
        const { height } = page.getSize()
        // White rectangle over original text
        page.drawRectangle({
          x: item.x / scale,
          y: height - item.y / scale - item.height / scale,
          width: item.width / scale,
          height: item.height / scale,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        })
        // Draw edited text — baseline matched to the preview's line box
        const font = await getFont(item.fontFamily, item.bold, item.italic)
        page.drawText(item.text, {
          x: item.x / scale,
          y: height - item.y / scale - (item.fontSize * 0.92),
          font,
          size: item.fontSize,
          color: hexToRgb(item.fontColor),
        })
      }

      // Draw text boxes — wrap like the preview (whitespace-pre-wrap at
      // box.width) and honor alignment so the PDF matches what you see.
      for (const box of boxes) {
        if (!box.text.trim()) continue
        const page = pdfDoc.getPage(box.page)
        const { height } = page.getSize()
        const font = await getFont(box.fontFamily, box.bold, box.italic)
        const boxW = Math.max(20, box.width / scale)
        const measure = (t: string) => {
          try { return font.widthOfTextAtSize(t, box.fontSize) } catch { return t.length * box.fontSize * 0.5 }
        }
        const lines: string[] = []
        for (const para of box.text.split('\n')) {
          const words = para.split(' ')
          let cur = ''
          for (const wd of words) {
            const t = cur ? cur + ' ' + wd : wd
            if (!cur || measure(t) <= boxW) cur = t
            else { lines.push(cur); cur = wd }
          }
          lines.push(cur)
        }
        let yOff = 0
        for (const line of lines) {
          let x = box.x / scale
          if (box.align === 'center') x += Math.max(0, (boxW - measure(line)) / 2)
          else if (box.align === 'right') x += Math.max(0, boxW - measure(line))
          page.drawText(line, {
            x,
            y: height - box.y / scale - box.fontSize - yOff,
            font,
            size: box.fontSize,
            color: hexToRgb(box.fontColor),
          })
          yOff += box.fontSize * 1.4 // matches preview lineHeight
        }
      }

      // Draw images
      for (const img of images) {
        try {
          const page = pdfDoc.getPage(img.page)
          const { height } = page.getSize()
          const imgBytes = await fetch(img.src).then(r => r.arrayBuffer())
          const ext = img.src.split(';')[0].split('/')[1]
          let embedded: Awaited<ReturnType<typeof pdfDoc.embedPng>>
          if (ext === 'png') {
            embedded = await pdfDoc.embedPng(imgBytes)
          } else {
            embedded = await pdfDoc.embedJpg(imgBytes)
          }
          page.drawImage(embedded, {
            x: img.x / scale,
            y: height - (img.y + img.height) / scale,
            width: img.width / scale,
            height: img.height / scale,
          })
        } catch { /* skip broken images */ }
      }

      // updateFieldAppearances already ran above; don't let save() regenerate
      // (and overwrite) the neutralized checkbox APs.
      const newBytes = await pdfDoc.save({ updateFieldAppearances: false })
      const blob = new Blob([new Uint8Array(newBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `editado-${file.name}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentBoxes = boxes.filter(b => b.page === currentPage)
  const currentImages = images.filter(i => i.page === currentPage)
  const currentExisting = existingTexts.filter(t => t.page === currentPage)
  const currentFormFields = formFields.filter(f => f.page === currentPage)
  const hasChanges = boxes.some(b => b.text.trim()) || images.length > 0 || existingTexts.some(t => t.edited) || formFields.some(f => f.touched || f.moved || f.hidden)
    // Telmex: even an untouched form must be exportable — downloading runs the
    // oval-snap + AP neutralization that removes the gray fallback squares.
    || formFields.some(f => f.ovalPdf)

  /* ── Toolbar ──────────────────────────────────────────── */

  const Toolbar = () => (
    <div className="spatial-toolbar mb-4 flex-wrap gap-y-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-1">
        <button
          className={`spatial-btn-icon ${mode === 'text' ? 'active' : ''}`}
          onClick={() => setMode('text')}
          title="Modo texto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
        <button
          className={`spatial-btn-icon ${mode === 'draw' ? 'active' : ''}`}
          onClick={() => setMode('draw')}
          title="Modo dibujo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          className="spatial-btn-icon"
          onClick={() => document.getElementById('img-upload')?.click()}
          title="Insertar imagen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <input id="img-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <button
          className="spatial-btn-icon"
          onClick={openSignature}
          title="Firma digital"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          className={`spatial-btn-icon ${showBackground ? 'active' : ''}`}
          onClick={() => setShowBackground(v => !v)}
          title={showBackground ? 'Ver solo texto (ocultar el diseño)' : 'Ver diseño del PDF (modo reemplazo)'}
        >
          {showBackground ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      <div className="spatial-toolbar-separator" />

      {/* Font family */}
      <select
        className="spatial-select text-xs py-1.5 px-2"
        value={fontFamily}
        onChange={e => { setFontFamily(e.target.value); applyToSelected({ fontFamily: e.target.value }) }}
        style={{ fontFamily }}
      >
        {FONT_FAMILIES.map(f => (
          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
        ))}
      </select>

      {/* Font size */}
      <div className="flex items-center gap-1">
        <button
          className="spatial-btn-icon !p-1"
          onClick={() => { const s = Math.max(6, fontSize - 2); setFontSize(s); applyToSelected({ fontSize: s }) }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <input
          type="number"
          value={fontSize}
          onChange={e => { const s = Number(e.target.value); setFontSize(s); applyToSelected({ fontSize: s }) }}
          min={6} max={120}
          className="spatial-input w-14 text-xs text-center py-1 px-1"
        />
        <button
          className="spatial-btn-icon !p-1"
          onClick={() => { const s = Math.min(120, fontSize + 2); setFontSize(s); applyToSelected({ fontSize: s }) }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="spatial-toolbar-separator" />

      {/* Bold / Italic / Underline */}
      <button
        className={`spatial-btn-icon ${bold ? 'active' : ''}`}
        onClick={() => { const v = !bold; setBold(v); applyToSelected({ bold: v }) }}
        title="Negrita"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      </button>
      <button
        className={`spatial-btn-icon ${italic ? 'active' : ''}`}
        onClick={() => { const v = !italic; setItalic(v); applyToSelected({ italic: v }) }}
        title="Cursiva"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0l-4 16m-2 0h4m2-16l4 16" />
        </svg>
      </button>
      <button
        className={`spatial-btn-icon ${underline ? 'active' : ''}`}
        onClick={() => { const v = !underline; setUnderline(v); applyToSelected({ underline: v }) }}
        title="Subrayado"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v7a5 5 0 0010 0V4M5 21h14" />
        </svg>
      </button>

      <div className="spatial-toolbar-separator" />

      {/* Alignment */}
      <button
        className={`spatial-btn-icon ${align === 'left' ? 'active' : ''}`}
        onClick={() => { setAlign('left'); applyToSelected({ align: 'left' }) }}
        title="Alinear izquierda"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
        </svg>
      </button>
      <button
        className={`spatial-btn-icon ${align === 'center' ? 'active' : ''}`}
        onClick={() => { setAlign('center'); applyToSelected({ align: 'center' }) }}
        title="Centrar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M3 18h18" />
        </svg>
      </button>
      <button
        className={`spatial-btn-icon ${align === 'right' ? 'active' : ''}`}
        onClick={() => { setAlign('right'); applyToSelected({ align: 'right' }) }}
        title="Alinear derecha"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
        </svg>
      </button>

      <div className="spatial-toolbar-separator" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        <label className="text-xs" style={{ color: 'var(--text-primary)' }}>Color:</label>
        <input
          type="color"
          value={fontColor}
          onChange={e => { setFontColor(e.target.value); applyToSelected({ fontColor: e.target.value }) }}
          className="w-6 h-6 rounded cursor-pointer border-0"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs" style={{ color: 'var(--text-primary)' }}>Fondo:</label>
        <select
          className="spatial-select text-xs py-1 px-1.5"
          value={highlightColor}
          onChange={e => { setHighlightColor(e.target.value); applyToSelected({ highlightColor: e.target.value }) }}
        >
          {HIGHLIGHT_COLORS.map(c => (
            <option key={c.value} value={c.value}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="spatial-toolbar-separator" />

      {/* Undo / Redo */}
      <button className="spatial-btn-icon" onClick={undo} title="Deshacer (Ctrl+Z)" disabled={history.length === 0}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button className="spatial-btn-icon" onClick={redo} title="Rehacer (Ctrl+Y)" disabled={redoStack.length === 0}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>

      <div className="spatial-toolbar-separator" />

      {/* Zoom */}
      <div className="flex items-center gap-2">
        <input
          type="range" min={0.25} max={3} step={0.05} value={scale}
          onChange={e => setScale(Number(e.target.value))}
          className="w-20 accent-sky-300"
        />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(scale * 100).toFixed(0)}%</span>
      </div>

      {/* Drawing options (when in draw mode) */}
      {mode === 'draw' && (
        <>
          <div className="spatial-toolbar-separator" />
          <div className="flex items-center gap-1">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Trazo:</label>
            <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
            <input type="range" min={1} max={10} value={drawSize} onChange={e => setDrawSize(Number(e.target.value))} className="w-16 accent-sky-300" />
          </div>
          <button
            className="spatial-btn-icon"
            onClick={() => { pushHistory(); setStrokes(prev => prev.filter(s => s.page !== currentPage)) }}
            title="Borrar trazos de esta pagina"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
    <PDFToolLayout
      title="Editar PDF Online Gratis"
      description="Escribe y edita texto directamente sobre las paginas de tu PDF. Gratis y sin subir archivos a servidores."
      keyword="Editar PDF"
    >
      {!file && <PDFUploader onFiles={f => f[0] && setFile(f[0])} />}

      {file && (
        <div className="mt-4">
          <Toolbar />

          {/* Saved indicator */}
          {showSaved && (
            <div className="text-xs mb-2 fade-in" style={{ color: 'var(--success)' }}>
              <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Guardado automatico
            </div>
          )}

          {/* OCR indicator — scanned pages without a text layer */}
          {ocrLoading && (
            <div className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Reconociendo texto del PDF (OCR)...
            </div>
          )}

          {/* PDF + Overlay — canvas stays visible; edited text is whiteed out locally */}
          <div
            className="relative inline-block rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-default)', background: showBackground ? undefined : '#ffffff' }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{ opacity: showBackground ? undefined : 0 }}
            />
            <canvas
              ref={drawCanvasRef}
              className="absolute inset-0"
              style={{ cursor: mode === 'draw' ? 'crosshair' : 'default', pointerEvents: mode === 'draw' ? 'auto' : 'none' }}
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
            />
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ cursor: mode === 'text' ? 'crosshair' : 'default', pointerEvents: mode === 'text' ? 'auto' : 'none' }}
              onClick={handleOverlayClick}
            >
              {/* Text boxes */}
              {currentBoxes.map(box => (
                <div
                  key={box.id}
                  ref={el => { if (el) boxRefsMap.current.set(box.id, el); else boxRefsMap.current.delete(box.id) }}
                  className={`editor-box absolute group cursor-pointer z-10 ${selectedBox === box.id ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-transparent' : ''}`}
                  style={{ left: box.x, top: box.y }}
                  onClick={e => { e.stopPropagation(); setSelectedBox(box.id); setSelectedImage(null) }}
                >
                  {/* Drag handle - always visible */}
                  <div
                    className="absolute -top-7 left-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-t opacity-100 transition-opacity cursor-move"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid #38bdf8', borderBottom: 'none' }}
                    onMouseDown={e => handleBoxDragStart(e, box.id)}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    <span>texto</span>
                  </div>
                  {/* Delete button — visible on hover OR when selected (touch can't hover) */}
                  <button
                    className={`absolute -top-7 right-0 w-5 h-5 rounded-t transition-opacity flex items-center justify-center text-white text-[10px] cursor-pointer min-w-0 min-h-0 ${selectedBox === box.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto'}`}
                    style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0 }}
                    onClick={e => { e.stopPropagation(); deleteBox(box.id) }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* Width resize handle */}
                  <div
                    className="absolute top-0 -right-1.5 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-50"
                    style={{ background: 'var(--accent)' }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      const startX = e.clientX
                      const startW = box.width
                      const onMove = (ev: MouseEvent) => {
                        updateBoxWidth(box.id, startW + (ev.clientX - startX))
                      }
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  />
                  {/* Editable text */}
                  <TextEditor
                    value={box.text}
                    className="min-w-[60px] min-h-[24px] px-2 py-1.5 outline-none whitespace-pre-wrap"
                    style={{
                      // fontSize is stored in PDF points (same as export);
                      // preview renders it at the current zoom scale
                      fontSize: box.fontSize * scale,
                      fontFamily: box.fontFamily,
                      color: box.fontColor || '#1e293b',
                      backgroundColor: box.highlightColor || 'rgba(244,247,255,0.22)',
                      fontWeight: box.bold ? 'bold' : 'normal',
                      fontStyle: box.italic ? 'italic' : 'normal',
                      textDecoration: box.underline ? 'underline' : 'none',
                      textAlign: box.align,
                      width: box.width,
                      border: selectedBox === box.id
                        ? '2px solid #38bdf8'
                        : '1.5px dashed #38bdf8',
                      borderRadius: '6px',
                      lineHeight: 1.4,
                      backdropFilter: 'blur(2px)',
                      boxShadow: selectedBox === box.id ? '0 0 8px rgba(125,211,252,0.3)' : 'none',
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onInput={text => updateBoxText(box.id, text)}
                    onFocus={() => setSelectedBox(box.id)}
                  />
                </div>
              ))}

              {/* Existing text items — invisible until selected/edited (canvas shows the original) */}
              {currentExisting.map(item => {
                const active = item.edited || selectedExisting === item.id
                return (
                <div
                  key={`ext-${item.id}`}
                  className={`existing-text absolute group cursor-pointer outline-1 outline-dashed outline-transparent hover:outline-emerald-500/60 ${selectedExisting === item.id ? 'ring-2 ring-emerald-400' : ''}`}
                  style={{ left: item.x, top: item.y }}
                  onClick={e => { e.stopPropagation(); setSelectedExisting(item.id); setSelectedBox(null); setSelectedImage(null) }}
                >
                  {/* Drag handle + delete — hover on desktop, always visible when selected (touch) */}
                  <div className={`absolute -top-6 left-0 right-0 flex items-center transition-opacity ${selectedExisting === item.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto'}`}>
                    <div
                      className="px-1.5 py-0.5 text-[9px] rounded-t cursor-move flex items-center"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid #10b981', borderBottom: 'none' }}
                      onMouseDown={e => handleExistingDragStart(e, item.id)}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                    <button
                      className="ml-auto px-1 py-0.5 rounded-t flex items-center text-white text-[10px] cursor-pointer min-w-0 min-h-0"
                      style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0 }}
                      onClick={e => { e.stopPropagation(); deleteExisting(item.id) }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Editable text — same font size as export (no 0.75 factor) */}
                  <TextEditor
                    value={item.text}
                    className="min-w-[40px] outline-none whitespace-pre"
                    style={{
                      fontSize: item.fontSize * scale,
                      fontFamily: item.fontFamily,
                      color: item.edited ? (item.fontColor || '#0f172a') : '#0f172a',
                      backgroundColor: showBackground
                        ? '#ffffff'
                        : (active ? 'rgba(56,189,248,0.10)' : 'transparent'),
                      fontWeight: item.bold ? 'bold' : 'normal',
                      fontStyle: item.italic ? 'italic' : 'normal',
                      width: item.width,
                      height: item.height,
                      boxSizing: 'border-box',
                      padding: 0,
                      border: active
                        ? (selectedExisting === item.id ? '2px solid #10b981' : '1.5px dashed rgba(16,185,129,0.6)')
                        : (showBackground ? 'none' : '1px dashed rgba(15,23,42,0.30)'),
                      borderRadius: '3px',
                      lineHeight: 1.3,
                      backdropFilter: 'none',
                      boxShadow: selectedExisting === item.id ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onInput={text => updateExistingText(item.id, text)}
                    onFocus={() => setSelectedExisting(item.id)}
                  />
                  {item.edited && (
                    <span className="absolute -bottom-5 left-0 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ color: '#10b981' }}>
                      editado
                    </span>
                  )}
                </div>
                )
              })}

              {/* Images */}
              {currentImages.map(img => (
                <div
                  key={img.id}
                  className={`editor-image absolute group cursor-pointer ${selectedImage === img.id ? 'ring-2 ring-sky-400' : ''}`}
                  style={{ left: img.x, top: img.y }}
                  onClick={e => { e.stopPropagation(); setSelectedImage(img.id); setSelectedBox(null) }}
                >
                  {/* Drag handle — visible on hover OR when selected */}
                  <div
                    className={`absolute -top-6 left-0 px-1.5 py-0.5 text-[9px] rounded-t cursor-move transition-opacity ${selectedImage === img.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto'}`}
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}
                    onMouseDown={e => handleImageDragStart(e, img.id)}
                  >
                    <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  {/* Delete — visible on hover OR when selected */}
                  <button
                    className={`absolute -top-6 right-0 w-5 h-5 rounded-t transition-opacity flex items-center justify-center text-white text-[10px] cursor-pointer min-w-0 min-h-0 ${selectedImage === img.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto'}`}
                    style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0 }}
                    onClick={e => { e.stopPropagation(); deleteImage(img.id) }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <img
                    src={img.src}
                    alt="Inserted"
                    className="pointer-events-none select-none"
                    style={{ width: img.width, height: img.height }}
                    draggable={false}
                  />
                </div>
              ))}

              {/* Native AcroForm fields — real inputs positioned over the form */}
              {currentFormFields.map(f => {
                const pos = { left: f.x, top: f.y, width: f.width, height: f.height }
                const key = fieldKey(f)
                const selected = selectedField === key
                const chromeVisible = selected ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto'
                if (f.hidden) {
                  // Mirror the export: empty text boxes are NOT whiteed out
                  // there (the printed design must survive), so nothing
                  // renders here either; other hidden fields show the patch.
                  if (!showBackground) return null
                  if (f.type === 'Tx' && f.value === '') return null
                  return (
                    <div
                      key={`ff-${f.page}-${f.name}-${f.type}-${f.exportValue || ''}-hidden`}
                      className="absolute pointer-events-none"
                      style={{ ...pos, background: '#ffffff' }}
                    />
                  )
                }
                if (f.type === 'Tx') {
                  return (
                    <div
                      key={`ff-${f.page}-${f.name}-Tx`}
                      className="absolute group/field"
                      style={pos}
                      onClick={e => { e.stopPropagation(); setSelectedField(key) }}
                    >
                      {/* Drag handle + hide — hover on desktop, sticky when selected */}
                      <div className={`absolute -top-5 left-0 right-0 flex items-center transition-opacity ${chromeVisible}`}>
                        <div
                          className="px-1.5 py-0.5 text-[9px] rounded-t cursor-move flex items-center"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid #0ea5e9', borderBottom: 'none', pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                          onMouseDown={e => handleFieldDragStart(e, f)}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                        <button
                          className="ml-auto px-1 py-0.5 rounded-t flex items-center text-white text-[10px] cursor-pointer min-w-0 min-h-0"
                          style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0, pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                          title="Ocultar campo"
                          onClick={e => { e.stopPropagation(); hideFormField(f) }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        type="text"
                        aria-label={f.name}
                        value={f.value}
                        onChange={e => updateFormField(f, { value: e.target.value })}
                        onClick={e => { e.stopPropagation(); setSelectedField(key) }}
                        onFocus={e => {
                          // First focus on a baked-in scan value selects it so
                          // typing replaces the sample ("Ñ") instead of appending.
                          if (!f.touched) e.target.select()
                        }}
                        className="absolute left-0 top-0 focus:ring-1 focus:ring-sky-400"
                        style={{
                          width: '100%',
                          height: '100%',
                          fontSize: Math.max(9, f.height * 0.62),
                          lineHeight: `${f.height}px`,
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          color: '#0f172a',
                          background: showBackground
                            // touched-but-empty keeps the white patch: clearing a
                            // baked-in scan value must actually cover it up
                            ? (f.value || f.touched ? '#ffffff' : 'transparent')
                            : 'rgba(255,255,255,0.75)',
                          border: showBackground ? 'none' : '1px dashed rgba(56,189,248,0.7)',
                          outline: 'none',
                          padding: '0 2px',
                          boxSizing: 'border-box',
                          textAlign: f.align || 'left',
                          pointerEvents: mode === 'draw' ? 'none' : 'auto',
                        }}
                      />
                    </div>
                  )
                }
                // Btn (checkbox) and Radio — centered in the widget rect
                const size = Math.min(Math.max(Math.min(f.width, f.height), 12), 24)
                // Telmex: the overlay rect is the printed oval — render a
                // circular toggle that sits on it instead of a native square.
                if (f.type === 'Btn' && f.ovalPdf) {
                  return (
                    <div
                      key={`ff-${f.page}-${f.name}-${f.type}-oval`}
                      className="absolute group/field"
                      style={pos}
                      onClick={e => { e.stopPropagation(); setSelectedField(key) }}
                    >
                      <div className={`absolute -top-5 left-0 right-0 flex items-center transition-opacity ${chromeVisible}`}>
                        <div
                          className="px-1.5 py-0.5 text-[9px] rounded-t cursor-move flex items-center"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid #0ea5e9', borderBottom: 'none', pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                          onMouseDown={e => handleFieldDragStart(e, f)}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                        <button
                          className="ml-auto px-1 py-0.5 rounded-t flex items-center text-white text-[10px] cursor-pointer min-w-0 min-h-0"
                          style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0, pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                          title="Ocultar campo"
                          onClick={e => { e.stopPropagation(); hideFormField(f) }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={f.checked}
                        aria-label={f.name}
                        onClick={e => { e.stopPropagation(); toggleFormField(f, !f.checked) }}
                        className="absolute left-0 top-0 flex items-center justify-center cursor-pointer transition hover:ring-2 hover:ring-sky-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.92]"
                        style={{
                          width: '100%',
                          height: '100%',
                          margin: 0,
                          padding: 0,
                          minWidth: 0,
                          minHeight: 0,
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          borderRadius: '50%',
                          background: f.checked ? 'rgba(3,105,161,0.12)' : 'transparent',
                          border: `2px solid ${f.checked ? '#0369a1' : 'rgba(148,163,184,0.75)'}`,
                          outline: 'none',
                          pointerEvents: mode === 'draw' ? 'none' : 'auto',
                        }}
                      >
                        {f.checked && (
                          <svg
                            viewBox="0 0 24 24"
                            className="pointer-events-none select-none"
                            style={{ width: '72%', height: '72%' }}
                            fill="none"
                            stroke="#0369a1"
                            strokeWidth={3.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4.5 12.5l5 5 10-10" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )
                }
                return (
                  <div
                    key={`ff-${f.page}-${f.name}-${f.type}-${f.exportValue || ''}`}
                    className="absolute group/field"
                    style={pos}
                    onClick={e => { e.stopPropagation(); setSelectedField(key) }}
                  >
                    <div className={`absolute -top-5 left-0 right-0 flex items-center transition-opacity ${chromeVisible}`}>
                      <div
                        className="px-1.5 py-0.5 text-[9px] rounded-t cursor-move flex items-center"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid #0ea5e9', borderBottom: 'none', pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                        onMouseDown={e => handleFieldDragStart(e, f)}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <button
                        className="ml-auto px-1 py-0.5 rounded-t flex items-center text-white text-[10px] cursor-pointer min-w-0 min-h-0"
                        style={{ background: 'var(--danger)', minWidth: 0, minHeight: 0, pointerEvents: mode === 'draw' ? 'none' : 'auto' }}
                        title="Ocultar campo"
                        onClick={e => { e.stopPropagation(); hideFormField(f) }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <input
                      type={f.type === 'Radio' ? 'radio' : 'checkbox'}
                      name={`ff-${f.page}-${f.name}`}
                      checked={f.checked}
                      onChange={e => toggleFormField(f, e.target.checked)}
                      onClick={e => e.stopPropagation()}
                      className="absolute cursor-pointer"
                      style={{
                        left: (f.width - size) / 2,
                        top: (f.height - size) / 2,
                        width: size,
                        height: size,
                        margin: 0,
                        // Override the global 44px touch-target minimum: form
                        // widgets must match their real position/size on the page
                        minWidth: 0,
                        minHeight: 0,
                        accentColor: '#0ea5e9',
                        pointerEvents: mode === 'draw' ? 'none' : 'auto',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Page navigation */}
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="spatial-btn text-sm"
              >
                Anterior
              </button>
              <span className="text-sm self-center" style={{ color: 'var(--text-secondary)' }}>
                Pagina {currentPage + 1} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="spatial-btn text-sm"
              >
                Siguiente
              </button>
            </div>
          )}

          {/* Download */}
          <div className="mt-4">
            <DownloadButton
              onClick={handleDownload}
              disabled={!hasChanges}
              loading={loading}
              label={`Descargar PDF editado`}
            />
          </div>
        </div>
      )}
    </PDFToolLayout>

    {/* Signature Modal */}
    {showSignature && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 'var(--z-modal-backdrop)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
        <div className="spatial-card p-6 rounded-2xl max-w-md w-full mx-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Dibuja tu firma</h3>
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--border-subtle)' }}>
            <canvas
              ref={sigCanvasRef}
              width={400}
              height={150}
              className="cursor-crosshair w-full"
              style={{ background: '#fff', touchAction: 'none' }}
              onMouseDown={sigMouseDown}
              onMouseMove={sigMouseMove}
              onMouseUp={sigMouseUp}
              onMouseLeave={sigMouseUp}
              onTouchStart={sigMouseDown}
              onTouchMove={sigMouseMove}
              onTouchEnd={sigMouseUp}
            />
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Dibuja tu firma en el area blanca. Luego presiona "Colocar firma" para insertarla en el PDF.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              className="spatial-btn text-sm"
              onClick={() => {
                sigPoints.current = []
                const canvas = sigCanvasRef.current
                if (canvas) {
                  const ctx = canvas.getContext('2d')!
                  ctx.fillStyle = '#ffffff'
                  ctx.fillRect(0, 0, canvas.width, canvas.height)
                  ctx.strokeStyle = '#ccc'
                  ctx.lineWidth = 1
                  ctx.beginPath()
                  ctx.moveTo(20, canvas.height - 30)
                  ctx.lineTo(canvas.width - 20, canvas.height - 30)
                  ctx.stroke()
                }
              }}
            >
              Limpiar
            </button>
            <button className="spatial-btn text-sm" onClick={() => setShowSignature(false)}>
              Cancelar
            </button>
            <button className="spatial-btn-primary text-sm" onClick={placeSignature}>
              Colocar firma
            </button>
          </div>
        </div>
      </div>
      )}
    </>
  )
}
