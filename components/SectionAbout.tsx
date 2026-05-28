// components/SectionAbout.tsx
export function SectionAbout() {
  return (
    <section
      id="quienes-somos"
      style={{
        maxWidth: "1320px",
        margin:   "0 auto",
        padding:  "110px 40px",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display:            "grid",
          gridTemplateColumns: "220px 1fr",
          gap:                "40px",
          marginBottom:       "56px",
          alignItems:         "end",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "11px",
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color:         "var(--muted)",
            display:       "flex",
            alignItems:    "center",
            gap:           "12px",
          }}
        >
          <span style={{ display: "inline-block", width: "28px", height: "1px", background: "var(--rust)" }} />
          Quiénes somos
        </span>

        <h2
          style={{
            fontFamily:    "var(--font-serif)",
            fontWeight:    400,
            fontSize:      "clamp(36px, 4.4vw, 60px)",
            lineHeight:    "1.02",
            letterSpacing: "-0.6px",
            margin:        0,
            textWrap:      "balance" as never,
          }}
        >
          Un proyecto de <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>código abierto</em>
        </h2>
      </div>

      {/* Grid de tarjetas */}
      <div
        style={{
          display:            "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:                "40px",
        }}
      >
        {/* Tarjeta — Qué es */}
        <div
          style={{
            border:       "1px solid var(--line)",
            borderRadius: "18px",
            padding:      "36px 32px",
            background:   "radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.02), transparent 60%), var(--bg-elev)",
            position:     "relative",
            overflow:     "hidden",
          }}
        >
          <span
            style={{
              position:      "absolute",
              top:           "18px",
              right:         "18px",
              fontFamily:    "var(--font-mono)",
              fontSize:      "10.5px",
              color:         "var(--muted)",
              letterSpacing: "1.2px",
            }}
          >
            01
          </span>

          <h3
            style={{
              fontFamily:    "var(--font-serif)",
              fontWeight:    400,
              fontSize:      "30px",
              letterSpacing: "-0.2px",
              margin:        "8px 0 14px",
            }}
          >
            El proyecto
          </h3>

          <p
            style={{
              color:     "var(--ivory-dim)",
              fontSize:  "15.5px",
              lineHeight: "1.6",
              margin:    0,
              maxWidth:  "46ch",
            }}
          >
            RustVault es un gestor de contraseñas autoalojado construido con Rust y Axum.
            Nació como proyecto final de ciclo formativo con el objetivo de demostrar que
            la seguridad real no requiere servicios de pago ni confiar en terceros.
          </p>

          <div
            style={{
              display:            "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap:                0,
              marginTop:          "28px",
              borderTop:          "1px solid var(--line)",
            }}
          >
            {[
              { n: "13", suffix: "", label: "Tablas en BD" },
              { n: "40+", suffix: "", label: "Endpoints API" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  paddingTop:    "22px",
                  borderRight:   i === 0 ? "1px solid var(--line)" : "none",
                  paddingLeft:   i === 1 ? "22px" : 0,
                }}
              >
                <div
                  style={{
                    fontFamily:    "var(--font-serif)",
                    fontSize:      "44px",
                    lineHeight:    1,
                    letterSpacing: "-0.8px",
                    color:         "var(--ivory)",
                  }}
                >
                  {stat.n}
                  <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>{stat.suffix}</em>
                </div>
                <div
                  style={{
                    fontFamily:    "var(--font-mono)",
                    fontSize:      "10.5px",
                    letterSpacing: "1.4px",
                    textTransform: "uppercase",
                    color:         "var(--muted)",
                    marginTop:     "8px",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta — Timeline */}
        <div
          style={{
            border:       "1px solid var(--line)",
            borderRadius: "18px",
            background:   "var(--bg-elev)",
            padding:      "32px",
          }}
        >
          <h4
            style={{
              margin:        "0 0 22px",
              fontFamily:    "var(--font-mono)",
              fontSize:      "11px",
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color:         "var(--muted)",
            }}
          >
            Hoja de ruta
          </h4>

          {[
            {
              year: "2024",
              text: <><strong>Backend completo</strong> — API REST en Rust con autenticación JWT, cifrado AES-256-GCM y arquitectura zero-knowledge.</>,
            },
            {
              year: "2024",
              text: <><strong>Vaults compartidos</strong> — Cifrado X25519 + ECIES para compartir credenciales sin que el servidor vea las claves.</>,
            },
            {
              year: "2025",
              text: <><strong>Frontend Next.js</strong> — Interfaz web completa con autofill, generador de contraseñas y TOTP integrado.</>,
            },
            {
              year: "2025",
              text: <><strong>Despliegue</strong> — Contenedores Docker listos para Oracle Cloud Free Tier y cualquier VPS.</>,
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display:       "grid",
                gridTemplateColumns: "64px 1fr",
                gap:           "18px",
                padding:       "16px 0",
                borderTop:     i === 0 ? "none" : "1px dashed var(--line)",
                alignItems:    "baseline",
              }}
            >
              <span
                style={{
                  fontFamily:  "var(--font-serif)",
                  fontStyle:   "italic",
                  fontSize:    "22px",
                  color:       "var(--rust-bright)",
                }}
              >
                {item.year}
              </span>
              <p
                style={{
                  fontSize:   "14.5px",
                  color:      "var(--ivory-dim)",
                  lineHeight: "1.55",
                  margin:     0,
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
