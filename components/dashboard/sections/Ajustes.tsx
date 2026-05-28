// components/dashboard/sections/Ajustes.tsx
"use client"
import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"

interface Props { token: string; onLogout: () => void; user?: { totp_enabled?: boolean } }

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

// QR generado localmente con canvas
function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!value || !canvasRef.current) return
    import("qrcode").then(QRLib => {
      QRLib.toCanvas(canvasRef.current!, value, {
        width: size, margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => setError(true))
    }).catch(() => setError(true))
  }, [value, size])

  if (error) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", borderRadius: "4px", fontSize: "11px", color: "#666", textAlign: "center", padding: "8px", boxSizing: "border-box" }}>
      QR no disponible
    </div>
  )
  return <canvas ref={canvasRef} style={{ display: "block", borderRadius: "4px" }} />
}

// Importar CSV o JSON
function ImportCSV({ token, mukHex }: { token: string; mukHex: string }) {
  const [status,   setStatus]   = useState<"idle" | "loading" | "done" | "error">("idle")
  const [imported, setImported] = useState(0)
  const [errors,   setErrors]   = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !mukHex) return
    setStatus("loading")
    setImported(0)
    setErrors(0)

    try {
      const text = await file.text()

      if (file.name.endsWith(".json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
        await importJSON(text)
      } else {
        await importCSV(text)
      }
    } catch (e) {
      console.error(e)
      setStatus("error")
    }

    if (fileRef.current) fileRef.current.value = ""
  }

  async function importJSON(text: string) {
    const data = JSON.parse(text)
    const passwords = data.data ?? (Array.isArray(data) ? data : [])
    if (!passwords.length) { setStatus("error"); return }

    let ok = 0, fail = 0
    for (const pw of passwords) {
      try {
        const key   = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["decrypt", "encrypt"])
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(pw.encrypted.nonce) }, key, hexToBytes(pw.encrypted.ciphertext))
        const nonce = crypto.getRandomValues(new Uint8Array(12))
        const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain)
        const encrypted = { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }
        const res = await fetch("/api/passwords", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ title: pw.title, domain: pw.domain ?? null, entry_type: pw.entry_type ?? "login", encrypted }),
        })
        if (res.ok) { ok++ } else { fail++ }
      } catch (e) { fail++ }
    }
    setImported(ok); setErrors(fail); setStatus("done")
  }

  async function importCSV(text: string) {
    const lines = text.split("\n").filter(l => l.trim())
    if (lines.length < 2) { setStatus("error"); return }

    const isBitwarden = lines[0].toLowerCase().includes("login_uri") || lines[0].toLowerCase().includes("login_username")
    const isLastPass  = lines[0].toLowerCase().includes("url") && lines[0].toLowerCase().includes("username")
    const cols = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase())

    let ok = 0, fail = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values: string[] = []
      let current = "", inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === "," && !inQuotes) { values.push(current); current = "" }
        else { current += ch }
      }
      values.push(current)

      const get = (key: string) => {
        const idx = cols.indexOf(key)
        return idx >= 0 ? (values[idx] ?? "").replace(/^"|"$/g, "").trim() : ""
      }

      let name = "", username = "", password = "", url = "", notes = ""
      if (isBitwarden) {
        name = get("name") || get("login_name"); username = get("login_username")
        password = get("login_password"); url = get("login_uri"); notes = get("notes")
      } else if (isLastPass) {
        name = get("name"); username = get("username")
        password = get("password"); url = get("url"); notes = get("extra")
      } else {
        name = get("name") || get("title"); username = get("username") || get("user")
        password = get("password") || get("pass"); url = get("url") || get("uri"); notes = get("notes")
      }

      if (!name && !username && !password) { fail++; continue }

      try {
        const plaintext = JSON.stringify({ username, password, url, notes })
        const key       = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["encrypt"])
        const nonce     = crypto.getRandomValues(new Uint8Array(12))
        const ct        = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(plaintext))
        const encrypted = { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }

        let domain: string | null = null
        try { domain = new URL(url).hostname.replace("www.", "") } catch (e) { /* sin dominio */ }

        const res = await fetch("/api/passwords", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ title: name || domain || "Importada", domain, entry_type: "login", encrypted }),
        })
        if (res.ok) { ok++ } else { fail++ }
      } catch (e) { fail++ }
    }
    setImported(ok); setErrors(fail); setStatus("done")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile}
        style={{ display: "none" }} id="import-csv" />
      <label htmlFor="import-csv"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "10px 16px", color: "var(--ivory-dim)", fontSize: "13.5px", cursor: "pointer", alignSelf: "flex-start" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 7 3 17 3 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {status === "loading" ? "Importando…" : "Seleccionar archivo (CSV o JSON)"}
      </label>
      {status === "done" && (
        <div style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "oklch(0.65 0.1 170)" }}>
          ✓ Importadas {imported} contraseñas{errors > 0 ? ` — ${errors} errores ignorados` : ""}
        </div>
      )}
      {status === "error" && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#f87171" }}>
          Error al leer el archivo — verifica que sea un CSV o JSON válido
        </div>
      )}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
        Formatos soportados: RustVault JSON, Bitwarden CSV, LastPass CSV, CSV genérico
      </p>
    </div>
  )
}

