// components/Header.tsx
"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  InformationCircleIcon, UsersIcon,
  Bars3Icon, XMarkIcon,
} from "@heroicons/react/24/outline"

const NAV_LINKS = [
  { href: "/quienes-somos", label: "Quiénes somos", Icon: InformationCircleIcon },
  { href: "/login",         label: "Usuarios",      Icon: UsersIcon },
] as const

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // En el dashboard ocultamos la nav del Header (hamburguesa y links)
  // porque el dashboard ya tiene su propia sidebar/drawer.
  const isDashboard = pathname?.startsWith("/dashboard") ?? false

  // Cerrar el menu al cambiar de página
  useEffect(() => { setOpen(false) }, [pathname])

  // Bloquear scroll del body cuando el menu está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else      document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <header
      className="sticky top-0 z-50 border-b border-[#e6e0d6] text-[#0d0a08]"
      style={{
        background:           "color-mix(in oklab, #ffffff 92%, transparent)",
        backdropFilter:       "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="max-w-container mx-auto px-5 sm:px-10 py-4 sm:py-[18px] flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand */}
        <Link href="/" className="flex items-center text-[#0d0a08]" aria-label="RustVault">
          <span className="font-serif text-xl sm:text-2xl tracking-[0.5px]">
            Rust<em className="italic text-rust">vault</em>
          </span>
        </Link>

        {/* Nav desktop — oculta en /dashboard */}
        {!isDashboard && (
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    inline-flex items-center gap-2 px-4 py-[10px] rounded-full text-sm tracking-[0.2px]
                    transition-colors duration-150 ease-out
                    ${active
                      ? "text-[#0d0a08] bg-[rgba(13,10,8,0.06)] font-medium"
                      : "text-[#3d3530] hover:bg-[rgba(13,10,8,0.04)]"}
                  `}
                >
                  <Icon className="w-4 h-4 text-rust" strokeWidth={1.8} />
                  {label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Botón hamburguesa móvil — oculto en /dashboard */}
        {!isDashboard && (
          <button
            onClick={() => setOpen(o => !o)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-[rgba(13,10,8,0.06)] transition-colors"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            {open
              ? <XMarkIcon className="w-6 h-6" strokeWidth={1.8} />
              : <Bars3Icon className="w-6 h-6" strokeWidth={1.8} />}
          </button>
        )}
      </div>

      {/* Drawer móvil — oculto en /dashboard */}
      {open && !isDashboard && (
        <>
          {/* Overlay */}
          <div
            className="md:hidden fixed inset-0 top-[57px] bg-black/30 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <nav
            className="md:hidden fixed top-[57px] left-0 right-0 z-50 bg-white border-b border-[#e6e0d6] flex flex-col px-5 py-4 gap-1"
            style={{
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)",
            }}
          >
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    inline-flex items-center gap-3 px-4 py-3 rounded-xl text-base tracking-[0.2px]
                    transition-colors duration-150 ease-out
                    ${active
                      ? "text-[#0d0a08] bg-[rgba(13,10,8,0.06)] font-medium"
                      : "text-[#3d3530]"}
                  `}
                >
                  <Icon className="w-5 h-5 text-rust" strokeWidth={1.8} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </>
      )}
    </header>
  )
}
