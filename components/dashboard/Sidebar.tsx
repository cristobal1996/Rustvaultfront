// components/dashboard/Sidebar.tsx
"use client"

interface Props {
  active:   string
  onChange: (section: string) => void
  user:     { name: string; email: string }
  onLogout: () => void
  counts:   Record<string, number>
}

const NAV_ITEMS = [
  {
    id:    "resumen",
    label: "Resumen",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },

  {
    id:    "entradas",
    label: "Contraseñas",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
  {
    id:    "generador",
    label: "Generador",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id:    "totp",
    label: "Códigos 2FA",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
        <path d="M9 7h6M9 11h4"/>
      </svg>
    ),
  },
  {
    id:    "compartidos",
    label: "Compartidos",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id:    "dispositivos",
    label: "Dispositivos",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
    ),
  },
  {
    id:    "ajustes",
    label: "Ajustes",
    icon:  (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export function Sidebar({ active, onChange, user, onLogout, counts }: Props) {
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <aside
      style={{
        position:      "sticky",
        top:           "88px",
        border:        "1px solid var(--line)",
        background:    "var(--bg-elev)",
        borderRadius:  "18px",
        padding:       "22px",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        gap:           0,
      }}
    >
      {/* Tarjeta del usuario */}
      <div
        style={{
          display:       "flex",
          alignItems:    "center",
          gap:           "14px",
          paddingBottom: "18px",
          borderBottom:  "1px dashed var(--line)",
          marginBottom:  "18px",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width:          "52px",
            height:         "52px",
            borderRadius:   "14px",
            background:     "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))",
            display:        "grid",
            placeItems:     "center",
            color:          "#f8f0e4",
            fontFamily:     "var(--font-serif)",
            fontSize:       "22px",
            boxShadow:      "inset 0 0 0 1px rgba(255,255,255,0.12), 0 6px 14px -8px rgba(0,0,0,0.5)",
            flexShrink:     0,
          }}
        >
          {initials}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize:      "15.5px",
              fontWeight:    500,
              color:         "var(--ivory)",
              letterSpacing: "0.1px",
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
            }}
          >
            {user.name}
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
            {user.email}
          </div>
        </div>
      </div>

      {/* Label sección */}
      <div
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      "10px",
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color:         "var(--muted)",
          padding:       "0 8px 8px",
        }}
      >
        Espacio personal
      </div>

      {/* Items de navegación */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            "12px",
                padding:        "11px 12px",
                borderRadius:   "10px",
                color:          isActive ? "var(--ivory)" : "var(--ivory-dim)",
                fontSize:       "14px",
                background:     isActive
                  ? "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
                  : "transparent",
                border:         isActive ? "none" : "none",
                boxShadow:      isActive ? "inset 0 0 0 1px var(--line-2)" : "none",
                textAlign:      "left",
                width:          "100%",
                cursor:         "pointer",
                position:       "relative",
                transition:     "background 140ms ease, color 140ms ease",
              }}
            >
              {/* Indicador activo */}
              {isActive && (
                <div
                  style={{
                    position:     "absolute",
                    left:         "-22px",
                    top:          "14px",
                    bottom:       "14px",
                    width:        "2px",
                    background:   "var(--rust-bright)",
                    borderRadius: "2px",
                  }}
                />
              )}

              {/* Icono */}
              <div
                style={{
                  width:     "18px",
                  height:    "18px",
                  color:     isActive ? "var(--rust-bright)" : "var(--muted)",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>

              <span style={{ flex: 1 }}>{item.label}</span>

              {/* Contador */}
              {counts[item.id] !== undefined && counts[item.id] > 0 && (
                <span
                  style={{
                    fontFamily:  "var(--font-mono)",
                    fontSize:    "10.5px",
                    color:       "var(--muted)",
                    padding:     "2px 6px",
                    border:      "1px solid var(--line-2)",
                    borderRadius: "5px",
                  }}
                >
                  {counts[item.id]}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Pie del sidebar — cerrar sesión */}
      <div
        style={{
          marginTop:    "auto",
          paddingTop:   "18px",
          borderTop:    "1px dashed var(--line)",
          display:      "flex",
          flexDirection: "column",
          gap:          "2px",
        }}
      >
        <button
          onClick={onLogout}
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        "12px",
            padding:    "11px 12px",
            borderRadius: "10px",
            color:      "var(--ivory-dim)",
            fontSize:   "14px",
            background: "transparent",
            border:     "none",
            textAlign:  "left",
            width:      "100%",
            cursor:     "pointer",
            transition: "background 140ms ease, color 140ms ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(220,38,38,0.08)"
            e.currentTarget.style.color      = "#f87171"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.color      = "var(--ivory-dim)"
          }}
        >
          <div style={{ width: "18px", height: "18px", color: "var(--muted)", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <path d="m16 17 5-5-5-5"/>
              <path d="M21 12H9"/>
            </svg>
          </div>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
