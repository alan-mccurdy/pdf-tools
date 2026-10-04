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
}

/**
 * Run OCR and return raw word boxes (no line grouping — callers group them).
 * Image coordinates are pixel-based, top-left origin, matching canvas coords.
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
          for (const w of line.words || []) {
            if (!w.text || !w.text.trim()) continue
            words.push({
              text: w.text,
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
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
