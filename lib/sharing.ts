// lib/sharing.ts
// Lógica de compartir bóvedas entre usuarios.
// La clave privada X25519 ya NO se guarda en sessionStorage: vive en una
// variable de módulo (RAM) y se descifra de la MUK cuando hace falta.

import {
  aesEncrypt, aesDecrypt, eciesEncrypt, eciesDecrypt, generateKeyPair,
  type EncryptedBlob, type ECIESBlob, type KeyPair,
} from "./crypto"
import { bytesToHex } from "./hex"
import { api, apiGet, apiPost } from "./api"

// ── Caché en RAM (no persiste a disco) ────────────────────────────

let cachedKeyPair: KeyPair | null = null

export function clearKeyPairCache(): void { cachedKeyPair = null }

// ── Registro inicial del par X25519 ───────────────────────────────

export async function setupAndRegisterKeyPair(mukHex: string): Promise<KeyPair> {
  const pair = await generateKeyPair()
  const encryptedPriv = await aesEncrypt(pair.privKeyPkcs8, mukHex)

  await apiPost("/api/sharing/keys", {
    pub_key:            pair.pubKeyHex,
    encrypted_priv_key: encryptedPriv,
  })

  cachedKeyPair = pair
  return pair
}

export async function getOrCreateKeyPair(mukHex: string): Promise<KeyPair> {
  if (cachedKeyPair) return cachedKeyPair

  const profile = await apiGet<{ pub_key?: string }>("/api/account/profile")

  if (profile.pub_key) {
    try {
      const privData = await apiGet<{ encrypted_priv_key: EncryptedBlob }>("/api/sharing/my-private-key")
      const privBytes = await aesDecrypt(privData.encrypted_priv_key, mukHex)
      if (privBytes) {
        cachedKeyPair = { pubKeyHex: profile.pub_key, privKeyPkcs8: privBytes }
        return cachedKeyPair
      }
    } catch {
      // fallthrough → generar nuevas
    }
  }

  return setupAndRegisterKeyPair(mukHex)
}

// ── Alice invita a Bob ────────────────────────────────────────────

export async function inviteMember(
  vaultId: string,
  invitedEmail: string,
  role: string,
  encryptedVaultKey: EncryptedBlob,
  mukHex: string,
): Promise<void> {
  const { pub_key: bobPubKeyHex } = await apiGet<{ pub_key: string }>(
    `/api/sharing/keys/${encodeURIComponent(invitedEmail)}`
  )

  const vaultKeyBytes = await aesDecrypt(encryptedVaultKey, mukHex)
  if (!vaultKeyBytes) throw new Error("No se pudo descifrar la Vault Key.")

  const eciesBlob = await eciesEncrypt(vaultKeyBytes, bobPubKeyHex)
  vaultKeyBytes.fill(0)

  await apiPost("/api/sharing/invite", {
    vault_id:            vaultId,
    invited_email:       invitedEmail,
    role,
    encrypted_vault_key: eciesBlob,
  })
}

// ── Bob acepta ───────────────────────────────────────────────────

export async function acceptInvitation(
  invitationId: string,
  eciesVaultKey: ECIESBlob,
  encryptedPrivKey: EncryptedBlob,
  mukHex: string,
): Promise<void> {
  const privKeyBytes = await aesDecrypt(encryptedPrivKey, mukHex)
  if (!privKeyBytes) throw new Error("No se pudo descifrar tu clave privada.")

  const vaultKeyBytes = await eciesDecrypt(eciesVaultKey, privKeyBytes)
  privKeyBytes.fill(0)
  if (!vaultKeyBytes) throw new Error("No se pudo descifrar la Vault Key.")

  const myEncryptedVaultKey = await aesEncrypt(vaultKeyBytes, mukHex)
  vaultKeyBytes.fill(0)

  await apiPost(`/api/sharing/accept/${invitationId}`, {
    vault_key_encrypted_with_muk: myEncryptedVaultKey,
  })
}

// Re-exports para compat con código existente que importa de "@/lib/sharing"
export type { EncryptedBlob, ECIESBlob, KeyPair }
export { bytesToHex }
