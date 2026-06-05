// app/dashboard/page.tsx
"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bars3Icon } from "@heroicons/react/24/outline"

import { Header }       from "@/components/Header"
import { Sidebar }      from "@/components/dashboard/Sidebar"
import { Resumen }      from "@/components/dashboard/sections/Resumen"
import { Entradas }     from "@/components/dashboard/sections/Entradas"
import { Generador }    from "@/components/dashboard/sections/Generador"
import { TOTP }         from "@/components/dashboard/sections/TOTP"
import { Compartidos }  from "@/components/dashboard/sections/Compartidos"
import { Dispositivos } from "@/components/dashboard/sections/Dispositivos"
import { Ajustes }      from "@/components/dashboard/sections/Ajustes"

import { apiGet, apiPost, clearSession, getToken } from "@/lib/api"
import { log } from "@/lib/log"
import { clearKeyPairCache } from "@/lib/sharing"

type Section = "resumen" | "entradas" | "generador" | "totp" | "compartidos" | "dispositivos" | "ajustes"
type Counts  = Record<string, number>

interface User { name: string; email: string }

const SECTION_LABELS: Record<Section, string> = {
  resumen:      "Resumen",
  entradas:     "Contraseñas",
  generador:    "Generador",
  totp:         "Códigos 2FA",
  compartidos:  "Compartidos",
  dispositivos: "Dispositivos",
  ajustes:      "Ajustes",
}

export default function Dashboard() {
  const router = useRouter()
  const [section,     setSection]     = useState<Section>("resumen")
  const [user,        setUser]        = useState<User>({ name: "Usuario", email: "" })
  const [ready,       setReady]       = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [counts,      setCounts]      = useState<Counts>({ entradas: 0, totp: 0, dispositivos: 0 })

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return }
    bootstrapUserData().then(() => setReady(true))

    async function bootstrapUserData() {
      try {
        const [me, passwords, devices] = await Promise.allSettled([
          apiGet<{ email: string }>("/api/account/me"),
          apiGet<{ total?: number }>("/api/passwords"),
          apiGet<unknown[]>("/api/devices"),
        ])

        if (me.status === "fulfilled" && me.value.email) {
          const name = me.value.email.split("@")[0]
          setUser({
            name:  name.charAt(0).toUpperCase() + name.slice(1),
            email: me.value.email,
          })
        } else {
          const email = localStorage.getItem("rv_email") ?? ""
          if (!email) { router.replace("/login"); return }
          const name = email.split("@")[0]
          setUser({ name: name.charAt(0).toUpperCase() + name.slice(1), email })
        }

        if (passwords.status === "fulfilled") {
          setCounts(c => ({ ...c, entradas: passwords.value.total ?? 0 }))
        }
        if (devices.status === "fulfilled") {
          setCounts(c => ({ ...c, dispositivos: (devices.value ?? []).length }))
        }
      } catch (e) {
        log.error("bootstrap failed", e)
      }
    }
  }, [router])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden"
    else            document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  // Cerrar drawer al cambiar de sección
  const handleSectionChange = (s: string) => {
    setSection(s as Section)
    setDrawerOpen(false)
  }

  async function handleLogout() {
    try { await apiPost("/api/auth/logout") } catch { /* ignorar */ }
    clearSession()
    clearKeyPairCache()
    router.replace("/login")
  }

  if (!ready) return null

  return (
    <>
      <Header />

      {/* Topbar móvil con hamburguesa */}
      <div className="lg:hidden sticky top-[57px] z-40 bg-bg border-b border-line">
        <div className="px-5 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-line transition-colors text-ivory"
            aria-label="Abrir menú"
          >
            <Bars3Icon className="w-6 h-6" strokeWidth={1.8} />
          </button>
          <span className="font-serif text-lg text-ivory">{SECTION_LABELS[section]}</span>
          <div className="w-10" />  {/* spacer para centrar */}
        </div>
      </div>

      <div className="max-w-container mx-auto px-5 sm:px-8 lg:px-10
                      pt-5 sm:pt-8 pb-12 sm:pb-20
                      lg:grid lg:gap-8 lg:items-start"
           style={{ gridTemplateColumns: "280px 1fr" }}>

        {/* Sidebar desktop (siempre visible en lg+) */}
        <div className="hidden lg:block">
          <Sidebar
            active={section}
            onChange={handleSectionChange}
            user={user}
            onLogout={handleLogout}
            counts={counts}
          />
        </div>

        {/* Drawer móvil */}
        {drawerOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] overflow-y-auto bg-bg p-4"
                 style={{ boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}>
              <Sidebar
                active={section}
                onChange={handleSectionChange}
                user={user}
                onLogout={handleLogout}
                counts={counts}
              />
            </div>
          </>
        )}

        <main className="min-h-[70vh] border border-line rounded-2xl p-5 sm:p-8 lg:p-10"
              style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(255,255,255,0.015), transparent 60%), var(--bg-elev)" }}>
          {section === "resumen"      && <Resumen      user={user} counts={counts} onNav={handleSectionChange} />}
          {section === "entradas"     && <Entradas />}
          {section === "generador"    && <Generador />}
          {section === "totp"         && <TOTP />}
          {section === "compartidos"  && <Compartidos />}
          {section === "dispositivos" && <Dispositivos />}
          {section === "ajustes"      && <Ajustes onLogout={handleLogout} />}
        </main>
      </div>
    </>
  )
}
