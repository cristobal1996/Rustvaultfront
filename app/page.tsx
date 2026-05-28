// app/page.tsx
import { Header }        from "@/components/Header"
import { Hero }          from "@/components/Hero"
import { Strip }         from "@/components/Strip"
import { SectionAbout }  from "@/components/SectionAbout"
import { SectionUsers }  from "@/components/SectionUsers"
import { Footer }        from "@/components/Footer"

export const metadata = {
  title: "RustVault — Gestor de contraseñas cifrado",
  description:
    "RustVault es el gestor de contraseñas cifrado de extremo a extremo escrito en Rust. " +
    "Tus credenciales viven dentro de una bóveda local, sincronizadas con cifrado post-cuántico.",
}

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Strip />
        <SectionAbout />
        <SectionUsers />
      </main>
      <Footer />
    </>
  )
}
