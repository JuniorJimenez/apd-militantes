// app/admin/AdminClient.tsx — Panel completo con tipo de militancia, verificaciones y exportación de expedientes
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { FiltroGeografico, ValoresGeo, VALORES_GEO_VACIO } from '@/components/SelectorGeografico'
import ToastContainer, { useToast } from '@/components/Toast'
import { TIPOS_MILITANCIA } from '@/lib/types'
import type { Militante } from '@/lib/types'

type Tab  = 'PENDIENTE' | 'ACTIVO' | 'INACTIVO' | 'TODOS'
type Modo = 'ver' | 'editar'
interface Stats { total: number; activos: number; pendientes: number; inactivos: number; mes: number }

// ── Plazo JCE Art. 4 ───────────────────────────────────────────────────────
function getPlazosJCE(hoy: Date): { label: string; fecha: Date; diasRestantes: number; nivel: 'ok'|'proximo'|'urgente'|'vencido' } {
  const anio = hoy.getFullYear()
  // Determinar tipo de año (simplificado — años electorales en RD: 2024, 2028...)
  const esElectoral    = anio % 4 === 0
  const esPreelectoral = (anio % 4) === 3

  let fecha: Date
  let label: string
  if (esElectoral) {
    fecha = new Date(anio, 10, 1)   // 1 Nov
    label = `1 de noviembre ${anio} (año electoral)`
  } else if (esPreelectoral) {
    fecha = new Date(anio, 3, 30)   // 30 Abr
    label = `30 de abril ${anio} (año preelectoral)`
  } else {
    fecha = new Date(anio, 7, 1)    // 1 Ago
    label = `1 de agosto ${anio}`
  }

  const diasRestantes = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  let nivel: 'ok'|'proximo'|'urgente'|'vencido'
  if      (diasRestantes < 0)   nivel = 'vencido'
  else if (diasRestantes <= 15) nivel = 'urgente'
  else if (diasRestantes <= 45) nivel = 'proximo'
  else                          nivel = 'ok'

  return { label, fecha, diasRestantes, nivel }
}

const IcoCard   = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm5 2a1 1 0 000 2h4a1 1 0 100-2H8z" clipRule="evenodd"/></svg>
const IcoCheck  = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
const IcoX      = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
const IcoEye    = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
const IcoEdit   = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
const IcoTrash  = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
const IcoExport = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
const IcoPrint  = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9a1 1 0 011-1h6a1 1 0 011 1v4H6v-4zm7-4H7a3 3 0 00-3 3v4H3a1 1 0 01-1-1V9a1 1 0 011-1h14a1 1 0 011 1v5a1 1 0 01-1 1h-1v-4a3 3 0 00-3-3z" clipRule="evenodd"/></svg>
const IcoBan    = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/></svg>
const IcoClock  = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
const IcoUpload = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
const IcoShield = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 1.5l6 2.4v4.76c0 4.01-2.53 7.67-6 9.34-3.47-1.67-6-5.33-6-9.34V3.9l6-2.4zm2.78 6.22a.75.75 0 00-1.06-1.06L9.25 9.13 8.28 8.16a.75.75 0 10-1.06 1.06l1.5 1.5a.75.75 0 001.06 0l2.99-3z" clipRule="evenodd"/></svg>

function getAfiliacionExpedienteHtmlHref(cedula: string) {
  return `/api/expedientes/afiliacion/${encodeURIComponent(cedula)}`
}
function getFichaAfiliacionHref(cedula: string) {
  return `/api/expedientes/afiliacion/${encodeURIComponent(cedula)}`
}

function getAfiliacionExpedienteJsonHref(cedula: string) {
  return `/api/expedientes/afiliacion/${encodeURIComponent(cedula)}?format=json`
}

function Badge({ estado }: { estado: string }) {
  const s = estado==='ACTIVO'?'bg-green-100 text-green-800':estado==='PENDIENTE'?'bg-amber-100 text-amber-800':'bg-gray-100 text-gray-500'
  const l = estado==='ACTIVO'?'Activo':estado==='PENDIENTE'?'Pendiente':'Inactivo'
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s}`}><span className="w-1.5 h-1.5 rounded-full bg-current"/>{l}</span>
}



function getVerificationBadgeData(militante: Militante) {
  const latest = militante.latestVerification
  if (!latest) {
    return { label: 'Sin verificación', className: 'bg-gray-100 text-gray-600', actionHref: `/verificacion-identidad?militanteId=${militante.id}` }
  }

  const byStatus: Record<string, { label: string; className: string }> = {
    approved: { label: 'Verificado', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'No coincide', className: 'bg-red-100 text-red-800' },
    manual_review: { label: 'Revisión manual', className: 'bg-yellow-100 text-yellow-800' },
    pending: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
    liveness_in_progress: { label: 'Liveness en curso', className: 'bg-blue-100 text-blue-800' },
    liveness_passed: { label: 'Liveness aprobado', className: 'bg-sky-100 text-sky-800' },
    liveness_failed: { label: 'Liveness fallido', className: 'bg-orange-100 text-orange-800' },
    face_match_pending: { label: 'Comparación pendiente', className: 'bg-indigo-100 text-indigo-800' },
  }

  const current = byStatus[latest.status] || byStatus.pending
  return {
    label: current.label,
    className: current.className,
    actionHref: `/admin/verificaciones/${latest.sessionId}`,
    updatedAt: latest.updatedAt,
    finalDecision: latest.finalDecision,
    sessionId: latest.sessionId,
  }
}

function VerificationBadge({ militante }: { militante: Militante }) {
  const badge = getVerificationBadgeData(militante)
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${badge.className}`}><IcoShield/>{badge.label}</span>
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return <div><p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p><p className="text-sm font-medium text-gray-800 break-words">{value}</p></div>
}

