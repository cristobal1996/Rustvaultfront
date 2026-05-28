// app/quienes-somos/page.tsx
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"

export const metadata = {
  title: "Quiénes somos — RustVault",
}

export default function QuienesSomos() {
  return (
    <>
      <Header />
      <main>
        <section
          style={{
            maxWidth: "860px",
            margin:   "0 auto",
            padding:  "100px 40px 120px",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           "10px",
              fontFamily:    "var(--font-mono)",
              fontSize:      "11px",
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color:         "var(--muted)",
              marginBottom:  "32px",
            }}
          >
            <span
              style={{
                display:    "inline-block",
                width:      "28px",
                height:     "1px",
                background: "var(--rust)",
              }}
            />
            Quiénes somos
          </div>

          {/* Título */}
          <h1
            style={{
              fontFamily:    "var(--font-serif)",
              fontWeight:    400,
              fontSize:      "clamp(40px, 5.5vw, 72px)",
              lineHeight:    "1.0",
              letterSpacing: "-1px",
              margin:        "0 0 40px",
              color:         "var(--ivory)",
            }}
          >
            Un proyecto de{" "}
            <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>
              código abierto
            </em>
          </h1>

          {/* Separador */}
          <div
            style={{
              width:        "48px",
              height:       "2px",
              background:   "linear-gradient(90deg, var(--rust), transparent)",
              marginBottom: "40px",
            }}
          />

          {/* Descripción — el alumno puede cambiar este texto */}
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "20px",
            }}
          >
            {[
              "RustVault es un gestor de contraseñas cifrado de extremo a extremo desarrollado como proyecto final de ciclo formativo. La aplicación permite guardar contraseñas, notas seguras y códigos de verificación (2FA) con total privacidad.",
              "Todo el contenido se cifra en el dispositivo del usuario antes de enviarse al servidor, de modo que nadie más, ni siquiera el administrador, puede leer los datos almacenados. A esto se le llama arquitectura zero-knowledge.",
              "El backend está desarrollado en Rust con el framework Axum y PostgreSQL como base de datos. El frontend utiliza Next.js con TypeScript. La comunicación entre ambos se realiza mediante una API REST con autenticación JWT.",
            ].map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize:   "18px",
                  lineHeight: "1.65",
                  color:      "var(--ivory-dim)",
                  margin:     0,
                }}
              >
                {p}
              </p>
            ))}
          </div>

          {/* Stack */}
          <div
            style={{
              marginTop:    "60px",
              padding:      "32px",
              border:       "1px solid var(--line)",
              borderRadius: "16px",
              background:   "var(--bg-elev)",
              display:      "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap:          "24px",
            }}
          >
            {[
              { label: "Backend",       value: "Rust · Axum · Tokio"        },
              { label: "Base de datos", value: "PostgreSQL 16"               },
              { label: "Cifrado",       value: "AES-256-GCM · Argon2id"     },
              { label: "Frontend",      value: "Next.js · TypeScript"        },
              { label: "Autenticación", value: "JWT · 2FA · X25519"          },
              { label: "Infraestructura", value: "Docker · Docker Compose"   },
            ].map(item => (
              <div key={item.label}>
                <div
                  style={{
                    fontFamily:    "var(--font-mono)",
                    fontSize:      "10px",
                    letterSpacing: "1.4px",
                    textTransform: "uppercase",
                    color:         "var(--muted)",
                    marginBottom:  "4px",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize:   "18px",
                    color:      "var(--ivory)",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
