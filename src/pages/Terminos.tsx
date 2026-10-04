import PDFToolLayout from '../components/Layout/PDFToolLayout'

export default function Terminos() {
  return (
    <PDFToolLayout
      title="Terminos de Servicio — PDF Tools"
      description="Terminos y condiciones de uso de PDF Tools."
      keyword="terminos de servicio"
    >
      <div className="prose-spatial max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Terminos de Servicio
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Ultima actualizacion: 18 de septiembre de 2026
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            1. Aceptacion de los terminos
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Al acceder y utilizar PDF Tools, aceptas estos Terminos de Servicio. Si no estas de acuerdo
            con alguno de estos terminos, no utilices el servicio.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            2. Descripcion del servicio
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools es un conjunto de herramientas gratuitas para manipular archivos PDF.
            Todas las operaciones se realizan localmente en tu navegador web. No se requiere
            registro ni cuenta para utilizar el servicio.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            3. Uso aceptable
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            Te comprometes a utilizar PDF Tools de manera legal y responsable. No debes utilizar
            las herramientas para:
          </p>
          <ul className="text-sm leading-relaxed list-disc pl-6 mb-3" style={{ color: 'var(--text-secondary)' }}>
            <li>Violar derechos de autor o propiedad intelectual de terceros</li>
            <li>Procesar contenido ilegal, difamatorio o que infrinja derechos de privacidad</li>
            <li>Intentar comprometer la seguridad o integridad del servicio</li>
            <li>Realizar automatizaciones que sobrecarguen los servidores (el sitio se aloja en GitHub Pages)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            4. Propiedad intelectual
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            El codigo fuente de PDF Tools esta disponible como software de codigo abierto. Las
            herramientas de terceros utilizadas (PDF.js, pdf-lib, tesseract.js, docx) mantienen
            sus propias licencias.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            5. Exclusion de garantias
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools se proporciona tal cual, sin garantias de ningun tipo. No garantizamos que
            el servicio este libre de errores o interrupciones. El uso de las herramientas es bajo
            tu propio riesgo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            6. Limitacion de responsabilidad
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            En ningun caso seremos responsables por danos directos, indirectos, incidentales o
            consecuentes derivados del uso de PDF Tools. Te recomendamos mantener copias de
            seguridad de tus archivos importantes antes de procesarlos.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            7. Publicidad
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools puede mostrar anuncios de Google AdSense para mantener el servicio gratuito.
            Los anuncios no interfieren con el procesamiento de archivos.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            8. Cambios en los terminos
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Nos reservamos el derecho de modificar estos terminos en cualquier momento. Los cambios
            seran publicados en esta pagina con la fecha de la ultima actualizacion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            9. Contacto
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Si tienes preguntas sobre estos Terminos de Servicio, puedes contactarnos a traves de
            nuestra pagina de{' '}
            <a href="/pdf-tools/contacto" className="underline" style={{ color: 'var(--accent)' }}>
              Contacto
            </a>.
          </p>
        </section>
      </div>
    </PDFToolLayout>
  )
}
