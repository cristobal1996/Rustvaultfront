// components/ui/Input.tsx
import { forwardRef, InputHTMLAttributes } from "react"

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, className = "", id, ...rest }, ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className="flex flex-col gap-[6px]">
      {label && <label htmlFor={inputId} className="label-mono">{label}</label>}
      <input ref={ref} id={inputId} className={`input-base ${className}`} {...rest} />
    </div>
  )
})
