// components/ui/Button.tsx
import { forwardRef, ButtonHTMLAttributes } from "react"

type Variant = "primary" | "ghost" | "danger"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  ghost:   "btn-ghost",
  danger:  "btn-danger",
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className = "", ...rest }, ref,
) {
  return <button ref={ref} className={`${VARIANTS[variant]} ${className}`} {...rest} />
})
