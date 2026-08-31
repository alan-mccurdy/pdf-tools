import { Link } from 'react-router-dom'

const tools = [
  { path: '/editar-pdf', label: 'Editar PDF' },
  { path: '/unir-pdf', label: 'Unir PDFs' },
  { path: '/word-a-pdf', label: 'Word a PDF' },
  { path: '/separar-pdf', label: 'Separar PDF' },
  { path: '/rotar-pdf', label: 'Rotar PDF' },
  { path: '/comprimir-pdf', label: 'Comprimir' },
  { path: '/eliminar-paginas', label: 'Eliminar' },
  { path: '/insertar-imagenes', label: 'Insertar Img' },
]

export default function Header() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          <span className="gradient-text">PDF Tools</span>
        </Link>
        <nav className="hidden md:flex gap-1">
          {tools.map(t => (
            <Link
              key={t.path}
              to={t.path}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
