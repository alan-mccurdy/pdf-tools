import { useRef, useState, type DragEvent } from 'react'

interface PDFUploaderProps {
  multiple?: boolean
  accept?: string
  onFiles: (files: File[]) => void
}

export default function PDFUploader({ multiple = false, accept = '.pdf', onFiles }: PDFUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      accept.split(',').some(a => f.name.toLowerCase().endsWith(a.trim()))
    )
    if (files.length) onFiles(files)
  }

  const handleChange = () => {
    const files = Array.from(inputRef.current?.files || [])
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`spatial-card-static border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300
        ${dragOver
          ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)] shadow-[0_0_40px_var(--accent-glow)]'
          : 'border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.02]'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
        <svg className="w-8 h-8" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Arrastra tu archivo aqui</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>o haz click para seleccionar</p>
    </div>
  )
}
