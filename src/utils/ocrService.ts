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
