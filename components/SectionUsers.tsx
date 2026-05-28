// components/SectionUsers.tsx
"use client"
import { useState } from "react"

const COLORS = ["r", "g", "b", "y", "p", "k"] as const
type Color = typeof COLORS[number]

const COLOR_STYLES: Record<Color, string> = {
  r: "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))",
  g: "linear-gradient(135deg, oklch(0.55 0.07 170), oklch(0.38 0.06 165))",
  b: "linear-gradient(135deg, oklch(0.5 0.09 250), oklch(0.35 0.08 245))",
  y: "linear-gradient(135deg, oklch(0.65 0.11 85), oklch(0.45 0.1 70))",
  p: "linear-gradient(135deg, oklch(0.5 0.1 320), oklch(0.36 0.09 310))",
  k: "linear-gradient(135deg, #3a302a, #211a16)",
}

interface User {
  name:     string
  handle:   string
  color:    Color
  role:     "admin" | "miembro" | "invitado"
  vaults:   number
  entries:  number
  devices:  number
  verified: boolean
  active:   boolean
}

const USERS: User[] = [
  { name: "Alice Martínez",  handle: "alice@dev.io",    color: "r", role: "admin",    vaults: 4,  entries: 142, devices: 3, verified: true,  active: true  },
  { name: "Bob Hernández",   handle: "bob@ops.net",     color: "b", role: "miembro",  vaults: 2,  entries: 67,  devices: 2, verified: true,  active: false },
  { name: "Carol Sánchez",   handle: "carol@design.es", color: "g", role: "miembro",  vaults: 3,  entries: 95,  devices: 4, verified: false, active: true  },
  { name: "David Romero",    handle: "david@cloud.io",  color: "y", role: "invitado", vaults: 1,  entries: 12,  devices: 1, verified: false, active: false },
  { name: "Elena Torres",    handle: "elena@sec.org",   color: "p", role: "admin",    vaults: 6,  entries: 208, devices: 5, verified: true,  active: true  },
  { name: "Fernando López",  handle: "fer@backend.dev", color: "k", role: "miembro",  vaults: 2,  entries: 44,  devices: 2, verified: true,  active: false },
]

const ROLE_STYLES: Record<string, { color: string; border: string }> = {
  admin:    { color: "var(--rust-bright)",         border: "color-mix(in oklab, var(--rust) 50%, var(--line-2))" },
  miembro:  { color: "oklch(0.78 0.08 170)",       border: "color-mix(in oklab, var(--patina) 35%, var(--line-2))" },
  invitado: { color: "oklch(0.8 0.08 85)",         border: "color-mix(in oklab, oklch(0.65 0.11 85) 40%, var(--line-2))" },
}

type Filter = "todos" | "admin" | "miembro" | "invitado"

