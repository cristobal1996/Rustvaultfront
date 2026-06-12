// tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:          "var(--bg)",
        "bg-elev":   "var(--bg-elev)",
        line:        "var(--line)",
        "line-2":    "var(--line-2)",
        ivory:       "var(--ivory)",
        "ivory-dim": "var(--ivory-dim)",
        muted:       "var(--muted)",
        rust:        "var(--rust)",
        "rust-deep":   "var(--rust-deep)",
        "rust-bright": "var(--rust-bright)",
        patina:      "var(--patina)",
      },
      fontFamily: {
        // 'serif' → títulos grandes (Instrument Serif)
        serif: ["var(--font-serif)", "serif"],

        // 'sans' es ALIAS de 'body' por compatibilidad: el código
        // existente que usa `font-sans` seguirá funcionando,
        // pero ahora apunta a Crimson Pro (serif clásica) en lugar
        // de Geist (sans-serif).
        sans:  ["var(--font-body)", "Georgia", "serif"],
        body:  ["var(--font-body)", "Georgia", "serif"],

        mono:  ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        container: "1320px",
      },
      animation: {
        "pulse-slow": "pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
