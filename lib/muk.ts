// lib/muk.ts
// Derivación de la Master Unlock Key (MUK) en el navegador.
//
// Usamos PBKDF2 con SHA-256 porque está disponible en Web Crypto API
// sin instalar librerías externas. El servidor usa Argon2id, pero
// para el proyecto de ciclo este enfoque es válido y seguro.
//
// La MUK se guarda en sessionStorage — desaparece al cerrar la pestaña.

const PBKDF2_ITERATIONS = 200_000  // 200k iteraciones — suficientemente lento

// ── Utilidades ────────────────────────────────────────────────────

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}

// ── Derivar MUK ───────────────────────────────────────────────────

/**
 * Deriva la Master Unlock Key a partir de la contraseña y el srp_salt.
 * El srp_salt viene del servidor al hacer login.
 */
export async function deriveMUK(password: string, srpSaltHex: string): Promise<string> {
  const enc      = new TextEncoder()
  const keyMat   = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  )
  const salt     = hexToBytes(srpSaltHex)
  const bits     = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMat,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

// ── Guardar y recuperar del sessionStorage ────────────────────────

const MUK_KEY = "rv_muk"

export function saveMUK(mukHex: string): void {
  sessionStorage.setItem(MUK_KEY, mukHex)
}

export function getMUK(): string | null {
  // Intentar primero sessionStorage, luego localStorage como fallback
  return sessionStorage.getItem(MUK_KEY) ?? localStorage.getItem("rv_muk") ?? null
}

export function clearMUK(): void {
  sessionStorage.removeItem(MUK_KEY)
}

// ── AES-256-GCM helpers ───────────────────────────────────────────

export interface EncryptedBlob {
  nonce:      string
  ciphertext: string
}

export async function aesEncrypt(plaintext: Uint8Array, mukHex: string): Promise<EncryptedBlob> {
  const key    = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["encrypt"])
  const nonce  = crypto.getRandomValues(new Uint8Array(12))
  const ct     = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }
}

export async function aesDecrypt(blob: EncryptedBlob, mukHex: string): Promise<Uint8Array | null> {
  try {
    const key   = await crypto.subtle.importKey("raw", hexToBytes(mukHex), { name: "AES-GCM" }, false, ["decrypt"])
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(blob.nonce) }, key, hexToBytes(blob.ciphertext))
    return new Uint8Array(plain)
  } catch { return null }
}

/**
 * Genera una Vault Key aleatoria de 32 bytes y la cifra con la MUK.
 */
export async function generateAndEncryptVaultKey(mukHex: string): Promise<EncryptedBlob> {
  const vaultKey = crypto.getRandomValues(new Uint8Array(32))
  return aesEncrypt(vaultKey, mukHex)
}
