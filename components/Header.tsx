// components/Header.tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()

  const navLinks = [
    { href: "/quienes-somos", label: "Quiénes somos" },
    { href: "/login",         label: "Usuarios" },
  ]

  return (
    <header
      style={{
        position:             "sticky",
        top:                  0,
        zIndex:               50,
        background:           "color-mix(in oklab, #ffffff 92%, transparent)",
        backdropFilter:       "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom:         "1px solid #e6e0d6",
        color:                "#0d0a08",
      }}
    >
      <div
        style={{
          maxWidth:       "1320px",
          margin:         "0 auto",
          padding:        "18px 40px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            "32px",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "12px", color: "#0d0a08" }}
          aria-label="RustVault"
        >
          <div
            style={{
              width:          "34px",
              height:         "34px",
              borderRadius:   "9px",
              background:     "radial-gradient(120% 120% at 30% 25%, oklch(0.74 0.14 55), oklch(0.62 0.13 45) 45%, oklch(0.48 0.13 40) 90%)",
              boxShadow:      "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -8px 14px rgba(0,0,0,0.35)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "16px", color: "rgba(20,15,10,0.7)" }}>
              R
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "24px", letterSpacing: "0.5px" }}>
            Rust<em style={{ fontStyle: "italic", color: "oklch(0.62 0.13 45)" }}>vault</em>
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  color:         active ? "#0d0a08" : "#3d3530",
                  padding:       "10px 16px",
                  borderRadius:  "999px",
                  fontSize:      "14px",
                  letterSpacing: "0.2px",
                  transition:    "background 160ms ease",
                  background:    active ? "rgba(13,10,8,0.06)" : "transparent",
                  fontWeight:    active ? 500 : 400,
                  textDecoration: "none",
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* CTA */}
        <Link
          href="/login"
          style={{
            background:     "#0d0a08",
            color:          "#ffffff",
            border:         "none",
            padding:        "11px 18px",
            borderRadius:   "999px",
            fontWeight:     500,
            fontSize:       "13.5px",
            display:        "inline-flex",
            alignItems:     "center",
            gap:            "8px",
            transition:     "transform 120ms ease, background 160ms ease",
            textDecoration: "none",
          }}
        >
          Entrar
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>
    </header>
  )
}
