import PDFToolLayout from '../components/Layout/PDFToolLayout'

export default function Contacto() {
  return (
    <PDFToolLayout
      title="Contacto — PDF Tools"
      description="Contacta al equipo de PDF Tools para soporte, sugerencias o reportar problemas."
      keyword="contacto"
    >
      <div className="prose-spatial max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Contacto
        </h1>

        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
          Tienes alguna pregunta, sugerencia o reporte de problema? Haznos saber.
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Opciones de contacto
          </h2>
          <div className="space-y-3">
            <div className="spatial-card-static px-5 py-4">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                GitHub Issues
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Para reportar bugs o solicitar funciones
              </p>
              <a
                href="https://github.com/alan-mccurdy/pdf-tools/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
                style={{ color: 'var(--accent)' }}
              >
                Abrir un issue en GitHub
              </a>
            </div>

            <div className="spatial-card-static px-5 py-4">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Email
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Para consultas generales y privacidad
              </p>
              <a
                href="mailto:alan.mccurdy@outlook.com"
                className="text-sm underline"
                style={{ color: 'var(--accent)' }}
              >
                alan.mccurdy@outlook.com
              </a>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Que podemos ayudarte?
          </h2>
          <ul className="text-sm leading-relaxed list-disc pl-6" style={{ color: 'var(--text-secondary)' }}>
            <li>Reportar un error en alguna herramienta</li>
            <li>Sugerir una nueva funcion o mejora</li>
            <li>Preguntas sobre privacidad y seguridad</li>
            <li>Consultas sobre uso comercial</li>
            <li>Contribuir al codigo abierto</li>
          </ul>
        </section>
      </div>
    </PDFToolLayout>
  )
}