const INP = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0D3B8C] transition-colors`

/** Formatea fecha sin desfase de zona horaria — parsea directamente del string ISO */
function fmtFecha(val: string | Date | null | undefined): string {
  if (!val) return ''
  const s = String(val).slice(0, 10) // "YYYY-MM-DD"
  if (!s || s.length < 10) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** Extrae solo "YYYY-MM-DD" para el input type=date sin conversión de zona horaria */
function toDateInput(val: string | Date | null | undefined): string {
  if (!val) return ''
  return String(val).slice(0, 10)
}

// ─── Modal Carga Masiva ────────────────────────────────────────────────────────
interface ImportResult { total:number; importados:number; duplicados:number; errores:number; detalles:{fila:number;cedula:string;error:string}[] }

function ModalImport({ onClose, onDone }: { onClose:()=>void; onDone:()=>void }) {
  const { show } = useToast()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [etapa,   setEtapa]   = useState<'upload'|'preview'|'result'>('upload')
  const [filas,   setFilas]   = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<ImportResult|null>(null)

  const COLS_REQ = ['cedula','nombres','apellidos','telefono','provincia','municipio']
  const COLS_OPT = ['email','sexo','estadoCivil','sector','direccion','ocupacion','motivo']

  const procesarArchivo = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const json  = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!json.length) { show('El archivo está vacío', 'error'); return }
        setFilas(json as any[])
        setEtapa('preview')
      } catch { show('Error al leer el archivo. Usa formato XLS o XLSX.', 'error') }
    }
    reader.readAsArrayBuffer(file)
  }

  const importar = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/militantes/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas }),
      })
      const json = await res.json()
      if (json.success) { setResult(json.data); setEtapa('result') }
      else show(json.error || 'Error al importar', 'error')
    } catch { show('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-[#0D3B8C] rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Carga masiva de militantes</p>
            <p className="text-white/70 text-xs mt-0.5">
              {etapa==='upload'?'Sube un archivo XLS/XLSX':etapa==='preview'?`${filas.length} registros encontrados`:'Importación completada'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><IcoX/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* Etapa 1: Upload */}
          {etapa==='upload' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold">Formato requerido del archivo XLS/XLSX:</p>
                <p>La primera fila debe contener los encabezados. Columnas <strong>requeridas</strong>:</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLS_REQ.map(c => <span key={c} className="bg-blue-200 text-blue-900 text-xs px-2 py-0.5 rounded font-mono">{c}</span>)}
                </div>
                <p className="mt-2">Columnas <strong>opcionales</strong>:</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLS_OPT.map(c => <span key={c} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-mono">{c}</span>)}
                </div>
                <p className="text-xs text-blue-600 mt-2">Todos los registros se importarán en estado <strong>PENDIENTE</strong> con tipo <strong>Simpatizante</strong>.</p>
              </div>

              <button onClick={() => fileRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2
                           text-gray-500 hover:border-[#0D3B8C] hover:text-[#0D3B8C] transition-colors cursor-pointer">
                <IcoUpload/>
                <span className="text-sm font-medium">Haz clic para seleccionar el archivo</span>
                <span className="text-xs text-gray-400">XLS, XLSX — máximo 5,000 registros</span>
              </button>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if(f) procesarArchivo(f) }}/>

              {/* Botón descargar plantilla */}
              <button onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  [...COLS_REQ, ...COLS_OPT],
                  ['04701234567','Juan Carlos','Pérez Gómez','8091234567','Santiago','Santiago','juan@email.com','Masculino','Soltero/a','Los Jardines','Calle 5 #12','Comerciante','Apoyo a la democracia'],
                ])
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Militantes')
                XLSX.writeFile(wb, 'plantilla-importacion-apd.xlsx')
              }}
                className="w-full h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
                <IcoExport/> Descargar plantilla de ejemplo
              </button>
            </div>
          )}

          {/* Etapa 2: Preview */}
          {etapa==='preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Vista previa de los primeros 5 registros:</p>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>{COLS_REQ.map(c => <th key={c} className="text-left py-2 px-3 font-medium text-gray-500 uppercase tracking-wide">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filas.slice(0,5).map((f,i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {COLS_REQ.map(c => <td key={c} className="py-2 px-3 text-gray-700">{f[c]||'—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filas.length > 5 && <p className="text-xs text-gray-400 text-center">… y {filas.length-5} registros más</p>}
            </div>
          )}

          {/* Etapa 3: Resultado */}
          {etapa==='result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                  <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Total</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-700">{result.importados}</p>
                  <p className="text-xs text-green-600 mt-1">Importados</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
                  <p className="text-2xl font-bold text-amber-700">{result.duplicados}</p>
                  <p className="text-xs text-amber-600 mt-1">Duplicados</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center border border-red-200">
                  <p className="text-2xl font-bold text-red-700">{result.errores}</p>
                  <p className="text-xs text-red-600 mt-1">Errores</p>
                </div>
              </div>
              {result.detalles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Registros con problemas</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {result.detalles.map((d,i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-xs">
                        <span className="text-gray-400">Fila {d.fila}</span>
                        <span className="font-mono text-gray-600">{d.cedula}</span>
                        <span className="text-red-600">{d.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          {etapa==='upload' && (
            <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cancelar</button>
          )}
          {etapa==='preview' && (
            <>
              <button onClick={() => { setEtapa('upload'); setFilas([]) }} className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cambiar archivo</button>
              <button onClick={importar} disabled={loading}
                className="flex-1 h-10 rounded-xl bg-[#0D3B8C] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? 'Importando...' : <><IcoUpload/> Importar {filas.length} registros</>}
              </button>
            </>
          )}
          {etapa==='result' && (
            <button onClick={() => { onDone(); onClose() }} className="flex-1 h-10 rounded-xl bg-[#0D3B8C] text-white text-sm font-medium hover:opacity-90">Aceptar</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Slide-over ───────────────────────────────────────────────────────────────
function SlideOver({ militante, modo, onClose, onSaved, onDeleted }: {
  militante:Militante|null; modo:Modo
  onClose:()=>void; onSaved:()=>void; onDeleted:()=>void
}) {
  const { show } = useToast()
  const [m, setM]       = useState<Militante|null>(null)
  const [mo, setMo]     = useState<Modo>(modo)
  const [load, setLoad] = useState(false)
  const [confirm, setConfirm] = useState<null|'eliminar'|'rechazar'|'desactivar'>(null)

  useEffect(() => { setM(militante ? { ...militante } : null); setMo(modo); setConfirm(null) }, [militante, modo])
  if (!m) return null

  const set = (k: keyof Militante) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setM(p => p ? { ...p, [k]: e.target.value } : p)

  const ini = `${m.nombres?.[0]??''}${m.apellidos?.[0]??''}`.toUpperCase()
  const desafiliadoFormalmente = !!(m as any).desafiliadoFormalmente

  const cambiarEstado = async (nuevoEstado: string, etiqueta: string) => {
    setLoad(true)
    try {
      const res  = await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setM(prev => prev ? { ...prev, estado: nuevoEstado as any } : prev)
        setConfirm(null)
        show(`${m.nombres} ${etiqueta}`, nuevoEstado === 'ACTIVO' ? 'success' : 'info')
        onSaved(); onClose()
      } else if (json.code === 'DESAFILIADO_FORMALMENTE') {
        show('Bloqueado — militante desafiliado formalmente. Debe reafiliarse por el formulario oficial.', 'error')
      } else {
        show(json.error || `No se pudo cambiar el estado a ${nuevoEstado}`, 'error')
      }
    } catch { show('Error de conexión. Verifica tu sesión e intenta de nuevo.', 'error') }
    finally { setLoad(false) }
  }

  const guardar = async () => {
    setLoad(true)
    try {
      const res  = await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m),
      })
      const json = await res.json()
      if (res.ok && json.success) { show(`${m.nombres} actualizado`, 'success'); onSaved(); onClose() }
      else show(json.error || 'Error al guardar cambios', 'error')
    } catch { show('Error de conexión al guardar', 'error') }
    finally { setLoad(false) }
  }

  const eliminar = async () => {
    setLoad(true)
    try {
      const res  = await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`, {
        method: 'DELETE', credentials: 'same-origin',
      })
      const json = await res.json()
      if (res.ok && json.success) { show(`${m.nombres} eliminado`, 'success'); onDeleted(); onClose() }
      else show(json.error || 'Error al eliminar', 'error')
    } catch { show('Error de conexión al eliminar', 'error') }
    finally { setLoad(false) }
  }

  const renderConfirm = () => {
    if (!confirm) return null
    const cfg: Record<string,{title:string;body:string;btn:string;cls:string;action:()=>void}> = {
      eliminar:  { title:'¿Eliminar militante?',   body:'Esta acción es permanente e irreversible.',            btn:'Sí, eliminar',   cls:'bg-[#C8001E]', action: eliminar },
      rechazar:  { title:'¿Rechazar solicitud?',   body:'El militante quedará en estado INACTIVO.',             btn:'Sí, rechazar',   cls:'bg-gray-600',  action: () => cambiarEstado('INACTIVO','rechazado') },
      desactivar:{ title:'¿Desactivar militante?', body:'Perderá el estado activo en el padrón del partido.',  btn:'Sí, desactivar', cls:'bg-gray-600',  action: () => cambiarEstado('INACTIVO','desactivado') },
    }
    const c = cfg[confirm]
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-red-800">{c.title}</p>
        <p className="text-xs text-red-600"><strong>{m.nombres} {m.apellidos}</strong> — {c.body}</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirm(null)} className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={c.action} disabled={load} className={`flex-1 h-9 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-1.5 ${c.cls}`}>
            {load ? 'Procesando...' : c.btn}
          </button>
        </div>
      </div>
    )
  }

  const renderAcciones = () => {
    if (confirm) return renderConfirm()

    if (mo==='editar') return (
      <div className="flex gap-2">
        <button onClick={() => setConfirm('eliminar')} className="h-10 px-3 rounded-lg border border-red-200 text-[#C8001E] text-sm hover:bg-red-50 flex items-center gap-1.5"><IcoTrash/>Eliminar</button>
        <button onClick={guardar} disabled={load} className="flex-1 h-10 rounded-lg bg-[#0D3B8C] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
          {load?'Guardando...':<><IcoCheck/>Guardar cambios</>}
        </button>
      </div>
    )

    if (m.estado==='PENDIENTE') return (
      <div className="space-y-2">
        <button onClick={() => cambiarEstado('ACTIVO','aprobado y activado')} disabled={load}
          className="w-full h-11 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
          {load?'Procesando...':<><IcoCheck/>Aprobar y activar</>}
        </button>
        <div className="flex gap-2">
          <button onClick={() => setConfirm('rechazar')} disabled={load} className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1.5"><IcoBan/>Rechazar</button>
          <button onClick={() => setMo('editar')} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1.5"><IcoEdit/>Editar</button>
          <button onClick={() => setConfirm('eliminar')} className="h-10 px-3 rounded-lg border border-red-200 text-[#C8001E] text-sm hover:bg-red-50"><IcoTrash/></button>
        </div>
      </div>
    )

    if (m.estado==='ACTIVO') return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <a href={`/carnet?cedula=${encodeURIComponent(m.cedula)}`} target="_blank" rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-2 py-3 text-center hover:bg-purple-100 cursor-pointer">
            <IcoCard/><span className="text-[11px] font-medium text-purple-700">Carnet</span>
          </a>
          <a href={`/admin/carta/${encodeURIComponent(m.cedula)}?tipo=afiliacion`} target="_blank" rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2 py-3 text-center hover:bg-blue-100 cursor-pointer">
            <span className="text-sm">📄</span><span className="text-[11px] font-medium text-[#0D3B8C]">Carta afl.</span>
          </a>
          <a href={getFichaAfiliacionHref(m.cedula)} target="_blank" rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-green-200 bg-green-50 px-2 py-3 text-center hover:bg-green-100 cursor-pointer">
            <span className="text-sm">📋</span><span className="text-[11px] font-medium text-green-700">Ficha</span>
          </a>
          <a href={getAfiliacionExpedienteHtmlHref(m.cedula)} target="_blank" rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2 py-3 text-center hover:bg-gray-100 cursor-pointer">
            <IcoExport/><span className="text-[11px] font-medium text-gray-600">Expediente</span>
          </a>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMo('editar')} className="flex-1 h-10 rounded-lg bg-[#0D3B8C] text-white text-sm font-medium hover:opacity-90 flex items-center justify-center gap-1.5"><IcoEdit/>Editar</button>
          <button onClick={() => setConfirm('desactivar')} disabled={load} className="h-10 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 flex items-center gap-1.5"><IcoBan/>Desactivar</button>
          <button onClick={() => setConfirm('eliminar')} className="h-10 px-3 rounded-lg border border-red-200 text-[#C8001E] text-sm hover:bg-red-50"><IcoTrash/></button>
        </div>
      </div>
    )

    if (desafiliadoFormalmente) return (
      <div className="space-y-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800">⚠️ Desafiliado formalmente</p>
          <p className="text-xs text-amber-700">La reactivación está bloqueada. Debe reafiliarse por el formulario oficial.</p>
        </div>
        <a href={`/admin/carta/${encodeURIComponent(m.cedula)}?tipo=desafiliacion`} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-[#C8001E]/30 bg-red-50 text-[#C8001E] text-sm font-medium hover:bg-red-100">
          📄 Carta de desafiliación
        </a>
        <div className="flex gap-2">
          <button onClick={() => setMo('editar')} className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1.5"><IcoEdit/>Editar</button>
          <button onClick={() => setConfirm('eliminar')} className="h-9 px-3 rounded-lg border border-red-200 text-[#C8001E] text-sm hover:bg-red-50"><IcoTrash/></button>
        </div>
      </div>
    )

    return (
      <div className="space-y-2">
        <button onClick={() => cambiarEstado('ACTIVO','reactivado')} disabled={load}
          className="w-full h-11 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
          {load?'Procesando...':<><IcoCheck/>Reactivar</>}
        </button>
        <div className="flex gap-2">
          <button onClick={() => cambiarEstado('PENDIENTE','movido a revisión')} disabled={load} className="flex-1 h-10 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 flex items-center justify-center gap-1.5"><IcoClock/>En revisión</button>
          <button onClick={() => setMo('editar')} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1.5"><IcoEdit/>Editar</button>
          <button onClick={() => setConfirm('eliminar')} className="h-10 px-3 rounded-lg border border-red-200 text-[#C8001E] text-sm hover:bg-red-50"><IcoTrash/></button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        tabIndex={-1}
      />
      <div
        className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#0D3B8C] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 text-white font-bold text-base flex items-center justify-center">{ini}</div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{m.nombres} {m.apellidos}</p>
              <p className="text-white/70 text-xs mt-0.5">{m.cedula}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mo==='editar' && <button onClick={() => setMo('ver')} className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg">Cancelar</button>}
            <button onClick={onClose} className="text-white/70 hover:text-white p-1"><IcoX/></button>
          </div>
        </div>
        <div className={`px-5 py-2.5 flex items-center gap-3 flex-shrink-0 border-b border-gray-200 ${m.estado==='PENDIENTE'?'bg-amber-50':m.estado==='ACTIVO'?'bg-green-50':'bg-gray-50'}`}>
          <Badge estado={m.estado}/>
          {m.tipoMilitancia && (
            <span className="text-xs bg-[#0D3B8C]/10 text-[#0D3B8C] px-2.5 py-1 rounded-full font-medium">{m.tipoMilitancia}</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mo==='ver' ? (
            <div className="space-y-5">
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Datos personales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Nombres" value={m.nombres}/><Campo label="Apellidos" value={m.apellidos}/>
                  <Campo label="Cédula" value={m.cedula}/><Campo label="Fecha nac." value={fmtFecha(m.fechaNac)}/>
                  <Campo label="Sexo" value={m.sexo}/><Campo label="Estado civil" value={m.estadoCivil}/>
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Contacto</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Teléfono" value={m.telefono}/><Campo label="Tel. alt." value={m.telefonoAlt}/>
                  <div className="col-span-2"><Campo label="Correo" value={m.email}/></div>
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Ubicación</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Provincia" value={m.provincia}/><Campo label="Municipio" value={m.municipio}/>
                  <Campo label="Barrio" value={m.sector}/><div className="col-span-2"><Campo label="Dirección" value={m.direccion}/></div>
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Militancia</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Tipo de militancia" value={m.tipoMilitancia}/>
                  <Campo label="Ocupación" value={m.ocupacion}/>
                  {m.motivo && <div className="col-span-2"><Campo label="Motivo" value={m.motivo}/></div>}
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Verificación de identidad</p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <VerificationBadge militante={m}/>
                    {m.latestVerification?.updatedAt && (
                      <span className="text-[11px] text-gray-500">Actualizada: {fmtFecha(m.latestVerification.updatedAt)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo label="Decisión final" value={m.latestVerification?.finalDecision || '—'}/>
                    <Campo label="Revisión manual" value={m.latestVerification?.manualReviewStatus || '—'}/>
                  </div>
                  {/* Hash SHA-256 — evidencia auditable Art. 5 Párr. II Reglamento JCE 2026 */}
                  {(m as any).livenessHash && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 space-y-1">
                      <p className="text-[10px] font-semibold text-green-800 uppercase tracking-wide">
                        🔒 Evidencia biométrica — Art. 5 Párr. II Reglamento JCE 2026
                      </p>
                      <p className="text-[10px] text-green-700 font-mono break-all leading-relaxed">
                        SHA-256: {(m as any).livenessHash}
                      </p>
                      {(m as any).verifiedAt && (
                        <p className="text-[10px] text-green-600">
                          Verificado: {fmtFecha((m as any).verifiedAt)}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {m.latestVerification?.sessionId ? (
                      <Link href={`/admin/verificaciones/${m.latestVerification.sessionId}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D3B8C]/20 text-[#0D3B8C] text-sm font-medium hover:bg-blue-50">
                        <IcoShield/> Abrir detalle
                      </Link>
                    ) : (
                      <Link href={`/verificacion-identidad?militanteId=${encodeURIComponent(String(m.id))}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D3B8C]/20 text-[#0D3B8C] text-sm font-medium hover:bg-blue-50">
                        <IcoShield/> Iniciar flujo
                      </Link>
                    )}
                    <a href={getAfiliacionExpedienteHtmlHref(m.cedula)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-green-200 text-green-700 text-sm font-medium hover:bg-green-50">
                      <IcoExport/> Expediente HTML
                    </a>
                    <a href={getFichaAfiliacionHref(m.cedula)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D3B8C]/20 bg-blue-50 text-[#0D3B8C] text-sm font-medium hover:bg-blue-100">
                      📋 Ficha Art. 5
                    </a>
                    <a href={getAfiliacionExpedienteJsonHref(m.cedula)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-white">
                      <IcoPrint/> Expediente JSON
                    </a>
                    <Link href="/admin/verificaciones" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-white">
                      <IcoEye/> Ver bandeja
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Datos personales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Nombres</label><input className={INP} value={m.nombres} onChange={set('nombres')}/></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Apellidos</label><input className={INP} value={m.apellidos} onChange={set('apellidos')}/></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Fecha nac.</label><input type="date" className={INP} value={toDateInput(m.fechaNac)} onChange={set('fechaNac')}/></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Sexo</label>
                    <select className={INP} value={m.sexo??''} onChange={set('sexo')}>
                      <option value="">—</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      {/* Valores posibles desde JCE en mayúsculas */}
                      {m.sexo && !['Masculino','Femenino',''].includes(m.sexo) && (
                        <option value={m.sexo}>{m.sexo}</option>
                      )}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Estado civil</label>
                    <select className={INP} value={m.estadoCivil??''} onChange={set('estadoCivil')}>
                      <option value="">—</option>
                      <option value="Soltero">Soltero</option>
                      <option value="Soltero/a">Soltero/a</option>
                      <option value="Casado">Casado</option>
                      <option value="Casado/a">Casado/a</option>
                      <option value="Divorciado">Divorciado</option>
                      <option value="Divorciado/a">Divorciado/a</option>
                      <option value="Viudo">Viudo</option>
                      <option value="Viudo/a">Viudo/a</option>
                      <option value="Unión libre">Unión libre</option>
                      {/* Valor almacenado si no coincide con los predefinidos */}
                      {m.estadoCivil && !['Soltero','Soltero/a','Casado','Casado/a','Divorciado','Divorciado/a','Viudo','Viudo/a','Unión libre',''].includes(m.estadoCivil) && (
                        <option value={m.estadoCivil}>{m.estadoCivil}</option>
                      )}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Estado APD</label>
                    <select className={INP} value={m.estado} onChange={set('estado')}><option value="ACTIVO">Activo</option><option value="PENDIENTE">Pendiente</option><option value="INACTIVO">Inactivo</option></select>
                  </div>
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Contacto</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Teléfono</label><input className={INP} value={m.telefono} onChange={set('telefono')}/></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Tel. alternativo</label><input className={INP} value={m.telefonoAlt??''} onChange={set('telefonoAlt')}/></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Correo</label><input type="email" className={INP} value={m.email??''} onChange={set('email')}/></div>
                </div>
              </div>
              <div><p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">Militancia — gestionado por admin</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Tipo de militancia</label>
                    <select className={`${INP} border-[#0D3B8C]/30 bg-blue-50/30`} value={m.tipoMilitancia??'Simpatizante'} onChange={set('tipoMilitancia')}>
                      {TIPOS_MILITANCIA.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                  </div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Ocupación</label><input className={INP} value={m.ocupacion??''} onChange={set('ocupacion')}/></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Motivo</label><textarea className={`${INP} resize-y min-h-[70px]`} value={m.motivo??''} onChange={set('motivo')}/></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-gray-200 px-5 py-4 bg-white">{renderAcciones()}</div>
      </div>
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toasts, show, remove } = useToast()

  const [militantes,   setMilitantes]   = useState<Militante[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0, activos:0, pendientes:0, inactivos:0, mes:0 })
  const [tab,          setTab]          = useState<Tab>('PENDIENTE')
  const [buscar,       setBuscar]       = useState('')
  const [geo,          setGeo]          = useState<ValoresGeo>(VALORES_GEO_VACIO)
  const [loading,      setLoading]      = useState(true)
  const [cerrando,     setCerrando]     = useState(false)
  const [exportando,   setExportando]   = useState(false)
  const [seleccionado, setSeleccionado] = useState<Militante|null>(null)
  const [modoPanel,    setModoPanel]    = useState<Modo>('ver')
  const [seleccionados,setSeleccionados]= useState<Set<string>>(new Set())
  const [accionMasiva, setAccionMasiva] = useState(false)
  const [showImport,   setShowImport]   = useState(false)
  const [revisionManualCount,    setRevisionManualCount]    = useState(0)
  const [desafiliacionesPending, setDesafiliacionesPending] = useState(0)

  const queryCedula = searchParams.get('cedula')?.trim() ?? ''
  const queryTab = searchParams.get('tab')?.trim() ?? ''

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ estado: tab, q: buscar, limite: '500' })
      if (geo.provincia) p.set('provincia', geo.provincia)
      if (geo.municipio) p.set('municipio', geo.municipio)
      if (geo.barrio)    p.set('sector',    geo.barrio)
      const res  = await fetch(`/api/militantes?${p}`)
      const json = await res.json()
      if (json.success) {
        setMilitantes(json.data.militantes)
        const s = json.data.stats
        setStats({ total: s.total, activos: s.activos, pendientes: s.pendientes, inactivos: s.total-s.activos-s.pendientes, mes: s.mes })
      }
      const reviewRes = await fetch('/api/admin/verificaciones?status=manual_review&limit=1')
      const reviewJson = await reviewRes.json()
      if (reviewJson?.success) setRevisionManualCount(reviewJson?.pagination?.total || 0)

      try {
        const desafRes  = await fetch('/api/admin/desafiliaciones?estado=PENDIENTE&limite=1')
        const desafJson = await desafRes.json()
        if (desafJson.success) setDesafiliacionesPending(desafJson.data?.total ?? 0)
      } catch { /* no bloquear si falla */ }
    } catch(e){ console.error(e) } finally { setLoading(false) }
    setSeleccionados(new Set())
  }, [tab, buscar, geo])

  useEffect(() => {
    if (queryCedula) {
      if (queryTab === 'ACTIVO' || queryTab === 'INACTIVO' || queryTab === 'TODOS' || queryTab === 'PENDIENTE') setTab(queryTab as Tab)
      setBuscar(queryCedula)
    }
  }, [queryCedula, queryTab])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!queryCedula || !militantes.length || seleccionado) return
    const normalized = queryCedula.replace(/\s+/g, '')
    const found = militantes.find(m => m.cedula.replace(/\s+/g, '') === normalized)
    if (found) {
      setSeleccionado(found)
      setModoPanel('ver')
    }
  }, [queryCedula, militantes, seleccionado])

  const toggleSeleccion = (cedula: string) => setSeleccionados(prev => { const n=new Set(prev); n.has(cedula)?n.delete(cedula):n.add(cedula); return n })
  const toggleTodos = () => { if(seleccionados.size===militantes.length) setSeleccionados(new Set()); else setSeleccionados(new Set(militantes.map(m=>m.cedula))) }

  const aplicarAccionMasiva = async (nuevoEstado: string) => {
    if (!seleccionados.size) return
    setAccionMasiva(true)
    try {
      const results = await Promise.all([...seleccionados].map(async cedula => {
        const res  = await fetch(`/api/militantes/${encodeURIComponent(cedula)}`, {
          method: 'PATCH', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado }),
        })
        const json = await res.json()
        return { ok: res.ok && json.success }
      }))
      const ok      = results.filter(r => r.ok).length
      const fallidos = results.filter(r => !r.ok).length
      const acc     = nuevoEstado === 'ACTIVO' ? 'aprobados' : nuevoEstado === 'INACTIVO' ? 'desactivados' : 'actualizados'
      if (ok > 0)       show(`${ok} militante(s) ${acc}`, 'success')
      if (fallidos > 0) show(`${fallidos} no pudieron actualizarse (verificar permisos)`, 'error')
      setSeleccionados(new Set())
      cargar()
    } catch { show('Error en la acción masiva', 'error') }
    finally { setAccionMasiva(false) }
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const p = new URLSearchParams({ estado: tab, q: buscar })
      if (geo.provincia) p.set('provincia', geo.provincia)
      if (geo.municipio) p.set('municipio', geo.municipio)
      const res  = await fetch(`/api/militantes/exportar?${p}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href=url; a.download=`padron-apd-${new Date().toISOString().slice(0,10)}.csv`; a.click()
      URL.revokeObjectURL(url)
      show('Exportado correctamente', 'success')
    } catch { show('Error al exportar', 'error') } finally { setExportando(false) }
  }

  const cerrarSesion = async () => {
    setCerrando(true)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(()=>{})
    router.push('/admin/login'); router.refresh()
  }

  const TABS: { value:Tab; label:string; color:string; count:number }[] = [
    { value:'PENDIENTE', label:'Pendientes', color:'text-amber-700', count:stats.pendientes },
    { value:'ACTIVO',    label:'Activos',    color:'text-green-700', count:stats.activos    },
    { value:'INACTIVO',  label:'Inactivos',  color:'text-gray-500',  count:stats.inactivos  },
    { value:'TODOS',     label:'Todos',      color:'text-[#0D3B8C]', count:stats.total      },
  ]

  const todosMarcados  = seleccionados.size===militantes.length && militantes.length>0
  const algunosMarcados= seleccionados.size>0 && seleccionados.size<militantes.length

  return (
    <>
      {seleccionado && <SlideOver militante={seleccionado} modo={modoPanel} onClose={() => setSeleccionado(null)} onSaved={cargar} onDeleted={cargar}/>}
      {showImport   && <ModalImport onClose={() => setShowImport(false)} onDone={cargar}/>}

      <div style={{height:'4px',background:'linear-gradient(to right,#0D3B8C 33%,#F5C400 33%,#F5C400 66%,#C8001E 66%)'}}/>
      <nav className="bg-[#0D3B8C] sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Image src="/logo-apd.png" alt="APD" width={85} height={85} className="object-contain"/>
            <div><p className="text-white font-medium text-sm leading-tight hidden sm:block">Panel de Administración</p><p className="text-white/60 text-xs">Alianza por la Democracia</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-white/75 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/15 transition-all">Consulta</Link>
            <Link href="/registro" className="text-white/75 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/15 transition-all">Registro</Link>
            <Link href="/admin/verificaciones" className="text-white/75 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/15 transition-all">Verificaciones</Link>
            <Link href="/admin/desafiliaciones" className="text-white/75 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/15 transition-all">Desafiliaciones</Link>
            <button onClick={cerrarSesion} disabled={cerrando} className="flex items-center gap-1.5 text-sm text-white/75 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/15 border border-white/20 transition-all disabled:opacity-60">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/></svg>
              {cerrando?'Saliendo...':'Cerrar sesión'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            {label:'Total',valor:stats.total,color:'text-[#0D3B8C]',bg:'bg-blue-50',border:'border-blue-200'},
            {label:'Activos',valor:stats.activos,color:'text-green-700',bg:'bg-green-50',border:'border-green-200'},
            {label:'Pendientes',valor:stats.pendientes,color:'text-amber-700',bg:'bg-amber-50',border:'border-amber-200'},
            {label:'Inactivos',valor:stats.inactivos,color:'text-gray-500',bg:'bg-gray-50',border:'border-gray-200'},
            {label:'Este mes',valor:stats.mes,color:'text-[#C8001E]',bg:'bg-red-50',border:'border-red-200'},
            {label:'Rev. manual',valor:revisionManualCount,color:'text-yellow-700',bg:'bg-yellow-50',border:'border-yellow-200'},
            {label:'Desafiliaciones',valor:desafiliacionesPending,color:'text-[#C8001E]',bg:'bg-red-50',border:'border-red-200'},
          ].map(({label,valor,color,bg,border}) => (
            <div key={label} className={`${bg} rounded-xl p-4 text-center border ${border}`}>
              <p className={`text-2xl sm:text-3xl font-semibold ${color} leading-none`}>{valor}</p>
              <p className="text-xs text-gray-500 mt-1.5 tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Alerta pendientes */}
        {stats.pendientes>0 && tab!=='PENDIENTE' && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-amber-800"><IcoClock/><span>Hay <strong>{stats.pendientes}</strong> solicitud(es) pendiente(s)</span></div>
            <button onClick={() => setTab('PENDIENTE')} className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg">Revisar ahora</button>
          </div>
        )}

        <div className="mb-4 bg-white border border-blue-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0D3B8C]">Bandeja de verificación de identidad</p>
            <p className="text-xs text-gray-500">Acceso directo a revisiones manuales y decisiones del flujo mock.</p>
          </div>
          <Link href="/admin/verificaciones" className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#0D3B8C] text-white text-sm font-medium hover:opacity-90">
            <IcoShield/> Abrir bandeja de verificaciones
          </Link>
        </div>

        {/* Banner desafiliaciones */}
        <div className="mb-4 bg-white border border-red-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#C8001E]">
              Gestión de desafiliaciones
              {desafiliacionesPending > 0 && (
                <span className="ml-2 bg-[#C8001E] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {desafiliacionesPending} pendiente{desafiliacionesPending > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">Revisa, actualiza y cierra solicitudes de desafiliación recibidas.</p>
          </div>
          <Link href="/admin/desafiliaciones" className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#C8001E] text-white text-sm font-medium hover:opacity-90">
            📋 Abrir bandeja de desafiliaciones
          </Link>
        </div>

        {/* Banner plazo JCE Art. 4 */}
        {(() => {
          const plazo = getPlazosJCE(new Date())
          if (plazo.nivel === 'ok') return null
          const estilos = {
            proximo:  { bg:'bg-blue-50',   border:'border-blue-200',   txt:'text-blue-800',   sub:'text-blue-600',   btn:'bg-[#0D3B8C] text-white hover:opacity-90', ico:'📅' },
            urgente:  { bg:'bg-amber-50',  border:'border-amber-200',  txt:'text-amber-900',  sub:'text-amber-700',  btn:'bg-amber-600 text-white hover:bg-amber-700', ico:'⚠️' },
            vencido:  { bg:'bg-red-50',    border:'border-red-200',    txt:'text-red-900',    sub:'text-red-700',    btn:'bg-[#C8001E] text-white hover:opacity-90', ico:'🚨' },
          }[plazo.nivel] ?? { bg:'bg-gray-50', border:'border-gray-200', txt:'text-gray-800', sub:'text-gray-500', btn:'bg-gray-600 text-white', ico:'📋' }

          return (
            <div className={`mb-4 ${estilos.bg} border ${estilos.border} rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <p className={`text-sm font-semibold ${estilos.txt}`}>
                  {estilos.ico} Entrega anual de padrón JCE — Art. 4
                  {plazo.nivel === 'vencido'
                    ? <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">VENCIDO</span>
                    : <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${plazo.nivel === 'urgente' ? 'bg-amber-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                        {plazo.diasRestantes} días
                      </span>
                  }
                </p>
                <p className={`text-xs mt-0.5 ${estilos.sub}`}>
                  {plazo.nivel === 'vencido'
                    ? `Plazo vencido el ${plazo.label}. Realiza la entrega a la JCE a la brevedad posible.`
                    : `Plazo: ${plazo.label}. Genera y entrega el padrón en formato JCE antes de esa fecha.`
                  }
                </p>
              </div>
              <Link href="/admin/exportar-jce"
                className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap ${estilos.btn}`}>
                📋 Ir a Exportación JCE
              </Link>
            </div>
          )
        })()}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {TABS.map(({value,label,color,count}) => (
              <button key={value} onClick={() => { setTab(value); setSeleccionados(new Set()) }}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all border flex items-center gap-2 ${tab===value?'bg-[#0D3B8C] text-white border-[#0D3B8C] font-medium':'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                {label}
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${tab===value?'bg-white/20 text-white':`bg-gray-100 ${color}`}`}>{count}</span>
              </button>
            ))}
          </div>

          {/* Acción masiva */}
          {seleccionados.size>0 && (
            <div className="flex items-center gap-3 mb-4 bg-[#0D3B8C]/5 border border-[#0D3B8C]/20 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-[#0D3B8C]">{seleccionados.size} seleccionado(s)</span>
              <div className="flex gap-2 ml-auto">
                {tab!=='ACTIVO'   && <button onClick={() => aplicarAccionMasiva('ACTIVO')}   disabled={accionMasiva} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"><IcoCheck/>Aprobar todos</button>}
                {tab!=='INACTIVO' && <button onClick={() => aplicarAccionMasiva('INACTIVO')} disabled={accionMasiva} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-500 text-white text-xs font-medium hover:bg-gray-600 disabled:opacity-60"><IcoBan/>Rechazar todos</button>}
                {tab==='INACTIVO' && <button onClick={() => aplicarAccionMasiva('ACTIVO')}   disabled={accionMasiva} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"><IcoCheck/>Reactivar todos</button>}
                <button onClick={() => setSeleccionados(new Set())} className="h-8 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          )}

          {/* Barra de herramientas */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              className="flex-1 min-w-[180px] h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-800 outline-none focus:border-[#0D3B8C] transition-colors"/>
            <button onClick={() => setShowImport(true)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap">
              <IcoUpload/> Cargar XLS
            </button>
            <button onClick={exportar} disabled={exportando} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60 whitespace-nowrap">
              <IcoExport/>{exportando?'Exportando...':'CSV'}
            </button>
            <Link href="/admin/exportar-jce"
              className="h-9 px-3 rounded-lg border border-[#0D3B8C]/30 bg-[#0D3B8C]/5 text-[#0D3B8C] text-sm hover:bg-[#0D3B8C]/10 flex items-center gap-2 whitespace-nowrap font-medium">
              📋 Exportar JCE
            </Link>
            <button onClick={() => {
              const p = new URLSearchParams({ estado: 'TODOS', q: buscar })
              if (geo.provincia) p.set('provincia', geo.provincia)
              if (geo.municipio) p.set('municipio', geo.municipio)
              window.open(`/admin/reporte?${p}`, '_blank')
            }}
              className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap">
              <IcoPrint/>Imprimir
            </button>
            <Link href="/admin/verificaciones" className="h-9 px-3 rounded-lg border border-[#0D3B8C]/20 text-[#0D3B8C] text-sm font-medium flex items-center gap-2 hover:bg-blue-50 whitespace-nowrap"><IcoShield/> Verificaciones</Link>
            <Link href="/registro" className="h-9 px-4 rounded-lg bg-[#0D3B8C] text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90 whitespace-nowrap">+ Nuevo</Link>
          </div>

          {/* Filtros geográficos */}
          <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Filtrar por ubicación</p>
            <FiltroGeografico valores={geo} onChange={setGeo}/>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            {loading ? (
              <div className="text-center py-12">
                <svg className="animate-spin w-8 h-8 text-[#0D3B8C] mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm text-gray-400">Cargando...</p>
              </div>
            ) : militantes.length===0 ? (
              <p className="text-sm text-gray-400 text-center py-12">{tab==='PENDIENTE'?'No hay solicitudes pendientes':'No se encontraron registros'}</p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">{militantes.length} registro(s)</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2.5 px-3 w-8">
                        <input type="checkbox" checked={todosMarcados}
                          ref={el => { if(el) el.indeterminate=algunosMarcados }}
                          onChange={toggleTodos} className="rounded border-gray-300 text-[#0D3B8C] cursor-pointer"/>
                      </th>
                      {['Nombre','Cédula','Tipo','Provincia','Estado','Verificación','Registro','Acciones'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {militantes.map(m => {
                      const marcado = seleccionados.has(m.cedula)
                      return (
                        <tr key={m.id} className={`border-b border-gray-100 transition-colors ${marcado?'bg-blue-50/50':m.estado==='PENDIENTE'?'bg-amber-50/30 hover:bg-amber-50/50':'hover:bg-gray-50'}`}>
                          <td className="py-3 px-3">
                            <input type="checkbox" checked={marcado} onChange={() => toggleSeleccion(m.cedula)} className="rounded border-gray-300 text-[#0D3B8C] cursor-pointer"/>
                          </td>
                          <td className="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">{m.nombres} {m.apellidos}</td>
                          <td className="py-3 px-3 text-gray-500 font-mono text-xs">{m.cedula}</td>
                          <td className="py-3 px-3">
                            <span className="text-xs bg-[#0D3B8C]/10 text-[#0D3B8C] px-2 py-0.5 rounded-full whitespace-nowrap">
                              {m.tipoMilitancia || 'Simpatizante'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-700">{m.provincia}</td>
                          <td className="py-3 px-3"><Badge estado={m.estado}/></td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              <VerificationBadge militante={m}/>
                              {m.latestVerification?.sessionId && (
                                <Link href={`/admin/verificaciones/${m.latestVerification.sessionId}`} className="text-[11px] text-[#0D3B8C] hover:underline">Abrir detalle</Link>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs whitespace-nowrap">{fmtFecha(m.createdAt)}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setSeleccionado(m); setModoPanel('ver') }} title="Ver" className="p-1.5 rounded-lg text-gray-400 hover:text-[#0D3B8C] hover:bg-blue-50 transition-all"><IcoEye/></button>
                              <button onClick={() => { setSeleccionado(m); setModoPanel('editar') }} title="Editar" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all"><IcoEdit/></button>
                              <button onClick={() => window.open(getAfiliacionExpedienteHtmlHref(m.cedula), '_blank')} title="Expediente HTML" className="p-1.5 rounded-lg text-gray-400 hover:text-green-700 hover:bg-green-50 transition-all"><IcoExport/></button>
                              <button onClick={() => window.open(getAfiliacionExpedienteJsonHref(m.cedula), '_blank')} title="Expediente JSON" className="p-1.5 rounded-lg text-gray-400 hover:text-slate-700 hover:bg-slate-100 transition-all"><IcoPrint/></button>
                              {m.estado === 'ACTIVO' && (
                                <button onClick={() => window.open(`/carnet?cedula=${encodeURIComponent(m.cedula)}`, '_blank')}
                                  title="Imprimir carnet" className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all"><IcoCard/></button>
                              )}
                              {m.estado==='PENDIENTE' && <>
                                <button onClick={async () => { const r=await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'ACTIVO'})}); const j=await r.json(); if(r.ok&&j.success){show(`${m.nombres} aprobado`,'success');cargar()}else{show(j.error||'Error al aprobar','error')} }} title="Aprobar" className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"><IcoCheck/></button>
                                <button onClick={async () => { const r=await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'INACTIVO'})}); const j=await r.json(); if(r.ok&&j.success){show(`${m.nombres} rechazado`,'info');cargar()}else{show(j.error||'Error al rechazar','error')} }} title="Rechazar" className="p-1.5 rounded-lg text-gray-400 hover:text-[#C8001E] hover:bg-red-50 transition-all"><IcoBan/></button>
                              </>}
                              {m.estado==='ACTIVO' && <button onClick={async () => { const r=await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'INACTIVO'})}); const j=await r.json(); if(r.ok&&j.success){show(`${m.nombres} desactivado`,'info');cargar()}else{show(j.error||'Error','error')} }} title="Desactivar" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"><IcoBan/></button>}
                              {m.estado==='INACTIVO' && !(m as any).desafiliadoFormalmente && <button onClick={async () => { const r=await fetch(`/api/militantes/${encodeURIComponent(m.cedula)}`,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'ACTIVO'})}); const j=await r.json(); if(r.ok&&j.success){show(`${m.nombres} reactivado`,'success');cargar()}else{show(j.error||'Error','error')} }} title="Reactivar" className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"><IcoCheck/></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={remove}/>
    </>
  )
}
