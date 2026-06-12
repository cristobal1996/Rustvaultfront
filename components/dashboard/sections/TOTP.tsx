// components/dashboard/sections/TOTP.tsx
"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { QrCodeIcon } from "@heroicons/react/24/outline"
import { getMUK } from "@/lib/muk"
import { aesDecrypt, aesEncryptText, type EncryptedBlob } from "@/lib/crypto"
import { hexToBytes, bytesToHex } from "@/lib/hex"
import { apiGet, apiPost, apiDelete } from "@/lib/api"
import { log } from "@/lib/log"
import { QrScanner } from "@/components/ui/QrScanner"

interface TOTPCredential {
  id:               string
  issuer:           string | null
  account:          string | null
  algorithm:        string
  digits:           number
  period:           number
  encrypted_secret: EncryptedBlob
}

const decryptBlob = aesDecrypt

// ── TOTP RFC 6238 ─────────────────────────────────────────────────

function base32Decode(str: string): Uint8Array {
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const clean = str.toUpperCase().replace(/=+$/, "")
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHA.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return new Uint8Array(out)
}

function bytesToBase32(bytes: Uint8Array): string {
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let result = "", buffer = 0, bitsLeft = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte; bitsLeft += 8
    while (bitsLeft >= 5) { result += ALPHA[(buffer >>> (bitsLeft - 5)) & 31]; bitsLeft -= 5 }
  }
  if (bitsLeft > 0) result += ALPHA[(buffer << (5 - bitsLeft)) & 31]
  return result
}

async function generateTOTP(secretBytes: Uint8Array, alg: string, digits: number, period: number): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / period)
  const cBytes  = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) { cBytes[i] = c & 0xff; c = Math.floor(c / 256) }
  const hash = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" }[alg] ?? "SHA-1"
  const key  = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash }, false, ["sign"])
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, cBytes))
  const off  = hmac[hmac.length - 1] & 0x0f
  const code = (((hmac[off] & 0x7f) << 24) | ((hmac[off+1] & 0xff) << 16) | ((hmac[off+2] & 0xff) << 8) | (hmac[off+3] & 0xff))
  return String(code % Math.pow(10, digits)).padStart(digits, "0")
}

// ── Card de un TOTP ───────────────────────────────────────────────

function TOTPCard({ cred, vaultKeyHex, onDelete }: { cred: TOTPCredential; vaultKeyHex: string | null; onDelete: () => void }) {
  const [code,      setCode]      = useState("——————")
  const [remaining, setRemaining] = useState(30)
  const [copied,    setCopied]    = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!vaultKeyHex || vaultKeyHex === "demo") return

    async function tick() {
      const secretBytes = await decryptBlob(cred.encrypted_secret, vaultKeyHex!)
      if (!secretBytes) return
      // El secret descifrado es directamente el string Base32 (ej: "JBSWY3DPEHPK3PXP")
      const secretB32 = new TextDecoder().decode(secretBytes).trim().toUpperCase()
      const s    = base32Decode(secretB32)
      const c    = await generateTOTP(s, cred.algorithm, cred.digits, cred.period)
      const rem  = cred.period - (Math.floor(Date.now() / 1000) % cred.period)
      const fmt  = cred.digits === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : `${c.slice(0, 4)} ${c.slice(4)}`
      setCode(fmt)
      setRemaining(rem)
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [cred, vaultKeyHex])

  const pct = (remaining / cred.period) * 100
  const color = remaining > 10 ? "var(--patina)" : "oklch(0.65 0.15 45)"

  function copy() {
    navigator.clipboard.writeText(code.replace(/\s/g, ""))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "20px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px", position: "relative", overflow: "hidden" }}>
      {/* Barra de progreso */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "var(--line)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 1s linear, background 1s ease" }} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "15px", color: "var(--ivory)", fontWeight: 500 }}>{cred.issuer ?? "Desconocido"}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{cred.account ?? ""}</div>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: color, padding: "3px 7px", border: `1px solid ${color}44`, borderRadius: "5px" }}>
          {remaining}s
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "32px", letterSpacing: "0.1em", color: color, lineHeight: 1 }}>
          {code}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={copy}
            style={{ background: copied ? "color-mix(in oklab, var(--patina) 15%, transparent)" : "var(--bg)", border: `1px solid ${copied ? "var(--patina)" : "var(--line-2)"}`, borderRadius: "7px", padding: "6px 10px", color: copied ? "var(--patina)" : "var(--muted)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--font-mono)", transition: "all 200ms" }}>
            {copied ? "✓" : "Copiar"}
          </button>
          <button onClick={() => { if (confirm(`¿Eliminar ${cred.issuer ?? "este código 2FA"}?`)) onDelete() }}
            style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "7px", padding: "6px 8px", color: "#f87171", cursor: "pointer", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────

