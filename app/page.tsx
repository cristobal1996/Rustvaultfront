// app/page.tsx
import { Header } from "@/components/Header"
import { Hero }   from "@/components/Hero"
import { Footer } from "@/components/Footer"

export const metadata = {
  title: "RustVault — Gestor de contraseñas cifrado",
  description:
    "RustVault es el gestor de contraseñas cifrado de extremo a extremo escrito en Rust. " +
    "Tus credenciales viven dentro de una bóveda local, sincronizadas con cifrado AES-256-GCM.",
}

export default function Home() {
  return (
    <>
      <Header />
      <main><Hero /></main>
      <Footer />
    </>
  )
}
