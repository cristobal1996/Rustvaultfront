// components/dashboard/sections/Entradas.tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import {
  PlusIcon, XMarkIcon, EyeIcon, EyeSlashIcon,
  ClipboardIcon, CheckIcon, KeyIcon, CreditCardIcon, DocumentTextIcon,
  IdentificationIcon, CommandLineIcon, Cog6ToothIcon, ArrowLeftIcon,
} from "@heroicons/react/24/outline"

import { getMUK } from "@/lib/muk"
import { aesEncryptText, aesDecryptText, type EncryptedBlob } from "@/lib/crypto"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { log } from "@/lib/log"

import { SectionHeader } from "@/components/ui/SectionHeader"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { Loading } from "@/components/ui/Loading"

interface Password {
  id:          string
  title:       string
  domain:      string | null
  entry_type:  string
  favicon_url: string | null
  version:     number
  updated_at:  string
  encrypted:   EncryptedBlob
}

interface PasswordContent {
  username: string
  password: string
  url:      string
  notes:    string
}

interface Version { version: number; changed_at: string; encrypted: EncryptedBlob }

// Tipos de entrada disponibles en el formulario.
// Actualmente solo se implementa 'login' en el frontend. Los demás
// tipos están soportados en el backend (CHECK constraint en la BD)
// y quedan listos para añadirse como ampliación futura.
const ENTRY_TYPES = [
  { id: "todos",    label: "Todos" },
  { id: "login",    label: "Login" },
  // { id: "card",     label: "Tarjeta" },
  // { id: "note",     label: "Nota" },
  // { id: "identity", label: "Identidad" },
  // { id: "ssh_key",  label: "SSH" },
  // { id: "api_key",  label: "API Key" },
] as const

const TYPE_ICON: Record<string, typeof KeyIcon> = {
  login:    KeyIcon,
  card:     CreditCardIcon,
  note:     DocumentTextIcon,
  identity: IdentificationIcon,
  ssh_key:  CommandLineIcon,
  api_key:  Cog6ToothIcon,
}

const EMPTY_FORM = { title: "", username: "", password: "", url: "", notes: "", entry_type: "login", domain: "" }

