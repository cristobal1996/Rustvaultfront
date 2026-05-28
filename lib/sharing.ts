// lib/sharing.ts
// Lógica criptográfica completa para compartir vaults entre usuarios.
// Todo ocurre en el navegador usando Web Crypto API — el servidor
// nunca ve las claves en claro.

// ── Tipos ─────────────────────────────────────────────────────────

export interface EncryptedBlob {
  nonce:      string
  ciphertext: string
}

export interface ECIESBlob {
  ephemeral_pub: string
  nonce:         string
  ciphertext:    string
}

// ── Utilidades hex ────────────────────────────────────────────────

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

export function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}

// ── AES-256-GCM ───────────────────────────────────────────────────

export async function aesEncrypt(plaintext: Uint8Array, keyHex: string): Promise<EncryptedBlob> {
  const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["encrypt"])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
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

// ── Par de claves X25519 ──────────────────────────────────────────

export interface KeyPair {
  pubKeyHex:    string
  privKeyPkcs8: Uint8Array  // formato pkcs8 para importar/exportar
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

/**
 * Registra el par de claves en el servidor.
 * La clave privada se cifra con la MUK antes de subirla.
 * La clave pública va en claro — es pública por definición.
 */
export async function setupAndRegisterKeyPair(mukHex: string, token: string): Promise<KeyPair> {
  const pair = await generateKeyPair()

  // Cifrar la clave privada con la MUK
  const encryptedPriv = await aesEncrypt(pair.privKeyPkcs8, mukHex)

  const res = await fetch("/api/sharing/keys", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      pub_key:            pair.pubKeyHex,
      encrypted_priv_key: encryptedPriv,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Error registrando claves")
  }

  // Guardar en sessionStorage para esta sesión
  sessionStorage.setItem("rv_pub_key",      pair.pubKeyHex)
  sessionStorage.setItem("rv_priv_key_pkcs8", bytesToHex(pair.privKeyPkcs8))

  return pair
}

/**
 * Recupera o genera el par de claves del usuario actual.
 * Si ya está en sessionStorage lo reutiliza.
 * Si no, lo genera y lo registra en el servidor.
 */
export async function getOrCreateKeyPair(mukHex: string, token: string): Promise<KeyPair> {
  const cachedPub  = sessionStorage.getItem("rv_pub_key")
  const cachedPriv = sessionStorage.getItem("rv_priv_key_pkcs8")

  if (cachedPub && cachedPriv) {
    return { pubKeyHex: cachedPub, privKeyPkcs8: hexToBytes(cachedPriv) }
  }

  // Intentar obtener la clave pública propia del servidor
  const profileRes = await fetch("/api/account/profile", {
    headers: { Authorization: `Bearer ${token}` },
  })
  const profile = await profileRes.json()

  if (profile.pub_key) {
    // Ya tiene clave pública — necesitamos la privada del servidor
    const privRes  = await fetch("/api/sharing/my-private-key", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (privRes.ok) {
      const privData = await privRes.json()
      // privData.encrypted_priv_key es un EncryptedBlob cifrado con la MUK
      const privBytes = await aesDecrypt(privData.encrypted_priv_key, mukHex)
      if (privBytes) {
        const pair: KeyPair = { pubKeyHex: profile.pub_key, privKeyPkcs8: privBytes }
        sessionStorage.setItem("rv_pub_key",       profile.pub_key)
        sessionStorage.setItem("rv_priv_key_pkcs8", bytesToHex(privBytes))
        return pair
      }
    }
  }

  // No tiene claves — generarlas y registrarlas
  return setupAndRegisterKeyPair(mukHex, token)
}

// ── ECIES: cifrar para un destinatario ───────────────────────────

/**
 * Cifra datos con la clave pública del destinatario.
 * Usa un par de claves efímero — solo el destinatario puede descifrar.
 */
export async function eciesEncrypt(plaintext: Uint8Array, recipientPubHex: string): Promise<ECIESBlob> {
  // Importar clave pública del destinatario
  const recipientPub = await crypto.subtle.importKey(
    "raw", hexToBytes(recipientPubHex), { name: "X25519" }, false, []
  )

  // Par efímero de un solo uso
  const ephemeral = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey"])

  // ECDH → clave AES compartida
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "X25519", public: recipientPub },
    ephemeral.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )

  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, sharedKey, plaintext)

  const ephPubRaw = await crypto.subtle.exportKey("raw", ephemeral.publicKey)

  return {
    ephemeral_pub: bytesToHex(new Uint8Array(ephPubRaw)),
    nonce:         bytesToHex(nonce),
    ciphertext:    bytesToHex(new Uint8Array(ct)),
  }
}

