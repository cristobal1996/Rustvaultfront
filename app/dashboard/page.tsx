// app/dashboard/page.tsx
"use client"
import { useState, useEffect } from "react"
import { clearMUK } from "@/lib/muk"
import { useRouter }           from "next/navigation"
import Link                    from "next/link"
import { Sidebar }             from "@/components/dashboard/Sidebar"
import { Resumen }             from "@/components/dashboard/sections/Resumen"
import { Entradas }            from "@/components/dashboard/sections/Entradas"
import { Generador }           from "@/components/dashboard/sections/Generador"
import { TOTP }                from "@/components/dashboard/sections/TOTP"
import { Compartidos }         from "@/components/dashboard/sections/Compartidos"
import { Dispositivos }        from "@/components/dashboard/sections/Dispositivos"
import { Ajustes }             from "@/components/dashboard/sections/Ajustes"

interface User { name: string; email: string }

export default function Dashboard() {
  const router  = useRouter()
  const [section, setSection] = useState("resumen")
  const [token,   setToken]   = useState("")
  const [user,    setUser]    = useState<User>({ name: "Usuario", email: "" })
  const [ready,   setReady]   = useState(false)
  const [counts,  setCounts]  = useState<Record<string, number>>({
    entradas: 0, totp: 0, dispositivos: 0,
  })

  useEffect(() => {
    const t = localStorage.getItem("rv_token")
    if (!t) { router.replace("/login"); return }
    setToken(t)

    fetch("/api/account/me", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.text() : Promise.resolve(""))
      .then(text => {
        if (!text) return
        const data = JSON.parse(text)
        if (data.email) {
          const emailName = data.email.split("@")[0]
          setUser({ name: emailName.charAt(0).toUpperCase() + emailName.slice(1), email: data.email })
        }
      }).catch(() => {
        // Fallback: usar el email guardado en localStorage
        const email = localStorage.getItem("rv_email") ?? ""
        if (email) {
          const emailName = email.split("@")[0]
          setUser({ name: emailName.charAt(0).toUpperCase() + emailName.slice(1), email })
        }
      })


      .catch(() => {})

    fetch("/api/passwords", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : { total: 0 })
      .then(data => setCounts(c => ({ ...c, entradas: data.total ?? 0 })))
      .catch(() => {})

    fetch("/api/devices", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => setCounts(c => ({ ...c, dispositivos: (Array.isArray(data) ? data : []).length })))
      .catch(() => {})

    setReady(true)
  }, [router])

  async function handleLogout() {
    if (token) await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    localStorage.clear()
    clearMUK()
    localStorage.removeItem('rv_muk')
    router.replace("/login")
  }

  const initials = user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
  if (!ready) return null

  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "color-mix(in oklab, #ffffff 92%, transparent)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid #e6e0d6", color: "#0d0a08" }}>
        <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "32px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", color: "#0d0a08", textDecoration: "none" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "radial-gradient(120% 120% at 30% 25%, oklch(0.74 0.14 55), oklch(0.62 0.13 45) 45%, oklch(0.48 0.13 40) 90%)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -8px 14px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "16px", color: "rgba(20,15,10,0.7)" }}>R</span>
            </div>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "24px", letterSpacing: "0.5px" }}>
              Rust<em style={{ fontStyle: "italic", color: "oklch(0.62 0.13 45)" }}>vault</em>
            </span>
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", padding: "6px 8px 6px 14px", border: "1px solid #e6e0d6", borderRadius: "999px", color: "#0d0a08", fontSize: "13.5px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "oklch(0.58 0.06 170)", boxShadow: "0 0 0 3px color-mix(in oklab, oklch(0.58 0.06 170) 25%, transparent)", flexShrink: 0 }} />
            <span>Sesión activa</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--font-serif)", fontSize: "14px", color: "#f8f0e4", background: "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)", flexShrink: 0 }}>
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "32px 40px 80px", display: "grid", gridTemplateColumns: "280px 1fr", gap: "32px", alignItems: "start" }}>
        <Sidebar active={section} onChange={setSection} user={user} onLogout={handleLogout} counts={counts} />

        <main style={{ minHeight: "70vh", border: "1px solid var(--line)", borderRadius: "18px", background: "radial-gradient(80% 60% at 50% 0%, rgba(255,255,255,0.015), transparent 60%), var(--bg-elev)", padding: "40px" }}>
          {section === "resumen"       && <Resumen user={user} counts={counts} onNav={setSection} />}
          {section === "entradas"      && <Entradas     token={token} />}
          {section === "generador"     && <Generador    token={token} />}
          {section === "totp"          && <TOTP         token={token} />}
          {section === "compartidos"   && <Compartidos  token={token} />}
          {section === "dispositivos"  && <Dispositivos token={token} />}
          {section === "ajustes"       && <Ajustes      token={token} onLogout={handleLogout} />}
        </main>
      </div>
    </>
  )
}