export function Entradas() {
  const mukHex = getMUK()

  const [passwords,  setPasswords]  = useState<Password[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState("")
  const [typeFilter, setTypeFilter] = useState("todos")

  const [openPw,      setOpenPw]      = useState<Password | null>(null)
  const [openContent, setOpenContent] = useState<PasswordContent | null>(null)
  const [showPass,    setShowPass]    = useState(false)
  const [copied,      setCopied]      = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  const [showVersions, setShowVersions] = useState(false)
  const [versions,     setVersions]     = useState<Version[]>([])

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: "", username: "", password: "", url: "", notes: "", domain: "" })

  // Bloquear scroll cuando el detalle está abierto en móvil
  useEffect(() => {
    if (openPw && typeof window !== "undefined" && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [openPw])

  const loadPasswords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== "todos") params.set("entry_type", typeFilter)
      if (search.trim()) params.set("search", search.trim())
      const data = await apiGet<{ data: Password[] }>(`/api/passwords?${params}`)
      setPasswords(data.data ?? [])
    } catch (e) {
      log.error("load passwords", e)
    } finally { setLoading(false) }
  }, [typeFilter, search])

  useEffect(() => { loadPasswords() }, [loadPasswords])

  async function openDetail(pw: Password) {
    setOpenPw(pw); setOpenContent(null); setShowPass(false); setEditMode(false)
    if (!mukHex) return
    const plain = await aesDecryptText(pw.encrypted, mukHex)
    if (!plain) return
    try {
      const c = JSON.parse(plain) as PasswordContent
      setOpenContent(c)
      setEditForm({ title: pw.title, domain: pw.domain ?? "", ...c })
    } catch (e) { log.error("parse pw content", e) }
  }

  async function saveNew() {
    if (!mukHex || !form.title.trim()) return
    setSaving(true)
    try {
      const encrypted = await aesEncryptText(
        JSON.stringify({ username: form.username, password: form.password, url: form.url, notes: form.notes }),
        mukHex,
      )
      await apiPost("/api/passwords", {
        title:      form.title.trim(),
        domain:     form.domain.trim() || null,
        entry_type: form.entry_type,
        encrypted,
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
      loadPasswords()
    } catch (e) {
      log.error("save new password", e)
    } finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!mukHex || !openPw) return
    setSaving(true)
    try {
      const encrypted = await aesEncryptText(
        JSON.stringify({ username: editForm.username, password: editForm.password, url: editForm.url, notes: editForm.notes }),
        mukHex,
      )
      await apiPut(`/api/passwords/${openPw.id}`, {
        title:  editForm.title.trim(),
        domain: editForm.domain.trim() || null,
        encrypted,
      })
      setEditMode(false)
      setOpenContent({ username: editForm.username, password: editForm.password, url: editForm.url, notes: editForm.notes })
      loadPasswords()
    } catch (e) {
      log.error("save edit", e)
    } finally { setSaving(false) }
  }

  async function deletePassword() {
    if (!openPw || !confirm("¿Eliminar esta contraseña?")) return
    try {
      await apiDelete(`/api/passwords/${openPw.id}`)
      setOpenPw(null)
      loadPasswords()
    } catch (e) { log.error("delete pw", e) }
  }

  async function loadVersions() {
    if (!openPw) return
    try {
      const data = await apiGet<Version[]>(`/api/passwords/${openPw.id}/versions`)
      setVersions(Array.isArray(data) ? data : [])
      setShowVersions(true)
    } catch (e) { log.error("load versions", e) }
  }

  async function restoreVersion(version: number) {
    if (!openPw || !confirm(`¿Restaurar la versión ${version}?`)) return
    try {
      await apiPost(`/api/passwords/${openPw.id}/restore/${version}`)
      setShowVersions(false)
      openDetail(openPw)
      loadPasswords()
    } catch (e) { log.error("restore version", e) }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!mukHex) {
    return (
      <div className="max-w-[420px] mx-auto py-10 flex flex-col gap-4">
        <p className="font-serif text-[28px] m-0">Sesión expirada</p>
        <p className="font-mono text-xs text-muted leading-[1.6]">
          La clave maestra no está disponible. Cierra sesión y vuelve a entrar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Lista izquierda — visible siempre en desktop, oculta cuando hay detalle abierto en móvil */}
      <div className={`flex-1 flex flex-col gap-3 min-w-0 ${openPw ? "hidden lg:flex" : "flex"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-mono m-0 mb-1">Mis contraseñas</p>
            <h2 className="font-serif font-normal text-[22px] sm:text-[28px] m-0">
              {passwords.length} {passwords.length === 1 ? "entrada" : "entradas"}
            </h2>
          </div>
          <Button onClick={() => setShowForm(v => !v)} className="px-3 sm:px-4 py-[9px] text-[13px] flex-shrink-0">
            <PlusIcon className="w-4 h-4" /> Nueva
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o dominio…"
            className="input-base flex-1 min-w-0" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-base sm:w-auto">
            {ENTRY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {showForm && (
          <div className="card-padded flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex justify-between">
              <span className="label-mono">Nueva entrada</span>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-ivory">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <div className="sm:col-span-2">
                <label className="label-mono block mb-[6px]">Nombre *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="GitHub, Gmail…" className="input-base" />
              </div>
              <div>
                <label className="label-mono block mb-[6px]">Tipo</label>
                <select value={form.entry_type} onChange={e => setForm(f => ({ ...f, entry_type: e.target.value }))} className="input-base">
                  {ENTRY_TYPES.filter(t => t.id !== "todos").map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label-mono block mb-[6px]">Dominio</label>
                <input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="github.com" className="input-base font-mono" />
              </div>
              <div>
                <label className="label-mono block mb-[6px]">Usuario</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label className="label-mono block mb-[6px]">Contraseña</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input-base" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-mono block mb-[6px]">URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://github.com" className="input-base" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-mono block mb-[6px]">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="input-base resize-y" />
              </div>
            </div>
            <Button onClick={saveNew} disabled={saving || !form.title.trim()}>
              {saving ? "Guardando…" : "Guardar entrada"}
            </Button>
          </div>
        )}

        {loading ? <Loading />
         : passwords.length === 0 ? (
          <EmptyState title="Sin entradas" subtitle="Crea tu primera contraseña con el botón Nueva" />
        ) : (
          <div className="flex flex-col gap-2">
            {passwords.map(pw => {
              const Icon = TYPE_ICON[pw.entry_type] ?? KeyIcon
              return (
                <button key={pw.id} onClick={() => openDetail(pw)}
                  className={`card text-left p-[14px] flex items-center gap-3 cursor-pointer transition-colors duration-150
                              ${openPw?.id === pw.id ? "border-rust" : "hover:border-line-2"}`}>
                  <Icon className="w-5 h-5 text-rust-bright flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ivory truncate">{pw.title}</div>
                    {pw.domain && <div className="font-mono text-[11px] text-muted truncate">{pw.domain}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detalle: panel lateral en desktop, pantalla completa en móvil */}
      {openPw && (
        <div className="
          lg:w-[360px] lg:flex-shrink-0 lg:relative lg:p-6 lg:h-fit
          fixed inset-0 z-50 lg:z-auto
          bg-bg-elev lg:bg-transparent
          p-5 overflow-y-auto
          lg:card lg:flex lg:flex-col lg:gap-4
        ">
          <div className="lg:hidden flex items-center mb-4">
            <button onClick={() => setOpenPw(null)}
              className="inline-flex items-center gap-2 text-ivory-dim hover:text-ivory transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm">Volver</span>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[10px] min-w-0">
                {(() => {
                  const Icon = TYPE_ICON[openPw.entry_type] ?? KeyIcon
                  return <Icon className="w-[22px] h-[22px] text-rust-bright flex-shrink-0" />
                })()}
                <div className="min-w-0">
                  <div className="text-base font-medium text-ivory truncate">{openPw.title}</div>
                  {openPw.domain && <div className="font-mono text-[11px] text-muted truncate">{openPw.domain}</div>}
                </div>
              </div>
              <button onClick={() => setOpenPw(null)} className="hidden lg:block text-muted hover:text-ivory flex-shrink-0">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {!openContent ? <div className="font-mono text-xs text-muted">Descifrando…</div>
             : editMode ? (
              <div className="flex flex-col gap-[10px]">
                <Field label="Nombre"     value={editForm.title}    onChange={v => setEditForm(f => ({ ...f, title: v }))} />
                <Field label="Dominio"    value={editForm.domain}   onChange={v => setEditForm(f => ({ ...f, domain: v }))} mono />
                <Field label="Usuario"    value={editForm.username} onChange={v => setEditForm(f => ({ ...f, username: v }))} />
                <Field label="Contraseña" value={editForm.password} onChange={v => setEditForm(f => ({ ...f, password: v }))} mono />
                <Field label="URL"        value={editForm.url}      onChange={v => setEditForm(f => ({ ...f, url: v }))} />
                <div>
                  <label className="label-mono block mb-[6px]">Notas</label>
                  <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="input-base resize-y" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={saving} className="flex-1 py-[9px] text-[13px]">
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <button onClick={() => setEditMode(false)} className="btn-ghost">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {openContent.username && (
                  <ReadField label="Usuario" value={openContent.username}
                    copied={copied === "user"} onCopy={() => copyToClipboard(openContent.username, "user")} />
                )}
                {openContent.url && (
                  <ReadField label="URL" value={openContent.url}
                    copied={copied === "url"} onCopy={() => copyToClipboard(openContent.url, "url")} />
                )}

                <div>
                  <p className="label-mono m-0 mb-1">Contraseña</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-ivory-dim flex-1 truncate">
                      {showPass ? openContent.password : "••••••••••••"}
                    </span>
                    <button onClick={() => setShowPass(v => !v)}
                      className="bg-bg border border-line-2 rounded-md w-8 h-8 grid place-items-center text-muted hover:text-ivory transition-colors flex-shrink-0">
                      {showPass ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyToClipboard(openContent.password, "pass")}
                      className={`bg-bg border border-line-2 rounded-md w-8 h-8 grid place-items-center flex-shrink-0 transition-colors ${copied === "pass" ? "text-patina" : "text-muted hover:text-ivory"}`}>
                      {copied === "pass" ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {openContent.notes && (
                  <div>
                    <p className="label-mono m-0 mb-1">Notas</p>
                    <p className="font-mono text-xs text-muted leading-[1.5] m-0 whitespace-pre-wrap">{openContent.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-1 flex-wrap">
                  <button onClick={() => setEditMode(true)} className="btn-ghost flex-1 py-2 text-xs">Editar</button>
                  <button onClick={loadVersions}            className="btn-ghost flex-1 py-2 text-xs">Historial</button>
                  <button onClick={deletePassword}          className="btn-danger px-3 py-2">Eliminar</button>
                </div>
              </div>
            )}

            {showVersions && (
              <div className="border-t border-line pt-4">
                <div className="flex justify-between mb-[10px]">
                  <span className="label-mono">Historial</span>
                  <button onClick={() => setShowVersions(false)} className="text-muted hover:text-ivory">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                {versions.map(v => (
                  <div key={v.version} className="flex items-center justify-between py-2 border-b border-line gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-ivory-dim">Versión {v.version}</div>
                      <div className="font-mono text-[10px] text-muted truncate">{new Date(v.changed_at).toLocaleString("es")}</div>
                    </div>
                    {v.version !== openPw.version && (
                      <button onClick={() => restoreVersion(v.version)}
                        className="bg-transparent border border-line-2 rounded-md px-[10px] py-1 text-[11px] text-ivory-dim hover:text-ivory transition-colors flex-shrink-0">
                        Restaurar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, mono = false }: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean
}) {
  return (
    <div>
      <label className="label-mono block mb-[6px]">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className={`input-base ${mono ? "font-mono" : ""}`} />
    </div>
  )
}

function ReadField({ label, value, copied, onCopy }: {
  label: string; value: string; copied: boolean; onCopy: () => void
}) {
  return (
    <div>
      <p className="label-mono m-0 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] text-ivory-dim flex-1 truncate">{value}</span>
        <button onClick={onCopy}
          className={`bg-bg border border-line-2 rounded-md w-8 h-8 grid place-items-center flex-shrink-0 transition-colors ${copied ? "text-patina" : "text-muted hover:text-ivory"}`}>
          {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
