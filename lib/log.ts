// lib/log.ts
// Logger condicional: solo logueará en desarrollo.

const isDev = process.env.NODE_ENV !== "production"

export const log = {
  info:  (...args: unknown[]) => { if (isDev) console.log(...args) },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args) },
  error: (...args: unknown[]) => { console.error(...args) }, // errores siempre
}
