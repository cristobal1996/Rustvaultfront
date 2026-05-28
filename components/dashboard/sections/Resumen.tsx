// components/dashboard/sections/Resumen.tsx
interface Props {
  user:   { name: string; email: string }
  counts: Record<string, number>
  onNav:  (s: string) => void
}

export function Resumen({ user, counts, onNav }: Props) {
  const cards = [
    { id: "vaults",      label: "Vaults",            value: counts.vaults   ?? 0, color: "var(--rust-bright)" },
    { id: "entradas",    label: "Contraseñas",        value: counts.entradas ?? 0, color: "oklch(0.78 0.08 170)" },
    { id: "totp",        label: "Códigos 2FA",        value: counts.totp     ?? 0, color: "oklch(0.8 0.08 250)" },
    { id: "dispositivos",label: "Dispositivos",       value: counts.dispositivos ?? 0, color: "oklch(0.8 0.08 85)" },
  ]

  const quickActions = [
    { id: "entradas",    label: "Nueva contraseña",   icon: "+" },
    { id: "generador",   label: "Generar contraseña", icon: "⚡" },
    { id: "totp",        label: "Añadir código 2FA",  icon: "📱" },
    { id: "compartidos", label: "Ver compartidos",    icon: "👥" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Saludo */}
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 8px" }}>
          Bienvenido de nuevo
        </p>
        <h1
          style={{
            fontFamily:    "var(--font-serif)",
            fontWeight:    400,
            fontSize:      "clamp(32px, 3.5vw, 48px)",
            lineHeight:    1,
            letterSpacing: "-0.6px",
            margin:        0,
            color:         "var(--ivory)",
          }}
        >
          {user.name.split(" ")[0]}{" "}
          <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>
            — tu bóveda está segura
          </em>
        </h1>
      </div>

      {/* Estadísticas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onNav(card.id)}
            style={{
              border:        "1px solid var(--line)",
              borderRadius:  "14px",
              padding:       "22px 20px",
              background:    "var(--bg-elev)",
              textAlign:     "left",
              cursor:        "pointer",
              transition:    "transform 140ms ease, border-color 140ms ease",
              display:       "flex",
              flexDirection: "column",
              gap:           "6px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform   = "translateY(-2px)"
              e.currentTarget.style.borderColor = "var(--line-2)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform   = "translateY(0)"
              e.currentTarget.style.borderColor = "var(--line)"
            }}
          >
            <span
              style={{
                fontFamily:    "var(--font-serif)",
                fontSize:      "40px",
                lineHeight:    1,
                letterSpacing: "-0.6px",
                color:         card.color,
              }}
            >
              {card.value}
            </span>
            <span
              style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "10px",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color:         "var(--muted)",
              }}
            >
              {card.label}
            </span>
          </button>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Acciones rápidas
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {quickActions.map(action => (
            <button
              key={action.id}
              onClick={() => onNav(action.id)}
              style={{
                border:         "1px solid var(--line-2)",
                borderRadius:   "12px",
                padding:        "16px 18px",
                background:     "transparent",
                textAlign:      "left",
                cursor:         "pointer",
                display:        "flex",
                alignItems:     "center",
                gap:            "12px",
                color:          "var(--ivory-dim)",
                fontSize:       "14px",
                transition:     "background 140ms ease, border-color 140ms ease, color 140ms ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background    = "rgba(255,255,255,0.03)"
                e.currentTarget.style.borderColor   = "#4d4136"
                e.currentTarget.style.color         = "var(--ivory)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background    = "transparent"
                e.currentTarget.style.borderColor   = "var(--line-2)"
                e.currentTarget.style.color         = "var(--ivory-dim)"
              }}
            >
              <span style={{ fontSize: "18px" }}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nota de seguridad */}
      <div
        style={{
          border:       "1px solid var(--line)",
          borderRadius: "12px",
          padding:      "16px 18px",
          background:   "var(--bg-elev)",
          display:      "flex",
          alignItems:   "center",
          gap:          "12px",
        }}
      >
        <span
          style={{
            width:        "8px",
            height:       "8px",
            borderRadius: "50%",
            background:   "var(--patina)",
            boxShadow:    "0 0 0 3px color-mix(in oklab, var(--patina) 22%, transparent)",
            flexShrink:   0,
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize:   "11px",
            color:      "var(--muted)",
            margin:     0,
            letterSpacing: "0.2px",
          }}
        >
          Tus contraseñas están cifradas con AES-256-GCM. El servidor nunca puede leerlas.
        </p>
      </div>
    </div>
  )
}
