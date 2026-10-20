import type { ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import AdSlot from '../Ads/AdSlot'
import { StructuredData, getToolSchemas, genericPageSchema, breadcrumbSchema } from '../../utils/structuredData'

interface PDFToolLayoutProps {
  title: string
  description: string
  keyword: string
  children: ReactNode
  // Optional: custom structured data for special pages
  customStructuredData?: Record<string, unknown> | Record<string, unknown>[]
}

const BASE_URL = 'https://alan-mccurdy.github.io/pdf-tools'

// Breadcrumb configuration per route
const breadcrumbMap: Record<string, Array<{ name: string; path: string }>> = {
  '/editar-pdf': [{ name: 'Editar PDF', path: '/editar-pdf' }],
  '/unir-pdf': [{ name: 'Unir PDFs', path: '/unir-pdf' }],
  '/word-a-pdf': [{ name: 'Word a PDF', path: '/word-a-pdf' }],
  '/pdf-a-word': [{ name: 'PDF a Word', path: '/pdf-a-word' }],
  '/separar-pdf': [{ name: 'Separar PDF', path: '/separar-pdf' }],
  '/rotar-pdf': [{ name: 'Rotar PDF', path: '/rotar-pdf' }],
  '/comprimir-pdf': [{ name: 'Comprimir PDF', path: '/comprimir-pdf' }],
  '/eliminar-paginas': [{ name: 'Eliminar Páginas', path: '/eliminar-paginas' }],
  '/insertar-imagenes': [{ name: 'Insertar Imágenes', path: '/insertar-imagenes' }],
  '/ocr-pdf': [{ name: 'OCR PDF', path: '/ocr-pdf' }],
  '/privacidad': [{ name: 'Privacidad', path: '/privacidad' }],
  '/terminos': [{ name: 'Términos', path: '/terminos' }],
  '/acerca': [{ name: 'Acerca', path: '/acerca' }],
  '/contacto': [{ name: 'Contacto', path: '/contacto' }],
}

function Breadcrumb() {
  const location = useLocation()
  const path = location.pathname.replace('/pdf-tools', '') || '/'
  const items = breadcrumbMap[path]

  if (!items || items.length === 0) return null

  const breadcrumbItems = [
    { name: 'Inicio', url: `${BASE_URL}/` },
    ...items.map(item => ({ name: item.name, url: `${BASE_URL}${item.path}` })),
  ]

  const schema = breadcrumbSchema(breadcrumbItems)

  return (
    <>
      <StructuredData data={schema} />
      <nav className="mb-6" aria-label="Breadcrumb" style={{ fontSize: '0.875rem' }}>
        <ol className="flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
          <li className="flex items-center gap-2">
            <a href="/" className="hover:underline transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Inicio
            </a>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          {items.map((item, index) => (
            <li key={item.path} className="flex items-center gap-2">
              {index === items.length - 1 ? (
                <span aria-current="page" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              ) : (
                <>
                  <a href={item.path} className="hover:underline transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    {item.name}
                  </a>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

function getCanonicalUrl(path: string): string {
  const cleanPath = path.replace('/pdf-tools', '') || '/'
  return `${BASE_URL}${cleanPath}`
}

function getOgImage(): string {
  // Could have per-page OG images in the future
  return `${BASE_URL}/og-image.png`
}

export default function PDFToolLayout({
  title,
  description,
  keyword,
  children,
  customStructuredData,
}: PDFToolLayoutProps) {
  const location = useLocation()
  const path = location.pathname.replace('/pdf-tools', '') || '/'
  const canonicalUrl = getCanonicalUrl(path)
  const ogImage = getOgImage()

  // Get structured data for this tool
  const toolSchemas = getToolSchemas(path)
  const pageSchema = toolSchemas
    ? [toolSchemas.webApp, toolSchemas.howTo, toolSchemas.faq]
    : [genericPageSchema(title, description, path)]

  // Combine with custom structured data if provided
  const allSchemas = customStructuredData
    ? [...pageSchema, ...(Array.isArray(customStructuredData) ? customStructuredData : [customStructuredData])]
    : pageSchema

  return (
    <>
      <Helmet>
        <title>{title} — PDF Tools Gratis</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PDF Tools" />
        <meta property="og:locale" content="es_ES" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* Additional SEO meta */}
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content="#08080d" />
      </Helmet>

      {/* JSON-LD Structured Data */}
      <StructuredData data={allSchemas} />

      {/* Breadcrumb Navigation */}
      <Breadcrumb />

      {/* Top Ad Slot */}
      <AdSlot position="top" className="mb-6" />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <header className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{keyword}</h1>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>
          </header>
          <div className="spatial-card-static p-6">
            {children}
          </div>
        </div>
        <aside className="w-full lg:w-80 shrink-0">
          <AdSlot position="sidebar" />
        </aside>
      </div>

      {/* Bottom Ad Slot */}
      <AdSlot position="bottom" className="mt-8" />
    </>
  )
}