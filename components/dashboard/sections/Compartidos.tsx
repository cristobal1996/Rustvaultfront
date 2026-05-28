// components/dashboard/sections/Compartidos.tsx
"use client"
import { useState, useEffect } from "react"
import { getMUK } from "@/lib/muk"

interface Props { token: string }

// ── Tipos ─────────────────────────────────────────────────────────

interface Password {
  id:    string
  title: string
  domain: string | null
  encrypted: { nonce: string; ciphertext: string }
}

interface InboxItem {
  id:                 string
  sender_email_hint:  string
  title_hint:         string | null
  message:            string | null
  permission:         string
  status:             string
  expires_at:         string
  created_at:         string
}

interface SentItem {
  id:                    string
  recipient_email_hint:  string
  title_hint:            string | null
  permission:            string
  status:                string
  expires_at:            string
  created_at:            string
}

interface FoundUser {
  id:          string
  email_hint:  string
  pub_key:     string | null
  invite_code: string | null
}

// ── Crypto helpers ────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

async function aesDecrypt(blob: { nonce: string; ciphertext: string }, keyHex: string): Promise<Uint8Array | null> {
  try {
    const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["decrypt"])
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(blob.nonce) }, key, hexToBytes(blob.ciphertext))
    return new Uint8Array(plain)
  } catch { return null }
}

async function aesEncrypt(data: Uint8Array, keyHex: string): Promise<{ nonce: string; ciphertext: string }> {
  const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["encrypt"])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data)
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }
}

// ECIES simplificado: re-cifrar con clave pública X25519 del destinatario
// El cliente hace el ECDH efímero y AES-GCM en el navegador
async function encryptForRecipient(plaintext: Uint8Array, recipientPubHex: string): Promise<{ ephemeral_pub: string; nonce: string; ciphertext: string }> {
  // Generar par efímero X25519
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])

  // ECDH con la clave pública del destinatario
  const recipientKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(recipientPubHex),
    { name: "ECDH", namedCurve: "P-256" },
    false, []   // clave pública — sin usos
  )

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientKey },
    ephemeral.privateKey,
    256
  )

  // HKDF para derivar clave AES
  const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"])
  const aesBits  = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("rustvault-sharing-v1") },
    hkdfKey, 256
  )

  const encrypted = await aesEncrypt(plaintext, bytesToHex(new Uint8Array(aesBits)))

  // Exportar clave pública efímera
  const ephPubRaw = await crypto.subtle.exportKey("raw", ephemeral.publicKey)

  return {
    ephemeral_pub: bytesToHex(new Uint8Array(ephPubRaw)),
    ...encrypted,
  }
}

// ── Componente ────────────────────────────────────────────────────

