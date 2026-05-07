'use client'
// app/admin/desafiliaciones/[id]/page.tsx
import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Solicitud = {
  id: string; cedula: string; nombres: string | null; apellidos: string | null
  tipoSolicitud: string; fechaSolicitud: string; fechaRecepcion: string | null
  medioRecepcion: string | null; referenciaDocumento: string | null
  motivo: string | null; detallePrueba: string | null
  estado: string; observaciones: string | null
  createdAt: string; updatedAt: string
  adjuntoNombre: string | null; adjuntoMimeType: string | null
  metadata: any
  militante?: { id: number; estado: string; tipoMilitancia: string | null } | null
}

const ESTADOS = ['PENDIENTE','RECIBIDA','REMITIDA','CERRADA','RECHAZADA','ARCHIVADA'] as const
const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-200',
  RECIBIDA:  'bg-blue-100 text-blue-800 border-blue-200',
  REMITIDA:  'bg-purple-100 text-purple-800 border-purple-200',
  CERRADA:   'bg-green-100 text-green-800 border-green-200',
  RECHAZADA: 'bg-red-100 text-red-800 border-red-200',
}

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—'
  const s = String(d).slice(0,10); const [y,m,dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )
}

function DetallePage() {
  const params = useParams()
  const router = useRouter()
  const id     = String(params.id)

  const [sol,          setSol]          = useState<Solicitud | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [nuevoEstado,  setNuevoEstado]  = useState('')
  const [observaciones,setObservaciones]= useState('')
  const [msg,          setMsg]          = useState<{text:string;ok:boolean}|null>(null)
  const [showAnular,   setShowAnular]   = useState(false)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [anulando,     setAnulando]     = useState(false)

  useEffect(() => {
    fetch(`/api/admin/desafiliaciones/${id}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) { setSol(j.data); setObservaciones(j.data.observaciones ?? ''); setNuevoEstado(j.data.estado) }
      })
      .finally(() => setLoading(false))
  }, [id])

  const guardar = async () => {
    setSaving(true); setMsg(null)
    try {
      const res  = await fetch(`/api/admin/desafiliaciones/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ estado: nuevoEstado, observaciones }),
      })
      const json = await res.json()
      if (json.success) {
        setSol(json.data)
        setMsg({ text: 'Guardado correctamente', ok: true })
      } else {
        setMsg({ text: json.error || 'Error al guardar', ok: false })
      }
    } catch { setMsg({ text: 'Error de conexión', ok: false }) }
    finally { setSaving(false) }
  }

  // ── Anulación de desafiliación inadvertida — Art. 13 Reglamento JCE 2026 ──
  const anularDesafiliacion = async () => {
    if (!motivoAnular.trim()) return
    setAnulando(true); setMsg(null)
    try {
      const res  = await fetch(`/api/admin/desafiliaciones/${id}/anular`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoAnular.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setSol(json.data.solicitud)
        setShowAnular(false)
        setMotivoAnular('')
        setMsg({ text: 'Desafiliación anulada. El militante ha sido restablecido como ACTIVO conforme al Art. 13.', ok: true })
      } else {
        setMsg({ text: json.error || 'Error al anular', ok: false })
      }
    } catch { setMsg({ text: 'Error de conexión', ok: false }) }
    finally { setAnulando(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C8001E] border-t-transparent"/>
    </div>
  )

  if (!sol) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-3">Solicitud no encontrada</p>
        <Link href="/admin/desafiliaciones" className="text-[#C8001E] underline text-sm">Volver</Link>
      </div>
    </div>
  )

  const meta = sol.metadata || {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#C8001E] px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Link href="/admin/desafiliaciones" className="text-white/80 hover:text-white text-sm">← Desafiliaciones</Link>
          <span className="text-white/40">|</span>
          <span className="text-white font-semibold text-sm">Detalle de solicitud</span>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ESTADO_STYLE[sol.estado] ?? ''}`}>
          {sol.estado}
        </span>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Identidad */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-semibold text-[#C8001E] uppercase tracking-widest border-b border-gray-100 pb-2">
            Datos del solicitante
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Campo label="Cédula"   value={sol.cedula}/>
            <Campo label="Nombres"  value={sol.nombres}/>
            <Campo label="Apellidos" value={sol.apellidos}/>
          </div>
          {sol.militante && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center gap-4 text-xs text-gray-600">
              <span>Estado APD: <strong>{sol.militante.estado}</strong></span>
              <span>Tipo: <strong>{sol.militante.tipoMilitancia ?? '—'}</strong></span>
              <Link href={`/admin?tab=ACTIVO`} className="ml-auto text-[#0D3B8C] underline">Ver en padrón →</Link>
            </div>
          )}
        </div>

        {/* Datos de la solicitud */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs font-semibold text-[#C8001E] uppercase tracking-widest border-b border-gray-100 pb-2">
            Datos de la solicitud
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Campo label="Tipo de solicitud"   value={sol.tipoSolicitud?.replace(/_/g,' ')}/>
            <Campo label="Fecha solicitud"     value={fmtFecha(sol.fechaSolicitud)}/>
            <Campo label="Fecha recepción"     value={fmtFecha(sol.fechaRecepcion)}/>
            <Campo label="Medio recepción"     value={sol.medioRecepcion}/>
            <Campo label="N° / Referencia doc" value={sol.referenciaDocumento}/>
            <Campo label="Registrada en sistema" value={fmtFecha(sol.createdAt)}/>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Motivo</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">
              {sol.motivo || '—'}
            </p>
          </div>
          {sol.detallePrueba && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Detalle / prueba</p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">
                {sol.detallePrueba}
              </p>
            </div>
          )}
          {sol.adjuntoNombre && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span>📎</span>
              <span>{sol.adjuntoNombre}</span>
              <span className="text-xs text-gray-400">({sol.adjuntoMimeType})</span>
            </div>
          )}
        </div>

        {/* Validaciones previas */}
        {meta.validacionPrevia && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-[#C8001E] uppercase tracking-widest border-b border-gray-100 pb-2">
              Validaciones al momento del registro
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:'JCE habilitado',   val: meta.validacionPrevia.jceValida && !meta.validacionPrevia.jceInhabilitado },
                { label:'Afiliado APD',     val: meta.validacionPrevia.apdRegistrado },
                { label:'Estado APD',       val: meta.validacionPrevia.estadoAPD },
                { label:'Tipo militancia',  val: meta.validacionPrevia.tipoMilitanciaAPD },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${
                    val === true ? 'text-green-700' : val === false ? 'text-red-600' : 'text-gray-800'
                  }`}>
                    {val === true ? '✓ Sí' : val === false ? '✗ No' : (val ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel de gestión */}
        <div className="bg-white rounded-xl border border-[#C8001E]/20 p-5 space-y-4">
          <p className="text-xs font-semibold text-[#C8001E] uppercase tracking-widest border-b border-gray-100 pb-2">
            Gestión administrativa
          </p>

          {/* Cambiar estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Estado de la solicitud</label>
              <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8001E]">
                {ESTADOS.map(e => (
                  <option key={e} value={e}>{e.charAt(0) + e.slice(1).toLowerCase()}</option>
                ))}
              </select>
              {nuevoEstado === 'CERRADA' && sol.militante && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  ⚠️ Al cerrar la solicitud el militante pasará a estado <strong>INACTIVO</strong> automáticamente.
                </p>
              )}
              {nuevoEstado === 'RECHAZADA' && (
                <p className="text-xs text-gray-500 mt-1">La solicitud se rechaza. Puede archivarla después.</p>
              )}
              {nuevoEstado === 'ARCHIVADA' && (
                <p className="text-xs text-gray-500 mt-1">La solicitud pasará al repositorio de archivados. No se puede deshacer fácilmente.</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Observaciones internas</label>
              <textarea
                value={observaciones} onChange={e => setObservaciones(e.target.value)}
                rows={3} placeholder="Notas internas del proceso..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8001E] resize-none"
              />
            </div>
          </div>

          {msg && (
            <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
              msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {msg.ok ? '✓ ' : '✗ '}{msg.text}
            </div>
          )}

          <div className="flex gap-3 justify-end flex-wrap">
            <Link href="/admin/desafiliaciones"
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              Volver
            </Link>
            {/* Botón rápido de archivar cuando está RECHAZADA */}
            {sol.estado === 'RECHAZADA' && nuevoEstado === 'RECHAZADA' && (
              <button
                onClick={() => { setNuevoEstado('ARCHIVADA'); guardar() }}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-500 text-sm hover:bg-gray-100 flex items-center gap-1.5"
              >
                🗄 Archivar
              </button>
            )}
            {sol.estado === 'CERRADA' && (
              <>
                <Link href={`/admin/carta/${encodeURIComponent(sol.cedula)}?tipo=desafiliacion`} target="_blank"
                  className="px-4 py-2 rounded-lg border border-[#C8001E]/30 text-[#C8001E] text-sm font-medium hover:bg-red-50 flex items-center gap-2">
                  📄 Carta de desafiliación
                </Link>
                <button onClick={() => setShowAnular(true)}
                  className="px-4 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50 flex items-center gap-2">
                  ↩ Anular (Art. 13)
                </button>
              </>
            )}
            <button onClick={guardar} disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#C8001E] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"/>}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

      </main>

      {/* Modal anulación Art. 13 */}
      {showAnular && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <p className="text-base font-semibold text-gray-900">↩ Anular desafiliación inadvertida</p>
              <p className="text-xs text-gray-500 mt-0.5">Art. 13 — Reglamento JCE, 15 enero 2026</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">¿En qué casos aplica?</p>
              <p>Cuando la desafiliación ocurrió sin el conocimiento o voluntad del ciudadano/a. El Art. 13 permite restablecer la condición si el/la afectado/a manifiesta su intención de permanecer.</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1.5">
                Justificación del restablecimiento <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoAnular}
                onChange={e => setMotivoAnular(e.target.value)}
                rows={4}
                placeholder="Ej: El ciudadano/a manifestó por escrito que la desafiliación fue procesada sin su consentimiento. Adjunta comunicación de fecha DD/MM/YYYY..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{motivoAnular.length}/500 caracteres</p>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">
              Esta acción: (1) marcará la solicitud como <strong>ANULADA</strong>, (2) reactivará al militante como <strong>ACTIVO</strong> y (3) quedará registrada en la bitácora de auditoría.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowAnular(false); setMotivoAnular('') }}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={anularDesafiliacion} disabled={anulando || !motivoAnular.trim()}
                className="flex-1 h-10 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {anulando ? 'Procesando...' : '↩ Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-50"/>}><DetallePage/></Suspense>
}
