// components/dashboard/sections/Dispositivos.tsx
"use client"
import { useState, useEffect } from "react"

interface Device {
  id:          string
  name:        string
  platform:    string
  is_trusted:  boolean
  last_seen_at: string | null
  created_at:  string
}

interface Props { token: string }

export function Dispositivos({ token }: Props) {
  const [devices,  setDevices]  = useState<Device[]>([])
  const [loading,  setLoading]  = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch("/api/devices", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setDevices(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function revoke(id: string) {
    setRevoking(id)
    try {
      await fetch(`/api/devices/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      setDevices(ds => ds.filter(d => d.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  const platformIcon = (platform: string) => {
    if (platform === "web")     return "🌐"
    if (platform === "mobile")  return "📱"
    if (platform === "desktop") return "💻"
    if (platform === "cli")     return "⌨️"
    return "🔌"
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>
          Seguridad
        </p>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", margin: 0 }}>
          Dispositivos <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>activos</em>
        </h2>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>Cargando dispositivos…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {devices.map(device => (
            <div
              key={device.id}
              style={{
                border:       "1px solid var(--line)",
                borderRadius: "12px",
                padding:      "18px 20px",
                background:   "var(--bg-elev)",
                display:      "flex",
                alignItems:   "center",
                gap:          "16px",
              }}
            >
              <span style={{ fontSize: "24px", flexShrink: 0 }}>{platformIcon(device.platform)}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
                  <span style={{ fontSize: "15px", color: "var(--ivory)", fontWeight: 500 }}>{device.name}</span>
                  {device.is_trusted && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "1px", textTransform: "uppercase", color: "var(--patina)", padding: "2px 6px", border: "1px solid color-mix(in oklab, var(--patina) 40%, transparent)", borderRadius: "4px" }}>
                      De confianza
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>
                  {device.platform} · {device.last_seen_at ? `Último acceso: ${new Date(device.last_seen_at).toLocaleDateString("es")}` : "Sin actividad"}
                </span>
              </div>

              <button
                onClick={() => revoke(device.id)}
                disabled={revoking === device.id}
                style={{
                  background:   "transparent",
                  border:       "1px solid rgba(220,38,38,0.25)",
                  borderRadius: "8px",
                  padding:      "7px 12px",
                  fontSize:     "12px",
                  color:        "#f87171",
                  cursor:       revoking === device.id ? "not-allowed" : "pointer",
                  fontFamily:   "var(--font-mono)",
                  transition:   "background 140ms ease",
                }}
              >
                {revoking === device.id ? "…" : "Revocar"}
              </button>
            </div>
          ))}

          {devices.length === 0 && (
            <div style={{ border: "1px dashed var(--line-2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px", margin: 0 }}>
                No hay dispositivos registrados
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
