/**
 * JSON-LD Structured Data for PDF Tools
 * Provides Schema.org markup for better SEO
 * Zero dependencies - pure TypeScript/JS
 */

const BASE_URL = 'https://alan-mccurdy.github.io/pdf-tools'
const ORG_NAME = 'PDF Tools'
const ORG_URL = BASE_URL

/**
 * SoftwareApplication schema for the main app and tool pages
 */
export function softwareApplicationSchema(overrides: Partial<Record<string, unknown>> = {}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PDF Tools',
    url: BASE_URL,
    description: 'Editor PDF online gratis: edita, une, separa, rota, comprime y convierte PDFs sin subir archivos.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and modern browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'Editar PDF',
      'Unir PDFs',
      'Word a PDF',
      'PDF a Word',
      'Separar PDF',
      'Rotar PDF',
      'Comprimir PDF',
      'Eliminar páginas',
      'Insertar imágenes',
      'OCR PDF',
    ],
    author: {
      '@type': 'Person',
      name: 'Alan García Pérez',
      url: 'https://github.com/alan-mccurdy',
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: ORG_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
      },
    },
    datePublished: '2024-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    inLanguage: 'es-ES',
    isAccessibleForFree: true,
  }

  return { ...base, ...overrides }
}

/**
 * WebApplication schema for individual tool pages
 */
