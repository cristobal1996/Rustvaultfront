// components/dashboard/sections/Entradas.tsx
"use client"
import { getMUK } from "@/lib/muk"
import { useState, useEffect, useCallback } from "react"

interface Props { token: string }

interface EncryptedBlob { nonce: string; ciphertext: string }

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
  title:    string
  username: string
  password: string
  url:      string
  notes:    string
}

interface Version {
  version:    number
  changed_at: string
  encrypted:  EncryptedBlob
}

// ── Crypto ────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return b
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")
}

async function decryptBlob(blob: EncryptedBlob, keyHex: string): Promise<string | null> {
  try {
    const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["decrypt"])
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hexToBytes(blob.nonce) }, key, hexToBytes(blob.ciphertext))
    return new TextDecoder().decode(plain)
  } catch { return null }
}

async function encryptText(text: string, keyHex: string): Promise<EncryptedBlob> {
  const key   = await crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["encrypt"])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(text))
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(new Uint8Array(ct)) }
}

const ENTRY_TYPES = [
  { id: "todos",    label: "Todos" },
  { id: "login",    label: "Login" },
  { id: "card",     label: "Tarjeta" },
  { id: "note",     label: "Nota" },
  { id: "identity", label: "Identidad" },
  { id: "ssh_key",  label: "SSH" },
  { id: "api_key",  label: "API Key" },
]

