// lib/api.ts
// Cliente HTTP unificado. Lee el token del sessionStorage automáticamente.
// Decisión de seguridad: el token vive en sessionStorage como la MUK,
// para que al cerrar pestaña se borre todo y se minimice la exposición a XSS.

/**
 * URL base de la API.
 *
 * - En DESARROLLO: queda vacía, las llamadas usan rutas relativas
 *   (`/api/...`) y el rewrite de Next.js (next.config.ts) las proxy-ea
 *   al backend local (`http://192.168.0.37:8080`).
 *
 * - En PRODUCCIÓN: se define como variable de entorno en Vercel,
 *   apuntando al backend desplegado (p.ej. `https://rustvault.onrender.com`).
 *   El rewrite del next.config.ts queda desactivado en producción.
 *
 * Variable: NEXT_PUBLIC_API_BASE
 * Ejemplo:  https://rustvault-backend.onrender.com
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""

/** Combina la URL base con el path sin generar doble barra. */
function fullUrl(path: string): string {
  if (!API_BASE) return path
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const base = API_BASE.replace(/\/+$/, "")     // sin barra final
  const p    = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public body?: unknown) {
    super(message)
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  auth?: boolean
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  }

  let finalBody: BodyInit | undefined
  if (body !== undefined) {
    if (body instanceof FormData || typeof body === "string") {
      finalBody = body as BodyInit
    } else {
      finalBody = JSON.stringify(body)
      finalHeaders["Content-Type"] = "application/json"
    }
  }

  if (auth) {
    const token = getToken()
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(fullUrl(path), { ...rest, body: finalBody, headers: finalHeaders })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? safeJsonParse(text) : null

  if (!res.ok) {
    const msg  = (data as { error?: string } | null)?.error
              ?? (typeof data === "string" ? data : null)
              ?? `HTTP ${res.status}`
    const code = (data as { code?: string }  | null)?.code

    if (process.env.NODE_ENV !== "production") {
      console.error(`[api] ${rest.method ?? "GET"} ${path} → ${res.status}`, data ?? text)
    }

    throw new ApiError(res.status, msg, code, data)
  }

  return data as T
}

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}

// ── Atajos por verbo ──────────────────────────────────────────────

export const apiGet    = <T = unknown>(path: string, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "GET" })

export const apiPost   = <T = unknown>(path: string, body?: unknown, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "POST", body })

export const apiPut    = <T = unknown>(path: string, body?: unknown, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "PUT", body })

export const apiDelete = <T = unknown>(path: string, opts: ApiOptions = {}) =>
  api<T>(path, { ...opts, method: "DELETE" })

// ── Sesión ────────────────────────────────────────────────────────
//
// El TOKEN va en sessionStorage (se borra al cerrar pestaña, como la MUK).
// Los datos no sensibles (user_id, email) pueden quedarse en localStorage
// para mostrar info de cuenta sin pedir login completo.
//
// srp_salt también va en sessionStorage porque es lo que se usa para
// derivar la MUK — no tiene sentido tener salt sin MUK.

const SESSION_KEYS = ["rv_user_id", "rv_email"] as const  // localStorage (no sensibles)
const SECURE_KEYS  = ["rv_token", "rv_srp_salt"] as const // sessionStorage (sensibles)

export function saveSession(s: { token: string; srp_salt: string; user_id: string; email: string }): void {
  // Sensibles: sessionStorage
  sessionStorage.setItem("rv_token",    s.token)
  sessionStorage.setItem("rv_srp_salt", s.srp_salt)
  // No sensibles: localStorage
  localStorage.setItem("rv_user_id", s.user_id)
  localStorage.setItem("rv_email",   s.email)
}

export function clearSession(): void {
  for (const k of SESSION_KEYS) localStorage.removeItem(k)
  for (const k of SECURE_KEYS)  sessionStorage.removeItem(k)
  sessionStorage.removeItem("rv_muk")
  sessionStorage.removeItem("rv_pub_key")
  sessionStorage.removeItem("rv_priv_key_pkcs8")
}

export function getToken(): string | null {
  return typeof window !== "undefined" ? sessionStorage.getItem("rv_token") : null
}

// Helper para leer otros datos de sesión
export function getSrpSalt(): string | null {
  return typeof window !== "undefined" ? sessionStorage.getItem("rv_srp_salt") : null
}
