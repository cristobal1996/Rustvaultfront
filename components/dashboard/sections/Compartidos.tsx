// components/dashboard/sections/Compartidos.tsx
"use client"
import { useState, useEffect } from "react"
import { getMUK } from "@/lib/muk"
import { apiGet, apiPost, getToken } from "@/lib/api"
import { log } from "@/lib/log"

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
  domain_hint:        string | null
  message:            string | null
  permission:         string
  share_mode:         "permanent" | "temporary" | "one_shot"
  status:             string
  expires_at:         string | null
  created_at:         string
}

interface SentItem {
  id:                    string
  recipient_email_hint:  string
  title_hint:            string | null
  domain_hint:           string | null
  permission:            string
  share_mode:            "permanent" | "temporary" | "one_shot"
  status:                string
  expires_at:            string | null
  created_at:            string
}

interface FoundUser {
  id:          string
  email_hint:  string
  pub_key:     string | null
  invite_code: string | null
}

// ── Crypto helpers ────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
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

export function Compartidos() {
  const mukHex = getMUK()

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
  const [shareMode,       setShareMode]       = useState<"permanent" | "temporary" | "one_shot">("permanent")
  const [durationMinutes, setDurationMinutes] = useState<number>(1440) // 24h por defecto

  // Mi código de invitación
  const [myCode,     setMyCode]     = useState<string | null>(null)
  const [hasKeys,    setHasKeys]    = useState<boolean | null>(null)
  const [genKeys,    setGenKeys]    = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Detalle de inbox
  const [viewItem,    setViewItem]    = useState<InboxItem | null>(null)
  const [viewContent, setViewContent] = useState<Record<string, string> | string | null>(null)
  const [accepting,   setAccepting]   = useState(false)
  const [viewing,     setViewing]     = useState<string | null>(null)   // id del item siendo procesado
  const [actionMsg,   setActionMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Tick para forzar re-render del contador "Caduca en X"
  // (no afecta a la lógica, solo a lo que se muestra)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (getToken()) {
      loadAll()
      ensureKeysExist()
    }
  }, [])

  // ── Auto-actualización de expiradas ─────────────────────────────
  // Cada 10 segundos:
  //  1. Filtra localmente las que ya hayan expirado (frontend)
  //  2. Si había alguna a punto de expirar, recarga del backend para
  //     limpiar también las que aún están en BD
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      let hadExpired = false

      setInbox(prev => {
        const filtered = prev.filter(item => {
          if (!item.expires_at) return true                            // permanente
          if (item.share_mode === "permanent") return true             // permanente
          const expiresMs = new Date(item.expires_at).getTime()
          if (expiresMs <= now) {
            hadExpired = true
            return false
          }
          return true
        })
        return filtered.length === prev.length ? prev : filtered
      })

      // Si alguna expiró localmente, recargar del backend para sincronizar
      if (hadExpired) {
        loadAll()
      }
    }
    const id = setInterval(tick, 10_000)
    // Ejecutar también inmediatamente al montar
    tick()
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ensureKeysExist() {
    try {
      const profile = await apiGet<{ pub_key?: string; encrypted_priv_key?: any }>("/api/account/me")
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

      await apiPost("/api/account/keys", { pub_key: pubHex, encrypted_priv_key: encPrivKey })
      log.info("Claves generadas y guardadas OK")
      setHasKeys(true)
    } catch (e) {
      log.warn("No se pudieron generar las claves:", e)
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
      const [inboxRes, sentRes, pwRes, profileRes] = await Promise.allSettled([
        apiGet<InboxItem[]>("/api/sharing/inbox"),
        apiGet<SentItem[]>("/api/sharing/sent"),
        apiGet<{ data: Password[] }>("/api/passwords"),
        apiGet<{ invite_code?: string }>("/api/account/me"),
      ])
      if (inboxRes.status === "fulfilled")  setInbox(inboxRes.value)
      if (sentRes.status === "fulfilled")   setSent(sentRes.value)
      if (pwRes.status === "fulfilled")     setPasswords(pwRes.value.data ?? [])
      if (profileRes.status === "fulfilled" && profileRes.value.invite_code) {
        setMyCode(profileRes.value.invite_code)
      }
    } finally { setLoading(false) }
  }

  async function searchByCode() {
    if (!codeInput.trim()) return
    setSearching(true)
    setFoundUser(null)
    setSearchError(null)
    try {
      const data = await apiGet<FoundUser[] | FoundUser>(`/api/users/search?q=${encodeURIComponent(codeInput.trim())}`)
      const arr  = Array.isArray(data) ? data : [data]
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

      try {
        await apiPost("/api/sharing/send", {
          password_id:             pw.id,
          recipient_invite_code:   codeInput.trim(),
          encrypted_for_recipient: encryptedForRecipient,
          title_hint:              pw.title,
          domain_hint:             pw.domain,
          message:                 message.trim() || null,
          permission,
          share_mode:              shareMode,
          duration_minutes:        shareMode === "temporary" ? durationMinutes : undefined,
        })
        const modeMsg =
          shareMode === "permanent" ? ""
          : shareMode === "temporary" ? ` (caduca en ${formatDuration(durationMinutes)})`
          : " (un solo uso)"
        setSendMsg({ ok: true, text: `Contraseña compartida con ${foundUser.email_hint}${modeMsg}` })
        setFoundUser(null)
        setCodeInput("")
        setMessage("")
        setSelectedPw("")
        setShareMode("permanent")
        setDurationMinutes(1440)
        loadAll()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Error al compartir")
      }
    } catch (e: unknown) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : "Error desconocido" })
    } finally { setSending(false) }
  }

  async function viewShared(item: InboxItem) {
    // Guardia anti doble-click: si ya estamos procesando este item, ignorar
    if (viewing === item.id) return
    setViewing(item.id)

    setViewItem(item)
    setViewContent(null)
    setActionMsg(null)

    if (!mukHex) {
      setActionMsg({ ok: false, text: "Sesión expirada" })
      setViewing(null)
      return
    }

    try {
      const data = await apiGet<any>(`/api/sharing/${item.id}/view`)
      const blob = data.encrypted
      if (!blob?.ephemeral_pub) {
        setActionMsg({ ok: false, text: "La compartición no tiene contenido cifrado" })
        return
      }

      // 1. Obtener clave privada cifrada del perfil
      const profile = await apiGet<any>("/api/account/me")
      if (!profile.encrypted_priv_key) {
        setActionMsg({ ok: false, text: "No tienes clave privada registrada" })
        return
      }

      // 2. Descifrar clave privada con MUK
      const privKeyBytes = await aesDecrypt(profile.encrypted_priv_key, mukHex)
      if (!privKeyBytes) {
        setActionMsg({ ok: false, text: "No se pudo descifrar la clave privada" })
        return
      }

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
          setViewContent(content)
        } catch {
          setViewContent(new TextDecoder().decode(plain))
        }
      }

      // NOTA: si era one_shot, el backend YA borró la fila. Pero NO la
      // quitamos de la lista local hasta que el usuario cierre la vista,
      // porque el contenido se renderiza dentro del map de inbox.
      // En cambio, marcamos el item como "ya visto" (status='viewed')
      // localmente para que al volver a pulsar Ver no se intente otra vez.
      if (item.share_mode === "one_shot") {
        setInbox(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: "viewed" } : i
        ))
      }
    } catch (e) {
      log.error("viewShared error:", e)
      // Mensaje específico según el error del backend
      const msg = e instanceof Error ? e.message : "Error al ver la contraseña"
      if (msg.includes("vista anteriormente") || msg.includes("ya no está disponible")) {
        // La compartición ya no existe (one_shot ya vista o expirada).
        // Quitarla de la lista local.
        setInbox(prev => prev.filter(i => i.id !== item.id))
        setViewItem(null)
        setActionMsg({ ok: false, text: msg })
      } else {
        setActionMsg({ ok: false, text: msg })
      }
    } finally {
      setViewing(null)
    }
  }

  // Cuando el usuario cierra la vista de un one_shot, lo quitamos de la lista
  function closeView() {
    if (viewItem?.share_mode === "one_shot") {
      const idToRemove = viewItem.id
      setInbox(prev => prev.filter(i => i.id !== idToRemove))
    }
    setViewItem(null)
    setViewContent(null)
  }

  async function acceptShare(id: string) {
    if (!mukHex) return
    setAccepting(true)
    setActionMsg(null)

    try {
      const data = await apiPost<any>(`/api/sharing/${id}/accept`)

      if (!data.encrypted) {
        setActionMsg({ ok: false, text: "La respuesta no incluye contenido cifrado" })
        return
      }

      // 1. Obtener la clave privada cifrada del perfil
      const profile = await apiGet<{ encrypted_priv_key?: any }>("/api/account/me")
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

      // Extraer el dominio del JSON descifrado para que la extensión
      // pueda autocompletar después.
      // IMPORTANTE: `plain` es Uint8Array, hay que decodificarlo a string
      // antes de pasar a JSON.parse (si no, falla silenciosamente).
      let domain: string | null = null
      try {
        const plainText = new TextDecoder().decode(plain)
        const content = JSON.parse(plainText) as { url?: string }
        if (content.url) {
          domain = extractDomain(content.url)
        }
      } catch {
        // Si el plain no es JSON parseable, lo dejamos sin domain
      }

      await apiPost("/api/passwords", {
        title:      data.title_hint ?? "Contraseña compartida",
        domain,                           // ← ahora SÍ se pasa el dominio
        entry_type: "login",
        encrypted,
      })

      setActionMsg({ ok: true, text: "✓ Contraseña aceptada y guardada en tus entradas" })
      setInbox(prev => prev.filter(i => i.id !== id))
      setViewItem(null)
      loadAll()

    } catch (e: unknown) {
      log.error("acceptShare error:", e)
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : "Error al aceptar" })
    } finally { setAccepting(false) }
  }

  async function rejectShare(id: string) {
    await apiPost(`/api/sharing/${id}/reject`)
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
        <div className="card-padded p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="label-mono m-0 mb-[6px]">Mi código</p>
            <div className="flex items-center gap-[10px] flex-wrap">
              <span className="font-mono text-[18px] sm:text-[22px] tracking-[0.1em] text-rust-bright font-medium break-all">
                {myCode}
              </span>
              <button onClick={copyMyCode}
                className={`rounded-md px-[10px] py-1 text-[11px] font-mono cursor-pointer flex-shrink-0 transition-colors
                            ${codeCopied
                              ? "border border-patina text-patina bg-[color-mix(in_oklab,var(--patina)_15%,transparent)]"
                              : "border border-line-2 text-muted bg-bg hover:text-ivory"}`}>
                {codeCopied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <p className="font-mono text-[10px] text-muted m-0 mt-[6px] leading-[1.5]">
              Comparte este código para que puedan enviarte contraseñas
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elev rounded-[10px] p-1 border border-line">
        {[
          { id: "inbox" as const, label: `Recibidas${inbox.length ? ` (${inbox.length})` : ""}` },
          { id: "sent"  as const, label: "Enviadas" },
          { id: "share" as const, label: "Compartir" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-[7px] border-none text-xs sm:text-[13px] cursor-pointer transition-all duration-150 whitespace-nowrap
                        ${tab === t.id
                          ? "bg-bg text-ivory font-medium"
                          : "bg-transparent text-muted"}`}>
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
            <div key={item.id} className="card-padded p-4 sm:p-[18px]">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-sm font-medium text-ivory">{item.title_hint ?? "Contraseña compartida"}</span>
                    {item.share_mode === "permanent" && (
                      <span className="font-mono text-[9px] uppercase tracking-[1px] px-[6px] py-[2px] rounded"
                        style={{ color: "var(--muted)", border: "1px solid var(--line-2)" }}>
                        Permanente
                      </span>
                    )}
                    {item.share_mode === "temporary" && (
                      <span className="font-mono text-[9px] uppercase tracking-[1px] px-[6px] py-[2px] rounded"
                        style={{ color: "var(--rust-bright)", border: "1px solid color-mix(in oklab, var(--rust) 40%, transparent)" }}>
                        ⏱ Temporal
                      </span>
                    )}
                    {item.share_mode === "one_shot" && (
                      <span className="font-mono text-[9px] uppercase tracking-[1px] px-[6px] py-[2px] rounded"
                        style={{ color: "#f87171", border: "1px solid rgba(220,38,38,0.4)" }}>
                        👁 Un solo uso
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    De {item.sender_email_hint}
                    {item.expires_at && (
                      <> · {item.share_mode === "one_shot"
                        ? `Se borra al verla (caduca en ${timeUntilExpiry(item.expires_at)})`
                        : `Caduca en ${timeUntilExpiry(item.expires_at)}`}
                      </>
                    )}
                  </div>
                  {item.message && (
                    <p className="text-xs text-ivory-dim mt-2 italic break-words">"{item.message}"</p>
                  )}
                </div>
                <div className="flex gap-[6px] flex-shrink-0 flex-wrap sm:flex-nowrap">
                  {(() => {
                    const isExpired = item.expires_at != null
                      && item.share_mode !== "permanent"
                      && new Date(item.expires_at).getTime() <= Date.now()
                    return (
                      <button onClick={() => viewShared(item)}
                        disabled={viewing === item.id || isExpired}
                        title={isExpired ? "Esta compartición ha expirado" : ""}
                        className="bg-transparent border border-line-2 rounded-md px-[10px] py-[6px] text-xs text-ivory-dim cursor-pointer hover:text-ivory transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {viewing === item.id ? "…" :
                         isExpired ? "Expirada" :
                         (item.share_mode === "one_shot" ? "Ver (única vez)" : "Ver")}
                      </button>
                    )
                  })()}
                  {/* Solo las permanentes con permiso "copy" se pueden aceptar */}
                  {item.share_mode === "permanent" && item.permission === "copy" && (
                    <button onClick={() => acceptShare(item.id)} disabled={accepting}
                      className="bg-rust text-white border-none rounded-md px-3 py-[6px] text-xs cursor-pointer hover:bg-rust-bright transition-colors disabled:opacity-50">
                      {accepting ? "…" : "Aceptar"}
                    </button>
                  )}
                  <button onClick={() => rejectShare(item.id)}
                    className="bg-transparent border border-[rgba(220,38,38,0.25)] rounded-md px-[10px] py-[6px] text-xs text-[#f87171] cursor-pointer hover:bg-[rgba(220,38,38,0.08)] transition-colors">
                    Rechazar
                  </button>
                </div>
              </div>

              {/* Vista del contenido */}
              {viewItem?.id === item.id && viewContent && (
                <div style={{ marginTop: "12px", padding: "14px 16px", background: "var(--bg)", borderRadius: "10px", border: "1px solid var(--line-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>
                      Contraseña compartida
                    </p>
                    <button onClick={closeView}
                      style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                      Cerrar
                    </button>
                  </div>

                  {/* Aviso para one_shot */}
                  {viewItem.share_mode === "one_shot" && (
                    <div style={{
                      marginBottom: "12px", padding: "8px 12px",
                      background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.25)",
                      borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "10px",
                      color: "#f87171", lineHeight: 1.5,
                    }}>
                      ⚠ Esta contraseña es de un solo uso. Cópiala ahora, ya no podrás verla de nuevo.
                    </div>
                  )}

                  {typeof viewContent === "string" ? (
                    <pre style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ivory-dim)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{viewContent}</pre>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {viewItem?.domain_hint && (
                        <Row label="Dominio" value={viewItem.domain_hint}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--rust-bright)", wordBreak: "break-all" }}>{viewItem.domain_hint}</span>
                          <CopyBtn text={viewItem.domain_hint} />
                        </Row>
                      )}
                      {viewContent.url && (
                        <Row label="URL" value={viewContent.url}>
                          <a href={viewContent.url.startsWith("http") ? viewContent.url : `https://${viewContent.url}`}
                             target="_blank" rel="noopener noreferrer"
                             style={{ color: "var(--rust-bright)", fontFamily: "var(--font-mono)", fontSize: "13px", textDecoration: "none", wordBreak: "break-all" }}>
                            {viewContent.url} ↗
                          </a>
                        </Row>
                      )}
                      {viewContent.username && (
                        <Row label="Usuario" value={viewContent.username}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory)", wordBreak: "break-all" }}>{viewContent.username}</span>
                          <CopyBtn text={viewContent.username} />
                        </Row>
                      )}
                      {viewContent.password && (
                        <Row label="Contraseña" value={viewContent.password}>
                          <PasswordField value={viewContent.password} />
                        </Row>
                      )}
                      {viewContent.notes && (
                        <Row label="Notas" value={viewContent.notes}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory-dim)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{viewContent.notes}</span>
                        </Row>
                      )}
                      {Object.entries(viewContent)
                        .filter(([k]) => !["url","username","password","notes"].includes(k))
                        .map(([k, v]) => (
                          <Row key={k} label={k} value={String(v)}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory-dim)", wordBreak: "break-all" }}>{String(v)}</span>
                          </Row>
                        ))}
                    </div>
                  )}
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
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginBottom: "3px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ivory)" }}>{item.title_hint ?? "Contraseña"}</span>
                  {item.share_mode === "temporary" && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase" as const, color: "var(--rust-bright)", border: "1px solid color-mix(in oklab, var(--rust) 40%, transparent)", padding: "2px 6px", borderRadius: "4px" }}>
                      ⏱ Temporal
                    </span>
                  )}
                  {item.share_mode === "one_shot" && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase" as const, color: "#f87171", border: "1px solid rgba(220,38,38,0.4)", padding: "2px 6px", borderRadius: "4px" }}>
                      👁 Un solo uso
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>
                  Para {item.recipient_email_hint}
                  {item.expires_at && item.share_mode !== "permanent" && (
                    <> · Caduca en {timeUntilExpiry(item.expires_at)}</>
                  )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%", maxWidth: "520px", minWidth: 0 }}>
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
            <select value={selectedPw} onChange={e => setSelectedPw(e.target.value)} style={{ ...inp, maxWidth: "100%" }}>
              <option value="">Selecciona una contraseña…</option>
              {passwords.map(p => (
                <option key={p.id} value={p.id}>
                  {formatPasswordOption(p.title, p.domain)}
                </option>
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

          {/* Modo de compartir */}
          {foundUser && (
            <div>
              <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "8px" }}>
                Modo de compartir
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { id: "permanent" as const, label: "Permanente",  desc: "El destinatario puede guardarla en sus contraseñas" },
                  { id: "temporary" as const, label: "Temporal",    desc: "Caduca y se elimina automáticamente" },
                  { id: "one_shot"  as const, label: "Un solo uso", desc: "Se elimina al verla por primera vez (máx 7 días)" },
                ].map(m => (
                  <button key={m.id} onClick={() => setShareMode(m.id)} type="button"
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${shareMode === m.id ? "var(--rust)" : "var(--line-2)"}`,
                      borderRadius: "8px",
                      background: shareMode === m.id ? "color-mix(in oklab, var(--rust) 10%, transparent)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left" as const,
                    }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" as const, color: shareMode === m.id ? "var(--rust-bright)" : "var(--muted)" }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--ivory-dim)", marginTop: "2px" }}>
                      {m.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Selector de duración solo si es temporal */}
              {shareMode === "temporary" && (
                <div style={{ marginTop: "10px" }}>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: "6px" }}>
                    Caducidad
                  </label>
                  <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                    style={{ ...inp, maxWidth: "100%", cursor: "pointer" }}>
                    <option value={15}>15 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={1440}>24 horas</option>
                    <option value={10080}>7 días</option>
                    <option value={43200}>30 días</option>
                  </select>
                </div>
              )}
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

// ── Componentes auxiliares para mostrar la contraseña compartida ──

function Row({ label, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      style={{
        background: "transparent", border: "1px solid var(--line-2)",
        borderRadius: "6px", padding: "4px 10px", fontSize: "10px",
        color: copied ? "#10b981" : "var(--muted)", cursor: "pointer",
        fontFamily: "var(--font-mono)", letterSpacing: "0.5px",
      }}>
      {copied ? "✓ Copiado" : "Copiar"}
    </button>
  )
}

function PasswordField({ value }: { value: string }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory)", wordBreak: "break-all", letterSpacing: shown ? "normal" : "2px" }}>
        {shown ? value : "•".repeat(Math.min(value.length, 16))}
      </span>
      <button onClick={() => setShown(!shown)}
        style={{
          background: "transparent", border: "1px solid var(--line-2)",
          borderRadius: "6px", padding: "4px 10px", fontSize: "10px",
          color: "var(--muted)", cursor: "pointer",
          fontFamily: "var(--font-mono)", letterSpacing: "0.5px",
        }}>
        {shown ? "Ocultar" : "Mostrar"}
      </button>
      <CopyBtn text={value} />
    </>
  )
}

// ── Helper para extraer el dominio de una URL ─────────────────────
// Soporta URLs completas (https://github.com/user) y dominios sueltos (github.com)
function extractDomain(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    // Si tiene esquema (https://, http://, etc), usar URL
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    // No es una URL parseable, devolver tal cual sin www
    return trimmed.replace(/^www\./, "").split("/")[0] || null
  }
}

// ── Helper para formatear texto del <option> del dropdown ─────────
// Evita redundancia (title == domain) y trunca textos largos
// para que el dropdown no se desborde en móvil.
function formatPasswordOption(title: string, domain: string | null): string {
  const MAX_LEN = 32

  // Normalizar para comparar: sin www, en minúsculas
  const normTitle  = title.toLowerCase().replace(/^www\./, "").trim()
  const normDomain = (domain ?? "").toLowerCase().replace(/^www\./, "").trim()

  // Si title y domain son el mismo (o muy parecidos), mostrar solo el title
  let label = (normDomain && normTitle !== normDomain)
    ? `${title} (${domain})`
    : title

  // Truncar si es muy largo
  if (label.length > MAX_LEN) {
    label = label.slice(0, MAX_LEN - 1) + "…"
  }

  return label
}

// Formatea minutos a un texto legible: "15 minutos", "1 hora", "24 horas", "7 días"...
function formatDuration(minutes: number): string {
  if (minutes < 60)        return `${minutes} minuto${minutes !== 1 ? "s" : ""}`
  if (minutes < 1440)      return `${minutes / 60} hora${minutes / 60 !== 1 ? "s" : ""}`
  const days = minutes / 1440
  return `${days} día${days !== 1 ? "s" : ""}`
}

// Calcula cuánto falta para que expire una compartición (o null si no caduca)
function timeUntilExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "expirada"
  const secs  = Math.floor(ms / 1000)
  if (secs < 60)  return `${secs} s`
  const mins  = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} día${days !== 1 ? "s" : ""}`
}
