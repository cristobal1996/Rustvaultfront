// components/dashboard/sections/Vaults.tsx
"use client"
import { useState } from "react"
import { getMUK, generateAndEncryptVaultKey } from "@/lib/muk"

interface Vault {
  id:        string
  name:      string
  vault_type: string
  user_role:  string
  entry_count?: number
}

interface Props {
  token:    string
  onSelect: (vaultId: string, vaultName: string) => void
}

export function Vaults({ token, onSelect }: Props) {
  const [vaults,  setVaults]  = useState<Vault[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    try {
      const res  = await fetch("/api/vaults", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setVaults(Array.isArray(data) ? data : (data.data ?? []))
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  if (!loaded && !loading) { load() }

  async function createVault() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      // Obtener MUK del sessionStorage (guardada al hacer login)
      const mukHex = getMUK()
      if (!mukHex) {
        alert("Sesión expirada. Vuelve a iniciar sesión para derivar la clave maestra.")
        return
      }

      // Generar Vault Key aleatoria y cifrarla con la MUK
      const encryptedVaultKey = await generateAndEncryptVaultKey(mukHex)

      const res = await fetch("/api/vaults", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          name:                newName.trim(),
          vault_type:          "personal",
          encrypted_vault_key: encryptedVaultKey,
        }),
      })
      if (res.ok) {
        setNewName("")
        setShowForm(false)
        setLoaded(false)
      }
    } finally {
      setCreating(false)
    }
  }

  const ROLE_COLOR: Record<string, string> = {
    owner:  "var(--rust-bright)",
    admin:  "oklch(0.78 0.08 85)",
    editor: "oklch(0.78 0.08 170)",
    viewer: "var(--muted)",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>
            Mis vaults
          </p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", margin: 0 }}>
            Carpetas <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>seguras</em>
          </h2>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background:   "var(--rust)",
            color:        "#fff",
            border:       "none",
            borderRadius: "10px",
            padding:      "10px 16px",
            fontSize:     "13.5px",
            fontWeight:   500,
            display:      "flex",
            alignItems:   "center",
            gap:          "8px",
            cursor:       "pointer",
          }}
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span>
          Nuevo vault
        </button>
      </div>

      {/* Formulario nuevo vault */}
      {showForm && (
        <div style={{
          border: "1px solid var(--line-2)", borderRadius: "12px",
          padding: "20px", background: "var(--bg-elev)",
          display: "flex", gap: "12px", alignItems: "center",
        }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createVault()}
            placeholder="Nombre del vault…"
            autoFocus
            style={{
              flex: 1, background: "var(--bg)", border: "1px solid var(--line-2)",
              borderRadius: "8px", padding: "10px 12px", fontSize: "14px",
              color: "var(--ivory)", outline: "none",
            }}
          />
          <button
            onClick={createVault}
            disabled={creating}
            style={{
              background: "var(--rust)", color: "#fff", border: "none",
              borderRadius: "8px", padding: "10px 16px", fontSize: "13.5px",
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creando…" : "Crear"}
          </button>
          <button
            onClick={() => setShowForm(false)}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Cargando vaults…</div>
      ) : vaults.length === 0 ? (
        <div style={{
          border: "1px dashed var(--line-2)", borderRadius: "14px",
          padding: "48px", textAlign: "center",
        }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", color: "var(--ivory-dim)", margin: "0 0 8px" }}>
            Sin vaults todavía
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            Crea tu primer vault para empezar a guardar contraseñas
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {vaults.map(vault => (
            <button
              key={vault.id}
              onClick={() => onSelect(vault.id, vault.name)}
              style={{
                border:        "1px solid var(--line)",
                borderRadius:  "14px",
                padding:       "22px",
                background:    "var(--bg-elev)",
                textAlign:     "left",
                cursor:        "pointer",
                display:       "flex",
                flexDirection: "column",
                gap:           "12px",
                transition:    "transform 140ms ease, border-color 140ms ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform   = "translateY(-2px)"
                e.currentTarget.style.borderColor = "#4d4136"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform   = "translateY(0)"
                e.currentTarget.style.borderColor = "var(--line)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--ivory)" }}>
                  {vault.name}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "10px",
                  letterSpacing: "1px", textTransform: "uppercase",
                  color: ROLE_COLOR[vault.user_role] ?? "var(--muted)",
                  padding: "3px 7px", border: `1px solid ${ROLE_COLOR[vault.user_role] ?? "var(--line-2)"}33`,
                  borderRadius: "5px",
                }}>
                  {vault.user_role}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {vault.vault_type}
                </span>
                <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "var(--line-2)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--muted)" }}>
                  Ver entradas →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
