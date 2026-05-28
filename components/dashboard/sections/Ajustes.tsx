// components/dashboard/sections/Ajustes.tsx
"use client"
import { useState } from "react"

interface Props { token: string; onLogout: () => void }

export function Ajustes({ token, onLogout }: Props) {
  const [section, setSection] = useState<"principal" | "2fa" | "exportar" | "eliminar">("principal")

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
      const res = await fetch("/api/account/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          current_password: currentPass,
          new_password:     newPass,
          new_srp_salt:     "placeholder",
          new_srp_verifier: "placeholder",
          rekeyed_vaults:   [],
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPassMsg({ ok: true, text: "Contraseña cambiada. Las otras sesiones han sido cerradas." })
        setCurrentPass(""); setNewPass(""); setNewPass2("")
      } else {
        setPassMsg({ ok: false, text: data.error ?? "Error al cambiar la contraseña" })
      }
    } catch {
      setPassMsg({ ok: false, text: "Error de conexión" })
    } finally {
      setSavingPass(false)
    }
  }

  async function handleSetup2FA() {
    setLoadingQR(true)
    try {
      const res  = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setTotp2fa(data)
    } finally {
      setLoadingQR(false)
    }
  }

  async function handleConfirm2FA() {
    const res  = await fetch("/api/auth/2fa/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:   JSON.stringify({ code: totpCode, encrypted_secret: { nonce: "00", ciphertext: "00" } }),
    })
    if (res.ok) setTotp2faMsg({ ok: true, text: "2FA activado correctamente" })
    else        setTotp2faMsg({ ok: false, text: "Código incorrecto" })
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
    { id: "principal", label: "Contraseña"      },
    { id: "2fa",       label: "Autenticación 2FA" },
    { id: "exportar",  label: "Exportar datos"   },
    { id: "eliminar",  label: "Eliminar cuenta"  },
  ] as const

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--line-2)",
    borderRadius: "8px", padding: "10px 12px", fontSize: "14px",
    color: "var(--ivory)", outline: "none", boxSizing: "border-box",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>Cuenta</p>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", margin: 0 }}>
          <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>Ajustes</em> de cuenta
        </h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            style={{ padding: "8px 14px", border: `1px solid ${section === t.id ? "var(--rust)" : "var(--line-2)"}`, borderRadius: "8px", background: section === t.id ? "color-mix(in oklab, var(--rust) 12%, transparent)" : "transparent", color: section === t.id ? "var(--rust-bright)" : "var(--muted)", fontSize: "13px", cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 140ms" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cambio de contraseña ── */}
      {section === "principal" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Cambiar contraseña maestra</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", margin: 0, lineHeight: "1.6" }}>
            Al cambiar la contraseña maestra se re-cifran automáticamente todas tus Vault Keys y se cierran las sesiones de otros dispositivos.
          </p>
          {passMsg && (
            <div style={{ background: passMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${passMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: passMsg.ok ? "#4ade80" : "#f87171" }}>
              {passMsg.text}
            </div>
          )}
          {[
            { label: "Contraseña actual",     val: currentPass, set: setCurrentPass },
            { label: "Nueva contraseña",      val: newPass,     set: setNewPass     },
            { label: "Confirmar nueva contraseña", val: newPass2, set: setNewPass2 },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "6px" }}>{f.label}</label>
              <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={inputStyle} />
            </div>
          ))}
          <button onClick={handleChangePassword} disabled={savingPass}
            style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: savingPass ? "not-allowed" : "pointer", alignSelf: "flex-start", paddingLeft: "24px", paddingRight: "24px" }}>
            {savingPass ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </div>
      )}

      {/* ── 2FA ── */}
      {section === "2fa" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Segundo factor de autenticación</p>
          {!totp2fa ? (
            <button onClick={handleSetup2FA} disabled={loadingQR}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "11px 20px", fontSize: "13.5px", cursor: "pointer", alignSelf: "flex-start" }}>
              {loadingQR ? "Generando QR…" : "Configurar 2FA"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                Escanea este QR con Google Authenticator, Authy o similar. Luego introduce el código de 6 dígitos para confirmar.
              </p>
              <div style={{ background: "white", padding: "16px", borderRadius: "10px", display: "inline-block", width: "fit-content" }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totp2fa.qr_url)}`} alt="QR 2FA" style={{ display: "block", width: "180px", height: "180px" }} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ivory-dim)", padding: "10px 12px", background: "var(--bg)", borderRadius: "7px", border: "1px solid var(--line-2)", wordBreak: "break-all" }}>
                {totp2fa.secret}
              </div>
              {totp2faMsg && (
                <div style={{ background: totp2faMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${totp2faMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: totp2faMsg.ok ? "#4ade80" : "#f87171" }}>
                  {totp2faMsg.text}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="text" placeholder="Código de 6 dígitos" value={totpCode} onChange={e => setTotpCode(e.target.value)} maxLength={6}
                  style={{ ...inputStyle, width: "180px", fontFamily: "var(--font-mono)", fontSize: "20px", letterSpacing: "0.15em", textAlign: "center" }} />
                <button onClick={handleConfirm2FA}
                  style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontSize: "13.5px", cursor: "pointer" }}>
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Exportar ── */}
      {section === "exportar" && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Exportar datos</p>
          <p style={{ fontSize: "14px", color: "var(--ivory-dim)", margin: 0, lineHeight: "1.6" }}>
            Descarga un backup de todos tus vaults. El archivo contiene los blobs cifrados — necesitarás tu contraseña maestra para leerlo.
          </p>
          {[
            { label: "Exportar vault Personal",      vaultId: "" },
            { label: "Exportar todos los vaults",    vaultId: "all" },
          ].map(opt => (
            <a key={opt.label}
              href={opt.vaultId === "all" ? "#" : `/api/transfer/export?vault_id=${opt.vaultId}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "10px 16px", color: "var(--ivory-dim)", fontSize: "13.5px", textDecoration: "none", alignSelf: "flex-start", transition: "border-color 140ms ease" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {opt.label}
            </a>
          ))}
        </div>
      )}

      {/* ── Eliminar cuenta ── */}
      {section === "eliminar" && (
        <div style={{ border: "1px solid rgba(220,38,38,0.2)", borderRadius: "14px", padding: "28px", background: "rgba(220,38,38,0.04)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#f87171", margin: 0 }}>Zona de peligro</p>
          <p style={{ fontSize: "14px", color: "var(--ivory-dim)", margin: 0, lineHeight: "1.6" }}>
            Esta acción es <strong style={{ color: "var(--ivory)" }}>irreversible</strong>. Se eliminarán todos tus datos, vaults, entradas y sesiones.
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
            style={{ background: confirmText === "ELIMINAR MI CUENTA" && deletePass ? "#dc2626" : "rgba(220,38,38,0.2)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px 20px", fontSize: "13.5px", cursor: (deleting || confirmText !== "ELIMINAR MI CUENTA" || !deletePass) ? "not-allowed" : "pointer", alignSelf: "flex-start", transition: "background 200ms" }}>
            {deleting ? "Eliminando…" : "Eliminar mi cuenta permanentemente"}
          </button>
        </div>
      )}
    </div>
  )
}
