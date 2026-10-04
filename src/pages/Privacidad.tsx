import PDFToolLayout from '../components/Layout/PDFToolLayout'

export default function Privacidad() {
  return (
    <PDFToolLayout
      title="Politica de Privacidad — PDF Tools"
      description="Conoce como PDF Tools protege tu privacidad. Tus archivos nunca salen de tu navegador."
      keyword="privacidad"
    >
      <div className="prose-spatial max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Politica de Privacidad
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Ultima actualizacion: 18 de septiembre de 2026
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            1. Procesamiento local — Tus archivos nunca salen de tu dispositivo
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools funciona completamente en tu navegador web. Todos los procesamientos de archivos PDF
            (edicion, compresion, separacion, rotacion, union, OCR, conversion) se realizan localmente
            en tu dispositivo usando tecnologias como PDF.js y pdf-lib.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <strong>Ningun archivo es subido a servidores externos.</strong> Los archivos permanecen en
            la memoria de tu navegador y se eliminan automaticamente cuando cierras la pestana o navegas
            a otra pagina.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            2. Datos que recopilamos
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            PDF Tools <strong>no recopila datos personales</strong> directamente. No requerimos registro,
            no solicitamos correo electronico, y no almacenamos informacion de usuarios en servidores propios.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            El unico dato que se almacena localmente en tu dispositivo es el estado de sesion (imagenes
            en IndexedDB en la herramienta de edicion) para permitirte continuar tu trabajo si recargas
            la pagina. Este dato nunca sale de tu navegador.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            3. Publicidad de terceros
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            Este sitio puede utilizar Google AdSense para mostrar anuncios. Google AdSense utiliza cookies
            para servir anuncios basados en tus visitas anteriores a este u otros sitios web en internet.
          </p>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            Puedes optar por no recibir anuncios personalizados visitando{' '}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: 'var(--accent)' }}>
              Configuracion de anuncios de Google
            </a>.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Google utiliza cookiesDoubleClick (DART) que le permiten servir anuncios a los usuarios
            basandose en sus visitas a otros sitios en internet. Puedes desactivar las cookies DART
            visitando la{' '}
            <a href="https://www.google.com/privacy/ads/" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: 'var(--accent)' }}>
              Politica de privacidad de la red de contenido y anuncios de Google
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            4. Servicios de analisis
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Actualmente no utilizamos herramientas de analisis como Google Analytics. Si en el futuro
            se implementan, esta politica se actualizara para reflejar dichos cambios.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            5. Enlaces a sitios de terceros
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Este sitio puede contener enlaces a sitios web de terceros (como documentacion de librerias
            o repositorios de codigo). PDF Tools no es responsable de las practicas de privacidad de
            dichos sitios. Te recomendamos leer las politicas de privacidad de cualquier sitio web de
            terceros que visites.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            6. Cambios en esta politica
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Nos reservamos el derecho de actualizar esta Politica de Privacidad en cualquier momento.
            Los cambios seran publicados en esta pagina con la fecha de la ultima actualizacion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            7. Contacto
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Si tienes preguntas sobre esta Politica de Privacidad, puedes contactarnos a traves de
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
