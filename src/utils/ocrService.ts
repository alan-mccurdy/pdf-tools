/**
 * OCR Service for PDF text extraction from scanned documents
 * Uses Tesseract.js for client-side OCR processing
 */

import { createWorker, type Worker } from 'tesseract.js'

let ocrWorker: Worker | null = null

export async function initOCR(): Promise<Worker | null> {
  if (ocrWorker) return ocrWorker
  
  try {
    // tesseract.js v7: createWorker loads, downloads languages and
    // initializes the engine internally. Languages go in the first arg.
    const worker = await createWorker('eng+spa')

    ocrWorker = worker
    return ocrWorker
  } catch (error) {
    console.error('Failed to initialize OCR:', error)
    return null
  }
}

export async function extractTextFromImage(imageData: string): Promise<string> {
  if (!ocrWorker) {
    const worker = await initOCR()
    if (!worker) return ''
  }
  
  if (!ocrWorker) return ''
  
  try {
    // Languages are already set on the worker; recognize() takes only the image
    const result = await ocrWorker.recognize(imageData)
    return result.data.text
  } catch (error) {
    console.error('OCR extraction failed:', error)
    return ''
  }
}

/** Word bounding box in image pixels (origin top-left). */
export interface OcrWordBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  /** Tesseract confidence 0–100 for this word. */
  confidence: number
  /** Average confidence 0–100 of the surviving words in this word's line. */
  lineConfidence: number
}

/**
 * Run OCR and return word boxes (no line grouping — callers group them).
 * Image coordinates are pixel-based, top-left origin, matching canvas coords.
 *
 * Words that are pure form-line artifacts (pipes/underscores/brackets drawn
 * as graphics) or low-confidence scraps are filtered out — they only add
 * noise to the editor's layer. Real text on scanned forms measures 84–97
 * confidence; junk measures <55. Line quality is judged from the SURVIVING
 * words' average, never tesseract's raw line.confidence: graphic scraps
 * sharing the line report conf 0 and would drag real text down with them.
 */
export async function extractWordsFromImage(image: HTMLCanvasElement): Promise<OcrWordBox[]> {
  const worker = await initOCR()
  if (!worker) return []

  try {
    const result = await worker.recognize(image, {}, { blocks: true, text: false })
    const words: OcrWordBox[] = []
    for (const block of result.data.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          // 1) keep words with letters/numbers (drop drawn lines, boxes,
          //    pipes, underscores) and confidence >= 55 (misread scraps)
          const survivors = (line.words || []).filter(
            w => !!w.text && !!w.text.trim() &&
              /[\p{L}\p{N}]/u.test(w.text) &&
              (typeof w.confidence === 'number' ? w.confidence : 0) >= 55,
          )
          if (!survivors.length) continue
          // 2) whole line read poorly (form graphics rows, garbage rows).
          //    Average the SURVIVING words: tesseract's raw line.confidence
          //    is dragged under the threshold by conf-0 graphic scraps that
          //    share the line — e.g. "NOMBRE DEL SUSCRIPTOR:" (96/95/67)
          //    read as line conf 31 and was discarded whole, leaving the
          //    printed words as bare pixels with no editable overlay.
          const lineConfidence = Math.round(
            survivors.reduce((s, w) => s + (typeof w.confidence === 'number' ? w.confidence : 0), 0) / survivors.length,
          )
          if (lineConfidence < 65) continue
          for (const w of survivors) {
            words.push({
              text: w.text,
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
              confidence: typeof w.confidence === 'number' ? w.confidence : 0,
              lineConfidence,
            })
          }
        }
      }
    }
    return words
  } catch (error) {
    console.error('OCR word extraction failed:', error)
    return []
  }
}

export async function closeOCR(): Promise<void> {
  if (ocrWorker) {
    try {
      await ocrWorker.terminate()
    } catch (error) {
      console.error('Error terminating OCR worker:', error)
    }
    ocrWorker = null
  }
}

export function isOCRSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined'
}
