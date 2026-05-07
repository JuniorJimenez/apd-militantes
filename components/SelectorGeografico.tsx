// components/SelectorGeografico.tsx
// Selector en cascada 6 niveles — División Territorial RD (ONE 2019)
// Provincia → Municipio → Distrito Municipal → Sección → Barrio/Paraje → Sub-barrio
// Los datos detallados se cargan dinámicamente desde /geo/{prov}.json

'use client'
import { useState, useEffect, useCallback } from 'react'
import { PROVINCIAS, getMunicipios, getProvByNombre, getMuniByNombre } from '@/lib/geografia'

// ─── Tipos de la jerarquía completa ──────────────────────────────────────────
interface SubBarrio  { codigo: string; nombre: string }
interface Barrio     { codigo: string; nombre: string; subbarrios: SubBarrio[] }
interface Seccion    { codigo: string; nombre: string; barrios: Barrio[] }
interface DistritoMun{ codigo: string; nombre: string; secciones: Seccion[] }
interface MuniDetalle{ codigo: string; nombre: string; distritos: DistritoMun[] }
interface ProvDetalle{ codigo: string; nombre: string; municipios: MuniDetalle[] }

// ─── Valores del formulario ───────────────────────────────────────────────────
export interface ValoresGeo {
  provincia:        string
  municipio:        string
  distritoMunicipal: string
  seccion:          string
  barrio:           string
  subbarrio:        string
}

export const VALORES_GEO_VACIO: ValoresGeo = {
  provincia:'', municipio:'', distritoMunicipal:'', seccion:'', barrio:'', subbarrio:''
}

// ─── Hook: carga datos de una provincia desde /geo/{codigo}.json ──────────────
function useProvDetalle(codigoProvincia: string) {
  const [detalle, setDetalle] = useState<ProvDetalle | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!codigoProvincia) { setDetalle(null); return }
    setLoading(true)
    fetch(`/geo/${codigoProvincia}.json`)
      .then(r => r.json())
      .then(d => setDetalle(d))
      .catch(() => setDetalle(null))
      .finally(() => setLoading(false))
  }, [codigoProvincia])

  return { detalle, loading }
}

// ─── Estilo base de selects ───────────────────────────────────────────────────
const SEL = `w-full h-10 border border-gray-200 rounded-lg px-3 text-sm
  text-gray-800 outline-none focus:border-[#0D3B8C] transition-colors bg-white
  disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`

// ─── Selector completo para el formulario de registro ─────────────────────────
interface SelectorProps {
  valores:    ValoresGeo
  onChange:   (v: ValoresGeo) => void
  required?:  boolean
  disabled?:  boolean
}

