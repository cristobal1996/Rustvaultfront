// components/ui/SectionHeader.tsx
// El patrón "label uppercase + título serif con palabra en cursiva" se repite
// en TODAS las secciones del dashboard. Lo extraemos aquí.

import { ReactNode } from "react"

interface Props {
  eyebrow: string
  title:   string
  accent?: string  // palabra final que va en cursiva color rust-bright
  right?:  ReactNode
}

export function SectionHeader({ eyebrow, title, accent, right }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="label-mono mb-[6px]">{eyebrow}</p>
        <h2 className="font-serif font-normal text-[32px] tracking-[-0.4px] m-0">
          {title}
          {accent && (
            <> <em className="italic text-rust-bright">{accent}</em></>
          )}
        </h2>
      </div>
      {right}
    </div>
  )
}
