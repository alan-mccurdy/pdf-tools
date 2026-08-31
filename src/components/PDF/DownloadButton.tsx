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
      className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-lg transition"
    >
      {loading ? 'Procesando...' : label}
    </button>
  )
}
