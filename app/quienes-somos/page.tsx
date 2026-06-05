// app/quienes-somos/page.tsx
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"

export const metadata = { title: "Quiénes somos — RustVault" }

const TEXTOS = [
  "RustVault es un gestor de contraseñas cifrado de extremo a extremo desarrollado como proyecto final de ciclo formativo. La aplicación permite guardar contraseñas, notas seguras y códigos de verificación (2FA) con total privacidad.",
  "Todo el contenido se cifra en el dispositivo del usuario antes de enviarse al servidor, de modo que nadie más, ni siquiera el administrador, puede leer los datos almacenados. A esto se le llama arquitectura zero-knowledge.",
  "El backend está desarrollado en Rust con el framework Axum y PostgreSQL como base de datos. El frontend utiliza Next.js con TypeScript. La comunicación entre ambos se realiza mediante una API REST con autenticación JWT.",
]

const STACK = [
  { label: "Backend",         value: "Rust · Axum · Tokio"     },
  { label: "Base de datos",   value: "PostgreSQL 16"            },
  { label: "Cifrado",         value: "AES-256-GCM · Argon2id"   },
  { label: "Frontend",        value: "Next.js · TypeScript"     },
  { label: "Autenticación",   value: "JWT · 2FA · X25519"       },
  { label: "Infraestructura", value: "Docker · Docker Compose"  },
]

export default function QuienesSomos() {
  return (
    <>
      <Header />
      <main>
        <section className="max-w-[860px] mx-auto px-5 sm:px-10
                            pt-12 sm:pt-20 lg:pt-[100px]
                            pb-16 sm:pb-24 lg:pb-[120px]">
          <div className="inline-flex items-center gap-[10px] label-mono mb-6 sm:mb-8">
            <span className="inline-block w-7 h-px bg-rust" />
            Quiénes somos
          </div>

          <h1 className="font-serif font-normal
                         text-[clamp(32px,8vw,72px)]
                         leading-none tracking-[-1px] text-ivory m-0 mb-8 sm:mb-10">
            Un proyecto de{" "}
            <em className="italic text-rust-bright">código abierto</em>
          </h1>

          <div className="h-[2px] w-12 mb-8 sm:mb-10"
               style={{ background: "linear-gradient(90deg, var(--rust), transparent)" }} />

          <div className="flex flex-col gap-4 sm:gap-5">
            {TEXTOS.map((p, i) => (
              <p key={i} className="text-base sm:text-lg leading-[1.65] text-ivory-dim m-0">{p}</p>
            ))}
          </div>

          <div className="mt-10 sm:mt-[60px] p-6 sm:p-8 card grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {STACK.map(item => (
              <div key={item.label}>
                <div className="label-mono mb-1">{item.label}</div>
                <div className="font-serif text-base sm:text-lg text-ivory">{item.value}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
