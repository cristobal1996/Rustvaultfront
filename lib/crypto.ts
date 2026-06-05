// lib/crypto.ts
// Primitivas criptográficas unificadas para todo el cliente.
// AES-256-GCM (simétrico) + X25519/ECIES (asimétrico) + PBKDF2 (derivación).

import { bytesToHex, hexToBytes, randomBytes } from "./hex"

// ── Tipos ─────────────────────────────────────────────────────────

export interface EncryptedBlob {
  nonce:      string  // 12 bytes hex
  ciphertext: string  // payload + tag (16 bytes) en hex
}

export interface ECIESBlob {
  ephemeral_pub: string  // 32 bytes hex
  nonce:         string
  ciphertext:    string
}

// ── PBKDF2 / derivación de MUK ────────────────────────────────────

const PBKDF2_ITERATIONS = 200_000

export async function deriveMUK(password: string, srpSaltHex: string): Promise<string> {
  const enc    = new TextEncoder()
  const keyMat = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(srpSaltHex), iterations: PBKDF2_ITERATIONS },
    keyMat,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

// ── AES-256-GCM ───────────────────────────────────────────────────

export async function aesEncrypt(plaintext: Uint8Array, keyHex: string): Promise<EncryptedBlob> {
  const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["encrypt"])
  const nonce = randomBytes(12)
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }
}

export async function aesDecrypt(blob: EncryptedBlob, keyHex: string): Promise<Uint8Array | null> {
  try {
    const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["decrypt"])
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(blob.nonce) }, key, hexToBytes(blob.ciphertext))
    return new Uint8Array(plain)
  } catch { return null }
}

/** Variante que devuelve string (errores → null). Atajo común para JSON cifrado. */
export async function aesDecryptText(blob: EncryptedBlob, keyHex: string): Promise<string | null> {
  const bytes = await aesDecrypt(blob, keyHex)
  return bytes ? new TextDecoder().decode(bytes) : null
}

/** Variante texto → blob. Atajo común para JSON cifrado. */
export async function aesEncryptText(plain: string, keyHex: string): Promise<EncryptedBlob> {
  return aesEncrypt(new TextEncoder().encode(plain), keyHex)
}

// ── Genera Vault Key cifrada con la MUK ───────────────────────────

export async function generateAndEncryptVaultKey(mukHex: string): Promise<EncryptedBlob> {
  return aesEncrypt(randomBytes(32), mukHex)
}

// ── ECIES sobre X25519 ────────────────────────────────────────────

export async function eciesEncrypt(plaintext: Uint8Array, recipientPubHex: string): Promise<ECIESBlob> {
  const recipientPub = await crypto.subtle.importKey(
    "raw", hexToBytes(recipientPubHex), { name: "X25519" }, false, []
  )
  const ephemeral = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey"])
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "X25519", public: recipientPub },
    ephemeral.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )
  const nonce = randomBytes(12)
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, sharedKey, plaintext)
  const ephPubRaw = await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  return {
    ephemeral_pub: bytesToHex(new Uint8Array(ephPubRaw)),
    nonce:         bytesToHex(nonce),
    ciphertext:    bytesToHex(new Uint8Array(ct)),
  }
}

export async function eciesDecrypt(blob: ECIESBlob, privKeyPkcs8: Uint8Array): Promise<Uint8Array | null> {
  try {
    const privKey = await crypto.subtle.importKey("pkcs8", privKeyPkcs8, { name: "X25519" }, false, ["deriveKey"])
    const ephPub  = await crypto.subtle.importKey("raw", hexToBytes(blob.ephemeral_pub), { name: "X25519" }, false, [])
    const sharedKey = await crypto.subtle.deriveKey(
      { name: "X25519", public: ephPub },
      privKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    )
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(blob.nonce) }, sharedKey, hexToBytes(blob.ciphertext)
    )
    return new Uint8Array(plain)
  } catch { return null }
}

// ── Pares de claves X25519 ────────────────────────────────────────

export interface KeyPair {
  pubKeyHex:    string
  privKeyPkcs8: Uint8Array
}

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey"])
  const pub  = await crypto.subtle.exportKey("raw",   pair.publicKey)
  const priv = await crypto.subtle.exportKey("pkcs8", pair.privateKey)
  return {
    pubKeyHex:    bytesToHex(new Uint8Array(pub)),
    privKeyPkcs8: new Uint8Array(priv),
  }
}
