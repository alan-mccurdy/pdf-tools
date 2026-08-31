import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import PDFToolLayout from '../components/Layout/PDFToolLayout'
import PDFUploader from '../components/PDF/PDFUploader'
import DownloadButton from '../components/PDF/DownloadButton'

interface CompressionPreset {
  name: string
  label: string
  useObjectStreams: boolean
  addDefaultPage: boolean
  description: string
}

const PRESETS: CompressionPreset[] = [
  { name: 'screen', label: 'Pantalla', useObjectStreams: true, addDefaultPage: false, description: 'Maxima compresion, ideal para pantalla' },
  { name: 'ebook', label: 'E-book', useObjectStreams: true, addDefaultPage: false, description: 'Balance entre tamano y calidad' },
  { name: 'printer', label: 'Impresora', useObjectStreams: false, addDefaultPage: false, description: 'Calidad para impresion' },
  { name: 'none', label: 'Sin compresion', useObjectStreams: false, addDefaultPage: false, description: 'Solo optimizar estructura' },
]

export default function ComprimirPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [preset, setPreset] = useState('ebook')
  const [loading, setLoading] = useState(false)
  const [originalSize, setOriginalSize] = useState(0)
  const [resultSize, setResultSize] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFiles = (files: File[]) => {
    if (files[0]) {
      setFile(files[0])
      setOriginalSize(files[0].size)
      setResultSize(null)
      setPreviewUrl(null)
    }
  }

  const handleCompress = async () => {
    if (!file) return
    setLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })

      // Remove metadata for screen/ebook presets
      if (preset === 'screen' || preset === 'ebook') {
        pdfDoc.setTitle('')
        pdfDoc.setAuthor('')
        pdfDoc.setSubject('')
        pdfDoc.setKeywords([])
        pdfDoc.setProducer('')
        pdfDoc.setCreator('')
      }

      const selectedPreset = PRESETS.find(p => p.name === preset)!
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: selectedPreset.useObjectStreams,
        addDefaultPage: selectedPreset.addDefaultPage,
      })

      const compressedBlob = new Blob([new Uint8Array(compressedBytes)], { type: 'application/pdf' })
      setResultSize(compressedBytes.length)

      // Create preview
      const previewUrlVal = URL.createObjectURL(compressedBlob)
      setPreviewUrl(previewUrlVal)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!file || !previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `comprimido-${file.name}`
    a.click()
  }

  const savings = resultSize && originalSize ? Math.round((1 - resultSize / originalSize) * 100) : 0

  return (
    <PDFToolLayout
      title="Comprimir PDF Online Gratis"
      description="Reduce el tamano de tu PDF manteniendo la calidad. Gratis y sin subir archivos a servidores."
      keyword="Comprimir PDF"
    >
      <PDFUploader onFiles={handleFiles} />

      {file && (
        <div className="mt-4 space-y-4">
          <div className="spatial-card-static px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            Tamano original: <strong>{(originalSize / 1024).toFixed(0)} KB</strong>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-primary)' }}>
              Preset de compresion
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => setPreset(p.name)}
                  className={`spatial-btn text-left px-3 py-2 text-sm ${preset === p.name ? '!border-[var(--accent)] !bg-[var(--accent-soft)]' : ''}`}
                >
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {!resultSize ? (
            <DownloadButton onClick={handleCompress} loading={loading} label="Comprimir PDF" />
          ) : (
            <div className="space-y-3">
              <div className="spatial-card-static px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                <div>Original: <strong>{(originalSize / 1024).toFixed(0)} KB</strong></div>
                <div>Comprimido: <strong>{(resultSize / 1024).toFixed(0)} KB</strong></div>
                <div className="mt-1">
                  {savings > 0 ? (
                    <span className="text-green-400">-{savings}% de reduccion</span>
                  ) : savings < 0 ? (
                    <span className="text-yellow-400">+{Math.abs(savings)}% (el archivo creció)</span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">Sin cambio significativo</span>
                  )}
                </div>
              </div>

              <DownloadButton onClick={handleDownload} loading={false} label="Descargar comprimido" />

              <button
                onClick={() => { setResultSize(null); setPreviewUrl(null) }}
                className="spatial-btn text-sm w-full"
              >
                Probar otro preset
              </button>
            </div>
          )}
        </div>
      )}
    </PDFToolLayout>
  )
}