export default function SelectorGeografico({ valores, onChange, required=false, disabled=false }: SelectorProps) {
  const provObj = getProvByNombre(valores.provincia)
  const { detalle, loading } = useProvDetalle(provObj?.codigo ?? '')

  // Listas en cascada derivadas de `detalle`
  const muniDetalle    = detalle?.municipios.find(m => m.nombre === valores.municipio)
  const dmDetalle      = muniDetalle?.distritos.find(d => d.nombre === valores.distritoMunicipal)
  const secDetalle     = dmDetalle?.secciones.find(s => s.nombre === valores.seccion)
  const barrioDetalle  = secDetalle?.barrios.find(b => b.nombre === valores.barrio)

  const set = (campo: keyof ValoresGeo, val: string) => {
    // Al cambiar un nivel superior, resetear todos los niveles inferiores
    const orden: (keyof ValoresGeo)[] = ['provincia','municipio','distritoMunicipal','seccion','barrio','subbarrio']
    const idx = orden.indexOf(campo)
    const reset: Partial<ValoresGeo> = {}
    orden.slice(idx + 1).forEach(k => { reset[k] = '' })
    onChange({ ...valores, [campo]: val, ...reset })
  }

  const Label = ({ children, extra }: { children: React.ReactNode; extra?: string }) => (
    <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
      {children}{required && <span className="text-[#C8001E]">*</span>}
      {extra && <span className="text-xs text-gray-400 font-normal">{extra}</span>}
    </label>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {/* 1. Provincia */}
      <div className="flex flex-col gap-1.5">
        <Label>Provincia</Label>
        <select value={valores.provincia} onChange={e => set('provincia', e.target.value)}
          disabled={disabled} className={SEL}>
          <option value="">Seleccionar provincia...</option>
          {PROVINCIAS.map(p => <option key={p.codigo} value={p.nombre}>{p.nombre}</option>)}
        </select>
      </div>

      {/* 2. Municipio */}
      <div className="flex flex-col gap-1.5">
        <Label extra={loading ? '· cargando...' : ''}>Municipio</Label>
        <select value={valores.municipio} onChange={e => set('municipio', e.target.value)}
          disabled={disabled || !valores.provincia || loading} className={SEL}>
          <option value="">
            {!valores.provincia ? 'Primero selecciona la provincia' : loading ? 'Cargando...' : 'Seleccionar municipio...'}
          </option>
          {detalle?.municipios.map(m =>
            <option key={m.codigo} value={m.nombre}>{m.nombre}</option>
          )}
        </select>
      </div>

      {/* 3. Distrito Municipal */}
      <div className="flex flex-col gap-1.5">
        <Label>Distrito Municipal</Label>
        <select value={valores.distritoMunicipal} onChange={e => set('distritoMunicipal', e.target.value)}
          disabled={disabled || !valores.municipio} className={SEL}>
          <option value="">
            {!valores.municipio ? 'Primero selecciona el municipio' : 'Seleccionar distrito municipal...'}
          </option>
          {muniDetalle?.distritos.map(d =>
            <option key={d.codigo} value={d.nombre}>{d.nombre}</option>
          )}
        </select>
      </div>

      {/* 4. Sección */}
      <div className="flex flex-col gap-1.5">
        <Label>Sección</Label>
        <select value={valores.seccion} onChange={e => set('seccion', e.target.value)}
          disabled={disabled || !valores.distritoMunicipal} className={SEL}>
          <option value="">
            {!valores.distritoMunicipal ? 'Primero selecciona el distrito municipal' : 'Seleccionar sección...'}
          </option>
          {dmDetalle?.secciones.map(s =>
            <option key={s.codigo} value={s.nombre}>{s.nombre}</option>
          )}
        </select>
      </div>

      {/* 5. Barrio / Paraje */}
      <div className="flex flex-col gap-1.5">
        <Label>Barrio / Paraje</Label>
        <select value={valores.barrio} onChange={e => set('barrio', e.target.value)}
          disabled={disabled || !valores.seccion} className={SEL}>
          <option value="">
            {!valores.seccion ? 'Primero selecciona la sección' : 'Seleccionar barrio o paraje...'}
          </option>
          {secDetalle?.barrios.map(b =>
            <option key={b.codigo} value={b.nombre}>{b.nombre}</option>
          )}
        </select>
      </div>

      {/* 6. Sub-barrio */}
      {barrioDetalle && barrioDetalle.subbarrios.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Sub-barrio</Label>
          <select value={valores.subbarrio} onChange={e => set('subbarrio', e.target.value)}
            disabled={disabled} className={SEL}>
            <option value="">Seleccionar sub-barrio...</option>
            {barrioDetalle.subbarrios.map(s =>
              <option key={s.codigo} value={s.nombre}>{s.nombre}</option>
            )}
          </select>
        </div>
      )}


    </div>
  )
}

// ─── Filtro compacto para panel admin (horizontal) ───────────────────────────
interface FiltroProps {
  valores:  ValoresGeo
  onChange: (v: ValoresGeo) => void
}

