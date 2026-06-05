// components/ui/Card.tsx
import { HTMLAttributes } from "react"

interface Props extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

export function Card({ padded = true, className = "", ...rest }: Props) {
  return <div className={`${padded ? "card-padded" : "card"} ${className}`} {...rest} />
}