export function webApplicationSchema(toolName: string, toolDescription: string, toolPath: string, features: string[] = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: toolName,
    description: toolDescription,
    url: `${BASE_URL}${toolPath}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requiere JavaScript y navegador moderno',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: features,
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: ORG_URL,
    },
    inLanguage: 'es-ES',
    isAccessibleForFree: true,
    dateModified: new Date().toISOString().split('T')[0],
  }
}

/**
 * HowTo schema for tool pages with step-by-step instructions
 */
export function howToSchema(name: string, description: string, steps: Array<{ name: string; text: string; url?: string; image?: string }>, toolPath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    url: `${BASE_URL}${toolPath}`,
    totalTime: 'PT2M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    supply: [
      {
        '@type': 'HowToSupply',
        name: 'Archivo PDF',
      },
      {
        '@type': 'HowToSupply',
        name: 'Navegador web moderno',
      },
    ],
    tool: [
      {
        '@type': 'HowToTool',
        name: 'PDF Tools',
        url: BASE_URL,
      },
    ],
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url && { url: step.url }),
      ...(step.image && { image: step.image }),
    })),
  }
}

/**
 * FAQPage schema for common questions
 */
export function faqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * BreadcrumbList schema
 */
export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * WebSite schema with SearchAction for site search
 */
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PDF Tools',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: ORG_URL,
    },
    inLanguage: 'es-ES',
  }
}

/**
 * Organization schema
 */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: ORG_URL,
    logo: `${BASE_URL}/og-image.png`,
    sameAs: [
      'https://github.com/alan-mccurdy/pdf-tools',
      'https://github.com/alan-mccurdy',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['Spanish', 'English'],
      url: `${BASE_URL}/contacto`,
    },
  }
}

/**
 * React component to render JSON-LD script tags
 */
export function StructuredData({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const schemas = Array.isArray(data) ? data : [data]
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}

/**
 * Pre-defined schemas for each tool page
 */
export const toolSchemas = {
  'editar-pdf': {
    webApp: webApplicationSchema(
      'Editar PDF Online',
      'Escribe texto, añade imágenes, firma y anota PDFs gratis. Editor completo en tu navegador.',
      '/editar-pdf',
      ['Añadir texto', 'Insertar imágenes', 'Firmar PDF', 'Anotar', 'Rellenar formularios', 'OCR integrado']
    ),
    howTo: howToSchema(
      'Cómo editar un PDF online gratis',
      'Aprende a editar cualquier PDF sin instalar software: añade texto, imágenes, firma y más.',
      [
        { name: 'Subir PDF', text: 'Arrastra tu archivo PDF al área de carga o haz clic para seleccionarlo.', url: `${BASE_URL}/editar-pdf` },
        { name: 'Añadir texto', text: 'Haz clic en cualquier parte del PDF y empieza a escribir. Cambia fuente, tamaño, color y alineación.', url: `${BASE_URL}/editar-pdf` },
        { name: 'Insertar imágenes', text: 'Añade tu firma, logos o sellos desde la barra de herramientas.', url: `${BASE_URL}/editar-pdf` },
        { name: 'Descargar', text: 'Guarda el PDF editado en tu dispositivo. El archivo original nunca se sube a servidores.', url: `${BASE_URL}/editar-pdf` },
      ],
      '/editar-pdf'
    ),
    faq: faqSchema([
      { question: '¿Es gratis editar PDFs?', answer: 'Sí, PDF Tools es 100% gratis. Sin límites de archivos, sin marca de agua, sin registro.' },
      { question: '¿Mis archivos se suben a un servidor?', answer: 'No. Todo el procesamiento ocurre en tu navegador (client-side). Tus archivos nunca salen de tu dispositivo.' },
      { question: '¿Puedo editar PDFs escaneados?', answer: 'Sí, usa la herramienta OCR para convertir PDFs escaneados a texto editable antes de editarlos.' },
      { question: '¿Funciona en móviles?', answer: 'Sí, la interfaz es totalmente responsive y funciona en iOS, Android y tablets.' },
    ]),
  },
  'unir-pdf': {
    webApp: webApplicationSchema(
      'Unir PDFs Online',
      'Combina múltiples archivos PDF en uno solo. Reordena páginas y descarga gratis.',
      '/unir-pdf',
      ['Combinar múltiples PDFs', 'Reordenar páginas', 'Vista previa de páginas', 'Descarga inmediata']
    ),
    howTo: howToSchema(
      'Cómo unir PDFs online gratis',
      'Combina varios archivos PDF en uno solo en segundos. Sin instalar nada, gratis y privado.',
      [
        { name: 'Subir PDFs', text: 'Selecciona múltiples archivos PDF o arrástralos al área de carga.', url: `${BASE_URL}/unir-pdf` },
        { name: 'Reordenar', text: 'Arrastra y suelta los archivos para cambiar el orden. Usa las flechas para mover páginas.', url: `${BASE_URL}/unir-pdf` },
        { name: 'Unir y descargar', text: 'Haz clic en "Unir y descargar". El PDF combinado se genera en tu navegador.', url: `${BASE_URL}/unir-pdf` },
      ],
      '/unir-pdf'
    ),
    faq: faqSchema([
      { question: '¿Cuántos PDFs puedo unir a la vez?', answer: 'No hay límite estricto, pero recomendamos hasta 50 archivos para mejor rendimiento.' },
      { question: '¿Se pierde calidad al unir?', answer: 'No, la unión mantiene la calidad original de cada página.' },
      { question: '¿Puedo reordenar páginas individuales?', answer: 'La herramienta une archivos completos. Para reordenar páginas individuales, usa "Editar PDF" después de unir.' },
    ]),
  },
  'comprimir-pdf': {
    webApp: webApplicationSchema(
      'Comprimir PDF Online',
      'Reduce el tamaño de tus PDFs manteniendo la calidad. Múltiples presets.',
      '/comprimir-pdf',
      ['Compresión sin pérdida', 'Presets: Pantalla, E-book, Impresora', 'Vista previa de tamaño', 'Eliminación de metadatos']
    ),
    howTo: howToSchema(
      'Cómo comprimir un PDF online',
      'Reduce el tamaño de archivo de tus PDFs gratis. Elige el nivel de compresión que necesitas.',
      [
        { name: 'Subir PDF', text: 'Arrastra tu archivo PDF o selecciónalo desde tu dispositivo.', url: `${BASE_URL}/comprimir-pdf` },
        { name: 'Elegir preset', text: 'Selecciona: Pantalla (máxima compresión), E-book (equilibrado), Impresora (alta calidad).', url: `${BASE_URL}/comprimir-pdf` },
        { name: 'Comprimir y descargar', text: 'El PDF comprimido se genera localmente. Verás el ahorro de tamaño antes de descargar.', url: `${BASE_URL}/comprimir-pdf` },
      ],
      '/comprimir-pdf'
    ),
    faq: faqSchema([
      { question: '¿Cuánto se reduce el tamaño?', answer: 'Depende del contenido. PDFs con imágenes se comprimen 50-90%. PDFs solo texto, 10-30%.' },
      { question: '¿Se pierde calidad visual?', answer: 'El preset "Pantalla" reduce calidad de imágenes. "Impresora" mantiene alta calidad visual.' },
      { question: '¿Se eliminan los metadatos?', answer: 'En presets Pantalla y E-book se eliminan metadatos (autor, título, etc.) para ahorrar espacio.' },
    ]),
  },
  'ocr-pdf': {
    webApp: webApplicationSchema(
      'OCR PDF - Extraer Texto',
      'Convierte PDFs escaneados a texto editable con OCR. Español + Inglés.',
      '/ocr-pdf',
      ['OCR español + inglés', 'PDFs escaneados a texto', 'Mantiene layout', 'Descarga como .txt o PDF con capa de texto']
    ),
    howTo: howToSchema(
      'Cómo hacer OCR a un PDF gratis',
      'Convierte imágenes y PDFs escaneados a texto editable con reconocimiento óptico de caracteres.',
      [
        { name: 'Subir PDF escaneado', text: 'Selecciona tu PDF escaneado o imagen (JPG, PNG).', url: `${BASE_URL}/ocr-pdf` },
        { name: 'Procesar OCR', text: 'El sistema reconoce el texto automáticamente (soporte español e inglés).', url: `${BASE_URL}/ocr-pdf` },
        { name: 'Descargar resultado', text: 'Descarga el texto como .txt o un PDF con capa de texto seleccionable.', url: `${BASE_URL}/ocr-pdf` },
      ],
      '/ocr-pdf'
    ),
    faq: faqSchema([
      { question: '¿Qué idiomas soporta?', answer: 'Español e inglés principalmente. Otros idiomas pueden funcionar con precisión variable.' },
      { question: '¿Funciona con PDFs de varias páginas?', answer: 'Sí, procesa todas las páginas del documento automáticamente.' },
      { question: '¿Qué precisión tiene?', answer: '90-98% en documentos limpios. Escaneados borrosos o manuscritos pueden tener menor precisión.' },
    ]),
  },
  'word-a-pdf': {
    webApp: webApplicationSchema(
      'Convertir Word a PDF',
      'Convierte documentos .docx a PDF gratis. Mantiene el formato original.',
      '/word-a-pdf',
      ['Conversión .docx a PDF', 'Mantiene formato', 'Múltiples archivos', 'Sin marca de agua']
    ),
    howTo: howToSchema(
      'Cómo convertir Word a PDF gratis',
      'Convierte tus documentos Word a PDF manteniendo el formato perfecto.',
      [
        { name: 'Subir .docx', text: 'Arrastra tu archivo Word o selecciónalo.', url: `${BASE_URL}/word-a-pdf` },
        { name: 'Convertir', text: 'La conversión es automática y mantiene fuentes, imágenes y layout.', url: `${BASE_URL}/word-a-pdf` },
        { name: 'Descargar PDF', text: 'Tu PDF listo para compartir o imprimir.', url: `${BASE_URL}/word-a-pdf` },
      ],
      '/word-a-pdf'
    ),
    faq: faqSchema([
      { question: '¿Soporta .doc (Word antiguo)?', answer: 'Actualmente solo .docx. Para .doc, ábrelo en Word y guárdalo como .docx primero.' },
      { question: '¿Se mantienen las fuentes?', answer: 'Sí, las fuentes se incrustan en el PDF para que se vea igual en cualquier dispositivo.' },
      { question: '¿Hay límite de tamaño?', answer: 'No hay límite estricto, pero archivos muy grandes (>100MB) pueden tardar más.' },
    ]),
  },
  'pdf-a-word': {
    webApp: webApplicationSchema(
      'Convertir PDF a Word',
      'Convierte PDF a .docx editable gratis. Extrae texto y estructura.',
      '/pdf-a-word',
      ['Conversión PDF a .docx', 'Texto editable', 'Mantiene estructura', 'Tablas y listas']
    ),
    howTo: howToSchema(
      'Cómo convertir PDF a Word gratis',
      'Convierte tus PDFs a documentos Word editables para seguir trabajando.',
      [
        { name: 'Subir PDF', text: 'Selecciona tu archivo PDF.', url: `${BASE_URL}/pdf-a-word` },
        { name: 'Convertir', text: 'Extrae texto, párrafos, tablas y listas a formato .docx.', url: `${BASE_URL}/pdf-a-word` },
        { name: 'Descargar .docx', text: 'Abre el resultado en Word, LibreOffice o Google Docs.', url: `${BASE_URL}/pdf-a-word` },
      ],
      '/pdf-a-word'
    ),
    faq: faqSchema([
      { question: '¿Funciona con PDFs escaneados?', answer: 'No directamente. Usa primero la herramienta OCR, luego convierte el resultado a Word.' },
      { question: '¿Se mantienen las tablas?', answer: 'Las tablas simples se convierten bien. Tablas complejas pueden requerir ajustes manuales.' },
      { question: '¿Las fuentes se conservan?', answer: 'El texto se convierte a fuentes estándar (Arial, Times). Fuentes especiales se sustituyen.' },
    ]),
  },
  'separar-pdf': {
    webApp: webApplicationSchema(
      'Separar PDF Online',
      'Extrae páginas de un PDF y guárdalas como archivos separados. Gratis y rápido.',
      '/separar-pdf',
      ['Extraer páginas sueltas', 'Dividir por rangos', 'Múltiples archivos de salida', 'Vista previa de páginas']
    ),
    howTo: howToSchema(
      'Cómo separar páginas de un PDF',
      'Extrae páginas específicas o divide un PDF en múltiples archivos.',
      [
        { name: 'Subir PDF', text: 'Selecciona el PDF del que quieres extraer páginas.', url: `${BASE_URL}/separar-pdf` },
        { name: 'Seleccionar páginas', text: 'Elige páginas individuales o rangos (ej: 1-3, 5, 7-10).', url: `${BASE_URL}/separar-pdf` },
        { name: 'Separar y descargar', text: 'Cada selección genera un PDF independiente. Descarga todo en ZIP.', url: `${BASE_URL}/separar-pdf` },
      ],
      '/separar-pdf'
    ),
    faq: faqSchema([
      { question: '¿Puedo extraer páginas no consecutivas?', answer: 'Sí, selecciona las páginas que quieras (ej: 1, 3, 5) y se generará un PDF con esas páginas.' },
      { question: '¿Se pueden dividir en varios PDFs a la vez?', answer: 'Sí, define múltiples rangos y cada uno genera un archivo separado.' },
    ]),
  },
  'rotar-pdf': {
    webApp: webApplicationSchema(
      'Rotar PDF Online',
      'Rota páginas de PDF 90°, 180° o 270°. Gratis y sin instalar nada.',
      '/rotar-pdf',
      ['Rotar 90°, 180°, 270°', 'Rotar páginas individuales', 'Rotar todo el documento', 'Vista previa']
    ),
    howTo: howToSchema(
      'Cómo rotar un PDF online',
      'Corrige la orientación de tus PDFs girando páginas individuales o todo el documento.',
      [
        { name: 'Subir PDF', text: 'Selecciona tu archivo PDF.', url: `${BASE_URL}/rotar-pdf` },
        { name: 'Elegir rotación', text: 'Selecciona páginas y ángulo: 90° (derecha), 180° (invertido), 270° (izquierda).', url: `${BASE_URL}/rotar-pdf` },
        { name: 'Aplicar y descargar', text: 'El PDF rotado se genera al instante.', url: `${BASE_URL}/rotar-pdf` },
      ],
      '/rotar-pdf'
    ),
    faq: faqSchema([
      { question: '¿Puedo rotar solo algunas páginas?', answer: 'Sí, selecciona las páginas específicas que quieres rotar.' },
      { question: '¿La rotación es permanente?', answer: 'Sí, el PDF descargado tiene las páginas rotadas permanentemente.' },
    ]),
  },
  'eliminar-paginas': {
    webApp: webApplicationSchema(
      'Eliminar Páginas de PDF',
      'Borra páginas de un PDF online gratis. Selecciona y elimina lo que no necesitas.',
      '/eliminar-paginas',
      ['Eliminar páginas individuales', 'Eliminar rangos', 'Vista previa antes de borrar', 'Descarga inmediata']
    ),
    howTo: howToSchema(
      'Cómo eliminar páginas de un PDF',
      'Quita páginas innecesarias de tus PDFs gratis y sin instalar software.',
      [
        { name: 'Subir PDF', text: 'Arrastra tu PDF al área de carga.', url: `${BASE_URL}/eliminar-paginas` },
        { name: 'Seleccionar páginas a borrar', text: 'Marca las páginas que quieres eliminar. Verás vista previa en miniatura.', url: `${BASE_URL}/eliminar-paginas` },
        { name: 'Eliminar y descargar', text: 'Genera el PDF sin las páginas seleccionadas.', url: `${BASE_URL}/eliminar-paginas` },
      ],
      '/eliminar-paginas'
    ),
    faq: faqSchema([
      { question: '¿Puedo deshacer la eliminación?', answer: 'Sí, antes de descargar puedes deseleccionar páginas. Una vez descargado, el original no se modifica.' },
      { question: '¿Hay límite de páginas a eliminar?', answer: 'No, puedes eliminar tantas páginas como necesites (excepto todas, necesitas al menos 1 página).' },
    ]),
  },
  'insertar-imagenes': {
    webApp: webApplicationSchema(
      'Insertar Imágenes en PDF',
      'Añade imágenes, firmas o sellos a tus PDFs. Editor visual gratuito.',
      '/insertar-imagenes',
      ['Insertar imágenes/JPG/PNG', 'Añadir firmas digitales', 'Redimensionar y posicionar', 'Múltiples imágenes por página']
    ),
    howTo: howToSchema(
      'Cómo insertar imágenes en un PDF',
      'Añade fotos, firmas, logos o sellos a cualquier página de tu PDF.',
      [
        { name: 'Subir PDF', text: 'Selecciona tu archivo PDF base.', url: `${BASE_URL}/insertar-imagenes` },
        { name: 'Añadir imagen', text: 'Sube tu imagen (JPG, PNG, SVG). Arrastra para posicionar, esquinas para redimensionar.', url: `${BASE_URL}/insertar-imagenes` },
        { name: 'Descargar', text: 'El PDF con las imágenes insertadas se genera localmente.', url: `${BASE_URL}/insertar-imagenes` },
      ],
      '/insertar-imagenes'
    ),
    faq: faqSchema([
      { question: '¿Qué formatos de imagen soporta?', answer: 'JPG, PNG, SVG, WebP. Las imágenes se incrustan manteniendo su calidad.' },
      { question: '¿Puedo poner una firma manuscrita?', answer: 'Sí, firma en papel, escanéala/fotografíala e insértala como imagen. O usa "Editar PDF" para dibujar la firma directamente.' },
      { question: '¿Puedo poner la misma imagen en varias páginas?', answer: 'Sí, inserta la imagen en cada página que necesites.' },
    ]),
  },
}

/**
 * Get all schemas for a specific tool path
 */
export function getToolSchemas(toolPath: string) {
  const key = toolPath.replace('/', '')
  return toolSchemas[key as keyof typeof toolSchemas] || null
}

/**
 * Home page schemas
 */
export const homeSchemas = {
  softwareApp: softwareApplicationSchema(),
  webSite: webSiteSchema(),
  organization: organizationSchema(),
  faq: faqSchema([
    { question: '¿Qué es PDF Tools?', answer: 'Un conjunto de 10 herramientas PDF gratuitas que funcionan 100% en tu navegador. Sin subir archivos, sin registro, sin límites.' },
    { question: '¿Es seguro usar PDF Tools?', answer: 'Sí. Todo el procesamiento ocurre localmente en tu navegador (client-side). Tus archivos nunca se envían a servidores externos.' },
    { question: '¿Necesito crear una cuenta?', answer: 'No. PDF Tools es completamente gratis y sin registro. Entra, usa las herramientas y descarga tus archivos.' },
    { question: '¿Funciona sin internet?', answer: 'La carga inicial requiere internet. Una vez cargado, las herramientas funcionan offline (excepto OCR que descarga modelos la primera vez).' },
    { question: '¿Puedo usar PDF Tools comercialmente?', answer: 'Sí, es software open-source bajo licencia MIT. Úsalo libremente en proyectos personales o comerciales.' },
    { question: '¿Cómo reporto un bug?', answer: 'Ve a la página de Contacto o abre un issue en GitHub: github.com/alan-mccurdy/pdf-tools/issues' },
  ]),
}

/**
 * Generic page schemas (privacy, terms, about, contact)
 */
export function genericPageSchema(title: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: `${BASE_URL}${path}`,
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: ORG_URL,
    },
    inLanguage: 'es-ES',
    dateModified: new Date().toISOString().split('T')[0],
  }
}