export function FiltroGeografico({ valores, onChange }: FiltroProps) {
  const provObj = getProvByNombre(valores.provincia)
  const { detalle, loading } = useProvDetalle(provObj?.codigo ?? '')

  const muniDetalle = detalle?.municipios.find(m => m.nombre === valores.municipio)
  const dmDetalle   = muniDetalle?.distritos.find(d => d.nombre === valores.distritoMunicipal)
  const secDetalle  = dmDetalle?.secciones.find(s => s.nombre === valores.seccion)
  const barDetalle  = secDetalle?.barrios.find(b => b.nombre === valores.barrio)

  const set = (campo: keyof ValoresGeo, val: string) => {
    const orden: (keyof ValoresGeo)[] = ['provincia','municipio','distritoMunicipal','seccion','barrio','subbarrio']
    const idx = orden.indexOf(campo)
    const reset: Partial<ValoresGeo> = {}
    orden.slice(idx + 1).forEach(k => { reset[k] = '' })
    onChange({ ...valores, [campo]: val, ...reset })
  }

  const hasFiltro = Object.values(valores).some(Boolean)

  const FS = `h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-700
    outline-none focus:border-[#0D3B8C] transition-colors bg-white
    disabled:bg-gray-50 disabled:cursor-not-allowed min-w-[155px]`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">

        <select value={valores.provincia} onChange={e => set('provincia', e.target.value)} className={FS}>
          <option value="">Todas las provincias</option>
          {PROVINCIAS.map(p => <option key={p.codigo} value={p.nombre}>{p.nombre}</option>)}
        </select>

        <select value={valores.municipio} onChange={e => set('municipio', e.target.value)}
          disabled={!valores.provincia || loading} className={FS}>
          <option value="">{loading ? 'Cargando...' : 'Todos los municipios'}</option>
          {detalle?.municipios.map(m => <option key={m.codigo} value={m.nombre}>{m.nombre}</option>)}
        </select>

        {valores.municipio && (
          <select value={valores.distritoMunicipal} onChange={e => set('distritoMunicipal', e.target.value)}
            disabled={!valores.municipio} className={FS}>
            <option value="">Todos los D.M.</option>
            {muniDetalle?.distritos.map(d => <option key={d.codigo} value={d.nombre}>{d.nombre}</option>)}
          </select>
        )}

        {valores.distritoMunicipal && (
          <select value={valores.seccion} onChange={e => set('seccion', e.target.value)}
            disabled={!valores.distritoMunicipal} className={FS}>
            <option value="">Todas las secciones</option>
            {dmDetalle?.secciones.map(s => <option key={s.codigo} value={s.nombre}>{s.nombre}</option>)}
          </select>
        )}

        {valores.seccion && (
          <select value={valores.barrio} onChange={e => set('barrio', e.target.value)}
            disabled={!valores.seccion} className={FS}>
            <option value="">Todos los barrios</option>
            {secDetalle?.barrios.map(b => <option key={b.codigo} value={b.nombre}>{b.nombre}</option>)}
          </select>
        )}

        {valores.barrio && barDetalle && barDetalle.subbarrios.length > 0 && (
          <select value={valores.subbarrio} onChange={e => set('subbarrio', e.target.value)}
            disabled={!valores.barrio} className={FS}>
            <option value="">Todos los sub-barrios</option>
            {barDetalle.subbarrios.map(s => <option key={s.codigo} value={s.nombre}>{s.nombre}</option>)}
          </select>
        )}

        {hasFiltro && (
          <button onClick={() => onChange(VALORES_GEO_VACIO)}
            className="h-9 px-3 text-xs text-gray-500 border border-gray-200 rounded-lg
                       hover:bg-gray-50 transition-colors whitespace-nowrap">
            Limpiar
          </button>
        )}
      </div>

      {/* Chips de filtros activos */}
      {hasFiltro && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-gray-400">Filtrando:</span>
          {Object.entries(valores).map(([k, v]) => v ? (
            <span key={k} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{v}</span>
          ) : null)}
        </div>
      )}
    </div>
  )
}
