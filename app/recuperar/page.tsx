// app/recuperar/page.tsx
"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyIcon, CheckCircleIcon } from "@heroicons/react/24/outline"

import { saveMUK } from "@/lib/muk"
import {
  deriveMUK, aesEncrypt, aesDecrypt, type EncryptedBlob,
} from "@/lib/crypto"
import { hexToBytes, bytesToHex, randomHex } from "@/lib/hex"
import { apiPost, apiGet, saveSession } from "@/lib/api"
import { log } from "@/lib/log"

import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/Button"
import { Input }  from "@/components/ui/Input"
import { ErrorMessage } from "@/components/ui/ErrorMessage"

type Step = "email" | "key" | "newpass" | "done"

interface BlobResponse {
  srp_salt:      string
  recovery_blob: EncryptedBlob
}

interface RecoverResponse {
  token: string
  user:  { id: string; email: string }
}

interface PasswordEntry {
  id:        string
  encrypted: EncryptedBlob
}

export default function Recuperar() {
  const router = useRouter()
  const [step,        setStep]        = useState<Step>("email")
  const [email,       setEmail]       = useState("")
  const [recoveryKey, setRecoveryKey] = useState("")
  const [newPass,     setNewPass]     = useState("")
  const [newPass2,    setNewPass2]    = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [recoveredMuk, setRecoveredMuk] = useState("")

  const cleanKey = () => recoveryKey.replace(/[\s-]/g, "").toLowerCase()

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await apiPost<BlobResponse>("/api/auth/recover/blob",
        { email: email.trim().toLowerCase() }, { auth: false })
      setStep("key")
    } catch {
      setError("No se encontró cuenta de recuperación para ese email")
    } finally { setLoading(false) }
  }

  async function handleKey(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      const key = cleanKey()
      if (key.length !== 64) {
        setError("La Recovery Key debe tener 64 caracteres hexadecimales"); return
      }

      const data = await apiPost<BlobResponse>("/api/auth/recover/blob",
        { email: email.trim().toLowerCase() }, { auth: false })

      const mukBytes = await aesDecrypt(data.recovery_blob, key)
      if (!mukBytes) { setError("Recovery Key incorrecta"); return }

      setRecoveredMuk(bytesToHex(mukBytes))
      setStep("newpass")
    } catch (e) {
      log.error("recovery key check failed", e)
      setError("Error al verificar la clave")
    } finally { setLoading(false) }
  }

  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPass !== newPass2) return setError("Las contraseñas no coinciden")
    if (newPass.length < 12)  return setError("Mínimo 12 caracteres")
    setLoading(true)

    try {
      // 1. Nueva MUK
      const newSrpSalt = randomHex(16)
      const newMukHex  = await deriveMUK(newPass, newSrpSalt)

      // 2. Recuperar cuenta en servidor → token nuevo
      const recoverData = await apiPost<RecoverResponse>("/api/auth/recover-with-key", {
        email:            email.trim().toLowerCase(),
        recovery_key:     cleanKey(),
        new_password:     newPass,
        new_srp_salt:     newSrpSalt,
        new_srp_verifier: newSrpSalt,
      }, { auth: false })

      // 3. Guardar sesión nueva (necesaria para el resto de llamadas)
      saveSession({
        token:    recoverData.token,
        srp_salt: newSrpSalt,
        user_id:  recoverData.user.id,
        email:    recoverData.user.email,
      })
      saveMUK(newMukHex)

      // 4. Descargar y re-cifrar contraseñas con la MUK nueva
      const pwData = await apiGet<{ data: PasswordEntry[] }>("/api/passwords?limit=1000")

      const reEncrypted: PasswordEntry[] = []
      for (const pw of pwData.data ?? []) {
        const plain = await aesDecrypt(pw.encrypted, recoveredMuk)
        if (!plain) { log.warn("no se pudo descifrar:", pw.id); continue }
        const newCt = await aesEncrypt(plain, newMukHex)
        plain.fill(0)
        reEncrypted.push({ id: pw.id, encrypted: newCt })
      }

      if (reEncrypted.length > 0) {
        await apiPost("/api/passwords/bulk-update", { re_encrypted_passwords: reEncrypted })
      }

      // 5. Regenerar recovery_blob USANDO LA MISMA Recovery Key (permanente)
      const recoveryBlob = await aesEncrypt(hexToBytes(newMukHex), cleanKey())
      await apiPost("/api/auth/recover/save-blob", { recovery_blob: recoveryBlob })

      setStep("done")
    } catch (e) {
      log.error("recovery failed", e)
      setError(e instanceof Error ? e.message : "Error al establecer la nueva contraseña")
    } finally { setLoading(false) }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px] flex flex-col gap-6">
          <div className="flex justify-center">
            <div className="w-[72px] h-[72px] rounded-full grid place-items-center"
                 style={{ background: "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.48 0.13 40))" }}>
              <KeyIcon className="w-9 h-9" style={{ color: "rgba(20,15,10,0.7)" }} />
            </div>
          </div>

          <div>
            <h1 className="font-serif font-normal text-[32px] m-0 mb-[6px] text-ivory">Recuperar cuenta</h1>
            <p className="font-mono text-xs text-muted m-0">Con tu Recovery Key, sin perder datos</p>
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          {step === "email" && (
            <form onSubmit={handleEmail} className="flex flex-col gap-[14px]">
              <Input label="Email de la cuenta" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
              <Button type="submit" disabled={loading}>
                {loading ? "Comprobando…" : "Continuar →"}
              </Button>
            </form>
          )}

          {step === "key" && (
            <form onSubmit={handleKey} className="flex flex-col gap-[14px]">
              <div className="flex flex-col gap-[6px]">
                <label className="label-mono">Recovery Key (64 caracteres hex)</label>
                <textarea value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} required rows={3}
                  className="input-base font-mono text-[13px] resize-y"
                  placeholder="xxxxxxxx - xxxxxxxx - xxxxxxxx - ..." />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Verificando…" : "Verificar clave →"}
              </Button>
            </form>
          )}

          {step === "newpass" && (
            <form onSubmit={handleNewPass} className="flex flex-col gap-[14px]">
              <p className="font-mono text-xs m-0 inline-flex items-center gap-2" style={{ color: "#10b981" }}>
                <CheckCircleIcon className="w-4 h-4" />
                Recovery Key verificada. Tus contraseñas se re-cifrarán automáticamente.
              </p>
              <Input label="Nueva contraseña maestra (mín. 12)" type="password" value={newPass}
                onChange={e => setNewPass(e.target.value)} required autoComplete="new-password" />
              <Input label="Repetir contraseña" type="password" value={newPass2}
                onChange={e => setNewPass2(e.target.value)} required autoComplete="new-password" />
              <Button type="submit" disabled={loading}>
                {loading ? "Re-cifrando contraseñas…" : "Establecer nueva contraseña →"}
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-4">
              <div className="border border-[rgba(16,185,129,0.3)] rounded-2xl p-[18px] bg-[rgba(16,185,129,0.04)]">
                <p className="font-mono text-[13px] m-0 leading-[1.6]" style={{ color: "#10b981" }}>
                  ✓ Cuenta recuperada<br/>
                  ✓ Contraseña cambiada<br/>
                  ✓ Contraseñas re-cifradas con la nueva MUK<br/>
                  ✓ Tu Recovery Key original sigue siendo válida
                </p>
              </div>
              <Button onClick={() => router.push("/dashboard")}>
                Entrar a mi bóveda →
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-2">
            <Link href="/login" className="text-center font-mono text-xs text-muted hover:text-ivory transition-colors">
              ← Volver al login
            </Link>
            <Link href="/eliminar-cuenta" className="text-center font-mono text-[11px] text-muted/70 hover:text-[#f87171] transition-colors">
              ¿Has perdido también la Recovery Key? Eliminar cuenta con código de emergencia
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
