import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const tools = [
  { path: '/editar-pdf', name: 'Editar PDF', desc: 'Escribe texto sobre paginas PDF', icon: 'edit' },
  { path: '/unir-pdf', name: 'Unir PDFs', desc: 'Combina multiples PDFs en uno', icon: 'merge' },
  { path: '/word-a-pdf', name: 'Word a PDF', desc: 'Convierte .docx a PDF', icon: 'convert' },
  { path: '/separar-pdf', name: 'Separar PDF', desc: 'Extrae paginas de un PDF', icon: 'split' },
  { path: '/rotar-pdf', name: 'Rotar PDF', desc: 'Rota paginas 90/180/270 grados', icon: 'rotate' },
  { path: '/comprimir-pdf', name: 'Comprimir PDF', desc: 'Reduce el tamano de tu PDF', icon: 'compress' },
  { path: '/eliminar-paginas', name: 'Eliminar Paginas', desc: 'Borra paginas de un PDF', icon: 'delete' },
  { path: '/insertar-imagenes', name: 'Insertar Imagenes', desc: 'Agrega imagenes o firmas', icon: 'image' },
]

function ToolIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    edit: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    merge: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    convert: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    split: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    rotate: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    compress: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    delete: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    image: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  }
  return icons[icon] || null
}

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Editor PDF Online Gratis — PDF Tools</title>
        <meta name="description" content="Herramientas PDF gratis: editar, unir, separar, rotar, comprimir y mas. 100% en tu navegador, sin subir archivos." />
      </Helmet>

      <div className="text-center mb-12 fade-in">
        <h1 className="text-5xl font-bold mb-4">
          <span className="gradient-text">Editor PDF Online Gratis</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Herramientas PDF 100% gratis. Tus archivos nunca salen de tu navegador.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((tool, i) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="glass-card p-6 group fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-all duration-300">
              <ToolIcon icon={tool.icon} />
            </div>
            <h2 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">{tool.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{tool.desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
