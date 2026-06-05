// components/ui/Loading.tsx
interface Props { text?: string }

export function Loading({ text = "Cargando…" }: Props) {
  return <div className="font-mono text-xs text-muted">{text}</div>
}
