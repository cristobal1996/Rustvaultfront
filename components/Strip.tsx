// components/Strip.tsx
export function Strip() {
  const techs = ["Rust", "Axum", "PostgreSQL", "AES-256-GCM", "Argon2id", "X25519", "JWT", "Docker"]

  return (
    <div
      style={{
        borderTop:    "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background:   "linear-gradient(180deg, rgba(255,255,255,0.015), transparent)",
      }}
    >
      <div
        style={{
          maxWidth:           "1320px",
          margin:             "0 auto",
          padding:            "26px 40px",
          display:            "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems:         "center",
          gap:                "32px",
        }}
      >
        {/* Label izquierdo */}
        <span
          style={{
            fontFamily:    "var(--font-mono)",
            fontSize:      "11px",
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color:         "var(--muted)",
          }}
        >
          Stack
        </span>

        {/* Tecnologías */}
        <div
          style={{
            display:         "flex",
            alignItems:      "center",
            gap:             "48px",
            color:           "var(--ivory-dim)",
            fontSize:        "17px",
            letterSpacing:   "0.5px",
            justifyContent:  "center",
            flexWrap:        "wrap",
          }}
        >
          {techs.map((tech, i) => (
            <span key={tech} style={{ display: "flex", alignItems: "center", gap: "48px" }}>
              <span
                style={{
                  opacity:    0.75,
                  fontFamily: "var(--font-serif)",
                }}
              >
                {tech}
              </span>
              {i < techs.length - 1 && (
                <span
                  style={{
                    width:        "4px",
                    height:       "4px",
                    borderRadius: "50%",
                    background:   "var(--line-2)",
                    flexShrink:   0,
                  }}
                />
              )}
            </span>
          ))}
        </div>

        {/* Status derecho */}
        <span
          style={{
            fontFamily:  "var(--font-mono)",
            fontSize:    "11px",
            color:       "var(--ivory-dim)",
            display:     "inline-flex",
            alignItems:  "center",
            gap:         "8px",
          }}
        >
          <span
            className="animate-pulse-slow"
            style={{
              width:        "6px",
              height:       "6px",
              borderRadius: "50%",
              background:   "var(--patina)",
              boxShadow:    "0 0 0 3px color-mix(in oklab, var(--patina) 25%, transparent)",
              flexShrink:   0,
            }}
          />
          Open source
        </span>
      </div>
    </div>
  )
}
