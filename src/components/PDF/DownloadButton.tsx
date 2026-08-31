interface DownloadButtonProps {
  onClick: () => void | Promise<void>
  disabled?: boolean
  label?: string
  loading?: boolean
}

export default function DownloadButton({ onClick, disabled, label = 'Descargar PDF', loading }: DownloadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="spatial-btn-primary mt-6 px-6 py-3 text-lg disabled:opacity-35 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Procesando...
        </span>
      ) : label}
    </button>
  )
}
