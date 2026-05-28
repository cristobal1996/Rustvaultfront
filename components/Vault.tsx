// components/Vault.tsx
"use client"
import { useState, useEffect, useRef } from "react"

export function Vault() {
  const [unlocked, setUnlocked] = useState(false)
  const vaultRef = useRef<HTMLDivElement>(null)

  // Generar los 12 pernos
  const bolts = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360
    return (
      <span
        key={i}
        style={{
          position:        "absolute",
          width:           "8px",
          height:          "8px",
          borderRadius:    "50%",
          background:      "radial-gradient(circle at 30% 30%, #c9a07c, #5b4128 70%)",
          boxShadow:       "inset 0 -1px 1px rgba(0,0,0,0.5)",
          top:             "50%",
          left:            "50%",
          transform:       `rotate(${angle}deg) translate(0, -47%) translate(-50%, -50%) rotate(${-angle}deg)`,
          transformOrigin: "0 0",
        }}
      />
    )
  })

  return (
    <div
      style={{
        position:     "relative",
        aspectRatio:  "1 / 1",
        width:        "100%",
        maxWidth:     "540px",
        justifySelf:  "end",
      }}
    >
      {/* Glow radial */}
      <div
        style={{
          position:      "absolute",
          inset:         "-10%",
          background:    "radial-gradient(60% 50% at 50% 50%, color-mix(in oklab, oklch(0.62 0.13 45) 22%, transparent), transparent 70%)",
          filter:        "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* Telemetría 1 */}
      <div
        style={{
          position:       "absolute",
          top:            "8%",
          left:           "-8%",
          background:     "color-mix(in oklab, var(--bg-elev) 90%, transparent)",
          border:         "1px solid var(--line-2)",
          borderRadius:   "10px",
          padding:        "10px 12px",
          fontFamily:     "var(--font-mono)",
          fontSize:       "11px",
          color:          "var(--ivory-dim)",
          display:        "flex",
          alignItems:     "center",
          gap:            "10px",
          backdropFilter: "blur(6px)",
          boxShadow:      "0 10px 30px -10px rgba(0,0,0,0.6)",
          zIndex:         2,
        }}
      >
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--patina)", boxShadow: "0 0 0 3px color-mix(in oklab, var(--patina) 22%, transparent)", flexShrink: 0 }} />
        AES-256-GCM activo
      </div>

      {/* Telemetría 2 */}
      <div
        style={{
          position:       "absolute",
          bottom:         "12%",
          right:          "-10%",
          background:     "color-mix(in oklab, var(--bg-elev) 90%, transparent)",
          border:         "1px solid var(--line-2)",
          borderRadius:   "10px",
          padding:        "10px 12px",
          fontFamily:     "var(--font-mono)",
          fontSize:       "11px",
          color:          "var(--ivory-dim)",
          display:        "flex",
          alignItems:     "center",
          gap:            "10px",
          backdropFilter: "blur(6px)",
          boxShadow:      "0 10px 30px -10px rgba(0,0,0,0.6)",
          zIndex:         2,
        }}
      >
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--rust)", flexShrink: 0 }} />
        Zero-knowledge
      </div>

      {/* Telemetría 3 */}
      <div
        style={{
          position:       "absolute",
          bottom:         "-4%",
          left:           "8%",
          background:     "color-mix(in oklab, var(--bg-elev) 90%, transparent)",
          border:         "1px solid var(--line-2)",
          borderRadius:   "10px",
          padding:        "10px 12px",
          fontFamily:     "var(--font-mono)",
          fontSize:       "11px",
          color:          "var(--ivory-dim)",
          display:        "flex",
          alignItems:     "center",
          gap:            "10px",
          backdropFilter: "blur(6px)",
          boxShadow:      "0 10px 30px -10px rgba(0,0,0,0.6)",
          zIndex:         2,
        }}
      >
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--patina)", boxShadow: "0 0 0 3px color-mix(in oklab, var(--patina) 22%, transparent)", flexShrink: 0 }} className="animate-pulse-slow" />
        Rust · Axum · PostgreSQL
      </div>

      {/* La caja fuerte */}
      <div
        ref={vaultRef}
        className={unlocked ? "vault-unlocked" : ""}
        onClick={() => setUnlocked(v => !v)}
        onMouseEnter={() => setUnlocked(true)}
        onMouseLeave={() => setUnlocked(false)}
        style={{
          position:     "absolute",
          inset:        "6%",
          borderRadius: "50%",
          background:   "radial-gradient(circle at 32% 28%, #4a3a2d, #2a201a 55%, #1a130f 80%)",
          boxShadow:    "inset 0 0 0 1px #3a2c22, inset 0 -30px 60px rgba(0,0,0,0.55), 0 30px 80px -20px rgba(0,0,0,0.7)",
          cursor:       "pointer",
        }}
      >
        {/* Ring exterior */}
        <div style={{
          position:     "absolute",
          inset:        "6%",
          borderRadius: "50%",
          border:       "1px solid #2c2218",
          background:   "radial-gradient(circle at 50% 50%, transparent 58%, rgba(0,0,0,0.35) 75%, transparent 80%)",
        }} />

        {/* Ring punteado */}
        <div style={{
          position:     "absolute",
          inset:        "12%",
          borderRadius: "50%",
          border:       "1px dashed rgba(210,165,120,0.18)",
        }} />

        {/* Puerta */}
        <div
          className="vault-door"
          style={{
            position:     "absolute",
            inset:        "17%",
            borderRadius: "50%",
            background:   "radial-gradient(circle at 40% 30%, oklch(0.55 0.12 50) 0%, oklch(0.42 0.11 42) 35%, oklch(0.30 0.08 38) 70%, oklch(0.22 0.06 35) 100%)",
            boxShadow:    "inset 0 0 0 1px rgba(255,220,180,0.08), inset 0 -20px 40px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5)",
            transition:   "box-shadow 600ms ease",
          }}
        />

        {/* Pernos */}
        <div style={{ position: "absolute", inset: "18%", borderRadius: "50%", pointerEvents: "none" }}>
          {bolts}
        </div>

        {/* Radios giratorios */}
        <div
          className="vault-spokes"
          style={{
            position:     "absolute",
            inset:        "28%",
            borderRadius: "50%",
          }}
        >
          {/* Rayo horizontal */}
          <div style={{
            position:     "absolute",
            top:          "50%",
            left:         "-6%",
            right:        "-6%",
            height:       "10px",
            transform:    "translateY(-50%)",
            background:   "linear-gradient(90deg, #1a120d, #6b4d35 50%, #1a120d)",
            borderRadius: "4px",
            boxShadow:    "inset 0 0 0 1px rgba(255,210,170,0.08), 0 2px 6px rgba(0,0,0,0.4)",
          }} />
          {/* Rayo vertical */}
          <div style={{
            position:     "absolute",
            left:         "50%",
            top:          "-6%",
            bottom:       "-6%",
            width:        "10px",
            transform:    "translateX(-50%)",
            background:   "linear-gradient(180deg, #1a120d, #6b4d35 50%, #1a120d)",
            borderRadius: "4px",
            boxShadow:    "inset 0 0 0 1px rgba(255,210,170,0.08), 0 2px 6px rgba(0,0,0,0.4)",
          }} />
        </div>

        {/* Hub central con la R */}
        <div style={{
          position:     "absolute",
          inset:        "41%",
          borderRadius: "50%",
          background:   "radial-gradient(circle at 35% 30%, oklch(0.74 0.14 55), oklch(0.62 0.13 45) 50%, oklch(0.48 0.13 40))",
          boxShadow:    "inset 0 0 0 1px rgba(255,255,255,0.15), inset 0 -6px 12px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.6)",
          display:      "grid",
          placeItems:   "center",
        }}>
          <span style={{
            fontFamily: "var(--font-serif)",
            fontStyle:  "italic",
            color:      "rgba(20,15,10,0.55)",
            fontSize:   "clamp(28px, 4vw, 48px)",
            lineHeight: 1,
          }}>
            R
          </span>
        </div>
      </div>
    </div>
  )
}
