import { Link } from 'react-router-dom'

const tools = [
  { path: '/editar-pdf', label: 'Editar PDF' },
  { path: '/unir-pdf', label: 'Unir PDFs' },
  { path: '/word-a-pdf', label: 'Word a PDF' },
  { path: '/separar-pdf', label: 'Separar PDF' },
  { path: '/rotar-pdf', label: 'Rotar PDF' },
  { path: '/comprimir-pdf', label: 'Comprimir PDF' },
  { path: '/eliminar-paginas', label: 'Eliminar Paginas' },
  { path: '/insertar-imagenes', label: 'Insertar Imagenes' },
]

export default function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-blue-400">
          PDF Tools
        </Link>
        <nav className="hidden md:flex gap-1">
          {tools.map(t => (
            <Link
              key={t.path}
              to={t.path}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
