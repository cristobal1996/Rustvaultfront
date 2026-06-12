// app/layout.tsx
import type { Metadata } from "next"
import { Instrument_Serif, Crimson_Pro, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const instrumentSerif = Instrument_Serif({
  weight:   ["400"],
  style:    ["normal", "italic"],
  subsets:  ["latin"],
  variable: "--font-serif",
  display:  "swap",
})

const crimsonPro = Crimson_Pro({
  weight:   ["300", "400", "500", "600", "700"],
  style:    ["normal", "italic"],
  subsets:  ["latin"],
  variable: "--font-body",
  display:  "swap",
})

const jetbrainsMono = JetBrains_Mono({
  weight:   ["400", "500"],
  subsets:  ["latin"],
  variable: "--font-mono",
  display:  "swap",
})

export const metadata: Metadata = {
  title:       "RustVault — Gestor de contraseñas cifrado",
  description: "Gestor de contraseñas cifrado de extremo a extremo escrito en Rust.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${instrumentSerif.variable} ${crimsonPro.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
