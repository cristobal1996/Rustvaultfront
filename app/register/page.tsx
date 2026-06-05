// app/register/page.tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardIcon, CheckIcon, ShieldCheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"

import { saveMUK } from "@/lib/muk"
import { deriveMUK, aesEncrypt } from "@/lib/crypto"
import { hexToBytes, randomHex, randomBytes, bytesToHex } from "@/lib/hex"
import { apiPost, saveSession } from "@/lib/api"
import { log } from "@/lib/log"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/Button"
import { Input }  from "@/components/ui/Input"
import { ErrorMessage } from "@/components/ui/ErrorMessage"

type Step = "form" | "emergency_kit"

interface RegisterResponse {
  token:           string
  user:            { id: string; email: string }
  emergency_code?: string
}

export default function Register() {
  const router = useRouter()
  const [step,          setStep]          = useState<Step>("form")
  const [email,         setEmail]         = useState("")
  const [password,      setPassword]      = useState("")
  const [password2,     setPassword2]     = useState("")
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [emergencyCode, setEmergencyCode] = useState("")
  const [recoveryKey,   setRecoveryKey]   = useState("")
  const [confirmed,     setConfirmed]     = useState(false)
  const [copied,        setCopied]        = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== password2) return setError("Las contraseñas no coinciden")
    if (password.length < 12)   return setError("Mínimo 12 caracteres")

    setLoading(true)
    try {
      // 1. srp_salt + MUK
      const srpSalt = randomHex(16)
      const mukHex  = await deriveMUK(password, srpSalt)

      // 2. Registrar en el servidor
      const data = await apiPost<RegisterResponse>("/api/auth/register", {
        email,
        password,
        srp_salt:     srpSalt,
        srp_verifier: srpSalt,  // TODO: implementar SRP real
      }, { auth: false })

      // 3. Guardar sesión (token en localStorage, MUK SOLO en sessionStorage)
      saveSession({ token: data.token, srp_salt: srpSalt, user_id: data.user.id, email: data.user.email })
      saveMUK(mukHex)

      // 4. Generar Recovery Key + recovery_blob
      const rkBytes = randomBytes(32)
      const rkHex   = bytesToHex(rkBytes)
      const rkKeyHex = rkHex
      const recoveryBlob = await aesEncrypt(hexToBytes(mukHex), rkKeyHex)

      await apiPost("/api/auth/recover/save-blob", { recovery_blob: recoveryBlob })

      // 5. Mostrar kit
      setEmergencyCode(data.emergency_code ?? "")
      setRecoveryKey(rkHex)
      setStep("emergency_kit")
    } catch (e) {
      log.error("register failed", e)
      setError(e instanceof Error ? e.message : "Error al registrarse")
    } finally {
      setLoading(false)
    }
  }

  async function copyRecoveryKey() {
    await navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatKey = (hex: string) => hex.match(/.{1,8}/g)?.join(" - ") ?? hex

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px] flex flex-col gap-6">
          <div className="flex justify-center">
            <div className="w-[72px] h-[72px] rounded-full grid place-items-center"
                 style={{ background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.48 0.13 40))" }}>
              <ShieldCheckIcon className="w-9 h-9" style={{ color: "rgba(20,15,10,0.7)" }} />
            </div>
          </div>

          {step === "form" && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="font-serif font-normal text-[32px] m-0 mb-[6px] text-ivory">Crear cuenta</h1>
                <p className="font-mono text-xs text-muted m-0">Tu bóveda, tus claves — zero-knowledge</p>
              </div>

              {error && <ErrorMessage>{error}</ErrorMessage>}

              <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
                <Input label="Correo electrónico" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" autoComplete="email" />
                <Input label="Contraseña maestra (mín. 12 caracteres)" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
                <Input label="Repetir contraseña" type="password" value={password2}
                  onChange={e => setPassword2(e.target.value)} required autoComplete="new-password" />
                <Button type="submit" disabled={loading} className="mt-1">
                  {loading ? "Creando cuenta…" : "Crear cuenta →"}
                </Button>
              </form>

              <Link href="/login" className="text-center font-mono text-xs text-muted hover:text-ivory transition-colors">
                ¿Ya tienes cuenta? Inicia sesión →
              </Link>
            </div>
          )}

          {step === "emergency_kit" && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="font-serif font-normal text-[28px] m-0 mb-2 text-ivory inline-flex items-center gap-2">
                  <ShieldCheckIcon className="w-7 h-7 text-rust-bright" />
                  Emergency Kit
                </h1>
                <p className="font-mono text-xs m-0 leading-[1.6] inline-flex items-start gap-[6px]" style={{ color: "#fbbf24" }}>
                  <ExclamationTriangleIcon className="w-4 h-4 mt-[1px] flex-shrink-0" />
                  <span>Guarda esta información en un lugar seguro. Se muestra <strong>una sola vez</strong>.</span>
                </p>
              </div>

              <div className="border border-[rgba(234,179,8,0.3)] rounded-2xl p-[18px] bg-[rgba(234,179,8,0.04)]">
                <p className="font-mono text-[10px] uppercase tracking-[1.2px] m-0 mb-[10px]" style={{ color: "#fbbf24" }}>
                  Recovery Key — para recuperar sin perder datos
                </p>
                <div className="font-mono text-[13px] text-ivory bg-bg rounded-lg p-3 break-all leading-[1.8] tracking-[0.04em] mb-[10px]">
                  {formatKey(recoveryKey)}
                </div>
                <button onClick={copyRecoveryKey}
                  className="inline-flex items-center gap-[6px] bg-transparent border border-[rgba(234,179,8,0.3)] rounded-md px-3 py-[6px] text-xs font-mono cursor-pointer"
                  style={{ color: "#fbbf24" }}>
                  {copied ? <CheckIcon className="w-3 h-3" /> : <ClipboardIcon className="w-3 h-3" />}
                  {copied ? "Copiado" : "Copiar Recovery Key"}
                </button>
              </div>

              {emergencyCode && (
                <div className="card-padded p-4">
                  <p className="label-mono m-0 mb-2">
                    Emergency Code — para eliminar la cuenta si pierdes todo
                  </p>
                  <div className="font-mono text-base text-rust-bright tracking-[0.1em]">
                    {emergencyCode}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-[10px] cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="mt-[2px] w-4 h-4 flex-shrink-0" style={{ accentColor: "var(--rust)" }} />
                <span className="font-mono text-xs text-muted leading-[1.6]">
                  He guardado la Recovery Key y el Emergency Code en un lugar seguro
                </span>
              </label>

              <Button onClick={() => router.push("/dashboard")} disabled={!confirmed}>
                Entrar a mi bóveda →
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
