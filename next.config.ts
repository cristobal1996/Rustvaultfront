// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // El frontend llama a la API Rust en local
  async rewrites() {
    return [
      {
        source:      "/api/:path*",
        destination: "http://192.168.0.37:8080/api/:path*",
      },
    ]
  },
}

export default nextConfig
