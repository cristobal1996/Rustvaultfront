// components/ui/EmptyState.tsx
interface Props {
  title:    string
  subtitle?: string
}

export function EmptyState({ title, subtitle }: Props) {
  return (
    <div className="border border-dashed border-line-2 rounded-2xl p-12 text-center">
      <p className="font-serif text-2xl text-ivory-dim m-0 mb-2">{title}</p>
      {subtitle && <p className="font-mono text-xs text-muted m-0">{subtitle}</p>}
    </div>
  )
}
