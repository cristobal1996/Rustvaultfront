// app/login/page.tsx
"use client"
import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { deriveMUK, saveMUK } from "@/lib/muk"

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

function LoginForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const justRegistered = searchParams.get("registered") === "1"

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [step,     setStep]     = useState<"idle" | "auth" | "deriving">("idle")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setStep("auth")

    try {
      // 1. Autenticar con el servidor
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email,
          password,
          device_name: "Navegador web",
          platform:    "web",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Credenciales incorrectas")
        return
      }

      // 2. Derivar la MUK con la contraseña y el srp_salt del servidor
      setStep("deriving")
      const mukHex = await deriveMUK(password, data.srp_salt)

      // 3. Guardar MUK en sessionStorage y token en localStorage
      saveMUK(mukHex)
      localStorage.setItem("rv_token",    data.token)
      localStorage.setItem("rv_srp_salt", data.srp_salt)
      localStorage.setItem("rv_user_id",  data.user.id)
      localStorage.setItem("rv_email",    data.user.email)
      localStorage.setItem("rv_muk",      mukHex)
      window.postMessage({ type: "RUSTVAULT_MUK", mukHex }, "*")

      // 4. Ir al dashboard
      router.push("/dashboard")
    } catch {
      setError("Error de conexión con el servidor")
    } finally {
      setLoading(false)
      setStep("idle")
    }
  }

  const stepLabel = step === "auth" ? "Verificando credenciales…" : step === "deriving" ? "Derivando clave maestra…" : "Entrar a la bóveda"

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--line-2)",
    borderRadius: "10px", padding: "12px 14px", fontSize: "14px",
    color: "var(--ivory)", outline: "none", transition: "border-color 160ms ease",
    boxSizing: "border-box",
  }

  return (
    <div style={{ width: "100%", maxWidth: "420px" }}>
      {/* Icono */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
        <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.62 0.13 45) 50%, oklch(0.48 0.13 40))", boxShadow: "0 0 0 1px var(--line-2), 0 20px 60px -20px oklch(0.48 0.13 40), inset 0 0 0 1px rgba(255,255,255,0.12)", display: "grid", placeItems: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(20,15,10,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
      </div>

      {/* Título */}
      <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", textAlign: "center", margin: "0 0 6px", color: "var(--ivory)" }}>
        Bienvenido de nuevo
      </h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--muted)", textAlign: "center", margin: "0 0 36px" }}>
        Accede a tu bóveda segura
      </p>

      {/* Formulario */}
      <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "20px", padding: "32px" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Registro exitoso */}
          {justRegistered && (
            <div style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#4ade80", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Cuenta creada correctamente — inicia sesión
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#f87171", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "8px" }}>
              Correo electrónico
            </label>
            <input id="email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="alice@example.com" style={inp}
              onFocus={e => e.target.style.borderColor = "var(--rust)"}
              onBlur={e  => e.target.style.borderColor = "var(--line-2)"}
            />
          </div>

          {/* Contraseña */}
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "8px" }}>
              Contraseña maestra
            </label>
            <div style={{ position: "relative" }}>
              <input id="password" type={showPass ? "text" : "password"} required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{ ...inp, paddingRight: "44px" }}
                onFocus={e => e.target.style.borderColor = "var(--rust)"}
                onBlur={e  => e.target.style.borderColor = "var(--line-2)"}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", padding: "4px", cursor: "pointer", lineHeight: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {showPass
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Botón */}
          <button type="submit" disabled={loading}
            style={{ background: loading ? "var(--rust-deep)" : "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 500, fontSize: "14.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset", transition: "background 160ms" }}>
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                {stepLabel}
              </>
            ) : (
              <>
                Entrar a la bóveda
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>

          {/* Separador */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: "1px" }}>o</span>
            <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
          </div>

          {/* Botones secundarios */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link href="/recuperar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "10px", padding: "11px", fontSize: "13.5px", color: "var(--ivory-dim)", textDecoration: "none", transition: "background 160ms ease" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              Recuperar contraseña
            </Link>
            <Link href="/register" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "10px", padding: "11px", fontSize: "13.5px", color: "var(--ivory-dim)", textDecoration: "none", transition: "background 160ms ease" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Crear una cuenta nueva
            </Link>
          </div>
        </form>
      </div>

      {/* Nota de seguridad */}
      <p style={{ textAlign: "center", marginTop: "24px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: "0.3px", lineHeight: "1.6" }}>
        Tu contraseña maestra nunca se envía al servidor.<br/>
        La clave se deriva localmente con PBKDF2-SHA256.
      </p>
    </div>
  )
}

export default function Login() {
  return (
    <>
      <Header />
      <main style={{ minHeight: "calc(100vh - 73px - 65px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
        <Suspense fallback={<div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