export function Ajustes({ token, onLogout, user }: Props) {
  const [section, setSection] = useState<"principal" | "2fa" | "exportar" | "eliminar">("principal")

  // Estado 2FA
  const [totpEnabled, setTotpEnabled] = useState(user?.totp_enabled ?? false)

  useEffect(() => {
    fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTotpEnabled(data.totp_enabled ?? false) })
      .catch(() => {})
  }, [token])

  // Cambio de contraseña
  const [currentPass, setCurrentPass] = useState("")
  const [newPass,     setNewPass]     = useState("")
  const [newPass2,    setNewPass2]    = useState("")
  const [savingPass,  setSavingPass]  = useState(false)
  const [passMsg,     setPassMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  // 2FA
  const [totp2fa,    setTotp2fa]    = useState<{ qr_url: string; secret: string } | null>(null)
  const [totpCode,   setTotpCode]   = useState("")
  const [loadingQR,  setLoadingQR]  = useState(false)
  const [totp2faMsg, setTotp2faMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Eliminar cuenta
  const [confirmText, setConfirmText] = useState("")
  const [deletePass,  setDeletePass]  = useState("")
  const [deleting,    setDeleting]    = useState(false)

  async function handleChangePassword() {
    if (newPass !== newPass2) { setPassMsg({ ok: false, text: "Las contraseñas nuevas no coinciden" }); return }
    if (newPass.length < 12)  { setPassMsg({ ok: false, text: "Mínimo 12 caracteres" }); return }
    setSavingPass(true)
    setPassMsg(null)
    try {
      const oldMukHex = sessionStorage.getItem("rv_muk") ?? localStorage.getItem("rv_muk")
      if (!oldMukHex) { setPassMsg({ ok: false, text: "Sesión expirada" }); return }

      const srpSalt    = localStorage.getItem("rv_srp_salt") ?? ""
      const keyMat     = await crypto.subtle.importKey("raw", new TextEncoder().encode(newPass), "PBKDF2", false, ["deriveBits"])
      const newMukBits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(srpSalt), iterations: 200000 }, keyMat, 256)
      const newMukHex  = bytesToHex(new Uint8Array(newMukBits))

      const pwRes  = await fetch("/api/passwords?limit=1000", { headers: { Authorization: `Bearer ${token}` } })
      const pwData = await pwRes.json()
      const passwords = pwData.data ?? []

      const reEncrypted = []
      for (const pw of passwords) {
        try {
          const oldKey = await crypto.subtle.importKey("raw", hexToBytes(oldMukHex), { name: "AES-GCM" }, false, ["decrypt"])
          const plain  = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(pw.encrypted.nonce) }, oldKey, hexToBytes(pw.encrypted.ciphertext))
          const newKey = await crypto.subtle.importKey("raw", hexToBytes(newMukHex), { name: "AES-GCM" }, false, ["encrypt"])
          const nonce  = crypto.getRandomValues(new Uint8Array(12))
          const newCt  = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, newKey, plain)
          reEncrypted.push({ id: pw.id, encrypted: { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(newCt)) } })
        } catch (e) { /* continuar */ }
      }

      const res = await fetch("/api/account/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ current_password: currentPass, new_password: newPass, new_srp_salt: srpSalt, new_srp_verifier: srpSalt, re_encrypted_passwords: reEncrypted }),
      })
      const data = await res.json()
      if (res.ok) {
        sessionStorage.setItem("rv_muk", newMukHex)
        localStorage.setItem("rv_muk", newMukHex)
        setPassMsg({ ok: true, text: `Contraseña cambiada. ${reEncrypted.length} entradas re-cifradas.` })
        setCurrentPass(""); setNewPass(""); setNewPass2("")
      } else {
        setPassMsg({ ok: false, text: data.error ?? "Error al cambiar la contraseña" })
      }
    } catch (e) {
      setPassMsg({ ok: false, text: "Error al procesar el cambio" })
    } finally {
      setSavingPass(false)
    }
  }

  async function handleSetup2FA() {
    setLoadingQR(true)
    try {
      const res  = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setTotp2fa({ qr_url: data.qr_code_url, secret: data.manual_key })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingQR(false)
    }
  }

  async function handleConfirm2FA() {
    if (!totpCode || totpCode.length !== 6) { setTotp2faMsg({ ok: false, text: "Introduce el código de 6 dígitos" }); return }
    if (!totp2fa?.secret) return
    const mukHex = sessionStorage.getItem("rv_muk") ?? localStorage.getItem("rv_muk")
    if (!mukHex) { setTotp2faMsg({ ok: false, text: "Sesión expirada" }); return }

    try {
      const key   = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["encrypt"])
      const nonce = crypto.getRandomValues(new Uint8Array(12))
      const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(totp2fa.secret))
      const encryptedSecret = { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }

      const res = await fetch("/api/auth/2fa/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ totp_code: totpCode, encrypted_secret: encryptedSecret, encrypted_backup_codes: encryptedSecret }),
      })
      if (res.ok) {
        setTotpEnabled(true); setTotp2fa(null); setTotpCode("")
        setTotp2faMsg({ ok: true, text: "2FA activado correctamente" })
      } else {
        setTotp2faMsg({ ok: false, text: "Código incorrecto" })
      }
    } catch (e) {
      setTotp2faMsg({ ok: false, text: "Error al activar 2FA" })
    }
  }

  async function handleDisable2FA() {
    if (!confirm("¿Seguro que quieres desactivar el 2FA?")) return
    const res = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) { setTotpEnabled(false); setTotp2faMsg({ ok: true, text: "2FA desactivado" }) }
    else { setTotp2faMsg({ ok: false, text: "Error al desactivar 2FA" }) }
  }

  async function handleDelete() {
    if (confirmText !== "ELIMINAR MI CUENTA") return
    setDeleting(true)
    const res = await fetch("/api/account/delete", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ password: deletePass, confirmation: "ELIMINAR MI CUENTA" }),
    })
    if (res.ok) onLogout()
    setDeleting(false)
  }

  const TABS = [
    { id: "principal", label: "Contraseña"       },
    { id: "2fa",       label: "Autenticación 2FA" },
    { id: "exportar",  label: "Exportar datos"    },
    { id: "eliminar",  label: "Eliminar cuenta"   },
  ] as const

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--line-2)",
    borderRadius: "8px", padding: "10px 12px", fontSize: "14px",
    color: "var(--ivory)", outline: "none", boxSizing: "border-box",
  }

  const mukForImport = (typeof window !== "undefined" ? sessionStorage.getItem("rv_muk") ?? localStorage.getItem("rv_muk") : "") ?? ""

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>Cuenta</p>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", margin: 0 }}>
          <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>Ajustes</em> de cuenta
        </h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            style={{ padding: "8px 16px", borderRadius: "8px", border: `1px solid ${section === t.id ? "var(--rust)" : "var(--line-2)"}`, background: section === t.id ? "color-mix(in oklab, var(--rust) 10%, transparent)" : "transparent", color: section === t.id ? "var(--rust-bright)" : "var(--muted)", fontSize: "13px", cursor: "pointer", transition: "all 140ms" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contraseña ── */}
      {section === "principal" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Cambiar contraseña maestra</p>
          {passMsg && (
            <div style={{ background: passMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${passMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: passMsg.ok ? "#4ade80" : "#f87171" }}>
              {passMsg.text}
            </div>
          )}
          {[
            { label: "Contraseña actual",       val: currentPass, set: setCurrentPass },
            { label: "Nueva contraseña",         val: newPass,     set: setNewPass },
            { label: "Repetir nueva contraseña", val: newPass2,    set: setNewPass2 },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>{f.label}</label>
              <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={inputStyle} />
            </div>
          ))}
          <button onClick={handleChangePassword} disabled={savingPass}
            style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px 20px", fontSize: "13.5px", cursor: "pointer", alignSelf: "flex-start" }}>
            {savingPass ? "Procesando…" : "Cambiar contraseña"}
          </button>
        </div>
      )}

      {/* ── 2FA ── */}
      {section === "2fa" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Segundo factor de autenticación</p>

          {totp2faMsg && (
            <div style={{ background: totp2faMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${totp2faMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: totp2faMsg.ok ? "#4ade80" : "#f87171" }}>
              {totp2faMsg.text}
            </div>
          )}

          {totpEnabled && !totp2fa && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: "10px" }}>
                <span style={{ fontSize: "18px" }}>✓</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "oklch(0.65 0.1 170)" }}>2FA activado</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>Tu cuenta está protegida con autenticación de dos factores</div>
                </div>
              </div>
              <button onClick={handleDisable2FA}
                style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "10px 16px", fontSize: "13px", color: "#f87171", cursor: "pointer", alignSelf: "flex-start" }}>
                Desactivar 2FA
              </button>
            </div>
          )}

          {!totpEnabled && !totp2fa && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
                Añade una capa extra de seguridad. Necesitarás un código de 6 dígitos en cada inicio de sesión.
              </p>
              <button onClick={handleSetup2FA} disabled={loadingQR}
                style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "11px 20px", fontSize: "13.5px", cursor: "pointer", alignSelf: "flex-start" }}>
                {loadingQR ? "Generando QR…" : "Configurar 2FA"}
              </button>
            </div>
          )}

          {totp2fa && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                1. Escanea el QR con la extensión RustVault o Google Authenticator<br/>
                2. Introduce el código de 6 dígitos para confirmar
              </p>
              <div style={{ background: "white", padding: "12px", borderRadius: "10px", display: "inline-block", width: "fit-content" }}>
                <QRCode value={totp2fa.qr_url} size={200} />
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 4px" }}>Código manual</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory-dim)", padding: "10px 12px", background: "var(--bg)", borderRadius: "7px", border: "1px solid var(--line-2)", wordBreak: "break-all", flex: 1, letterSpacing: "0.1em" }}>
                    {totp2fa.secret.match(/.{1,4}/g)?.join(" ") ?? totp2fa.secret}
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(totp2fa.secret)}
                    style={{ background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                    Copiar
                  </button>
                </div>
                <button onClick={() => navigator.clipboard.writeText(totp2fa.qr_url)}
                  style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--muted)", cursor: "pointer", alignSelf: "flex-start", fontFamily: "var(--font-mono)" }}>
                  📋 Copiar URL otpauth:// para usar en Códigos 2FA
                </button>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="tel" placeholder="000000" value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={e => { if (e.key === "Enter") handleConfirm2FA() }}
                  maxLength={6} autoFocus
                  style={{ ...inputStyle, width: "150px", fontFamily: "var(--font-mono)", fontSize: "26px", letterSpacing: "0.25em", textAlign: "center" }} />
                <button onClick={handleConfirm2FA} disabled={totpCode.length !== 6}
                  style={{ background: totpCode.length === 6 ? "var(--rust)" : "var(--rust-deep)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontSize: "13.5px", cursor: totpCode.length === 6 ? "pointer" : "not-allowed" }}>
                  Confirmar
                </button>
                <button onClick={() => { setTotp2fa(null); setTotpCode(""); setTotp2faMsg(null) }}
                  style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "var(--muted)", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Exportar / Importar ── */}
      {section === "exportar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Exportar datos</p>
            <p style={{ fontSize: "13.5px", color: "var(--ivory-dim)", margin: 0, lineHeight: "1.6" }}>
              Descarga un backup de todas tus contraseñas en formato JSON.
            </p>
            <button onClick={async () => {
              try {
                const res  = await fetch("/api/passwords?limit=1000", { headers: { Authorization: `Bearer ${token}` } })
                const data = await res.json()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement("a")
                a.href = url; a.download = `rustvault-backup-${new Date().toISOString().slice(0,10)}.json`
                a.click(); URL.revokeObjectURL(url)
              } catch (e) { alert("Error al exportar") }
            }}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "10px 16px", color: "var(--ivory-dim)", fontSize: "13.5px", cursor: "pointer", alignSelf: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar contraseñas (JSON)
            </button>
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Importar desde Bitwarden / LastPass</p>
            <p style={{ fontSize: "13.5px", color: "var(--ivory-dim)", margin: 0, lineHeight: "1.6" }}>
              Importa contraseñas desde un archivo CSV o desde un backup JSON de RustVault.
            </p>
            <ImportCSV token={token} mukHex={mukForImport} />
          </div>
        </div>
      )}

      {/* ── Eliminar cuenta ── */}
      {section === "eliminar" && (
        <div style={{ border: "1px solid rgba(220,38,38,0.2)", borderRadius: "14px", padding: "28px", background: "rgba(220,38,38,0.04)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#f87171", margin: 0 }}>Zona de peligro</p>
          <p style={{ fontSize: "14px", color: "var(--ivory-dim)", margin: 0, lineHeight: "1.6" }}>
            Esta acción es <strong style={{ color: "var(--ivory)" }}>irreversible</strong>. Se eliminarán todos tus datos.
          </p>
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Contraseña actual</label>
            <input type="password" value={deletePass} onChange={e => setDeletePass(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>Escribe "ELIMINAR MI CUENTA" para confirmar</label>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="ELIMINAR MI CUENTA"
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", color: confirmText === "ELIMINAR MI CUENTA" ? "#f87171" : "var(--ivory)" }} />
          </div>
          <button onClick={handleDelete} disabled={deleting || confirmText !== "ELIMINAR MI CUENTA" || !deletePass}
            style={{ background: confirmText === "ELIMINAR MI CUENTA" && deletePass ? "#dc2626" : "rgba(220,38,38,0.2)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px 20px", fontSize: "13.5px", cursor: (deleting || confirmText !== "ELIMINAR MI CUENTA" || !deletePass) ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
            {deleting ? "Eliminando…" : "Eliminar mi cuenta"}
          </button>
        </div>
      )}
    </div>
  )
}
