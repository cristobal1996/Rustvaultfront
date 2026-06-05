// lib/hex.ts
// Conversiones hex ↔ bytes, usadas en toda la criptografía cliente.

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function randomHex(byteCount: number): string {
  const arr = new Uint8Array(byteCount)
  crypto.getRandomValues(arr)
  return bytesToHex(arr)
}

export function randomBytes(byteCount: number): Uint8Array {
  const arr = new Uint8Array(byteCount)
  crypto.getRandomValues(arr)
  return arr
}
