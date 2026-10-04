import PDFToolLayout from '../components/Layout/PDFToolLayout'

export default function Acerca() {
  return (
    <PDFToolLayout
      title="Acerca de — PDF Tools"
      description="Conoce PDF Tools: herramientas PDF gratuitas, open source, 100% en tu navegador."
      keyword="acerca de pdf tools"
    >
      <div className="prose-spatial max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Acerca de PDF Tools
        </h1>

        <section className="mb-8">
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools es un conjunto de herramientas gratuitas para trabajar con archivos PDF,
            directamente en tu navegador. Sin subidas a servidores, sin registros, sin limites.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Nuestra mision
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Hacer que el trabajo con PDFs sea accesible para todos, sin necesidad de software costoso
            o servicios que comprometan la privacidad de tus documentos. Todo ocurre en tu navegador,
            y tus archivos nunca salen de tu dispositivo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Herramientas disponibles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'Editar PDF', desc: 'Anadir texto, imagenes, dibujo y firmas' },
              { name: 'Separar PDF', desc: 'Extraer paginas especificas' },
              { name: 'Unir PDFs', desc: 'Combinar multiples archivos' },
              { name: 'Rotar PDF', desc: 'Girar paginas 90, 180 o 270 grados' },
              { name: 'Eliminar paginas', desc: 'Borrar paginas no deseadas' },
              { name: 'Comprimir PDF', desc: 'Reducir tamano de archivo' },
              { name: 'Word a PDF', desc: 'Convertir documentos Word' },
              { name: 'PDF a Word', desc: 'Convertir PDF a documento editable' },
              { name: 'Insertar imagenes', desc: 'Anadir imagenes a un PDF' },
              { name: 'OCR', desc: 'Extraer texto de PDFs escaneados' },
            ].map(tool => (
              <div
                key={tool.name}
                className="spatial-card-static px-4 py-3"
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tool.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Tecnologia
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools esta construido con tecnologias modernas de codigo abierto:
          </p>
          <ul className="text-sm leading-relaxed list-disc pl-6" style={{ color: 'var(--text-secondary)' }}>
            <li><strong>React</strong> + <strong>Vite</strong> — interfaz rapida y moderna</li>
            <li><strong>PDF.js</strong> — renderizado y lectura de PDFs (Mozilla)</li>
            <li><strong>pdf-lib</strong> — creacion y edicion de PDFs</li>
            <li><strong>Tesseract.js</strong> — reconocimiento de texto (OCR)</li>
            <li><strong>docx</strong> — generacion de documentos Word</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Codigo abierto
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            El codigo fuente de PDF Tools esta disponible en GitHub. Si quieres contribuir o reportar
            un problema, visita nuestro repositorio.
          </p>
        </section>
      </div>
    </PDFToolLayout>
  )
}
