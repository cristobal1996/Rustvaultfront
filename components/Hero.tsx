// components/Hero.tsx
import Link from "next/link"
import { Vault } from "./Vault"

export function Hero() {
  return (
    <section
      style={{
        maxWidth:           "1320px",
        margin:             "0 auto",
        padding:            "90px 40px 60px",
        display:            "grid",
        gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
        gap:                "72px",
        alignItems:         "center",
      }}
    >
      {/* Columna izquierda */}
      <div>
        {/* Eyebrow */}
        <div
          style={{
            display:       "inline-flex",
            alignItems:    "center",
            gap:           "10px",
            fontFamily:    "var(--font-mono)",
            fontSize:      "11.5px",
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color:         "var(--ivory-dim)",
            padding:       "7px 12px",
            border:        "1px solid var(--line-2)",
            borderRadius:  "999px",
            background:    "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
          }}
        >
          <span
            className="animate-pulse-slow"
            style={{
              width:        "7px",
              height:       "7px",
              borderRadius: "50%",
              background:   "var(--patina)",
              boxShadow:    "0 0 0 3px color-mix(in oklab, var(--patina) 25%, transparent)",
              flexShrink:   0,
            }}
          />
          Cifrado de extremo a extremo
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily:    "var(--font-serif)",
            fontWeight:    400,
            fontSize:      "clamp(56px, 6.6vw, 96px)",
            lineHeight:    0.98,
            letterSpacing: "-1.2px",
            margin:        "22px 0 28px",
            color:         "var(--ivory)",
            textWrap:      "balance" as never,
          }}
        >
          Rust<em style={{ fontStyle: "italic", color: "var(--rust-bright)", position: "relative" }}>vault</em>
        </h1>

        {/* Lede */}
        <p
          style={{
            fontSize:   "18px",
            lineHeight: "1.55",
            color:      "var(--ivory-dim)",
            maxWidth:   "520px",
            margin:     "0 0 36px",
            textWrap:   "pretty" as never,
          }}
        >
          El gestor de contraseñas cifrado de extremo a extremo escrito en Rust.
          Tus credenciales viven dentro de una bóveda local, sincronizadas con
          cifrado AES-256-GCM — nadie, ni siquiera nosotros, puede abrirlas.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <Link
            href="/register"
            style={{
              background:   "var(--rust)",
              color:        "#fff",
              border:       "none",
              padding:      "14px 22px",
              borderRadius: "12px",
              fontWeight:   500,
              fontSize:     "14.5px",
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "10px",
              boxShadow:    "0 1px 0 rgba(255,255,255,0.12) inset, 0 10px 30px -10px var(--rust-deep)",
              transition:   "transform 120ms ease, background 160ms ease",
              textDecoration: "none",
            }}
          >
            Crear cuenta gratis
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>

          <a
            href="/quienes-somos"
            style={{
              background:   "transparent",
              color:        "var(--ivory)",
              border:       "1px solid var(--line-2)",
              padding:      "13px 20px",
              borderRadius: "12px",
              fontSize:     "14px",
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "10px",
              transition:   "background 160ms ease, border-color 160ms ease",
            }}
          >
            Conocer el proyecto
          </a>
        </div>
      </div>

      {/* Columna derecha — vault animado */}
      <Vault />
    </section>
  )
}
