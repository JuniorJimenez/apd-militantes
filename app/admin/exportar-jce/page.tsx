// app/admin/exportar-jce/page.tsx
// Módulo de exportación JCE — Art. 4 y 18 Reglamento 2026
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Preview { total: number; muestra: string[][] }
interface Entrega { id: string; anio: number; fechaCorte: string; totalRegistros: number; estadoFiltro: string; notas: string | null; creadoEn: string }

function getPlazosJCE() {
  const hoy  = new Date()
  const anio = hoy.getFullYear()
  const esElectoral    = anio % 4 === 0
  const esPreelectoral = (anio % 4) === 3
  let fecha: Date, tipo: string
  if (esElectoral)    { fecha = new Date(anio, 10, 1); tipo = 'Año electoral' }
  else if (esPreelectoral) { fecha = new Date(anio, 3, 30); tipo = 'Año preelectoral' }
  else                { fecha = new Date(anio, 7, 1);  tipo = 'Año ordinario' }
  const dias = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000)
  return { fecha, tipo, dias, anio }
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function ExportarJCEPage() {
  const plazo = getPlazosJCE()

  const [preview,   setPreview]   = useState<Preview | null>(null)
  const [entregas,  setEntregas]  = useState<Entrega[]>([])
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [estado,    setEstado]    = useState('ACTIVO')
  const [notas,     setNotas]     = useState('')
  const [fechaCorte,setFechaCorte]= useState(new Date().toISOString().slice(0,10))
  const [msg,       setMsg]       = useState<{text:string; ok:boolean} | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [rPrev, rEnt] = await Promise.all([
        fetch(`/api/militantes/exportar-jce?estado=${estado}&formato=preview`, { credentials:'same-origin' }),
        fetch('/api/jce-entregas', { credentials:'same-origin' }),
      ])
      const jPrev = await rPrev.json()
      const jEnt  = await rEnt.json()
      if (jPrev.success) setPreview({ total: jPrev.total, muestra: jPrev.muestra })
      if (jEnt.success)  setEntregas(jEnt.data)
    } catch { /* silencio */ }
    finally { setLoading(false) }
  }, [estado])

  useEffect(() => { cargar() }, [cargar])

  const exportar = async () => {
    setExporting(true); setMsg(null)
    try {
      // 1. Generar CSV
      const res  = await fetch(`/api/militantes/exportar-jce?estado=${estado}`, { credentials:'same-origin' })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `padron-apd-jce-art18-${plazo.anio}-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)

      // 2. Registrar entrega
      await fetch('/api/jce-entregas', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: plazo.anio, fechaCorte, estadoFiltro: estado, totalRegistros: preview?.total ?? 0, notas }),
      })

      setMsg({ text: `Archivo generado y entrega registrada — ${preview?.total ?? 0} registros.`, ok: true })
      setNotas('')
      cargar()
    } catch {
      setMsg({ text: 'Error al generar el archivo. Intenta de nuevo.', ok: false })
    } finally { setExporting(false) }
  }

  // Nivel del plazo
  const nivelPlazo = plazo.dias < 0 ? 'vencido' : plazo.dias <= 15 ? 'urgente' : plazo.dias <= 45 ? 'proximo' : 'ok'
  const plazoBadge = {
    ok:      { cls:'bg-green-100 text-green-800',  txt:`${plazo.dias} días restantes` },
    proximo: { cls:'bg-blue-100 text-blue-800',    txt:`${plazo.dias} días restantes` },
    urgente: { cls:'bg-amber-100 text-amber-800',  txt:`⚠️ ${plazo.dias} días — URGENTE` },
    vencido: { cls:'bg-red-100 text-red-800',      txt:'🚨 PLAZO VENCIDO' },
  }[nivelPlazo]

  const fechaLabel = plazo.fecha.toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0D3B8C] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo-apd.png" alt="APD" width={36} height={36} className="object-contain"/>
          <div>
            <p className="text-white font-semibold text-sm">Exportación JCE — Art. 4 y 18</p>
            <p className="text-white/60 text-xs">Reglamento de Afiliaciones y Desafiliaciones 2026</p>
          </div>
        </div>
        <Link href="/admin" className="text-white/70 hover:text-white text-sm">← Panel admin</Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Plazo Art. 4 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Plazo de entrega JCE — Art. 4</p>
              <p className="text-xs text-gray-500 mt-0.5">{plazo.tipo} · Próximo vencimiento: <strong>{fechaLabel}</strong></p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${plazoBadge.cls}`}>
              {plazoBadge.txt}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
              <p className="font-semibold text-gray-800">Ordinario</p>
              <p>1 agosto</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
              <p className="font-semibold text-gray-800">Preelectoral</p>
              <p>30 abril</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
              <p className="font-semibold text-gray-800">Electoral</p>
              <p>1 noviembre</p>
            </div>
          </div>
        </div>

        {/* Base legal */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Art. 18 — Elementos del formato</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-blue-700">
            {[['a)','Nombre del Partido'],['b)','Nombre del/la Afiliado/a'],['c)','Cédula de Identidad y Electoral'],
              ['d)','Id Municipio'],['e)','Id Distrito Municipal'],['f)','Código de Circunscripción'],
              ['g)','Fecha de Afiliación'],['h)','Documentación Soporte']].map(([l,n]) => (
              <p key={l}><span className="font-bold text-blue-900">{l}</span> {n}</p>
            ))}
          </div>
        </div>

        {/* Parámetros */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-900">Parámetros de exportación</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Estado de militantes</label>
              <select value={estado} onChange={e => setEstado(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D3B8C]">
                <option value="ACTIVO">Solo ACTIVOS (recomendado JCE)</option>
                <option value="TODOS">Todos los estados</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha de corte del padrón</label>
              <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D3B8C]"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notas de la entrega (opcional)</label>
            <input value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ej: Entrega física en oficinas JCE, Av. 27 de Febrero..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0D3B8C]"/>
          </div>
        </div>

        {/* Vista previa */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0D3B8C] border-t-transparent mx-auto mb-2"/>
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        ) : preview && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Vista previa</p>
              <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                {preview.total.toLocaleString()} registros
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-[#0D3B8C]/5">
                  <tr>{['Partido','Nombre','Cédula','Id Mun.','Id DM','Circunsc.','Fecha afl.','Doc.'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-[#0D3B8C] font-semibold whitespace-nowrap border-b border-gray-100">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {preview.muestra.map((row, i) => (
                    <tr key={i} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate border-b border-gray-50" title={cell}>
                          {cell || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">Primeros 5 de {preview.total.toLocaleString()} registros.</p>
          </div>
        )}

        {/* Mensaje */}
        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {msg.ok ? '✓ ' : '✗ '}{msg.text}
          </div>
        )}

        {/* Botón */}
        <button onClick={exportar} disabled={exporting || loading || !preview?.total}
          className="w-full h-14 rounded-2xl bg-[#0D3B8C] text-white font-semibold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-3 shadow-lg">
          {exporting ? (
            <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"/>Generando y registrando entrega...</>
          ) : (
            <>📥 Descargar padrón JCE {plazo.anio} y registrar entrega</>
          )}
        </button>

        {/* Historial de entregas */}
        {entregas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-900">Historial de entregas registradas</p>
            <div className="space-y-2">
              {entregas.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      Padrón {e.anio} · {e.totalRegistros.toLocaleString()} registros · {e.estadoFiltro}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Fecha de corte: {new Date(e.fechaCorte).toLocaleDateString('es-DO')} · Generado: {fmtFecha(e.creadoEn)}
                    </p>
                    {e.notas && <p className="text-xs text-gray-400 mt-0.5 italic">{e.notas}</p>}
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">✓ Registrado</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          El registro de entregas queda en la base de datos del sistema como constancia interna. El archivo CSV debe entregarse físicamente o a través de la plataforma digital JCE.
        </p>
      </div>
    </div>
  )
}
