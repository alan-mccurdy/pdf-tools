import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

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
}

interface EditorState {
  boxes: TextBox[]
  images: ImageBox[]
  strokes: DrawStroke[]
  existingTexts?: ExistingTextItem[]
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

function fontToPdfLib(fontFamily: string): StandardFonts {
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
  return map[fontFamily] || StandardFonts.Helvetica
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

/* ── Component ──────────────────────────────────────────── */

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
  const [drawColor, setDrawColor] = useState('#000000')
  const [drawSize, setDrawSize] = useState(2)
  const [showSaved, setShowSaved] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const sigDrawing = useRef(false)
  const sigPoints = useRef<{ x: number; y: number }[]>([])

  // Undo/Redo
  const [history, setHistory] = useState<EditorState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const nextId = useRef(1)
  const isDrawing = useRef(false)
  const currentStroke = useRef<{ x: number; y: number }[]>([])
  const dragRef = useRef<{ id: number; startX: number; startY: number; boxX: number; boxY: number } | null>(null)
  const imgDragRef = useRef<{ id: number; startX: number; startY: number; imgX: number; imgY: number } | null>(null)
  const fileRef = useRef(file)
  fileRef.current = file
  const newBoxRef = useRef<number | null>(null)
  const boxRefsMap = useRef<Map<number, HTMLDivElement>>(new Map())

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
    const timer = setTimeout(() => {
      saveState(file.name, { boxes, images, strokes, existingTexts })
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
    }, 500)
    return () => clearTimeout(timer)
  }, [boxes, images, strokes, existingTexts, file])

  // Load persisted state when file changes
  useEffect(() => {
    if (!file) return
    loadState(file.name).then((saved) => {
      if (saved) {
        setBoxes(saved.boxes || [])
        setImages(saved.images || [])
        setStrokes(saved.strokes || [])
        if (saved.existingTexts) setExistingTexts(saved.existingTexts)
        // Update nextId
        const maxId = Math.max(
          ...saved.boxes.map(b => b.id),
          ...saved.images.map(i => i.id),
          ...saved.strokes.map(s => s.id),
          ...(saved.existingTexts || []).map(t => t.id),
          0,
        )
        nextId.current = maxId + 1
      }
    })
  }, [file])

  // Render current PDF page
  useEffect(() => {
    if (!file) return
    const render = async () => {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setTotalPages(pdf.numPages)
      const page = await pdf.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport } as never).promise
    }
    render()
  }, [file, currentPage, scale])

  // Extract existing text items from PDF page
  useEffect(() => {
    if (!file) return
    const extract = async () => {
      const bytes = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const page = await pdf.getPage(currentPage + 1)
      const textContent = await page.getTextContent()
      const items = textContent.items as any[]
      if (!items.length) { setExistingTexts(prev => prev.filter(t => t.page !== currentPage)); return }

      // Group by Y-coordinate (within 3px tolerance at scale) to form lines
      const Y_TOLERANCE = 3
      const lines: { items: any[]; y: number }[] = []
      for (const item of items) {
        if (!item.str?.trim()) continue
        const tx = item.transform
        // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const itemY = tx[5]
        const existing = lines.find(l => Math.abs(l.y - itemY) < Y_TOLERANCE)
        if (existing) {
          existing.items.push(item)
        } else {
          lines.push({ items: [item], y: itemY })
        }
      }

      // Sort items in each line by X position
      for (const line of items.length ? lines : []) {
        line.items.sort((a: any, b: any) => a.transform[4] - b.transform[4])
      }

      // Check if we already have persisted edits for this page
      const existingForPage = existingTexts.filter(t => t.page === currentPage)
      const existingMap = new Map(existingForPage.map(t => [t.originalText + '|' + Math.round(t.y), t]))

      const newItems: ExistingTextItem[] = []
      let id = nextId.current
      for (const line of lines) {
        const combinedText = line.items.map((i: any) => i.str).join(' ')
        const firstItem = line.items[0]
        const tx = firstItem.transform
        const fontSize = Math.abs(tx[3]) || 12
        const x = tx[4] * scale
        const y = tx[5] * scale
        // Calculate width from last item
        const lastItem = line.items[line.items.length - 1]
        const endX = (lastItem.transform[4] + (lastItem.width || 0)) * scale
        const width = Math.max(endX - x, 60)
        const height = fontSize * scale * 1.3

        // Detect bold from font name
        const fontName = firstItem.fontName || ''
        const isBold = /bold/i.test(fontName)
        const isItalic = /italic|oblique/i.test(fontName)

        // Check if this line was previously edited
        const key = combinedText + '|' + Math.round(y)
        const prev = existingMap.get(key)
        if (prev) {
          newItems.push({ ...prev, id: prev.id })
        } else {
          newItems.push({
            id: id++,
            text: combinedText,
            originalText: combinedText,
            x, y, width, height, fontSize,
            fontFamily: 'Helvetica',
            fontColor: '#000000',
            bold: isBold,
            italic: isItalic,
            page: currentPage,
            edited: false,
          })
        }
      }
      nextId.current = id
      setExistingTexts(prev => {
        const other = prev.filter(t => t.page !== currentPage)
        return [...other, ...newItems]
      })
    }
    extract().catch(() => {})
  }, [file, currentPage, scale])

  // Render draw strokes on canvas overlay
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight
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
  }, [strokes, currentPage, scale])

  // ── Undo/Redo ──────────────────────────────────────────

  const pushHistory = useCallback(() => {
    const state: EditorState = { boxes, images, strokes, existingTexts }
    setHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1)
      newHist.push(state)
      if (newHist.length > 50) newHist.shift()
      return newHist
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [boxes, images, strokes, existingTexts, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const prev = history[historyIndex - 1]
    setBoxes(prev.boxes)
    setImages(prev.images)
    setStrokes(prev.strokes)
    if (prev.existingTexts) setExistingTexts(prev.existingTexts)
    setHistoryIndex(i => i - 1)
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const next = history[historyIndex + 1]
    setBoxes(next.boxes)
    setImages(next.images)
    setStrokes(next.strokes)
    if (next.existingTexts) setExistingTexts(next.existingTexts)
    setHistoryIndex(i => i + 1)
  }, [history, historyIndex])

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

  const sigMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    sigDrawing.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    sigPoints.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]
  }, [])

  const sigMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sigDrawing.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
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
      pushHistory()
      setStrokes(prev => [...prev, {
        id: nextId.current++,
        points: [...currentStroke.current],
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
      const fontCache: Record<string, PDFFont> = {}

      const getFont = async (name: string, isBold: boolean, isItalic: boolean) => {
        let key = name
        if (isBold) key += '-Bold'
        if (isItalic) key += '-Italic'
        if (!fontCache[key]) {
          const std = fontToPdfLib(name)
          fontCache[key] = await pdfDoc.embedFont(std)
        }
        return fontCache[key]
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
        // Draw edited text
        const font = await getFont(item.fontFamily, item.bold, item.italic)
        page.drawText(item.text, {
          x: item.x / scale,
          y: height - item.y / scale - (item.fontSize * 0.85),
          font,
          size: item.fontSize,
          color: hexToRgb(item.fontColor),
        })
      }

      // Draw text boxes
      for (const box of boxes) {
        if (!box.text.trim()) continue
        const page = pdfDoc.getPage(box.page)
        const { height } = page.getSize()
        const font = await getFont(box.fontFamily, box.bold, box.italic)
        const lines = box.text.split('\n')
        let yOff = 0
        for (const line of lines) {
          page.drawText(line, {
            x: box.x / scale,
            y: height - box.y / scale - box.fontSize - yOff,
            font,
            size: box.fontSize,
            color: hexToRgb(box.fontColor),
          })
          yOff += box.fontSize * 1.3
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

      const newBytes = await pdfDoc.save()
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
  const hasChanges = boxes.some(b => b.text.trim()) || images.length > 0 || existingTexts.some(t => t.edited)

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
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Color:</label>
        <input
          type="color"
          value={fontColor}
          onChange={e => { setFontColor(e.target.value); applyToSelected({ fontColor: e.target.value }) }}
          className="w-6 h-6 rounded cursor-pointer border-0"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Fondo:</label>
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
      <button className="spatial-btn-icon" onClick={undo} title="Deshacer (Ctrl+Z)" disabled={historyIndex <= 0}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button className="spatial-btn-icon" onClick={redo} title="Rehacer (Ctrl+Y)" disabled={historyIndex >= history.length - 1}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>

      <div className="spatial-toolbar-separator" />

      {/* Zoom */}
      <div className="flex items-center gap-2">
        <input
          type="range" min={0.5} max={3} step={0.1} value={scale}
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
      <PDFUploader onFiles={f => f[0] && setFile(f[0])} />

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

          {/* PDF + Overlay */}
          <div className="relative inline-block rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            <canvas ref={canvasRef} className="block" />
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
                  className={`editor-box absolute group ${selectedBox === box.id ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-transparent' : ''}`}
                  style={{ left: box.x, top: box.y }}
                  onClick={e => { e.stopPropagation(); setSelectedBox(box.id); setSelectedImage(null) }}
                >
                  {/* Drag handle */}
                  <div
                    className="absolute -top-7 left-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-t opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}
                    onMouseDown={e => handleBoxDragStart(e, box.id)}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    <span>texto</span>
                  </div>
                  {/* Delete button */}
                  <button
                    className="absolute -top-7 right-0 w-5 h-5 rounded-t opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]"
                    style={{ background: 'var(--danger)' }}
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
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="min-w-[60px] min-h-[24px] px-2 py-1.5 outline-none whitespace-pre-wrap"
                    style={{
                      fontSize: box.fontSize,
                      fontFamily: box.fontFamily,
                      color: box.fontColor,
                      backgroundColor: box.highlightColor || 'rgba(255,255,255,0.85)',
                      fontWeight: box.bold ? 'bold' : 'normal',
                      fontStyle: box.italic ? 'italic' : 'normal',
                      textDecoration: box.underline ? 'underline' : 'none',
                      textAlign: box.align,
                      width: box.width,
                      border: selectedBox === box.id
                        ? '1.5px solid var(--accent)'
                        : '1.5px dashed rgba(125,211,252,0.5)',
                      borderRadius: '6px',
                      lineHeight: 1.4,
                      backdropFilter: 'blur(8px)',
                      boxShadow: selectedBox === box.id ? '0 0 12px rgba(125,211,252,0.2)' : 'none',
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onInput={e => updateBoxText(box.id, (e.target as HTMLDivElement).textContent || '')}
                    onFocus={() => setSelectedBox(box.id)}
                  >
                    {box.text}
                  </div>
                </div>
              ))}

              {/* Existing text items (editable) */}
              {currentExisting.map(item => (
                <div
                  key={`ext-${item.id}`}
                  className={`existing-text absolute group ${selectedExisting === item.id ? 'ring-2 ring-emerald-400' : ''}`}
                  style={{ left: item.x, top: item.y }}
                  onClick={e => { e.stopPropagation(); setSelectedExisting(item.id); setSelectedBox(null); setSelectedImage(null) }}
                >
                  {/* Drag handle */}
                  <div
                    className="absolute -top-6 left-0 px-1.5 py-0.5 text-[9px] rounded-t cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}
                  >
                    <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    <span className="ml-1 text-[8px]" style={{ color: 'var(--accent)' }}>original</span>
                  </div>
                  {/* Delete button */}
                  <button
                    className="absolute -top-6 right-0 w-5 h-5 rounded-t opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]"
                    style={{ background: 'var(--danger)' }}
                    onClick={e => { e.stopPropagation(); deleteExisting(item.id) }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* Editable text */}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="min-w-[40px] min-h-[16px] px-1 py-0.5 outline-none whitespace-pre-wrap"
                    style={{
                      fontSize: item.fontSize * scale * 0.75,
                      fontFamily: item.fontFamily,
                      color: item.edited ? '#059669' : 'var(--text-primary)',
                      backgroundColor: item.edited ? 'rgba(5,150,105,0.08)' : 'rgba(255,255,255,0.03)',
                      fontWeight: item.bold ? 'bold' : 'normal',
                      fontStyle: item.italic ? 'italic' : 'normal',
                      width: item.width,
                      border: selectedExisting === item.id
                        ? '1.5px solid #10b981'
                        : '1px dashed rgba(16,185,129,0.3)',
                      borderRadius: '3px',
                      lineHeight: 1.3,
                      backdropFilter: 'blur(2px)',
                    }}
                    onInput={e => updateExistingText(item.id, (e.target as HTMLDivElement).textContent || '')}
                    onFocus={() => setSelectedExisting(item.id)}
                  >
                    {item.text}
                  </div>
                  {item.edited && (
                    <span className="absolute -bottom-5 left-0 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#10b981' }}>
                      editado
                    </span>
                  )}
                </div>
              ))}

              {/* Images */}
              {currentImages.map(img => (
                <div
                  key={img.id}
                  className={`editor-image absolute group ${selectedImage === img.id ? 'ring-2 ring-sky-400' : ''}`}
                  style={{ left: img.x, top: img.y }}
                  onClick={e => { e.stopPropagation(); setSelectedImage(img.id); setSelectedBox(null) }}
                >
                  {/* Drag handle */}
                  <div
                    className="absolute -top-6 left-0 px-1.5 py-0.5 text-[9px] rounded-t cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}
                    onMouseDown={e => handleImageDragStart(e, img.id)}
                  >
                    <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  {/* Delete */}
                  <button
                    className="absolute -top-6 right-0 w-5 h-5 rounded-t opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]"
                    style={{ background: 'var(--danger)' }}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
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
