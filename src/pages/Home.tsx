import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const tools = [
  { path: '/editar-pdf', name: 'Editar PDF', desc: 'Escribe texto sobre paginas PDF', icon: '✏️' },
  { path: '/unir-pdf', name: 'Unir PDFs', desc: 'Combina multiples PDFs en uno', icon: '🔗' },
  { path: '/word-a-pdf', name: 'Word a PDF', desc: 'Convierte .docx a PDF', icon: '📄' },
  { path: '/separar-pdf', name: 'Separar PDF', desc: 'Extrae paginas de un PDF', icon: '✂️' },
  { path: '/rotar-pdf', name: 'Rotar PDF', desc: 'Rota paginas 90/180/270 grados', icon: '🔄' },
  { path: '/comprimir-pdf', name: 'Comprimir PDF', desc: 'Reduce el tamano de tu PDF', icon: '📦' },
  { path: '/eliminar-paginas', name: 'Eliminar Paginas', desc: 'Borra paginas de un PDF', icon: '🗑️' },
  { path: '/insertar-imagenes', name: 'Insertar Imagenes', desc: 'Agrega imagenes o firmas', icon: '🖼️' },
]

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Editor PDF Online Gratis — PDF Tools</title>
        <meta name="description" content="Herramientas PDF gratis: editar, unir, separar, rotar, comprimir y mas. 100% en tu navegador, sin subir archivos." />
      </Helmet>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Editor PDF Online Gratis</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Herramientas PDF 100% gratis. Tus archivos nunca salen de tu navegador.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map(tool => (
          <Link
            key={tool.path}
            to={tool.path}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 hover:bg-gray-800 transition group"
          >
            <div className="text-3xl mb-3">{tool.icon}</div>
            <h2 className="text-lg font-semibold group-hover:text-blue-400 transition">{tool.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{tool.desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
