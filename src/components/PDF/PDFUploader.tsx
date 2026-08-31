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
      className={`glass-card border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300
        ${dragOver
          ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(96,165,250,0.1)]'
          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p className="text-lg font-medium text-white">Arrastra tu archivo aqui</p>
      <p className="text-sm text-gray-500 mt-1">o haz click para seleccionar</p>
    </div>
  )
}
