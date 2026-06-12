// app/login/page.tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LockClosedIcon, KeyIcon } from "@heroicons/react/24/outline"

import { saveMUK } from "@/lib/muk"
import { deriveMUK } from "@/lib/crypto"
import { apiPost, saveSession } from "@/lib/api"
import { log } from "@/lib/log"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/Button"
import { Input }  from "@/components/ui/Input"
import { ErrorMessage } from "@/components/ui/ErrorMessage"

interface LoginResponse {
  token:        string
  user:         { id: string; email: string }
  srp_salt:     string
  requires_2fa: boolean
}

type Step = "credentials" | "totp"

// Detecta el nombre del navegador para mostrarlo en "Dispositivos"
function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "Navegador"
  const ua = navigator.userAgent
  if (/Edg\//.test(ua))   return "Microsoft Edge"
  if (/Chrome\//.test(ua) && !/Edg|OPR/.test(ua)) return "Google Chrome"
  if (/Firefox\//.test(ua)) return "Mozilla Firefox"
  if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) return "Safari"
  if (/Opera|OPR\//.test(ua)) return "Opera"
  return "Navegador"
}

export default function Login() {
  const router = useRouter()
  const [step,     setStep]     = useState<Step>("credentials")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiPost<LoginResponse>("/api/auth/login", {
        email:              email.trim().toLowerCase(),
        password,
        device_name:        detectDeviceName(),
        platform:           "web",
        device_fingerprint: null,
      }, { auth: false })

      // Si requiere 2FA, ir a la pantalla del código
      // (en este caso el backend NO crea sesión, solo nos dice que lo pida)
      if (data.requires_2fa) {
        setStep("totp")
        return
      }

      // Si no requiere 2FA, login completado
      await completeLogin(data)
    } catch (e) {
      log.error("login failed", e)
      setError(e instanceof Error ? e.message : "Credenciales incorrectas")
    } finally {
      setLoading(false)
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Reenvía email + password + código TOTP
      const data = await apiPost<LoginResponse>("/api/auth/login", {
        email:              email.trim().toLowerCase(),
        password,
        totp_code:          totpCode.trim(),
        device_name:        detectDeviceName(),
        platform:           "web",
        device_fingerprint: null,
      }, { auth: false })

      await completeLogin(data)
    } catch (e) {
      log.error("2fa failed", e)
      setError(e instanceof Error ? e.message : "Código incorrecto")
    } finally {
      setLoading(false)
    }
  }

  async function completeLogin(data: LoginResponse) {
    if (!data.token || !data.user || !data.srp_salt) {
      throw new Error("Respuesta de login incompleta")
    }

    const mukHex = await deriveMUK(password, data.srp_salt)

    saveSession({
      token:    data.token,
      srp_salt: data.srp_salt,
      user_id:  data.user.id,
      email:    data.user.email,
    })
    saveMUK(mukHex)

    router.push("/dashboard")
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px] flex flex-col gap-6">
          <div className="flex justify-center">
            <div className="w-[72px] h-[72px] rounded-full grid place-items-center"
                 style={{ background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.48 0.13 40))" }}>
              {step === "credentials"
                ? <LockClosedIcon className="w-9 h-9" style={{ color: "rgba(20,15,10,0.7)" }} />
                : <KeyIcon        className="w-9 h-9" style={{ color: "rgba(20,15,10,0.7)" }} />}
            </div>
          </div>

          <div>
            <h1 className="font-serif font-normal text-[32px] m-0 mb-[6px] text-ivory">
              {step === "credentials" ? "Iniciar sesión" : "Verificación en dos pasos"}
            </h1>
            <p className="font-mono text-xs text-muted m-0">
              {step === "credentials"
                ? "Tu contraseña nunca sale de este dispositivo"
                : "Introduce el código de tu app de autenticación"}
            </p>
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          {step === "credentials" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-[14px]">
              <Input label="Correo electrónico" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" autoComplete="email" />
              <Input label="Contraseña maestra" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <Button type="submit" disabled={loading}>
                {loading ? "Entrando…" : "Entrar →"}
              </Button>
            </form>
          )}

          {step === "totp" && (
            <form onSubmit={handle2FA} className="flex flex-col gap-[14px]">
              <Input label="Código de 6 dígitos" value={totpCode} onChange={e => setTotpCode(e.target.value)}
                required inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="123456" autoFocus
                style={{ fontFamily: "var(--font-mono)", fontSize: "18px", letterSpacing: "0.5em", textAlign: "center" }} />
              <Button type="submit" disabled={loading || totpCode.length !== 6}>
                {loading ? "Verificando…" : "Verificar →"}
              </Button>
            </form>
          )}

          <div className="flex justify-between items-center font-mono text-xs">
            <Link href="/register"  className="text-muted hover:text-ivory transition-colors">Crear cuenta</Link>
            <Link href="/recuperar" className="text-muted hover:text-ivory transition-colors">¿Olvidaste tu contraseña?</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
