// components/Footer.tsx
export function Footer() {
  return (
    <footer className="border-t border-line mt-10">
      <div className="max-w-container mx-auto px-5 sm:px-10 py-6 sm:py-8
                      flex flex-col sm:flex-row items-center justify-between gap-4
                      font-mono text-[11px] tracking-[0.6px] text-muted text-center sm:text-left">
        <span>© 2025 RustVault — Proyecto de código abierto</span>
        <div className="flex items-center gap-5 sm:gap-7">
          <a href="/login"    className="hover:text-ivory transition-colors">Entrar</a>
          <a href="/register" className="hover:text-ivory transition-colors">Registrarse</a>
          <a
            href="https://github.com/cristobal1996/Rustvaultback"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ivory transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
