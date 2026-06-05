// components/Hero.tsx
import { VaultIllustration } from "./VaultIllustration"

export function Hero() {
  return (
    <section className="max-w-container mx-auto px-5 sm:px-10
                        pt-12 sm:pt-20 lg:pt-[120px]
                        pb-12 sm:pb-16 lg:pb-[100px]
                        grid grid-cols-1 lg:grid-cols-2
                        gap-10 sm:gap-12 lg:gap-20
                        items-center">

      {/* Columna texto */}
      <div className="order-2 lg:order-1 text-center lg:text-left">
        <h1 className="font-serif font-normal
                       text-[clamp(48px,12vw,110px)] lg:text-[clamp(64px,7vw,110px)]
                       leading-[0.98] tracking-[-1.2px] text-ivory m-0 mb-4 sm:mb-6 text-balance">
          Rust<em className="italic text-rust-bright">vault</em>
        </h1>

        <div
          className="h-px mb-4 sm:mb-6 mx-auto lg:mx-0"
          style={{ width: "120px", background: "linear-gradient(90deg, var(--rust), transparent)" }}
        />

        <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-ivory-dim
                      max-w-[460px] mx-auto lg:mx-0 m-0 text-pretty">
          Rustvault es el gestor de contraseñas cifrado de extremo a extremo
          escrito en Rust. Tus credenciales viven dentro de una bóveda local,
          sincronizadas con cifrado post-cuántico — nadie, ni siquiera nosotros,
          puede abrirlas.
        </p>
      </div>

      {/* Columna vault — arriba en móvil, derecha en desktop */}
      <div className="order-1 lg:order-2 w-full max-w-[320px] sm:max-w-[420px] lg:max-w-none mx-auto">
        <VaultIllustration />
      </div>
    </section>
  )
}
