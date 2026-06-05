// components/ui/ErrorMessage.tsx
interface Props { children: React.ReactNode }

export function ErrorMessage({ children }: Props) {
  if (!children) return null
  return (
    <div className="bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] rounded-lg px-[14px] py-[10px] text-[13px] text-[#f87171]">
      {children}
    </div>
  )
}
