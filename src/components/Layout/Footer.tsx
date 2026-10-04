export default function Footer() {
  return (
    <footer className="spatial-glass border-t border-white/[0.06] mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <a href="/pdf-tools/acerca" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>Acerca de</a>
          <a href="/pdf-tools/contacto" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>Contacto</a>
          <a href="/pdf-tools/privacidad" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>Privacidad</a>
          <a href="/pdf-tools/terminos" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>Terminos</a>
        </div>
        <p className="text-center">PDF Tools — Herramientas PDF gratis, 100% en tu navegador.</p>
        <p className="text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>Los archivos nunca salen de tu dispositivo.</p>
      </div>
    </footer>
  )
}
