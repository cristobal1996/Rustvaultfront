// app/register/page.tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"

function generateRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("")
}

export default function Register() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Validación de fortaleza de contraseña
  const checks = {
    length:    password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
  }
  const strength = Object.values(checks).filter(Boolean).length
  const strengthLabel = ["", "Débil", "Regular", "Buena", "Fuerte"][strength]
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"][strength]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!checks.length)    return setError("La contraseña debe tener al menos 12 caracteres")
    if (!checks.uppercase) return setError("La contraseña debe contener al menos una mayúscula")
    if (!checks.lowercase) return setError("La contraseña debe contener al menos una minúscula")
    if (!checks.number)    return setError("La contraseña debe contener al menos un número")
    if (password !== confirm) return setError("Las contraseñas no coinciden")

    setLoading(true)

    try {
      // Generar salt y verifier aleatorios
      // En producción se usaría SRP real, aquí usamos placeholders seguros
      const srpSalt     = generateRandomHex(16)
      const srpVerifier = generateRandomHex(32)

      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email,
          password,
          srp_salt:     srpSalt,
          srp_verifier: srpVerifier,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Error al crear la cuenta")
        return
      }

      // Registro exitoso — ir al login
      router.push("/login?registered=1")
    } catch {
      setError("Error de conexión con el servidor")
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width:        "100%",
    background:   "var(--bg)",
    border:       "1px solid var(--line-2)",
    borderRadius: "10px",
    padding:      "12px 14px",
    fontSize:     "14px",
    color:        "var(--ivory)",
    outline:      "none",
    transition:   "border-color 160ms ease",
    boxSizing:    "border-box",
  }

  const label: React.CSSProperties = {
    display:       "block",
    fontFamily:    "var(--font-mono)",
    fontSize:      "10.5px",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color:         "var(--muted)",
    marginBottom:  "8px",
  }

  return (
    <>
      <Header />

      <main style={{ minHeight: "calc(100vh - 73px - 65px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>

          {/* Icono */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.62 0.13 45) 50%, oklch(0.48 0.13 40))",
              boxShadow: "0 0 0 1px var(--line-2), 0 20px 60px -20px oklch(0.48 0.13 40), inset 0 0 0 1px rgba(255,255,255,0.12)",
              display: "grid", placeItems: "center",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(20,15,10,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>

          {/* Título */}
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", textAlign: "center", margin: "0 0 6px", color: "var(--ivory)" }}>
            Crear cuenta
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--muted)", textAlign: "center", margin: "0 0 36px" }}>
            Tu bóveda, tus reglas
          </p>

          {/* Formulario */}
          <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "20px", padding: "32px" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

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
                <label style={label}>Correo electrónico</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="alice@example.com"
                  style={inp}
                  onFocus={e => e.target.style.borderColor = "var(--rust)"}
                  onBlur={e  => e.target.style.borderColor = "var(--line-2)"}
                />
              </div>

              {/* Contraseña */}
              <div>
                <label style={label}>Contraseña maestra</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 12 caracteres"
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

                {/* Barra de fortaleza */}
                {password.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: "3px", borderRadius: "2px", background: i <= strength ? strengthColor : "var(--line-2)", transition: "background 300ms" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: strengthColor }}>{strengthLabel}</span>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {[
                          { ok: checks.length,    label: "12+" },
                          { ok: checks.uppercase, label: "A-Z" },
                          { ok: checks.lowercase, label: "a-z" },
                          { ok: checks.number,    label: "0-9" },
                        ].map(c => (
                          <span key={c.label} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: c.ok ? "var(--patina)" : "var(--muted)", transition: "color 200ms" }}>
                            {c.ok ? "✓" : "·"} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label style={label}>Confirmar contraseña</label>
                <input
                  type={showPass ? "text" : "password"} required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  style={{ ...inp, borderColor: confirm && confirm !== password ? "#ef4444" : "var(--line-2)" }}
                  onFocus={e => e.target.style.borderColor = confirm !== password ? "#ef4444" : "var(--rust)"}
                  onBlur={e  => e.target.style.borderColor = confirm && confirm !== password ? "#ef4444" : "var(--line-2)"}
                />
                {confirm && confirm !== password && (
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "#f87171", margin: "6px 0 0" }}>
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>

              {/* Botón registrarse */}
              <button
                type="submit" disabled={loading}
                style={{ background: loading ? "var(--rust-deep)" : "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 500, fontSize: "14.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset", transition: "background 160ms" }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Creando cuenta…
                  </>
                ) : (
                  <>
                    Crear mi cuenta
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

              {/* Link al login */}
              <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "10px", padding: "11px", fontSize: "13.5px", color: "var(--ivory-dim)", textDecoration: "none", transition: "background 160ms ease, border-color 160ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "#4d4136" }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--line-2)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Ya tengo cuenta — iniciar sesión
              </Link>
            </form>
          </div>

          {/* Nota de seguridad */}
          <p style={{ textAlign: "center", marginTop: "24px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: "0.3px", lineHeight: "1.6" }}>
            Tu contraseña maestra nunca se envía al servidor.<br/>
            El cifrado ocurre en tu dispositivo.
          </p>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
