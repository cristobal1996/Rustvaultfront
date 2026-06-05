// components/dashboard/sections/Vaults.tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline"

import { apiGet, apiPost } from "@/lib/api"
import { getMUK } from "@/lib/muk"
import { generateAndEncryptVaultKey } from "@/lib/crypto"
import { log } from "@/lib/log"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Loading } from "@/components/ui/Loading"
import { EmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"

interface Vault {
  id:           string
  name:         string
  vault_type:   string
  user_role:    string
  entry_count?: number
}

interface Props {
  onSelect: (vaultId: string, vaultName: string) => void
}

const ROLE_COLOR: Record<string, string> = {
  owner:  "var(--rust-bright)",
  admin:  "oklch(0.78 0.08 85)",
  editor: "oklch(0.78 0.08 170)",
  viewer: "var(--muted)",
}

export function Vaults({ onSelect }: Props) {
  const [vaults,  setVaults]  = useState<Vault[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<Vault[] | { data: Vault[] }>("/api/vaults")
      setVaults(Array.isArray(data) ? data : data.data ?? [])
    } catch (e) {
      log.error("load vaults", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createVault() {
    if (!newName.trim()) return

    const mukHex = getMUK()
    if (!mukHex) {
      alert("Sesión expirada. Vuelve a iniciar sesión.")
      return
    }

    setCreating(true)
    try {
      const encryptedVaultKey = await generateAndEncryptVaultKey(mukHex)
      await apiPost("/api/vaults", {
        name:                newName.trim(),
        vault_type:          "personal",
        encrypted_vault_key: encryptedVaultKey,
      })
      setNewName("")
      setShowForm(false)
      load()
    } catch (e) {
      log.error("create vault", e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        eyebrow="Mis bóvedas"
        title="Bóvedas"
        accent="seguras"
        right={
          <Button onClick={() => setShowForm(v => !v)} className="px-4 py-[10px] text-[13.5px]">
            <PlusIcon className="w-[18px] h-[18px]" />
            Nueva bóveda
          </Button>
        }
      />

      {showForm && (
        <div className="card flex gap-3 items-center p-5">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createVault()}
            placeholder="Nombre de la bóveda…" autoFocus
            className="input-base flex-1" />
          <Button onClick={createVault} disabled={creating} className="px-4 py-[10px]">
            {creating ? "Creando…" : "Crear"}
          </Button>
          <button onClick={() => setShowForm(false)}
            className="text-muted text-lg leading-none p-1 hover:text-ivory transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {loading ? <Loading text="Cargando bóvedas…" />
       : vaults.length === 0 ? (
        <EmptyState title="Sin bóvedas todavía" subtitle="Crea tu primera bóveda para empezar a guardar contraseñas" />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {vaults.map(vault => {
            const roleColor = ROLE_COLOR[vault.user_role] ?? "var(--muted)"
            return (
              <button key={vault.id} onClick={() => onSelect(vault.id, vault.name)}
                className="card text-left p-[22px] flex flex-col gap-3 cursor-pointer
                           hover:-translate-y-[2px] hover:border-[#4d4136] transition-[transform,border-color] duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-[22px] text-ivory">{vault.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[1px] px-[7px] py-[3px] rounded-md"
                        style={{ color: roleColor, border: `1px solid ${roleColor}33` }}>
                    {vault.user_role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-muted uppercase tracking-[1px]">
                    {vault.vault_type}
                  </span>
                  <span className="w-[3px] h-[3px] rounded-full bg-line-2" />
                  <span className="font-mono text-[10.5px] text-muted">Ver entradas →</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