/**
 * Descifra un blob ECIES con la clave privada del destinatario.
 */
export async function eciesDecrypt(blob: ECIESBlob, privKeyPkcs8: Uint8Array): Promise<Uint8Array | null> {
  try {
    const privKey = await crypto.subtle.importKey(
      "pkcs8", privKeyPkcs8, { name: "X25519" }, false, ["deriveKey"]
    )
    const ephPub = await crypto.subtle.importKey(
      "raw", hexToBytes(blob.ephemeral_pub), { name: "X25519" }, false, []
    )
    const sharedKey = await crypto.subtle.deriveKey(
      { name: "X25519", public: ephPub },
      privKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    )
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(blob.nonce) },
      sharedKey,
      hexToBytes(blob.ciphertext)
    )
    return new Uint8Array(plain)
  } catch { return null }
}

// ── Flujo de Alice: invitar ───────────────────────────────────────

/**
 * Alice invita a Bob a su vault.
 *
 * 1. Obtiene la pub_key de Bob del servidor
 * 2. Descifra la Vault Key con la MUK de Alice
 * 3. Cifra la Vault Key con la pub_key de Bob (ECIES)
 * 4. Envía la invitación al servidor
 */
export async function inviteMember(
  vaultId:           string,
  invitedEmail:      string,
  role:              string,
  encryptedVaultKey: EncryptedBlob,
  mukHex:            string,
  token:             string,
): Promise<void> {
  // 1. Obtener pub_key de Bob
  const keyRes = await fetch(
    `/api/sharing/keys/${encodeURIComponent(invitedEmail)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!keyRes.ok) throw new Error(`${invitedEmail} no tiene clave pública registrada. Debe iniciar sesión al menos una vez.`)
  const { pub_key: bobPubKeyHex } = await keyRes.json()

  // 2. Descifrar Vault Key con MUK de Alice
  const vaultKeyBytes = await aesDecrypt(encryptedVaultKey, mukHex)
  if (!vaultKeyBytes) throw new Error("No se pudo descifrar la Vault Key. Comprueba tu clave maestra.")

  // 3. Cifrar Vault Key con pub_key de Bob (ECIES)
  const eciesBlob = await eciesEncrypt(vaultKeyBytes, bobPubKeyHex)
  vaultKeyBytes.fill(0)  // limpiar de memoria

  // 4. Enviar al servidor
  const res = await fetch("/api/sharing/invite", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      vault_id:            vaultId,
      invited_email:       invitedEmail,
      role,
      encrypted_vault_key: eciesBlob,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Error al enviar la invitación")
  }
}

// ── Flujo de Bob: aceptar ─────────────────────────────────────────

/**
 * Bob acepta una invitación.
 *
 * 1. Descifra su clave privada con su MUK
 * 2. Descifra la Vault Key con su clave privada (ECIES)
 * 3. Re-cifra la Vault Key con su propia MUK
 * 4. Sube su copia al servidor
 */
export async function acceptInvitation(
  invitationId:      string,
  eciesVaultKey:     ECIESBlob,
  encryptedPrivKey:  EncryptedBlob,
  mukHex:            string,
  token:             string,
): Promise<void> {
  // 1. Descifrar clave privada con MUK de Bob
  const privKeyBytes = await aesDecrypt(encryptedPrivKey, mukHex)
  if (!privKeyBytes) throw new Error("No se pudo descifrar tu clave privada. Comprueba tu clave maestra.")

  // 2. Descifrar Vault Key con clave privada de Bob
  const vaultKeyBytes = await eciesDecrypt(eciesVaultKey, privKeyBytes)
  privKeyBytes.fill(0)  // limpiar
  if (!vaultKeyBytes) throw new Error("No se pudo descifrar la Vault Key.")

  // 3. Re-cifrar Vault Key con MUK de Bob
  const myEncryptedVaultKey = await aesEncrypt(vaultKeyBytes, mukHex)
  vaultKeyBytes.fill(0)  // limpiar

  // 4. Enviar al servidor
  const res = await fetch(`/api/sharing/accept/${invitationId}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({
      vault_key_encrypted_with_muk: myEncryptedVaultKey,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Error al aceptar la invitación")
  }
}
