// components/dashboard/sections/Generador.tsx
"use client"
import { useState } from "react"

interface Props { token: string }

export function Generador({ token }: Props) {
  const [length,     setLength]     = useState(20)
  const [uppercase,  setUppercase]  = useState(true)
  const [lowercase,  setLowercase]  = useState(true)
  const [digits,     setDigits]     = useState(true)
  const [symbols,    setSymbols]    = useState(true)
  const [ambiguous,  setAmbiguous]  = useState(false)
  const [password,   setPassword]   = useState("")
  const [entropy,    setEntropy]    = useState<number | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [copied,     setCopied]     = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/generator/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          length,
          use_uppercase:     uppercase,
          use_lowercase:     lowercase,
          use_digits:        digits,
          use_symbols:       symbols,
          exclude_ambiguous: ambiguous,
        }),
      })
      const data = await res.json()
      setPassword(data.password ?? "")
      setEntropy(data.entropy  ?? null)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!password) return
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const strengthLabel =
    !entropy                  ? null
    : entropy < 40            ? { label: "Muy débil",  color: "#ef4444" }
    : entropy < 60            ? { label: "Débil",      color: "#f97316" }
    : entropy < 80            ? { label: "Aceptable",  color: "#eab308" }
    : entropy < 100           ? { label: "Fuerte",     color: "#22c55e" }
    :                           { label: "Muy fuerte", color: "#10b981" }

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "10px",
        padding:      "10px 14px",
        border:       `1px solid ${value ? "var(--rust)" : "var(--line-2)"}`,
        borderRadius: "8px",
        background:   value ? "color-mix(in oklab, var(--rust) 12%, transparent)" : "transparent",
        color:        value ? "var(--rust-bright)" : "var(--ivory-dim)",
        fontSize:     "13.5px",
        cursor:       "pointer",
        transition:   "all 140ms ease",
        flex:         1,
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width:        "14px",
          height:       "14px",
          borderRadius: "4px",
          border:       `1.5px solid ${value ? "var(--rust)" : "var(--line-2)"}`,
          background:   value ? "var(--rust)" : "transparent",
          display:      "grid",
          placeItems:   "center",
          flexShrink:   0,
          transition:   "all 140ms ease",
        }}
      >
        {value && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </span>
      {label}
    </button>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: "600px" }}>
      {/* Cabecera */}
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 6px" }}>
          Herramienta
        </p>
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "32px", letterSpacing: "-0.4px", margin: 0 }}>
          Generador de <em style={{ fontStyle: "italic", color: "var(--rust-bright)" }}>contraseñas</em>
        </h2>
      </div>

      {/* Resultado */}
      <div
        style={{
          border:       "1px solid var(--line)",
          borderRadius: "14px",
          padding:      "22px",
          background:   "var(--bg-elev)",
          display:      "flex",
          flexDirection: "column",
          gap:          "14px",
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "22px",
              letterSpacing: "0.1em",
              color:         password ? "var(--ivory)" : "var(--muted)",
              padding:       "16px 56px 16px 18px",
              background:    "var(--bg)",
              border:        "1px solid var(--line-2)",
              borderRadius:  "10px",
              minHeight:     "58px",
              wordBreak:     "break-all",
              lineHeight:    "1.4",
            }}
          >
            {password || "Pulsa generar…"}
          </div>

          {password && (
            <button
              onClick={copy}
              style={{
                position:   "absolute",
                right:      "10px",
                top:        "50%",
                transform:  "translateY(-50%)",
                background: copied ? "color-mix(in oklab, var(--patina) 15%, transparent)" : "var(--bg-elev)",
                border:     `1px solid ${copied ? "var(--patina)" : "var(--line-2)"}`,
                borderRadius: "7px",
                padding:    "6px 8px",
                color:      copied ? "var(--patina)" : "var(--muted)",
                cursor:     "pointer",
                fontSize:   "11px",
                fontFamily: "var(--font-mono)",
                transition: "all 200ms ease",
              }}
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          )}
        </div>

        {/* Entropía */}
        {strengthLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ flex: 1, height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height:     "100%",
                width:      `${Math.min(100, ((entropy ?? 0) / 128) * 100)}%`,
                background: strengthLabel.color,
                borderRadius: "2px",
                transition: "width 400ms ease",
              }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: strengthLabel.color }}>
              {strengthLabel.label} · {Math.round(entropy ?? 0)} bits
            </span>
          </div>
        )}
      </div>

      {/* Longitud */}
      <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "22px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)" }}>
            Longitud
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "28px", color: "var(--rust-bright)" }}>
            {length}
          </span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={e => setLength(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: "var(--rust)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {[8, 12, 16, 20, 32, 64].map(v => (
            <button
              key={v}
              onClick={() => setLength(v)}
              style={{
                fontFamily:   "var(--font-mono)",
                fontSize:     "10px",
                padding:      "3px 7px",
                border:       `1px solid ${length === v ? "var(--rust)" : "var(--line-2)"}`,
                borderRadius: "5px",
                background:   length === v ? "color-mix(in oklab, var(--rust) 15%, transparent)" : "transparent",
                color:        length === v ? "var(--rust-bright)" : "var(--muted)",
                cursor:       "pointer",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Opciones */}
      <div style={{ border: "1px solid var(--line)", borderRadius: "14px", padding: "22px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "10px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2px" }}>
          Caracteres
        </span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Toggle label="A–Z"      value={uppercase}  onChange={setUppercase} />
          <Toggle label="a–z"      value={lowercase}  onChange={setLowercase} />
          <Toggle label="0–9"      value={digits}     onChange={setDigits}    />
          <Toggle label="!@#…"     value={symbols}    onChange={setSymbols}   />
        </div>
        <Toggle label="Excluir caracteres ambiguos (0/O, 1/l)" value={ambiguous} onChange={setAmbiguous} />
      </div>

      {/* Botón generar */}
      <button
        onClick={generate}
        disabled={loading}
        style={{
          background:   loading ? "var(--rust-deep)" : "var(--rust)",
          color:        "#fff",
          border:       "none",
          borderRadius: "12px",
          padding:      "14px",
          fontSize:     "15px",
          fontWeight:   500,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          gap:          "10px",
          cursor:       loading ? "not-allowed" : "pointer",
          boxShadow:    "0 1px 0 rgba(255,255,255,0.1) inset",
          transition:   "background 160ms ease",
        }}
      >
        {loading ? "Generando…" : "Generar contraseña segura"}
      </button>
    </div>
  )
}
