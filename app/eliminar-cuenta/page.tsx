// app/eliminar-cuenta/page.tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ExclamationTriangleIcon, ShieldExclamationIcon,
  CheckCircleIcon, ArrowLeftIcon,
} from "@heroicons/react/24/outline"

import { apiPost, ApiError } from "@/lib/api"
import { log } from "@/lib/log"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/Button"
import { Input }  from "@/components/ui/Input"
import { ErrorMessage } from "@/components/ui/ErrorMessage"

type Step = "form" | "confirm" | "done"

export default function EliminarCuenta() {
  const router = useRouter()
  const [step,          setStep]          = useState<Step>("form")
  const [email,         setEmail]         = useState("")
  const [emergencyCode, setEmergencyCode] = useState("")
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Valida email + código en el servidor SIN borrar nada.
  // Si son correctos, avanza a la pantalla de confirmación.
  // Si no, muestra error claro y se queda en el formulario.
  async function handleContinue() {
    setError(null)

    if (!email.trim() || !emergencyCode.trim()) {
      setError("Rellena ambos campos")
      return
    }

    setLoading(true)
    try {
      await apiPost("/api/auth/recover/verify", {
        email:          email.trim().toLowerCase(),
        emergency_code: emergencyCode.trim().toUpperCase(),
      }, { auth: false })

      // Verificación OK → mostrar confirmación
      setStep("confirm")
    } catch (e) {
      log.error("verify emergency code failed", e)
      if (e instanceof ApiError && e.status === 401) {
        setError("El email o el código de emergencia no son correctos. Revisa que has copiado el código tal y como te lo dimos al registrarte.")
      } else {
        setError("No se pudo verificar el código. Inténtalo de nuevo en unos segundos.")
      }
    } finally {
      setLoading(false)
    }
  }

  // El usuario ya pasó la verificación previa, aquí solo borramos
  async function handleConfirm() {
    setError(null)
    setLoading(true)
    try {
      await apiPost("/api/auth/recover", {
        email:          email.trim().toLowerCase(),
        emergency_code: emergencyCode.trim().toUpperCase(),
      }, { auth: false })

      setStep("done")
    } catch (e) {
      log.error("emergency recovery failed", e)
      setError("Algo ha salido mal al eliminar la cuenta. Vuelve a intentarlo.")
      setStep("form")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px] flex flex-col gap-6">

          {/* Cabecera */}
          <div className="flex justify-center">
            <div
              className="w-[72px] h-[72px] rounded-full grid place-items-center"
              style={{ background: "radial-gradient(circle at 35% 30%, #ef4444, #991b1b)" }}
            >
              <ShieldExclamationIcon className="w-9 h-9" style={{ color: "rgba(20,15,10,0.85)" }} />
            </div>
          </div>

          {/* ── PASO 1: formulario ─────────────────────────────── */}
          {step === "form" && (
            <>
              <div>
                <h1 className="font-serif font-normal text-[32px] m-0 mb-[6px] text-ivory">
                  Eliminar cuenta
                </h1>
                <p className="font-mono text-xs text-muted m-0">
                  Usa esta opción solo si has perdido también la Recovery Key
                </p>
              </div>

              <div className="border border-[rgba(234,179,8,0.3)] rounded-2xl p-4 bg-[rgba(234,179,8,0.04)]">
                <p className="font-mono text-xs m-0 leading-[1.6] inline-flex items-start gap-2" style={{ color: "#fbbf24" }}>
                  <ExclamationTriangleIcon className="w-5 h-5 mt-[1px] flex-shrink-0" />
                  <span>
                    <strong>Advertencia:</strong> esta acción <strong>eliminará permanentemente tu cuenta y todos los datos asociados</strong>.
                    Después podrás registrarte de nuevo con el mismo email, pero las contraseñas guardadas se perderán.
                  </span>
                </p>
              </div>

              {error && <ErrorMessage>{error}</ErrorMessage>}

              <div className="flex flex-col gap-[14px]">
                <Input
                  label="Correo electrónico de la cuenta"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                />
                <div className="flex flex-col gap-[6px]">
                  <label className="label-mono">Código de emergencia</label>
                  <input
                    value={emergencyCode}
                    onChange={e => setEmergencyCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX"
                    className="input-base font-mono tracking-[0.1em]"
                    autoCapitalize="characters"
                  />
                  <span className="font-mono text-[10px] text-muted">
                    Es el código que se mostró al crear la cuenta
                  </span>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={loading}
                  variant="danger"
                  className="bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626]"
                >
                  {loading ? "Verificando…" : "Continuar →"}
                </Button>
              </div>

              <Link href="/recuperar" className="text-center font-mono text-xs text-muted hover:text-ivory transition-colors inline-flex items-center justify-center gap-2">
                <ArrowLeftIcon className="w-3 h-3" />
                Volver a recuperar con Recovery Key
              </Link>
            </>
          )}

          {/* ── PASO 2: confirmación ───────────────────────────── */}
          {step === "confirm" && (
            <>
              <div>
                <h1 className="font-serif font-normal text-[28px] m-0 mb-[6px] text-ivory">
                  ¿Estás seguro?
                </h1>
                <p className="font-mono text-xs text-muted m-0">
                  Última oportunidad para cancelar
                </p>
              </div>

              <div className="border border-[rgba(239,68,68,0.3)] rounded-2xl p-5 bg-[rgba(239,68,68,0.04)]">
                <p className="font-mono text-[13px] m-0 leading-[1.7]" style={{ color: "#f87171" }}>
                  Vas a eliminar la cuenta <strong>{email}</strong> de forma permanente.<br/><br/>
                  Se perderán todos los datos:
                </p>
                <ul className="font-mono text-xs mt-3 ml-4 space-y-1" style={{ color: "#f87171" }}>
                  <li>· Todas tus contraseñas guardadas</li>
                  <li>· Todos los códigos 2FA almacenados</li>
                  <li>· Historial de versiones</li>
                  <li>· Contraseñas compartidas pendientes</li>
                </ul>
                <p className="font-mono text-xs mt-3 mb-0" style={{ color: "#f87171" }}>
                  <strong>Esta acción no se puede deshacer.</strong>
                </p>
              </div>

              {error && <ErrorMessage>{error}</ErrorMessage>}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626]"
                >
                  {loading ? "Eliminando…" : "Sí, eliminar cuenta"}
                </Button>
              </div>
            </>
          )}

          {/* ── PASO 3: resultado ──────────────────────────────── */}
          {step === "done" && (
            <>
              <div>
                <h1 className="font-serif font-normal text-[28px] m-0 mb-[6px] text-ivory inline-flex items-center gap-2">
                  <CheckCircleIcon className="w-7 h-7 text-patina" />
                  Cuenta eliminada
                </h1>
                <p className="font-mono text-xs text-muted m-0">
                  El email <strong>{email}</strong> está libre para registrarse de nuevo
                </p>
              </div>

              <div className="border border-[rgba(16,185,129,0.3)] rounded-2xl p-[18px] bg-[rgba(16,185,129,0.04)]">
                <p className="font-mono text-[13px] m-0 leading-[1.6]" style={{ color: "#10b981" }}>
                  ✓ Cuenta eliminada permanentemente<br/>
                  ✓ Todas las sesiones cerradas<br/>
                  ✓ Datos asociados borrados<br/>
                  ✓ Email disponible para nuevo registro
                </p>
              </div>

              <Button onClick={() => router.push("/register")}>
                Crear cuenta nueva →
              </Button>

              <Link
                href="/"
                className="text-center font-mono text-xs text-muted hover:text-ivory transition-colors"
              >
                Volver al inicio
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
