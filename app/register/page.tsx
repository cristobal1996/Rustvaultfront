"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { saveMUK } from "@/lib/muk"

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

type Step = "form" | "emergency_kit"

export default function Register() {
  const router   = useRouter()
  const [step,          setStep]          = useState<Step>("form")
  const [email,         setEmail]         = useState("")
  const [password,      setPassword]      = useState("")
  const [password2,     setPassword2]     = useState("")
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [emergencyCode, setEmergencyCode] = useState("")
  const [recoveryKey,   setRecoveryKey]   = useState("")
  const [confirmed,     setConfirmed]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== password2) { setError("Las contraseñas no coinciden"); return }
    if (password.length < 12)   { setError("Mínimo 12 caracteres"); return }
    setLoading(true)

    try {
      // 1. Generar srp_salt aleatorio
      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const srpSalt   = bytesToHex(saltBytes)

      // 2. Derivar MUK con PBKDF2
      const keyMat  = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
      const mukBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 200000 },
        keyMat, 256
      )
      const mukHex = bytesToHex(new Uint8Array(mukBits))

      // 3. Registrar usuario en el servidor
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password, srp_salt: srpSalt, srp_verifier: srpSalt }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al registrarse"); return }

      // 4. PRIMERO guardar sesión para que los siguientes fetch tengan token
      saveMUK(mukHex)
      localStorage.setItem("rv_token",    data.token)
      localStorage.setItem("rv_srp_salt", srpSalt)
      localStorage.setItem("rv_user_id",  data.user.id)
      localStorage.setItem("rv_email",    data.user.email)
      localStorage.setItem("rv_muk",      mukHex)

      // 5. Generar Recovery Key de 32 bytes (64 chars hex)
      const rkBytes = crypto.getRandomValues(new Uint8Array(32))
      const rkHex   = bytesToHex(rkBytes)

      // 6. Cifrar la MUK con la Recovery Key
      const rkKey  = await crypto.subtle.importKey("raw", rkBytes, { name: "AES-GCM" }, false, ["encrypt"])
      const nonce  = crypto.getRandomValues(new Uint8Array(12))
      const mukCt  = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, rkKey, hexToBytes(mukHex))
      const recoveryBlob = {
        nonce:      bytesToHex(nonce),
        ciphertext: bytesToHex(new Uint8Array(mukCt)),
      }

      // 7. Guardar recovery blob en el servidor (ya tenemos token)
      await fetch("/api/auth/recover/save-blob", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
        body:    JSON.stringify({ recovery_blob: recoveryBlob }),
      })

      // 8. Mostrar Emergency Kit
      setEmergencyCode(data.emergency_code ?? "")
      setRecoveryKey(rkHex)
      setStep("emergency_kit")

    } catch (e) {
      setError("Error de conexión con el servidor")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function formatKey(hex: string): string {
    return hex.match(/.{1,8}/g)?.join(" - ") ?? hex
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--line-2)",
    borderRadius: "10px", padding: "12px 14px", fontSize: "14px",
    color: "var(--ivory)", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", gap: "24px" }}>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.48 0.13 40))", display: "grid", placeItems: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(20,15,10,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
        </div>

        {/* ── Formulario de registro ── */}
        {step === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", margin: "0 0 6px", color: "var(--ivory)" }}>Crear cuenta</h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>Tu bóveda, tus claves — zero-knowledge</p>
            </div>

            {error && (
              <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#f87171" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" style={inp} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Contraseña maestra (mín. 12 caracteres)</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Repetir contraseña</label>
                <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required style={inp} />
              </div>
              <button type="submit" disabled={loading}
                style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: "pointer", marginTop: "4px" }}>
                {loading ? "Creando cuenta…" : "Crear cuenta →"}
              </button>
            </form>

            <Link href="/login" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", textAlign: "center", textDecoration: "none" }}>
              ¿Ya tienes cuenta? Inicia sesión →
            </Link>
          </div>
        )}

        {/* ── Emergency Kit ── */}
        {step === "emergency_kit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "28px", margin: "0 0 8px", color: "var(--ivory)" }}>🔐 Emergency Kit</h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#fbbf24", margin: 0, lineHeight: "1.6" }}>
                ⚠️ Guarda esta información en un lugar seguro. Se muestra <strong>una sola vez</strong>.
              </p>
            </div>

            {/* Recovery Key */}
            <div style={{ border: "1px solid rgba(234,179,8,0.3)", borderRadius: "12px", padding: "18px", background: "rgba(234,179,8,0.04)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#fbbf24", margin: "0 0 10px" }}>
                Recovery Key — para recuperar contraseñas sin perder datos
              </p>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory)", background: "var(--bg)", borderRadius: "8px", padding: "12px", wordBreak: "break-all", lineHeight: "1.8", letterSpacing: "0.04em", marginBottom: "10px" }}>
                {formatKey(recoveryKey)}
              </div>
              <button onClick={() => navigator.clipboard.writeText(recoveryKey)}
                style={{ background: "transparent", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", color: "#fbbf24", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                📋 Copiar Recovery Key
              </button>
            </div>

            {/* Emergency Code */}
            {emergencyCode && (
              <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", background: "var(--bg-elev)" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>
                  Emergency Code — para eliminar la cuenta si pierdes todo
                </p>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", color: "var(--rust-bright)", letterSpacing: "0.1em" }}>
                  {emergencyCode}
                </div>
              </div>
            )}

            {/* Confirmación */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                style={{ marginTop: "2px", accentColor: "var(--rust)", width: "16px", height: "16px", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", lineHeight: "1.6" }}>
                He guardado la Recovery Key y el Emergency Code en un lugar seguro
              </span>
            </label>

            <button onClick={() => router.push("/dashboard")} disabled={!confirmed}
              style={{ background: confirmed ? "var(--rust)" : "var(--rust-deep)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: confirmed ? "pointer" : "not-allowed" }}>
              Entrar a mi bóveda →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