export function SectionUsers() {
  const [filter, setFilter]   = useState<Filter>("todos")
  const [search, setSearch]   = useState("")
  const [hovered, setHovered] = useState<number | null>(null)

  const filtered = USERS.filter(u => {
    const matchFilter = filter === "todos" || u.role === filter
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.handle.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts: Record<Filter, number> = {
    todos:    USERS.length,
    admin:    USERS.filter(u => u.role === "admin").length,
    miembro:  USERS.filter(u => u.role === "miembro").length,
    invitado: USERS.filter(u => u.role === "invitado").length,
  }

  return (
    <section
      id="usuarios"
      style={{ maxWidth: "1320px", margin: "0 auto", padding: "110px 40px" }}
    >
      {/* Cabecera */}
      <div
        style={{
          display:            "grid",
          gridTemplateColumns: "220px 1fr",
          gap:                "40px",
          marginBottom:       "56px",
          alignItems:         "end",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "11px",
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color:         "var(--muted)",
            display:       "flex",
            alignItems:    "center",
            gap:           "12px",
          }}
        >
          <span style={{ display: "inline-block", width: "28px", height: "1px", background: "var(--rust)" }} />
          Usuarios
        </span>
        <h2
          style={{
            fontFamily:    "var(--font-serif)",
            fontWeight:    400,
            fontSize:      "clamp(36px, 4.4vw, 60px)",
            lineHeight:    "1.02",
            letterSpacing: "-0.6px",
            margin:        0,
          }}
        >
          Colaboración <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>segura</em>
        </h2>
      </div>

      {/* Controles */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "22px" }}>
        {(["todos", "admin", "miembro", "invitado"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding:      "9px 14px",
              border:       `1px solid ${filter === f ? "var(--ivory)" : "var(--line-2)"}`,
              borderRadius: "999px",
              fontSize:     "13px",
              color:        filter === f ? "var(--bg)" : "var(--ivory-dim)",
              background:   filter === f ? "var(--ivory)" : "transparent",
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "8px",
              cursor:       "pointer",
              transition:   "all 160ms ease",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span
              style={{
                color:      filter === f ? "rgba(0,0,0,0.5)" : "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize:   "11px",
              }}
            >
              {counts[f]}
            </span>
          </button>
        ))}

        {/* Búsqueda */}
        <div
          style={{
            marginLeft:   "auto",
            display:      "inline-flex",
            alignItems:   "center",
            gap:          "10px",
            border:       "1px solid var(--line-2)",
            borderRadius: "999px",
            padding:      "9px 14px",
            color:        "var(--ivory-dim)",
            background:   "transparent",
            minWidth:     "240px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar usuario…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background:  "transparent",
              border:      "none",
              outline:     "none",
              color:       "var(--ivory)",
              font:        "inherit",
              flex:        1,
              fontSize:    "13.5px",
            }}
          />
        </div>
      </div>

      {/* Grid de tarjetas */}
      <div
        style={{
          display:            "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                "18px",
        }}
      >
        {filtered.map((user, i) => {
          const roleStyle = ROLE_STYLES[user.role]
          const isHovered = hovered === i

          return (
            <div
              key={user.handle}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                border:       `1px solid ${isHovered ? "#4d4136" : "var(--line)"}`,
                background:   "var(--bg-elev)",
                borderRadius: "16px",
                padding:      "22px",
                display:      "flex",
                flexDirection: "column",
                gap:          "14px",
                transition:   "transform 160ms ease, border-color 160ms ease",
                transform:    isHovered ? "translateY(-2px)" : "translateY(0)",
                cursor:       "pointer",
              }}
            >
              {/* Top: avatar + info + role */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {/* Avatar */}
                <div
                  style={{
                    width:        "44px",
                    height:       "44px",
                    borderRadius: "12px",
                    background:   COLOR_STYLES[user.color],
                    display:      "grid",
                    placeItems:   "center",
                    fontFamily:   "var(--font-serif)",
                    fontSize:     "20px",
                    color:        "#f8f0e4",
                    flexShrink:   0,
                    boxShadow:    "inset 0 0 0 1px rgba(255,255,255,0.08)",
                  }}
                >
                  {user.name[0]}
                </div>

                {/* Nombre + handle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize:      "15.5px",
                      color:         "var(--ivory)",
                      fontWeight:    500,
                      letterSpacing: "0.1px",
                      display:       "flex",
                      alignItems:    "center",
                      gap:           "8px",
                    }}
                  >
                    {user.name}
                    {user.verified && (
                      <span
                        style={{
                          width:        "14px",
                          height:       "14px",
                          borderRadius: "50%",
                          background:   "var(--patina)",
                          display:      "inline-grid",
                          placeItems:   "center",
                          color:        "var(--bg)",
                          fontSize:     "9px",
                          fontWeight:   700,
                          flexShrink:   0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize:   "11.5px",
                      color:      "var(--muted)",
                      marginTop:  "2px",
                      overflow:   "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.handle}
                  </div>
                </div>

                {/* Rol */}
                <span
                  style={{
                    fontFamily:    "var(--font-mono)",
                    fontSize:      "10px",
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    padding:       "4px 8px",
                    borderRadius:  "6px",
                    color:         roleStyle.color,
                    border:        `1px solid ${roleStyle.border}`,
                    flexShrink:    0,
                  }}
                >
                  {user.role}
                </span>
              </div>

              {/* Estadísticas */}
              <div
                style={{
                  display:            "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  paddingTop:         "14px",
                  borderTop:          "1px dashed var(--line)",
                }}
              >
                {[
                  { v: user.vaults,  k: "Vaults"   },
                  { v: user.entries, k: "Entradas"  },
                  { v: user.devices, k: "Devices"   },
                ].map(stat => (
                  <div key={stat.k} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span
                      style={{
                        fontFamily:    "var(--font-serif)",
                        fontSize:      "20px",
                        color:         "var(--ivory)",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {stat.v}
                    </span>
                    <span
                      style={{
                        fontFamily:    "var(--font-mono)",
                        fontSize:      "9.5px",
                        letterSpacing: "1.2px",
                        textTransform: "uppercase",
                        color:         "var(--muted)",
                      }}
                    >
                      {stat.k}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pie */}
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  fontFamily:     "var(--font-mono)",
                  fontSize:       "11px",
                  color:          "var(--muted)",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span
                    className={user.active ? "animate-pulse-slow" : ""}
                    style={{
                      width:        "6px",
                      height:       "6px",
                      borderRadius: "50%",
                      background:   user.active ? "var(--patina)" : "#5a4e42",
                      boxShadow:    user.active ? "0 0 0 3px color-mix(in oklab, var(--patina) 22%, transparent)" : "none",
                      flexShrink:   0,
                    }}
                  />
                  {user.active ? "Activo ahora" : "Desconectado"}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
