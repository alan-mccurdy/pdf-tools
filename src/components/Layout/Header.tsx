import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/editar-pdf', label: 'Editar PDF' },
  { path: '/unir-pdf', label: 'Unir PDFs' },
  { path: '/word-a-pdf', label: 'Word a PDF' },
  { path: '/pdf-a-word', label: 'PDF a Word' },
  { path: '/separar-pdf', label: 'Separar PDF' },
  { path: '/rotar-pdf', label: 'Rotar PDF' },
  { path: '/comprimir-pdf', label: 'Comprimir' },
  { path: '/eliminar-paginas', label: 'Eliminar' },
  { path: '/insertar-imagenes', label: 'Insertar Img' },
]

export default function Header() {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 spatial-glass border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="4" width="20" height="26" rx="3" fill="url(#logo-grad)" opacity="0.9"/>
              <rect x="10" y="2" width="20" height="26" rx="3" stroke="rgba(125,211,252,0.4)" strokeWidth="1.5" fill="rgba(125,211,252,0.08)"/>
              <path d="M14 10h12M14 15h10M14 20h8" stroke="rgba(125,211,252,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="2" y1="4" x2="22" y2="30">
                  <stop stopColor="rgba(125,211,252,0.2)"/>
                  <stop offset="1" stopColor="rgba(196,181,253,0.15)"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-lg font-bold gradient-text hidden sm:block">PDF Tools</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? 'bg-white/[0.08] text-[var(--accent)] border border-[var(--accent-strong)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            className="lg:hidden spatial-btn-icon"
            onClick={() => {
              const nav = document.getElementById('mobile-nav')
              nav?.classList.toggle('hidden')
            }}
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        <nav id="mobile-nav" className="hidden lg:hidden pb-3">
          <div className="flex flex-wrap gap-1.5">
            {navItems.map(item => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => document.getElementById('mobile-nav')?.classList.add('hidden')}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? 'bg-white/[0.08] text-[var(--accent)] border border-[var(--accent-strong)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </header>
  )
}