export function Compartidos({ token: tokenProp }: Props) {
  const mukHex = getMUK()
  const [token, setToken] = useState(tokenProp)

  useEffect(() => {
    // Si el prop llega vacío, leerlo del localStorage
    if (!token) {
      const t = localStorage.getItem("rv_token") ?? ""
      setToken(t)
    }
  }, [tokenProp])

  // Actualizar cuando cambia el prop
  useEffect(() => {
    if (tokenProp) setToken(tokenProp)
  }, [tokenProp])

  const [tab,       setTab]       = useState<"inbox" | "sent" | "share">("inbox")
  const [inbox,     setInbox]     = useState<InboxItem[]>([])
  const [sent,      setSent]      = useState<SentItem[]>([])
  const [passwords, setPasswords] = useState<Password[]>([])
  const [loading,   setLoading]   = useState(false)

  // Formulario enviar
  const [selectedPw,   setSelectedPw]   = useState("")
  const [codeInput,    setCodeInput]    = useState("")
  const [searching,    setSearching]    = useState(false)
  const [foundUser,    setFoundUser]    = useState<FoundUser | null>(null)
  const [searchError,  setSearchError]  = useState<string | null>(null)
  const [permission,   setPermission]   = useState<"view" | "copy">("copy")
  const [message,      setMessage]      = useState("")
  const [sending,      setSending]      = useState(false)
  const [sendMsg,      setSendMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  // Mi código de invitación
  const [myCode,     setMyCode]     = useState<string | null>(null)
  const [hasKeys,    setHasKeys]    = useState<boolean | null>(null)
  const [genKeys,    setGenKeys]    = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Detalle de inbox
  const [viewItem,    setViewItem]    = useState<InboxItem | null>(null)
  const [viewContent, setViewContent] = useState<string | null>(null)
  const [accepting,   setAccepting]   = useState(false)
  const [actionMsg,   setActionMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (token) {
      loadAll()
      ensureKeysExist()
    }
  }, [token])

  async function ensureKeysExist() {
    try {
      const profile = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      if (profile.pub_key && profile.encrypted_priv_key) { setHasKeys(true); return }  // ya tiene par completo

      const mukHex = getMUK()
      if (!mukHex) return

      // Generar par de claves P-256
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      )

      // Exportar clave pública
      const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey)
      const pubHex = Array.from(new Uint8Array(pubRaw)).map(b => b.toString(16).padStart(2, "0")).join("")

      // Exportar clave privada y cifrarla con la MUK
      const privRaw    = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
      const privBytes  = new Uint8Array(privRaw)
      const aesKey     = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["encrypt"])
      const nonce      = crypto.getRandomValues(new Uint8Array(12))
      const privCt     = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, privBytes)
      const encPrivKey = { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(privCt)) }

      await fetch("/api/account/keys", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ pub_key: pubHex, encrypted_priv_key: encPrivKey }),
      })
      console.log("Claves generadas y guardadas OK")
      setHasKeys(true)
    } catch (e) {
      console.warn("No se pudieron generar las claves:", e)
      setHasKeys(false)
    }
  }

  async function generateKeysNow() {
    setGenKeys(true)
    await ensureKeysExist()
    setGenKeys(false)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [inboxRes, sentRes, pwRes, profileRes] = await Promise.all([
        fetch("/api/sharing/inbox",  { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/sharing/sent",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/passwords",      { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/account/me",     { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (inboxRes.ok)   setInbox(await inboxRes.json())
      if (sentRes.ok)    setSent(await sentRes.json())
      if (pwRes.ok)      setPasswords((await pwRes.json()).data ?? [])
      if (profileRes.ok) {
        const p = await profileRes.json()
        if (p.invite_code) setMyCode(p.invite_code)
      }
    } finally { setLoading(false) }
  }

  async function searchByCode() {
    if (!codeInput.trim()) return
    setSearching(true)
    setFoundUser(null)
    setSearchError(null)
    try {
      const res  = await fetch(`/api/users/search?q=${encodeURIComponent(codeInput.trim())}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const arr  = Array.isArray(data) ? data : []
      if (!arr.length) setSearchError(`No se encontró ningún usuario con el código ${codeInput.trim().toUpperCase()}`)
      else setFoundUser(arr[0])
    } catch { setSearchError("Error de conexión") }
    finally { setSearching(false) }
  }

  async function sendShare() {
    if (!selectedPw || !foundUser || !mukHex) return
    setSending(true)
    setSendMsg(null)

    try {
      // Obtener la contraseña seleccionada
      const pw = passwords.find(p => p.id === selectedPw)
      if (!pw) throw new Error("Contraseña no encontrada")
      if (!foundUser.pub_key) throw new Error("El destinatario no tiene clave pública — debe iniciar sesión en la app al menos una vez")

      // Descifrar el contenido con nuestra MUK
      const plainBytes = await aesDecrypt(pw.encrypted, mukHex)
      if (!plainBytes) throw new Error("No se pudo descifrar la contraseña")

      // Re-cifrar con la clave pública del destinatario (ECIES)
      const encryptedForRecipient = await encryptForRecipient(plainBytes, foundUser.pub_key)

      const res = await fetch("/api/sharing/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          password_id:             pw.id,
          recipient_invite_code:   codeInput.trim(),
          encrypted_for_recipient: encryptedForRecipient,
          title_hint:              pw.title,
          message:                 message.trim() || null,
          permission,
        }),
      })

      if (res.ok) {
        setSendMsg({ ok: true, text: `Contraseña compartida con ${foundUser.email_hint}` })
        setFoundUser(null)
        setCodeInput("")
        setMessage("")
        setSelectedPw("")
        loadAll()
      } else {
        const err = await res.json()
        throw new Error(err.error ?? "Error al compartir")
      }
    } catch (e: unknown) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : "Error desconocido" })
    } finally { setSending(false) }
  }

  async function viewShared(item: InboxItem) {
    setViewItem(item)
    setViewContent(null)
    setActionMsg(null)

    if (!mukHex) return

    try {
      const res  = await fetch(`/api/sharing/${item.id}/view`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) return

      const blob = data.encrypted
      if (!blob?.ephemeral_pub) return

      // 1. Obtener clave privada cifrada del perfil
      const profile = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      if (!profile.encrypted_priv_key) return

      // 2. Descifrar clave privada con MUK
      const privKeyBytes = await aesDecrypt(profile.encrypted_priv_key, mukHex)
      if (!privKeyBytes) return

      // 3. Importar clave privada PKCS8
      const privateKey = await crypto.subtle.importKey(
        "pkcs8", privKeyBytes,
        { name: "ECDH", namedCurve: "P-256" },
        false, ["deriveBits"]
      )

      // 4. ECDH con la clave pública efímera
      const ephemeralKey = await crypto.subtle.importKey(
        "raw", hexToBytes(blob.ephemeral_pub),
        { name: "ECDH", namedCurve: "P-256" },
        false, []
      )

      const sharedBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralKey },
        privateKey, 256
      )

      // 5. HKDF → clave AES
      const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"])
      const aesBits  = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("rustvault-sharing-v1") },
        hkdfKey, 256
      )

      // 6. Descifrar contenido
      const plain = await aesDecrypt({ nonce: blob.nonce, ciphertext: blob.ciphertext }, bytesToHex(new Uint8Array(aesBits)))
      if (plain) {
        try {
          const content = JSON.parse(new TextDecoder().decode(plain))
          setViewContent(JSON.stringify(content, null, 2))
        } catch {
          setViewContent(new TextDecoder().decode(plain))
        }
      }
    } catch (e) {
      console.error("viewShared error:", e)
    }
  }

  async function acceptShare(id: string) {
    if (!mukHex) return
    setAccepting(true)
    setActionMsg(null)

    try {
      const res  = await fetch(`/api/sharing/${id}/accept`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()

      if (!res.ok) {
        setActionMsg({ ok: false, text: data.error ?? "Error al aceptar" })
        return
      }

      if (!data.encrypted) {
        setActionMsg({ ok: false, text: "La respuesta no incluye contenido cifrado" })
        return
      }

      // 1. Obtener la clave privada cifrada del perfil
      const profile = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      if (!profile.encrypted_priv_key) {
        setActionMsg({ ok: false, text: "No tienes clave privada registrada — abre Compartidos para generarla" })
        return
      }

      // 2. Descifrar la clave privada con la MUK
      const privKeyBytes = await aesDecrypt(profile.encrypted_priv_key, mukHex)
      if (!privKeyBytes) {
        setActionMsg({ ok: false, text: "No se pudo descifrar la clave privada" })
        return
      }

      // 3. Importar la clave privada PKCS8
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privKeyBytes,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits"]
      )

      // 4. Descifrar el contenido con ECIES usando la clave privada
      const blob = data.encrypted
      const ephPubBytes = hexToBytes(blob.ephemeral_pub)
      const ephemeralKey = await crypto.subtle.importKey(
        "raw", ephPubBytes,
        { name: "ECDH", namedCurve: "P-256" },
        false, []
      )

      const sharedBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralKey },
        privateKey,
        256
      )

      // HKDF para derivar clave AES
      const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"])
      const aesBits  = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("rustvault-sharing-v1") },
        hkdfKey, 256
      )
      const aesKeyHex = bytesToHex(new Uint8Array(aesBits))

      // Descifrar el contenido
      const plain = await aesDecrypt({ nonce: blob.nonce, ciphertext: blob.ciphertext }, aesKeyHex)
      if (!plain) {
        setActionMsg({ ok: false, text: "No se pudo descifrar el contenido compartido" })
        return
      }

      // 5. Re-cifrar con nuestra MUK y guardar como contraseña propia
      const encrypted = await aesEncrypt(plain, mukHex)
      await fetch("/api/passwords", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          title:      data.title_hint ?? "Contraseña compartida",
          entry_type: "login",
          encrypted,
        }),
      })

      setActionMsg({ ok: true, text: "✓ Contraseña aceptada y guardada en tus entradas" })
      setInbox(prev => prev.filter(i => i.id !== id))
      setViewItem(null)
      loadAll()

    } catch (e: unknown) {
      console.error("acceptShare error:", e)
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "Error al aceptar" })
    } finally { setAccepting(false) }
  }

  async function rejectShare(id: string) {
    await fetch(`/api/sharing/${id}/reject`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
    setInbox(prev => prev.filter(i => i.id !== id))
    setViewItem(null)
    loadAll()
  }

  function copyMyCode() {
    if (!myCode) return
    navigator.clipboard.writeText(myCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const statusColor = (s: string) => ({
    pending:  "var(--rust-bright)",
    accepted: "oklch(0.65 0.1 170)",
    rejected: "#ef4444",
    expired:  "var(--muted)",
  }[s] ?? "var(--muted)")

  const inp: React.CSSProperties = {
    background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "8px",
    padding: "9px 11px", fontSize: "13px", color: "var(--ivory)", outline: "none",
    width: "100%", boxSizing: "border-box" as const,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Mi código de invitación */}
      {/* Aviso si no hay claves generadas */}
      {(hasKeys === false || hasKeys === null) && !genKeys && (
        <div style={{ border: "1px solid rgba(220,38,38,0.3)", borderRadius: "12px", padding: "16px 18px", background: "rgba(220,38,38,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#f87171", margin: "0 0 4px" }}>Clave de cifrado no generada</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>
              Necesitas generar tu par de claves para recibir contraseñas compartidas
            </p>
          </div>
          <button onClick={generateKeysNow} disabled={genKeys}
            style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>
            {genKeys ? "Generando…" : "Generar claves"}
          </button>
        </div>
      )}

      {myCode && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "16px 20px", background: "var(--bg-elev)", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>Mi código</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "22px", letterSpacing: "0.1em", color: "var(--rust-bright)", fontWeight: 500 }}>{myCode}</span>
              <button onClick={copyMyCode}
                style={{ background: codeCopied ? "color-mix(in oklab, var(--patina) 15%, transparent)" : "var(--bg)", border: `1px solid ${codeCopied ? "var(--patina)" : "var(--line-2)"}`, borderRadius: "6px", padding: "4px 10px", color: codeCopied ? "var(--patina)" : "var(--muted)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                {codeCopied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", margin: "6px 0 0", lineHeight: "1.5" }}>
              Comparte este código para que puedan enviarte contraseñas
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: "var(--bg-elev)", borderRadius: "10px", padding: "4px", border: "1px solid var(--line)" }}>
        {[
          { id: "inbox" as const, label: `Recibidas${inbox.length ? ` (${inbox.length})` : ""}` },
          { id: "sent"  as const, label: "Enviadas" },
          { id: "share" as const, label: "Compartir" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", background: tab === t.id ? "var(--bg)" : "transparent", color: tab === t.id ? "var(--ivory)" : "var(--muted)", fontSize: "13px", cursor: "pointer", fontWeight: tab === t.id ? 500 : 400, transition: "all 140ms" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Bandeja de entrada ── */}
      {tab === "inbox" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {actionMsg && (
            <div style={{ background: actionMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${actionMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: actionMsg.ok ? "#4ade80" : "#f87171" }}>
              {actionMsg.text}
            </div>
          )}

          {loading ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)" }}>Cargando…</div>
          ) : inbox.length === 0 ? (
            <div style={{ border: "1px dashed var(--line-2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>Sin contraseñas recibidas</p>
            </div>
          ) : inbox.map(item => (
            <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "16px 18px", background: "var(--bg-elev)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ivory)" }}>{item.title_hint ?? "Contraseña compartida"}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase", color: statusColor(item.status), padding: "2px 6px", border: `1px solid ${statusColor(item.status)}33`, borderRadius: "4px" }}>{item.permission}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>
                    De {item.sender_email_hint} · Caduca {new Date(item.expires_at).toLocaleDateString("es")}
                  </div>
                  {item.message && (
                    <p style={{ fontSize: "12px", color: "var(--ivory-dim)", margin: "8px 0 0", fontStyle: "italic" }}>"{item.message}"</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button onClick={() => viewShared(item)}
                    style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "6px 10px", fontSize: "12px", color: "var(--ivory-dim)", cursor: "pointer" }}>
                    Ver
                  </button>
                  {item.permission === "copy" && (
                    <button onClick={() => acceptShare(item.id)} disabled={accepting}
                      style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
                      {accepting ? "…" : "Aceptar"}
                    </button>
                  )}
                  <button onClick={() => rejectShare(item.id)}
                    style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "7px", padding: "6px 10px", fontSize: "12px", color: "#f87171", cursor: "pointer" }}>
                    Rechazar
                  </button>
                </div>
              </div>

              {/* Vista del contenido */}
              {viewItem?.id === item.id && viewContent && (
                <div style={{ marginTop: "12px", padding: "12px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--line-2)" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>Contenido descifrado</p>
                  <pre style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ivory-dim)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {viewContent}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Enviadas ── */}
      {tab === "sent" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sent.length === 0 ? (
            <div style={{ border: "1px dashed var(--line-2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>Aún no has compartido ninguna contraseña</p>
            </div>
          ) : sent.map(item => (
            <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "14px 16px", background: "var(--bg-elev)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--ivory)", marginBottom: "3px" }}>{item.title_hint ?? "Contraseña"}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>
                  Para {item.recipient_email_hint} · {item.permission}
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", color: statusColor(item.status), padding: "3px 8px", border: `1px solid ${statusColor(item.status)}33`, borderRadius: "4px" }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Compartir ── */}
      {tab === "share" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "520px" }}>
          {sendMsg && (
            <div style={{ background: sendMsg.ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${sendMsg.ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.2)"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: sendMsg.ok ? "#4ade80" : "#f87171" }}>
              {sendMsg.text}
            </div>
          )}

          {!mukHex && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "10px", padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#f87171" }}>
              Sesión expirada — cierra sesión y vuelve a entrar para compartir contraseñas
            </div>
          )}

          {/* Seleccionar contraseña */}
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "6px" }}>
              Contraseña a compartir
            </label>
            <select value={selectedPw} onChange={e => setSelectedPw(e.target.value)} style={inp}>
              <option value="">Selecciona una contraseña…</option>
              {passwords.map(p => (
                <option key={p.id} value={p.id}>{p.title}{p.domain ? ` (${p.domain})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Buscar destinatario */}
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "6px" }}>
              Código del destinatario
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setFoundUser(null); setSearchError(null) }}
                onKeyDown={e => e.key === "Enter" && searchByCode()}
                placeholder="RV-XXXX-XXXX" maxLength={12}
                style={{ ...inp, fontFamily: "var(--font-mono)", fontSize: "16px", letterSpacing: "0.08em" }} />
              <button onClick={searchByCode} disabled={searching || codeInput.length < 3}
                style={{ background: "var(--bg-elev)", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "9px 16px", color: "var(--ivory-dim)", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>
                {searching ? "…" : "Buscar"}
              </button>
            </div>
            {searchError && <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#f87171", margin: "6px 0 0" }}>{searchError}</p>}
          </div>

          {/* Usuario encontrado */}
          {foundUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--bg)" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))", display: "grid", placeItems: "center", fontFamily: "var(--font-serif)", fontSize: "16px", color: "#f8f0e4", flexShrink: 0 }}>
                {foundUser.email_hint[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--ivory)" }}>{foundUser.email_hint}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: foundUser.pub_key ? "var(--patina)" : "#f87171" }}>
                  {foundUser.pub_key ? "✓ Listo para recibir" : "✗ Sin clave pública — debe iniciar sesión en la app"}
                </div>
              </div>
              <button onClick={() => { setFoundUser(null); setCodeInput("") }}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "18px" }}>×</button>
            </div>
          )}

          {/* Permiso */}
          {foundUser && (
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "8px" }}>
                Permiso
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { id: "view" as const,  label: "Solo ver",     desc: "Puede ver temporalmente sin guardar" },
                  { id: "copy" as const,  label: "Copiar",       desc: "Puede guardarla como suya" },
                ].map(p => (
                  <button key={p.id} onClick={() => setPermission(p.id)}
                    style={{ flex: 1, padding: "10px", border: `1px solid ${permission === p.id ? "var(--rust)" : "var(--line-2)"}`, borderRadius: "8px", background: permission === p.id ? "color-mix(in oklab, var(--rust) 10%, transparent)" : "transparent", cursor: "pointer", textAlign: "left" as const }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" as const, color: permission === p.id ? "var(--rust-bright)" : "var(--muted)" }}>{p.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--ivory-dim)", marginTop: "2px" }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mensaje opcional */}
          {foundUser && (
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "6px" }}>
                Mensaje (opcional)
              </label>
              <input value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Aquí tienes las credenciales…" style={inp} />
            </div>
          )}

          {/* Botón enviar */}
          {foundUser && (
            <button onClick={sendShare}
              disabled={sending || !selectedPw || !foundUser.pub_key || !mukHex}
              style={{ background: sending || !selectedPw || !foundUser.pub_key ? "var(--rust-deep)" : "var(--rust)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
              {sending ? "Cifrando y enviando…" : "Compartir contraseña"}
            </button>
          )}

          {/* Cómo funciona */}
          {!foundUser && (
            <div style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "16px", background: "var(--bg-elev)", marginTop: "4px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>Cómo funciona</p>
              {[
                ["01", "Elige la contraseña que quieres compartir"],
                ["02", "Introduce el código RV-XXXX-XXXX del destinatario"],
                ["03", "La contraseña se cifra con su clave pública en tu navegador"],
                ["04", "El servidor guarda el blob cifrado — no puede leerlo"],
                ["05", "El destinatario la acepta y se guarda con su propia clave"],
              ].map(([n, t]) => (
                <div key={n} style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--rust-bright)", flexShrink: 0 }}>{n}</span>
                  <span style={{ fontSize: "12.5px", color: "var(--ivory-dim)", lineHeight: "1.5" }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