export function TOTP() {
  const [creds,        setCreds]        = useState<TOTPCredential[]>([])
  const [loading,      setLoading]      = useState(false)
  const [vaultKeyHex,  setVaultKeyHex]  = useState<string | null>(() => getMUK())
  const [mukInput,     setMukInput]     = useState("")
  const [parseUrl,     setParseUrl]     = useState("")
  const [showAdd,      setShowAdd]      = useState(false)
  const [parsed,       setParsed]       = useState<Record<string, string> | null>(null)
  const [showScanner,  setShowScanner]  = useState(false)
  const [scanError,    setScanError]    = useState<string | null>(null)

  const loadCreds = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<TOTPCredential[]>("/api/totp")
      setCreds(Array.isArray(data) ? data : [])
    } catch (e) { log.error("load totp", e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCreds() }, [loadCreds])

  async function parseOTPUrl() {
    try {
      const data = await apiPost<Record<string, string>>("/api/totp/parse", { otpauth_url: parseUrl })
      setParsed(data)
    } catch (e) { log.error("parse otp url", e) }
  }

  async function handleQrDetected(qrText: string) {
    setShowScanner(false)
    setScanError(null)

    // El QR debe contener una URL otpauth://
    if (!qrText.toLowerCase().startsWith("otpauth://")) {
      setScanError("El código QR no es un código 2FA válido (debe empezar por otpauth://)")
      return
    }

    // Rellenar el campo y parsear automáticamente
    setParseUrl(qrText)
    setShowAdd(true)

    try {
      const data = await apiPost<Record<string, string>>("/api/totp/parse", { otpauth_url: qrText })
      setParsed(data)
    } catch (e) {
      log.error("parse scanned qr", e)
      setScanError("Error al procesar el código escaneado")
    }
  }

  async function saveTOTP() {
    if (!parsed) return
    const muk = getMUK()
    if (!muk) { alert("Sesión expirada, vuelve a iniciar sesión"); return }

    try {
      const encryptedSecret = await aesEncryptText(parsed.secret_b32, muk)
      await apiPost("/api/totp", {
        issuer:           parsed.issuer    ?? "Desconocido",
        account:          parsed.account   ?? "",
        algorithm:        parsed.algorithm ?? "SHA1",
        digits:           parseInt(parsed.digits as unknown as string) || 6,
        period:           parseInt(parsed.period as unknown as string) || 30,
        encrypted_secret: encryptedSecret,
      })
      setParsed(null)
      setParseUrl("")
      setShowAdd(false)
      loadCreds()
    } catch (e) {
      alert("Error cifrando o guardando el secreto")
      log.error("save totp", e)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 4px" }}>Autenticación</p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "28px", letterSpacing: "-0.3px", margin: 0 }}>
            Códigos <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>2FA</em>
          </h2>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div className="md:hidden">
            <button onClick={() => { setShowScanner(true); setScanError(null) }}
                style={{ background: "transparent", color: "var(--ivory)", border: "1px solid var(--line-2)", borderRadius: "9px", padding: "9px 14px", fontSize: "13.5px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                title="Escanear código QR con la cámara">
                <QrCodeIcon className="w-4 h-4" />
                Escanear
              </button>
          </div>
            <button onClick={() => setShowAdd(v => !v)}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "9px", padding: "9px 14px", fontSize: "13.5px", fontWeight: 500, cursor: "pointer" }}>
              + Añadir
            </button>
        </div>
      </div>

      {/* Desbloqueo si no hay key */}
      {!vaultKeyHex && (
        <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", background: "var(--bg-elev)", display: "flex", gap: "12px", alignItems: "center" }}>
          <input type="password" placeholder="MUK hex para descifrar secretos…" value={mukInput} onChange={e => setMukInput(e.target.value)}
            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "9px 12px", fontSize: "13px", color: "var(--ivory)", outline: "none", fontFamily: "var(--font-mono)" }} />
          <button onClick={() => setVaultKeyHex(mukInput)}
            style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "7px", padding: "9px 14px", fontSize: "13.5px", cursor: "pointer" }}>
            Desbloquear
          </button>
          <button onClick={() => setVaultKeyHex("demo")}
            style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "9px 14px", fontSize: "12px", color: "var(--muted)", cursor: "pointer" }}>
            Solo ver lista
          </button>
        </div>
      )}

      {/* Formulario añadir TOTP */}
      {showAdd && (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "12px", padding: "20px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)" }}>
            Parsear URL otpauth://
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <input type="text" placeholder="otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DP…"
              value={parseUrl} onChange={e => setParseUrl(e.target.value)}
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "7px", padding: "9px 12px", fontSize: "12px", color: "var(--ivory)", outline: "none", fontFamily: "var(--font-mono)" }} />
            <button onClick={parseOTPUrl}
              style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "7px", padding: "9px 14px", fontSize: "13.5px", cursor: "pointer" }}>
              Parsear
            </button>
          </div>
          {parsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "14px", background: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ivory-dim)" }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(parsed, null, 2)}</pre>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={saveTOTP}
                  style={{ flex: 1, background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 16px", fontSize: "13.5px", fontWeight: 500, cursor: "pointer" }}>
                  Guardar código 2FA
                </button>
                <button onClick={() => setParsed(null)}
                  style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "10px 14px", color: "var(--muted)", cursor: "pointer", fontSize: "13px" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error de escaneo */}
      {scanError && (
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#f87171", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{scanError}</span>
          <button onClick={() => setScanError(null)}
            style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {/* Grid de tarjetas */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Cargando…</div>
      ) : creds.length === 0 ? (
        <div style={{ border: "1px dashed var(--line-2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px", margin: "0 0 8px" }}>Sin códigos 2FA guardados</p>
          <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "11px", margin: 0 }}>Escanea un QR con la cámara o pega la URL otpauth://</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          {creds.map(cred => (
            <TOTPCard key={cred.id} cred={cred} vaultKeyHex={vaultKeyHex} onDelete={async () => {
              try {
                await apiDelete(`/api/totp/${cred.id}`)
                setCreds(prev => prev.filter(c => c.id !== cred.id))
              } catch (e) { log.error("delete totp", e) }
            }} />
          ))}
        </div>
      )}

      {/* Modal del escáner QR */}
      {showScanner && (
        <QrScanner
          onDetect={handleQrDetected}
          onClose={() => setShowScanner(false)}
          hint="Apunta a un código QR de 2FA (otpauth://)"
        />
      )}
    </div>
  )
}
