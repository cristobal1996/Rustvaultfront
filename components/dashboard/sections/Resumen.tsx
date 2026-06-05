// components/dashboard/sections/Resumen.tsx
import {
  FolderIcon, LockClosedIcon, DevicePhoneMobileIcon, ComputerDesktopIcon,
  PlusIcon, BoltIcon, QrCodeIcon, UsersIcon,
} from "@heroicons/react/24/outline"

interface Props {
  user:   { name: string; email: string }
  counts: Record<string, number>
  onNav:  (s: string) => void
}

const CARDS = [
  { id: "vaults",       label: "Bóvedas",      key: "vaults",       color: "var(--rust-bright)",   Icon: FolderIcon },
  { id: "entradas",     label: "Contraseñas",  key: "entradas",     color: "oklch(0.78 0.08 170)", Icon: LockClosedIcon },
  { id: "totp",         label: "Códigos 2FA",  key: "totp",         color: "oklch(0.8 0.08 250)",  Icon: DevicePhoneMobileIcon },
  { id: "dispositivos", label: "Dispositivos", key: "dispositivos", color: "oklch(0.8 0.08 85)",   Icon: ComputerDesktopIcon },
] as const

const ACTIONS = [
  { id: "entradas",    label: "Nueva contraseña",   Icon: PlusIcon },
  { id: "generador",   label: "Generar contraseña", Icon: BoltIcon },
  { id: "totp",        label: "Añadir código 2FA",  Icon: QrCodeIcon },
  { id: "compartidos", label: "Ver compartidos",    Icon: UsersIcon },
] as const

// Extrae el primer nombre, separando por espacio O por puntos
// (los emails con puntos como "cristobal.perez.1996" no caben en un H1)
function firstName(fullName: string): string {
  const noSpaces = fullName.split(" ")[0] ?? ""
  const firstPart = noSpaces.split(".")[0] ?? noSpaces
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase()
}

export function Resumen({ user, counts, onNav }: Props) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[1.4px] text-muted m-0 mb-2">Bienvenido de nuevo</p>
        <h1 className="font-serif font-normal
                       text-[clamp(22px,5.5vw,48px)] sm:text-[clamp(32px,3.5vw,48px)]
                       leading-tight tracking-[-0.6px] m-0 text-ivory break-words">
          {firstName(user.name)}{" "}
          <em className="italic text-rust-bright">— tu bóveda está segura</em>
        </h1>
      </div>

      {/* Stat cards: 2 col en móvil, 4 en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {CARDS.map(({ id, label, key, color, Icon }) => (
          <button key={id} onClick={() => onNav(id)}
            className="card text-left p-4 sm:p-[22px] flex flex-col gap-2 sm:gap-[10px] cursor-pointer
                       hover:-translate-y-[2px] hover:border-line-2 transition-[transform,border-color] duration-150">
            <Icon className="w-5 h-5" style={{ color }} />
            <span className="font-serif text-[32px] sm:text-[40px] leading-none tracking-[-0.6px]" style={{ color }}>
              {counts[key] ?? 0}
            </span>
            <span className="label-mono">{label}</span>
          </button>
        ))}
      </div>

      {/* Quick actions: 1 col móvil, 2 col desde sm */}
      <div>
        <p className="label-mono m-0 mb-3">Acciones rápidas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => onNav(id)} className="btn-ghost justify-start">
              <Icon className="w-[18px] h-[18px] text-rust-bright flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
