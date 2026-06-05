// components/dashboard/Sidebar.tsx
"use client"
import {
  Squares2X2Icon, LockClosedIcon, SparklesIcon, DevicePhoneMobileIcon,
  UsersIcon, ComputerDesktopIcon, Cog6ToothIcon, ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline"

interface Props {
  active:   string
  onChange: (section: string) => void
  user:     { name: string; email: string }
  onLogout: () => void
  counts:   Record<string, number>
}

const NAV_ITEMS = [
  { id: "resumen",      label: "Resumen",      Icon: Squares2X2Icon },
  { id: "entradas",     label: "Contraseñas",  Icon: LockClosedIcon },
  { id: "generador",    label: "Generador",    Icon: SparklesIcon },
  { id: "totp",         label: "Códigos 2FA",  Icon: DevicePhoneMobileIcon },
  { id: "compartidos",  label: "Compartidos",  Icon: UsersIcon },
  { id: "dispositivos", label: "Dispositivos", Icon: ComputerDesktopIcon },
  { id: "ajustes",      label: "Ajustes",      Icon: Cog6ToothIcon },
] as const

export function Sidebar({ active, onChange, user, onLogout, counts }: Props) {
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <aside className="lg:sticky lg:top-[88px] card p-5 flex flex-col overflow-hidden">
      {/* Tarjeta usuario */}
      <div className="flex items-center gap-[14px] pb-[18px] border-b border-dashed border-line mb-[18px]">
        <div
          className="w-[52px] h-[52px] rounded-xl grid place-items-center text-[#f8f0e4] font-serif text-[22px] flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))",
            boxShadow:  "inset 0 0 0 1px rgba(255,255,255,0.12), 0 6px 14px -8px rgba(0,0,0,0.5)",
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-medium text-ivory tracking-[0.1px] truncate">{user.name}</div>
          <div className="font-mono text-[11.5px] text-muted mt-[2px] truncate">{user.email}</div>
        </div>
      </div>

      <div className="label-mono px-2 pb-2">Espacio personal</div>

      <nav className="flex flex-col gap-[2px]">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`
                relative w-full flex items-center gap-3 px-3 py-3 lg:py-[11px] rounded-[10px] text-sm
                text-left transition-colors duration-150 ease-out
                ${isActive
                  ? "text-ivory"
                  : "text-ivory-dim hover:text-ivory"}
              `}
              style={isActive ? {
                background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                boxShadow:  "inset 0 0 0 1px var(--line-2)",
              } : undefined}
            >
              {isActive && (
                <div className="hidden lg:block absolute -left-[22px] top-[14px] bottom-[14px] w-[2px] rounded-sm bg-rust-bright" />
              )}
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-rust-bright" : "text-muted"}`} />
              <span className="flex-1">{label}</span>
              {counts[id] !== undefined && counts[id] > 0 && (
                <span className="font-mono text-[10.5px] text-muted px-[6px] py-[2px] border border-line-2 rounded">
                  {counts[id]}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto pt-[18px] border-t border-dashed border-line">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-3 lg:py-[11px] rounded-[10px] text-sm text-ivory-dim text-left
                     bg-transparent hover:bg-[rgba(220,38,38,0.08)] hover:text-[#f87171] transition-colors duration-150"
        >
          <ArrowRightStartOnRectangleIcon className="w-[18px] h-[18px] text-muted flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
