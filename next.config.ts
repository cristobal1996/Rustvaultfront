// next.config.ts
import type { NextConfig } from "next"

/**
 * Estrategia de URL de la API:
 *
 *   - DESARROLLO: el rewrite proxy-ea las peticiones a `/api/*` hacia el
 *     backend local (192.168.0.37:8080 por defecto). El frontend llama
 *     a `/api/auth/login` y Next.js lo redirige internamente al backend
 *     Rust. La variable NEXT_PUBLIC_API_BASE se queda vacía.
 *
 *   - PRODUCCIÓN: no hay rewrite. El frontend llama a la URL completa
 *     del backend usando NEXT_PUBLIC_API_BASE (configurada en Vercel).
 *     Por ejemplo: https://rustvault-backend.onrender.com
 *
 * El cliente HTTP (lib/api.ts) usa NEXT_PUBLIC_API_BASE para construir
 * la URL completa. Si está vacía (en dev), las peticiones van a rutas
 * relativas (`/api/...`) que el rewrite captura.
 */

// En dev, apuntar al backend local. Configurable por si la IP cambia.
const DEV_API_TARGET = process.env.DEV_API_TARGET ?? "http://192.168.0.37:8080"

const nextConfig: NextConfig = {
  async rewrites() {
    // Solo aplicar rewrites en desarrollo. En producción Vercel ignora
    // este bloque y las llamadas van directas a NEXT_PUBLIC_API_BASE.
    if (process.env.NODE_ENV !== "production") {
      return [
        {
          source:      "/api/:path*",
          destination: `${DEV_API_TARGET}/api/:path*`,
        },
      ]
    }
    return []
  },
}

export default nextConfig
