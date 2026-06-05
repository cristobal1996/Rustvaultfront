// lib/muk.ts
// Master Unlock Key — vive SOLO en sessionStorage durante la sesión.
// Si se pierde, el usuario tiene que volver a iniciar sesión.
// NUNCA se guarda en localStorage (eso sería persistir la llave maestra
// en disco, accesible a cualquier XSS o malware).

const MUK_KEY = "rv_muk"

export function saveMUK(mukHex: string): void {
  sessionStorage.setItem(MUK_KEY, mukHex)
}

export function getMUK(): string | null {
  return sessionStorage.getItem(MUK_KEY)
}

export function clearMUK(): void {
  sessionStorage.removeItem(MUK_KEY)
}

// Re-exports históricos para compat — ahora viven en lib/crypto.ts
export {
  deriveMUK,
  aesEncrypt,
  aesDecrypt,
  aesEncryptText,
  aesDecryptText,
  generateAndEncryptVaultKey,
  type EncryptedBlob,
} from "./crypto"
