// components/dashboard/sections/Generador.tsx
"use client"
import { useState, useReducer } from "react"
import { CheckIcon, ClipboardIcon, BoltIcon } from "@heroicons/react/24/outline"

import { apiPost } from "@/lib/api"
import { log } from "@/lib/log"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Button } from "@/components/ui/Button"

// ── Reducer para opciones ─────────────────────────────────────
interface Opts {
  length:    number
  uppercase: boolean
  lowercase: boolean
  digits:    boolean
  symbols:   boolean
  ambiguous: boolean
}

const INITIAL: Opts = {
  length: 20, uppercase: true, lowercase: true,
  digits: true, symbols: true, ambiguous: false,
}

type OptKey = keyof Opts
function optsReducer(state: Opts, action: { key: OptKey; value: Opts[OptKey] }): Opts {
  return { ...state, [action.key]: action.value }
}

// ── Componente ────────────────────────────────────────────────

interface GenResponse {
  password: string
  entropy:  number
}

export function Generador() {
  const [opts,     setOpts]     = useReducer(optsReducer, INITIAL)
  const [password, setPassword] = useState("")
  const [entropy,  setEntropy]  = useState<number | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [copied,   setCopied]   = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const data = await apiPost<GenResponse>("/api/generator/generate", {
        length:            opts.length,
        use_uppercase:     opts.uppercase,
        use_lowercase:     opts.lowercase,
        use_digits:        opts.digits,
        use_symbols:       opts.symbols,
        exclude_ambiguous: opts.ambiguous,
      })
      setPassword(data.password)
      setEntropy(data.entropy)
    } catch (e) {
      log.error("generate", e)
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

  const strength = !entropy ? null
    : entropy < 40  ? { label: "Muy débil",  color: "#ef4444" }
    : entropy < 60  ? { label: "Débil",      color: "#f97316" }
    : entropy < 80  ? { label: "Aceptable",  color: "#eab308" }
    : entropy < 100 ? { label: "Fuerte",     color: "#22c55e" }
    :                 { label: "Muy fuerte", color: "#10b981" }

  return (
    <div className="flex flex-col gap-7 w-full max-w-[600px]">
      <SectionHeader eyebrow="Herramienta" title="Generador de" accent="contraseñas" />

      {/* Resultado */}
      <div className="card-padded flex flex-col gap-[14px]">
        <div className="relative">
          <div className={`font-mono text-[15px] sm:text-[18px] lg:text-[22px] tracking-[0.06em] sm:tracking-[0.1em] px-4 sm:px-[18px] py-4 bg-bg border border-line-2 rounded-[10px] min-h-[58px] break-all leading-[1.4] ${password ? "text-ivory" : "text-muted"}`}>
            {password || "Pulsa generar…"}
          </div>
          {password && (
            <button onClick={copy}
              className={`mt-2 sm:mt-0 sm:absolute sm:right-[10px] sm:top-1/2 sm:-translate-y-1/2 inline-flex items-center gap-[5px] rounded-md px-[10px] py-[6px] text-[11px] font-mono cursor-pointer transition-all duration-200
                          ${copied ? "border border-patina text-patina bg-[color-mix(in_oklab,var(--patina)_15%,transparent)]"
                                   : "border border-line-2 text-muted bg-bg-elev"}`}>
              {copied
                ? <><CheckIcon     className="w-3 h-3" /> Copiado</>
                : <><ClipboardIcon className="w-3 h-3" /> Copiar</>}
            </button>
          )}
        </div>

        {strength && (
          <div className="flex items-center gap-[10px]">
            <div className="flex-1 h-1 bg-line rounded-[2px] overflow-hidden">
              <div className="h-full rounded-[2px] transition-[width] duration-400"
                   style={{ width: `${Math.min(100, ((entropy ?? 0) / 128) * 100)}%`, background: strength.color }} />
            </div>
            <span className="font-mono text-[11px]" style={{ color: strength.color }}>
              {strength.label} · {Math.round(entropy ?? 0)} bits
            </span>
          </div>
        )}
      </div>

      {/* Longitud */}
      <div className="card-padded flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-muted">Longitud</span>
          <span className="font-serif text-[28px] text-rust-bright">{opts.length}</span>
        </div>
        <input type="range" min={8} max={64} value={opts.length}
          onChange={e => setOpts({ key: "length", value: parseInt(e.target.value) })}
          className="w-full" style={{ accentColor: "var(--rust)" }} />
        <div className="flex justify-between">
          {[8, 12, 16, 20, 32, 64].map(v => (
            <button key={v} onClick={() => setOpts({ key: "length", value: v })}
              className={`font-mono text-[10px] px-[7px] py-[3px] rounded-md cursor-pointer
                          ${opts.length === v
                            ? "border border-rust text-rust-bright bg-[color-mix(in_oklab,var(--rust)_15%,transparent)]"
                            : "border border-line-2 text-muted"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="card-padded flex flex-col gap-[10px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-muted mb-[2px]">Caracteres</span>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="A–Z"  value={opts.uppercase} onChange={v => setOpts({ key: "uppercase", value: v })} />
          <Toggle label="a–z"  value={opts.lowercase} onChange={v => setOpts({ key: "lowercase", value: v })} />
          <Toggle label="0–9"  value={opts.digits}    onChange={v => setOpts({ key: "digits",    value: v })} />
          <Toggle label="!@#…" value={opts.symbols}   onChange={v => setOpts({ key: "symbols",   value: v })} />
        </div>
        <Toggle label="Excluir caracteres ambiguos (0/O, 1/l)"
                value={opts.ambiguous} onChange={v => setOpts({ key: "ambiguous", value: v })} />
      </div>

      <Button onClick={generate} disabled={loading}>
        <BoltIcon className="w-[18px] h-[18px]" />
        {loading ? "Generando…" : "Generar contraseña segura"}
      </Button>
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex-1 inline-flex items-center justify-center gap-[10px] px-[14px] py-[10px] rounded-lg text-[13.5px] cursor-pointer transition-all duration-150
                  ${value
                    ? "border border-rust text-rust-bright bg-[color-mix(in_oklab,var(--rust)_12%,transparent)]"
                    : "border border-line-2 text-ivory-dim bg-transparent"}`}>
      <span className={`w-4 h-4 rounded-sm grid place-items-center flex-shrink-0 transition-all duration-150
                        ${value ? "bg-rust border border-rust" : "border border-line-2"}`}>
        {value && <CheckIcon className="w-[11px] h-[11px] text-white" strokeWidth={3} />}
      </span>
      {label}
    </button>
  )
}
