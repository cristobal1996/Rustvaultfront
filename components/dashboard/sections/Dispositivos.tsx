// components/dashboard/sections/Dispositivos.tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import {
  GlobeAltIcon, DevicePhoneMobileIcon, ComputerDesktopIcon,
  CommandLineIcon, CpuChipIcon, ShieldCheckIcon,
} from "@heroicons/react/24/outline"

import { apiGet, apiDelete } from "@/lib/api"
import { log } from "@/lib/log"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Loading } from "@/components/ui/Loading"
import { EmptyState } from "@/components/ui/EmptyState"

interface Device {
  id:           string
  name:         string
  platform:     string
  is_trusted:   boolean
  last_seen_at: string | null
  created_at:   string
}

const PLATFORM_ICON: Record<string, typeof GlobeAltIcon> = {
  web:     GlobeAltIcon,
  mobile:  DevicePhoneMobileIcon,
  desktop: ComputerDesktopIcon,
  cli:     CommandLineIcon,
}

export function Dispositivos() {
  const [devices,  setDevices]  = useState<Device[]>([])
  const [loading,  setLoading]  = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<Device[]>("/api/devices")
      setDevices(Array.isArray(data) ? data : [])
    } catch (e) {
      log.error("load devices", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function revoke(id: string) {
    setRevoking(id)
    try {
      await apiDelete(`/api/devices/${id}`)
      setDevices(ds => ds.filter(d => d.id !== id))
    } catch (e) {
      log.error("revoke device", e)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader eyebrow="Seguridad" title="Dispositivos" accent="activos" />

      {loading ? <Loading text="Cargando dispositivos…" /> : (
        <div className="flex flex-col gap-[10px]">
          {devices.map(device => {
            const Icon = PLATFORM_ICON[device.platform] ?? CpuChipIcon
            return (
              <div key={device.id} className="card-padded flex items-center gap-4 p-[18px]">
                <Icon className="w-[22px] h-[22px] text-ivory-dim" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[10px] mb-[3px]">
                    <span className="text-[15px] text-ivory font-medium">{device.name}</span>
                    {device.is_trusted && (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[1px]
                                       text-patina border border-[color-mix(in_oklab,var(--patina)_40%,transparent)]
                                       rounded px-[6px] py-[2px]">
                        <ShieldCheckIcon className="w-[10px] h-[10px]" />
                        De confianza
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-muted">
                    {device.platform} · {device.last_seen_at
                      ? `Último acceso: ${new Date(device.last_seen_at).toLocaleDateString("es")}`
                      : "Sin actividad"}
                  </span>
                </div>

                <button onClick={() => revoke(device.id)} disabled={revoking === device.id} className="btn-danger">
                  {revoking === device.id ? "…" : "Revocar"}
                </button>
              </div>
            )
          })}

          {devices.length === 0 && <EmptyState title="No hay dispositivos registrados" />}
        </div>
      )}
    </div>
  )
}
