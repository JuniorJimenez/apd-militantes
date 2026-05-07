'use client'
// app/admin/desafiliaciones/page.tsx
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Solicitud = {
  id: string; cedula: string; nombres: string | null; apellidos: string | null
  tipoSolicitud: string; fechaSolicitud: string; fechaRecepcion: string | null
  medioRecepcion: string | null; referenciaDocumento: string | null
  motivo: string | null; estado: string; observaciones: string | null
  createdAt: string; adjuntoNombre: string | null
}

const ESTADOS = ['TODOS','PENDIENTE','RECIBIDA','REMITIDA','CERRADA','RECHAZADA'] as const
const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-800',
  RECIBIDA:   'bg-blue-100 text-blue-800',
  REMITIDA:   'bg-purple-100 text-purple-800',
  CERRADA:    'bg-green-100 text-green-800',
  RECHAZADA:  'bg-red-100 text-red-800',
}

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—'
  const s = String(d).slice(0,10); const [y,m,dd] = s.split('-')
  return `${dd}/${m}/${y}`
}

export default function DesafiliacionesAdmin() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [stats,       setStats]       = useState<Record<string,number>>({})
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('PENDIENTE')
  const [q,           setQ]           = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ estado: tab, q })
    fetch(`/api/admin/desafiliaciones?${p}`)
      .then(r => r.json())
      .then(j => { if (j.success) { setSolicitudes(j.data.solicitudes); setStats(j.data.stats) } })
      .finally(() => setLoading(false))
  }, [tab, q])

  useEffect(() => { load() }, [load])

  const totalPorEstado = (e: string) => stats[e] ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#C8001E] px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white text-sm">← Panel admin</Link>
          <span className="text-white/40">|</span>
          <span className="text-white font-semibold text-sm">Gestión de Desafiliaciones</span>
        </div>
        <Link href="/admin" className="text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">
          Volver al padrón
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['PENDIENTE','RECIBIDA','REMITIDA','CERRADA','RECHAZADA'] as const).map(e => (
            <div key={e} className={`rounded-xl border p-3 text-center cursor-pointer transition-all ${
              tab === e ? 'ring-2 ring-[#C8001E] border-[#C8001E]/30' : 'border-gray-200 bg-white'
            }`} onClick={() => setTab(e)}>
              <p className="text-xl font-bold text-gray-800">{totalPorEstado(e)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{e.charAt(0) + e.slice(1).toLowerCase()}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por cédula o nombre..."
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8001E]"
          />
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map(e => (
              <button key={e} onClick={() => setTab(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === e ? 'bg-[#C8001E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {e === 'TODOS' ? 'Todos' : e.charAt(0) + e.slice(1).toLowerCase()}
                {e !== 'TODOS' && <span className="ml-1 opacity-70">({totalPorEstado(e)})</span>}
              </button>
            ))}
          </div>
          <button onClick={load} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200">
            🔄 Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C8001E] border-t-transparent"/>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">No hay solicitudes en este estado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cédula / Nombre</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Tipo solicitud</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitudes.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-500">{s.cedula}</p>
                      <p className="font-semibold text-gray-800">{s.apellidos}, {s.nombres}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs hidden sm:table-cell">
                      {s.tipoSolicitud?.replace(/_/g,' ')}
                      {s.adjuntoNombre && <span className="ml-1">📎</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {fmtFecha(s.fechaSolicitud)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[s.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/desafiliaciones/${s.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#C8001E] text-white hover:opacity-90 font-medium">
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          {solicitudes.length} solicitud(es) mostradas
        </p>
      </main>
    </div>
  )
}
