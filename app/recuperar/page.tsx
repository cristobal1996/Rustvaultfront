"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

type Step = "email" | "key" | "newpass" | "done"

export default function Recuperar() {
  const router = useRouter()
  const [step,         setStep]         = useState<Step>("email")
  const [email,        setEmail]        = useState("")
  const [recoveryKey,  setRecoveryKey]  = useState("")
  const [newPass,      setNewPass]      = useState("")
  const [newPass2,     setNewPass2]     = useState("")
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [recoveredMuk, setRecoveredMuk] = useState("")
  const [oldSrpSalt,   setOldSrpSalt]   = useState("")
  const [userId,       setUserId]       = useState("")
  const [userEmail,    setUserEmail]    = useState("")

  // ── PASO 1: pedir el blob por email ─────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/recover/blob", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        setError("No se encontró cuenta de recuperación para ese email")
        return
      }
      const data = await res.json()
      setOldSrpSalt(data.srp_salt)
      setStep("key")
    } catch (e) {
      setError("Error de conexión")
      console.error(e)
    } finally { setLoading(false) }
  }

  // ── PASO 2: descifrar MUK con la Recovery Key ───────────────────────
  async function handleKey(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cleanKey = recoveryKey.replace(/[\s-]/g, "").toLowerCase()
      if (cleanKey.length !== 64) {
        setError("La Recovery Key debe tener 64 caracteres hexadecimales")
        return
      }
      const res = await fetch("/api/auth/recover/blob", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) { setError("Error al obtener datos"); return }
      const data       = await res.json()
      const blob       = data.recovery_blob
      const rkBytes    = hexToBytes(cleanKey)
      const rkKey      = await crypto.subtle.importKey("raw", rkBytes, { name: "AES-GCM" }, false, ["decrypt"])
      try {
        const mukBytes = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: hexToBytes(blob.nonce) },
          rkKey,
          hexToBytes(blob.ciphertext)
        )
        setRecoveredMuk(bytesToHex(new Uint8Array(mukBytes)))
        setStep("newpass")
      } catch (decryptErr) {
        setError("Recovery Key incorrecta")
        console.error(decryptErr)
      }
    } catch (e) {
      setError("Error al verificar la clave")
      console.error(e)
    } finally { setLoading(false) }
  }

  // ── PASO 3: nueva contraseña + re-cifrado ───────────────────────────
  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPass !== newPass2) { setError("Las contraseñas no coinciden"); return }
    if (newPass.length < 12)  { setError("Mínimo 12 caracteres"); return }
    setLoading(true)

    try {
      // 1. Generar nuevo srp_salt y nueva MUK
      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const srpSalt   = bytesToHex(saltBytes)

      const keyMat     = await crypto.subtle.importKey("raw", new TextEncoder().encode(newPass), "PBKDF2", false, ["deriveBits"])
      const newMukBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 200000 },
        keyMat, 256
      )
      const newMukHex = bytesToHex(new Uint8Array(newMukBits))

      // 2. Cambiar password en servidor y obtener token nuevo
      const recoverRes = await fetch("/api/auth/recover-with-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:            email.trim().toLowerCase(),
          recovery_key:     recoveryKey.replace(/[\s-]/g, "").toLowerCase(),
          new_password:     newPass,
          new_srp_salt:     srpSalt,
          new_srp_verifier: srpSalt,
        }),
      })
      if (!recoverRes.ok) {
        const err = await recoverRes.json()
        setError(err.error ?? "Error al recuperar la cuenta")
        return
      }
      const recoverData = await recoverRes.json()
      const token       = recoverData.token

      // 3. Obtener todas las contraseñas (con token NUEVO)
      const pwRes  = await fetch("/api/passwords?limit=1000", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const pwData = await pwRes.json()

      // 4. Descifrar con MUK vieja y re-cifrar con MUK nueva
      const reEncrypted: Array<{ id: string, encrypted: { nonce: string, ciphertext: string } }> = []
      for (const pw of (pwData.data ?? [])) {
        try {
          const oldKey = await crypto.subtle.importKey("raw", hexToBytes(recoveredMuk), { name: "AES-GCM" }, false, ["decrypt"])
          const plain  = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(pw.encrypted.nonce) }, oldKey, hexToBytes(pw.encrypted.ciphertext))
          const newKey = await crypto.subtle.importKey("raw", hexToBytes(newMukHex), { name: "AES-GCM" }, false, ["encrypt"])
          const nonce  = crypto.getRandomValues(new Uint8Array(12))
          const newCt  = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, newKey, plain)
          reEncrypted.push({
            id:        pw.id,
            encrypted: { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(newCt)) },
          })
        } catch (decErr) {
          console.warn("No se pudo re-cifrar:", pw.id, decErr)
        }
      }

      // 5. Enviar todas las contraseñas re-cifradas (NO cambia password de usuario)
      if (reEncrypted.length > 0) {
        await fetch("/api/passwords/bulk-update", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ re_encrypted_passwords: reEncrypted }),
        })
      }

      // ─────────────────────────────────────────────────────────────
      // 6. Regenerar recovery_blob USANDO LA MISMA RECOVERY KEY
      //    (la que el usuario acaba de introducir y validar)
      //    Así la Recovery Key original sigue siendo válida para siempre.
      // ─────────────────────────────────────────────────────────────
      const sameRkBytes = hexToBytes(recoveryKey.replace(/[\s-]/g, "").toLowerCase())
      const rkKey       = await crypto.subtle.importKey("raw", sameRkBytes, { name: "AES-GCM" }, false, ["encrypt"])
      const nonce       = crypto.getRandomValues(new Uint8Array(12))
      const mukCt       = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, rkKey, hexToBytes(newMukHex))
      const recoveryBlob = {
        nonce:      bytesToHex(nonce),
        ciphertext: bytesToHex(new Uint8Array(mukCt)),
      }
      await fetch("/api/auth/recover/save-blob", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ recovery_blob: recoveryBlob }),
      })

      // 7. Guardar sesión nueva
      setUserId(recoverData.user?.id ?? "")
      setUserEmail(recoverData.user?.email ?? email)
      localStorage.setItem("rv_token",    token)
      localStorage.setItem("rv_srp_salt", srpSalt)
      localStorage.setItem("rv_muk",      newMukHex)
      localStorage.setItem("rv_email",    recoverData.user?.email ?? email)
      localStorage.setItem("rv_user_id",  recoverData.user?.id ?? "")
      sessionStorage.setItem("rv_muk",    newMukHex)

      setStep("done")
    } catch (e) {
      setError("Error al establecer la nueva contraseña")
      console.error(e)
    } finally { setLoading(false) }
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
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
        </div>

        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", margin: "0 0 6px", color: "var(--ivory)" }}>Recuperar cuenta</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            Con tu Recovery Key, sin perder datos
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#f87171" }}>
            {error}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Email de la cuenta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" style={inp} />
            </div>
            <button type="submit" disabled={loading}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              {loading ? "Comprobando…" : "Continuar →"}
            </button>
          </form>
        )}

        {step === "key" && (
          <form onSubmit={handleKey} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>
                Recovery Key (64 caracteres hexadecimales)
              </label>
              <textarea value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} required rows={3}
                placeholder="xxxxxxxx - xxxxxxxx - xxxxxxxx - ..."
                style={{ ...inp, fontFamily: "var(--font-mono)", fontSize: "13px", resize: "vertical" }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              {loading ? "Verificando…" : "Verificar clave →"}
            </button>
          </form>
        )}

        {step === "newpass" && (
          <form onSubmit={handleNewPass} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#10b981", margin: 0 }}>
              ✓ Recovery Key verificada. Tus contraseñas se re-cifrarán automáticamente.
            </p>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>
                Nueva contraseña maestra (mín. 12)
              </label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required style={inp} />
            </div>
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>
                Repetir contraseña
              </label>
              <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} required style={inp} />
            </div>
            <button type="submit" disabled={loading}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              {loading ? "Re-cifrando contraseñas…" : "Establecer nueva contraseña →"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ border: "1px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "18px", background: "rgba(16,185,129,0.04)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "#10b981", margin: 0, lineHeight: "1.6" }}>
                ✓ Cuenta recuperada<br/>
                ✓ Contraseña cambiada<br/>
                ✓ Contraseñas re-cifradas con la nueva MUK<br/>
                ✓ Tu Recovery Key original sigue siendo válida
              </p>
            </div>
            <button onClick={() => router.push("/dashboard")}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              Entrar a mi bóveda →
            </button>
          </div>
        )}

        <Link href="/login" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", textAlign: "center", textDecoration: "none" }}>
          ← Volver al login
        </Link>
      </div>
    </div>
  )
}