export function Entradas({ token }: Props) {
  const mukHex = getMUK()

  const [passwords,   setPasswords]   = useState<Password[]>([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState("")
  const [typeFilter,  setTypeFilter]  = useState("todos")

  const [openPw,      setOpenPw]      = useState<Password | null>(null)
  const [openContent, setOpenContent] = useState<PasswordContent | null>(null)
  const [showPass,    setShowPass]    = useState(false)
  const [copied,      setCopied]      = useState<string | null>(null)

  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState({ title: "", username: "", password: "", url: "", notes: "", entry_type: "login", domain: "" })
  const [saving,      setSaving]      = useState(false)

  const [showVersions, setShowVersions] = useState(false)
  const [versions,     setVersions]     = useState<Version[]>([])

  const [editMode,    setEditMode]    = useState(false)
  const [editForm,    setEditForm]    = useState<PasswordContent & { title: string; domain: string }>({ title: "", username: "", password: "", url: "", notes: "", domain: "" })

  const loadPasswords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== "todos") params.set("entry_type", typeFilter)
      if (search.trim()) params.set("search", search.trim())
      const res  = await fetch(`/api/passwords?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPasswords(data.data ?? [])
    } finally { setLoading(false) }
  }, [token, typeFilter, search])

  useEffect(() => { loadPasswords() }, [loadPasswords])

  async function openDetail(pw: Password) {
    setOpenPw(pw)
    setOpenContent(null)
    setShowPass(false)
    setEditMode(false)
    if (!mukHex) return
    const plain = await decryptBlob(pw.encrypted, mukHex)
    if (plain) {
      try {
        const c = JSON.parse(plain) as PasswordContent
        setOpenContent(c)
        setEditForm({ title: pw.title, domain: pw.domain ?? "", ...c })
      } catch {}
    }
  }

  async function saveNew() {
    if (!mukHex || !form.title.trim()) return
    setSaving(true)
    try {
      const encrypted = await encryptText(
        JSON.stringify({ username: form.username, password: form.password, url: form.url, notes: form.notes }),
        mukHex
      )
      const res = await fetch("/api/passwords", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          title:      form.title.trim(),
          domain:     form.domain.trim() || null,
          entry_type: form.entry_type,
          encrypted,
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ title: "", username: "", password: "", url: "", notes: "", entry_type: "login", domain: "" })
        loadPasswords()
      }
    } finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!mukHex || !openPw) return
    setSaving(true)
    try {
      const encrypted = await encryptText(
        JSON.stringify({ username: editForm.username, password: editForm.password, url: editForm.url, notes: editForm.notes }),
        mukHex
      )
      const res = await fetch(`/api/passwords/${openPw.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          title:     editForm.title.trim(),
          domain:    editForm.domain.trim() || null,
          encrypted,
        }),
      })
      if (res.ok) {
        setEditMode(false)
        setOpenContent({ username: editForm.username, password: editForm.password, url: editForm.url, notes: editForm.notes, title: editForm.title })
        loadPasswords()
      }
    } finally { setSaving(false) }
  }

  async function deletePassword() {
    if (!openPw || !confirm("¿Eliminar esta contraseña?")) return
    await fetch(`/api/passwords/${openPw.id}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setOpenPw(null)
    loadPasswords()
  }

  async function loadVersions() {
    if (!openPw) return
    const res  = await fetch(`/api/passwords/${openPw.id}/versions`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setVersions(Array.isArray(data) ? data : [])
    setShowVersions(true)
  }

  async function restoreVersion(version: number) {
    if (!openPw || !confirm(`¿Restaurar la versión ${version}?`)) return
    await fetch(`/api/passwords/${openPw.id}/restore/${version}`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    setShowVersions(false)
    openDetail(openPw)
    loadPasswords()
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = passwords.filter(p =>
    (!search || p.title.toLowerCase().includes(search.toLowerCase()) || p.domain?.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === "todos" || p.entry_type === typeFilter)
  )

  const typeIcon: Record<string, string> = {
    login: "🔐", card: "💳", note: "📝", identity: "🪪", ssh_key: "🔑", api_key: "⚙️"
  }

  const inp: React.CSSProperties = {
    background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "8px",
    padding: "9px 11px", fontSize: "13px", color: "var(--ivory)", outline: "none",
    width: "100%", boxSizing: "border-box" as const,
  }

  const label: React.CSSProperties = {
    display: "block", fontFamily: "var(--font-mono)", fontSize: "10px",
    letterSpacing: "1.2px", textTransform: "uppercase" as const,
    color: "var(--muted)", marginBottom: "6px",
  }

  if (!mukHex) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "420px", margin: "0 auto", padding: "40px 0" }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 400, margin: 0 }}>
          Sesión expirada
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", lineHeight: "1.6" }}>
          La clave maestra no está disponible. Cierra sesión y vuelve a entrar.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: "24px", height: "100%" }}>

      {/* ── Lista izquierda ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>

        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 4px" }}>
              Mis contraseñas
            </p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "28px", margin: 0 }}>
              {filtered.length} {filtered.length === 1 ? "entrada" : "entradas"}
            </h2>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            style={{ background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
            + Nueva
          </button>
        </div>

        {/* Búsqueda y filtros */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o dominio…"
            style={{ ...inp, flex: 1, minWidth: "160px" }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ ...inp, width: "auto" }}>
            {ENTRY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Formulario nueva contraseña */}
        {showForm && (
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "12px", padding: "20px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)" }}>Nueva entrada</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Nombre *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="GitHub, Gmail…" style={inp} />
              </div>
              <div>
                <label style={label}>Tipo</label>
                <select value={form.entry_type} onChange={e => setForm(f => ({ ...f, entry_type: e.target.value }))} style={inp}>
                  {ENTRY_TYPES.filter(t => t.id !== "todos").map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Dominio</label>
                <input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="github.com" style={{ ...inp, fontFamily: "var(--font-mono)" }} />
              </div>
              <div>
                <label style={label}>Usuario</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={label}>Contraseña</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://github.com" style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  style={{ ...inp, resize: "vertical" as const }} />
              </div>
            </div>
            <button onClick={saveNew} disabled={saving || !form.title.trim()}
              style={{ background: saving || !form.title.trim() ? "var(--rust-deep)" : "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px", fontSize: "13.5px", fontWeight: 500, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Guardando…" : "Guardar entrada"}
            </button>
          </div>
        )}

        {/* Lista de contraseñas */}
        {loading ? (
          <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "12px", padding: "20px 0" }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ border: "1px dashed var(--line-2)", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", margin: 0 }}>
              {search ? "Sin resultados" : "Sin contraseñas — añade una con + Nueva"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filtered.map(pw => (
              <button key={pw.id} onClick={() => openDetail(pw)}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", border: `1px solid ${openPw?.id === pw.id ? "var(--rust)" : "var(--line)"}`, borderRadius: "10px", background: openPw?.id === pw.id ? "color-mix(in oklab, var(--rust) 8%, var(--bg-elev))" : "var(--bg-elev)", cursor: "pointer", textAlign: "left", transition: "border-color 120ms" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, oklch(0.55 0.13 45), oklch(0.4 0.11 35))", display: "grid", placeItems: "center", fontSize: "16px", flexShrink: 0 }}>
                  {typeIcon[pw.entry_type] ?? "🔐"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--ivory)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pw.title}</div>
                  {pw.domain && <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>{pw.domain}</div>}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", flexShrink: 0 }}>
                  v{pw.version}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Panel derecho: detalle ── */}
      {openPw && (
        <div style={{ width: "360px", flexShrink: 0, border: "1px solid var(--line)", borderRadius: "16px", padding: "24px", background: "var(--bg-elev)", display: "flex", flexDirection: "column", gap: "16px", height: "fit-content" }}>

          {/* Cabecera del detalle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>{typeIcon[openPw.entry_type] ?? "🔐"}</span>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 500, color: "var(--ivory)" }}>{openPw.title}</div>
                {openPw.domain && <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)" }}>{openPw.domain}</div>}
              </div>
            </div>
            <button onClick={() => setOpenPw(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "20px" }}>×</button>
          </div>

          {!openContent ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)" }}>Descifrando…</div>
          ) : editMode ? (
            /* Modo edición */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div><label style={label}>Nombre</label><input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Dominio</label><input value={editForm.domain} onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))} style={{ ...inp, fontFamily: "var(--font-mono)" }} /></div>
              <div><label style={label}>Usuario</label><input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Contraseña</label><input type="text" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} style={{ ...inp, fontFamily: "var(--font-mono)" }} /></div>
              <div><label style={label}>URL</label><input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Notas</label><textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" as const }} /></div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: "var(--rust)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button onClick={() => setEditMode(false)} style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "9px 12px", color: "var(--muted)", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* Modo vista */
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Usuario",     value: openContent.username, key: "user" },
                { label: "URL",         value: openContent.url,      key: "url"  },
              ].filter(f => f.value).map(field => (
                <div key={field.key}>
                  <p style={{ ...label, margin: "0 0 4px" }}>{field.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.value}</span>
                    <button onClick={() => copyToClipboard(field.value, field.key)}
                      style={{ background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: copied === field.key ? "var(--patina)" : "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                      {copied === field.key ? "✓" : "Copiar"}
                    </button>
                  </div>
                </div>
              ))}

              {/* Contraseña */}
              <div>
                <p style={{ ...label, margin: "0 0 4px" }}>Contraseña</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ivory-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {showPass ? openContent.password : "••••••••••••"}
                  </span>
                  <button onClick={() => setShowPass(v => !v)}
                    style={{ background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                    {showPass ? "Ocultar" : "Ver"}
                  </button>
                  <button onClick={() => copyToClipboard(openContent.password, "pass")}
                    style={{ background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: copied === "pass" ? "var(--patina)" : "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
                    {copied === "pass" ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>

              {openContent.notes && (
                <div>
                  <p style={{ ...label, margin: "0 0 4px" }}>Notas</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--muted)", lineHeight: "1.5", margin: 0, whiteSpace: "pre-wrap" }}>{openContent.notes}</p>
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                <button onClick={() => setEditMode(true)}
                  style={{ flex: 1, background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "8px", fontSize: "12px", color: "var(--ivory-dim)", cursor: "pointer" }}>
                  Editar
                </button>
                <button onClick={loadVersions}
                  style={{ flex: 1, background: "transparent", border: "1px solid var(--line-2)", borderRadius: "8px", padding: "8px", fontSize: "12px", color: "var(--ivory-dim)", cursor: "pointer" }}>
                  Historial
                </button>
                <button onClick={deletePassword}
                  style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#f87171", cursor: "pointer" }}>
                  Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Historial de versiones */}
          {showVersions && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--muted)" }}>Historial</span>
                <button onClick={() => setShowVersions(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "16px" }}>×</button>
              </div>
              {versions.map(v => (
                <div key={v.version} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ivory-dim)" }}>Versión {v.version}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)" }}>{new Date(v.changed_at).toLocaleString("es")}</div>
                  </div>
                  {v.version !== openPw.version && (
                    <button onClick={() => restoreVersion(v.version)}
                      style={{ background: "transparent", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", color: "var(--ivory-dim)", cursor: "pointer" }}>
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
