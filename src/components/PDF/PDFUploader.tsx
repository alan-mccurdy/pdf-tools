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
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition
        ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="text-4xl mb-3">📄</div>
      <p className="text-lg font-medium">Arrastra tu PDF aqui</p>
      <p className="text-sm text-gray-400 mt-1">o haz click para seleccionar</p>
    </div>
  )
}
