// components/Footer.tsx
export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: "40px" }}>
      <div
        style={{
          maxWidth:       "1320px",
          margin:         "0 auto",
          padding:        "32px 40px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          color:          "var(--muted)",
          fontFamily:     "var(--font-mono)",
          fontSize:       "11px",
          letterSpacing:  "0.6px",
        }}
      >
        <span>© 2025 RustVault — Proyecto de código abierto</span>
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <a href="/login"    style={{ color: "var(--muted)", transition: "color 160ms" }}>Entrar</a>
          <a href="/register" style={{ color: "var(--muted)", transition: "color 160ms" }}>Registrarse</a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--muted)", transition: "color 160ms" }}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
