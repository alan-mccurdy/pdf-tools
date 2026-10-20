#!/usr/bin/env node
/**
 * Dynamic Sitemap Generator for PDF Tools
 * Runs at build time to generate sitemap.xml with all routes
 * Zero dependencies - uses only Node.js built-ins
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = 'https://alan-mccurdy.github.io/pdf-tools'
const OUTPUT_PATH = resolve('public/sitemap.xml')

// All routes in the application with their SEO metadata
const routes = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: 1.0,
    title: 'Editor PDF Online Gratis',
    description: 'Herramientas PDF gratis: editar, unir, separar, rotar, comprimir y más. 100% en tu navegador, sin subir archivos.',
  },
  {
    path: '/editar-pdf',
    changefreq: 'monthly',
    priority: 0.9,
    title: 'Editar PDF Online',
    description: 'Escribe texto, añade imágenes, firma y anota PDFs gratis. Editor completo en tu navegador.',
  },
  {
    path: '/unir-pdf',
    changefreq: 'monthly',
    priority: 0.9,
    title: 'Unir PDFs Online',
    description: 'Combina múltiples archivos PDF en uno solo. Reordena páginas y descarga gratis.',
  },
  {
    path: '/word-a-pdf',
    changefreq: 'monthly',
    priority: 0.8,
    title: 'Convertir Word a PDF',
    description: 'Convierte documentos .docx a PDF gratis. Mantiene el formato original.',
  },
  {
    path: '/pdf-a-word',
    changefreq: 'monthly',
    priority: 0.8,
    title: 'Convertir PDF a Word',
    description: 'Convierte PDF a .docx editable gratis. Extrae texto y estructura.',
  },
  {
    path: '/separar-pdf',
    changefreq: 'monthly',
    priority: 0.8,
    title: 'Separar PDF Online',
    description: 'Extrae páginas de un PDF y guárdalas como archivos separados. Gratis y rápido.',
  },
  {
    path: '/rotar-pdf',
    changefreq: 'monthly',
    priority: 0.8,
    title: 'Rotar PDF Online',
    description: 'Rota páginas de PDF 90°, 180° o 270°. Gratis y sin instalar nada.',
  },
  {
    path: '/comprimir-pdf',
    changefreq: 'monthly',
    priority: 0.9,
    title: 'Comprimir PDF Online',
    description: 'Reduce el tamaño de tus PDFs manteniendo la calidad. Múltiples presets.',
  },
  {
    path: '/eliminar-paginas',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Eliminar Páginas de PDF',
    description: 'Borra páginas de un PDF online gratis. Selecciona y elimina lo que no necesitas.',
  },
  {
    path: '/insertar-imagenes',
    changefreq: 'monthly',
    priority: 0.7,
    title: 'Insertar Imágenes en PDF',
    description: 'Añade imágenes, firmas o sellos a tus PDFs. Editor visual gratuito.',
  },
  {
    path: '/ocr-pdf',
    changefreq: 'monthly',
    priority: 0.8,
    title: 'OCR PDF - Extraer Texto',
    description: 'Convierte PDFs escaneados a texto editable con OCR. Español + Inglés.',
  },
  {
    path: '/privacidad',
    changefreq: 'yearly',
    priority: 0.3,
    title: 'Política de Privacidad',
    description: 'Cómo protegemos tus datos. Los archivos nunca salen de tu dispositivo.',
  },
  {
    path: '/terminos',
    changefreq: 'yearly',
    priority: 0.3,
    title: 'Términos de Uso',
    description: 'Condiciones de uso de PDF Tools. Servicio gratuito sin garantías.',
  },
  {
    path: '/acerca',
    changefreq: 'monthly',
    priority: 0.5,
    title: 'Acerca de PDF Tools',
    description: 'Proyecto open-source de herramientas PDF gratuitas. Hecho con React + pdf-lib.',
  },
  {
    path: '/contacto',
    changefreq: 'monthly',
    priority: 0.5,
    title: 'Contacto',
    description: 'Reporta bugs, sugiere funciones o colabora en GitHub.',
  },
]

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0]

  const urlEntries = routes.map(route => {
    const url = `${BASE_URL}${route.path}`
    return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`
  }).join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`

  writeFileSync(OUTPUT_PATH, sitemap)
  console.log(`✅ Sitemap generated at ${OUTPUT_PATH}`)
  console.log(`📊 ${routes.length} URLs included`)
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;')
}

// Also generate robots.txt dynamically
function generateRobots() {
  const robots = `User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml

# Crawl-delay for respectful crawling
Crawl-delay: 10

# Disallow admin/private paths (none in this SPA)
# Disallow: /admin/
# Disallow: /api/
`

  writeFileSync(resolve('public/robots.txt'), robots)
  console.log('✅ robots.txt generated')
}

// Generate JSON-LD structured data for each page (optional - for reference)
function generateStructuredData() {
  const structuredData = routes.map(route => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.title,
    description: route.description,
    url: `${BASE_URL}${route.path}`,
    potentialAction: route.path !== '/' && route.path !== '/privacidad' && route.path !== '/terminos' && route.path !== '/acerca' && route.path !== '/contacto' ? {
      '@type': 'UseAction',
      target: `${BASE_URL}${route.path}`,
      name: route.title,
    } : undefined,
  }))

  writeFileSync(
    resolve('public/structured-data.json'),
    JSON.stringify(structuredData, null, 2)
  )
  console.log('✅ Structured data reference generated')
}

// Run generation
generateSitemap()
generateRobots()
generateStructuredData()
console.log('\n🎉 All SEO files generated successfully!')