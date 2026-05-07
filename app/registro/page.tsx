// app/registro/page.tsx — Formulario de registro con todas las mejoras
'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import ToastContainer, { useToast } from '@/components/Toast'
import SelectorGeografico, { ValoresGeo, VALORES_GEO_VACIO } from '@/components/SelectorGeografico'
import { PreRegistrationVerificationCard } from '@/components/verification/PreRegistrationVerificationCard'
import { RegistrationProgressStepper } from '@/components/verification/RegistrationProgressStepper'
import { PROVINCIAS } from '@/lib/geografia'
import { OCUPACIONES } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCedula(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 3)  return d
  if (d.length <= 10) return `${d.slice(0,3)}-${d.slice(3)}`
  return `${d.slice(0,3)}-${d.slice(3,10)}-${d.slice(10,11)}`
}
function fmtTelefono(v: string) {
  // Extraer solo dígitos, ignorar el +1 inicial si ya existe
  const raw = v.replace(/\D/g, '')
  // Si empieza con 1, quitarlo (es el código de país)
  const d = raw.startsWith('1') ? raw.slice(1) : raw
  const digits = d.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3)  return `+1(${digits}`
  if (digits.length <= 6)  return `+1(${digits.slice(0,3)})${digits.slice(3)}`
  return `+1(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`
}
function soloDigitosTel(v: string) { return v.replace(/\D/g, '').slice(0, 10) }
function cedulaDigitos(v: string) { return v.replace(/\D/g, '') }

// ─── Componentes menores ──────────────────────────────────────────────────────
function Sec({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-[#0D3B8C] uppercase tracking-widest border-b border-gray-200 pb-2 mb-5">{title}</p>
}
function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-600 font-medium">
        {label}{req && <span className="text-[#C8001E] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
const I = `w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
  text-gray-800 outline-none focus:border-[#0D3B8C] transition-colors
  disabled:bg-gray-50 disabled:text-gray-500`

// ─── Selector múltiple de ocupaciones ─────────────────────────────────────────
function SelectorOcupacion({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (occ: string) => {
    onChange(value.includes(occ) ? value.filter(v => v !== occ) : [...value, occ])
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-left
                    outline-none focus:border-[#0D3B8C] transition-colors flex items-center justify-between
                    ${value.length > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
        <span className="truncate">
          {value.length === 0 ? 'Seleccionar ocupación(es)...' :
           value.length === 1 ? value[0] : `${value.length} ocupaciones seleccionadas`}
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor"
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Chips de seleccionadas */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map(occ => (
            <span key={occ} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full">
              {occ}
              <button type="button" onClick={() => toggle(occ)} className="hover:text-blue-900 ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {OCUPACIONES.map(occ => (
            <button key={occ} type="button" onClick={() => toggle(occ)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors
                ${value.includes(occ) ? 'text-[#0D3B8C] font-medium' : 'text-gray-700'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                ${value.includes(occ) ? 'bg-[#0D3B8C] border-[#0D3B8C]' : 'border-gray-300'}`}>
                {value.includes(occ) && (
                  <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                    <path d="M1.5 5L4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              {occ}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Estado JCE ───────────────────────────────────────────────────────────────
type JCEEstado = 'idle' | 'buscando' | 'encontrado' | 'no_encontrado' | 'ya_registrado' | 'inhabilitado' | 'error'
interface JCEData {
  nombres: string; apellidos: string; fechaNac: string
  sexo: string; estadoCivil: string; provincia: string; municipio: string
  valida: boolean; inhabilitado: boolean; enAPD: boolean; estadoAPD: string | null
  errorConexion: string | null
}

// ─── Formulario ───────────────────────────────────────────────────────────────
interface Form {
  telefono: string; telefonoAlt: string; email: string
  direccion: string; motivo: string
}
const INIT_FORM: Form = { telefono:'', telefonoAlt:'', email:'', direccion:'', motivo:'' }

function RegistroForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const cedulaInicial = searchParams.get('cedula') ?? ''

  const [cedula,      setCedula]      = useState(cedulaInicial ? fmtCedula(cedulaInicial) : '')
  const [jceEstado,   setJceEstado]   = useState<JCEEstado>('idle')
  const [jceData,     setJceData]     = useState<JCEData | null>(null)
  const [form,        setForm]        = useState<Form>(INIT_FORM)
  const [ocupaciones, setOcupaciones] = useState<string[]>([])
  const [geo,         setGeo]         = useState<ValoresGeo>(VALORES_GEO_VACIO)
  const [loading,     setLoading]     = useState(false)
  const [verificationGate, setVerificationGate] = useState<{ sessionId: string | null; approved: boolean }>({ sessionId: null, approved: false })
  const [formLoadTime]                = useState(() => Date.now())
  const { toasts, show, remove }      = useToast()
  const debounceRef                   = useRef<NodeJS.Timeout>()

  const sf = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleTel = (k: 'telefono'|'telefonoAlt') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: fmtTelefono(e.target.value) }))

  // ── Consulta JCE ─────────────────────────────────────────────────────────
  const consultarJCE = useCallback(async (ced: string) => {
    const digitos = cedulaDigitos(ced)
    if (digitos.length < 11) return
    setJceEstado('buscando'); setJceData(null)
    try {
      const res  = await fetch(`/api/jce?cedula=${digitos}`)
      const json = await res.json()
      if (!json.success) { setJceEstado('error'); return }
      const d: JCEData = json.data
      if (!d.valida && !d.errorConexion) { setJceEstado('no_encontrado'); return }
      if (d.enAPD)                        { setJceEstado('ya_registrado'); setJceData(d); return }
      if (d.inhabilitado)                 { setJceEstado('inhabilitado');  setJceData(d); return }
      setJceData(d); setJceEstado('encontrado')
      // Auto-selección geográfica
      if (d.provincia) {
        const provObj = PROVINCIAS.find(p =>
          p.nombre.toLowerCase().includes(d.provincia.toLowerCase()) ||
          d.provincia.toLowerCase().includes(p.nombre.toLowerCase())
        )
        if (provObj) setGeo(prev => ({ ...prev, provincia: provObj.nombre, municipio:'', distritoMunicipal:'', seccion:'', barrio:'', subbarrio:'' }))
      }
    } catch { setJceEstado('error') }
  }, [])

  useEffect(() => {
    if (cedulaInicial && cedulaDigitos(cedulaInicial).length === 11) consultarJCE(cedulaInicial)
  }, [])

  useEffect(() => {
    const d = cedulaDigitos(cedula)
    if (d.length === 11) {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => consultarJCE(cedula), 400)
    } else { setJceEstado('idle'); setJceData(null) }
    return () => clearTimeout(debounceRef.current)
  }, [cedula, consultarJCE])

  // ── Envío ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cedulaDigitos(cedula).length < 11) { show('Ingresa una cédula válida', 'warning'); return }
    if (!form.telefono)                     { show('El teléfono es obligatorio', 'warning'); return }
    if (!geo.provincia || !geo.municipio)   { show('Selecciona provincia y municipio', 'warning'); return }
    if (jceEstado === 'ya_registrado')      { show('Esta cédula ya está registrada en APD', 'warning'); return }
    if (jceEstado === 'inhabilitado')       { show('Esta cédula aparece inhabilitada en JCE', 'warning'); return }
    if (!verificationGate.sessionId || !verificationGate.approved) {
      show('Debes completar la validación de vida antes de enviar la solicitud', 'warning')
      return
    }

    setLoading(true)
    try {
      const payload = {
        nombres:    jceData?.nombres   || '',
        apellidos:  jceData?.apellidos || '',
        cedula,
        fechaNac:   jceData?.fechaNac  || '',
        sexo:       jceData?.sexo      || '',
        estadoCivil:jceData?.estadoCivil || '',
        ...form,
        ocupacion:         ocupaciones.join(', '),
        provincia:         geo.provincia,
        municipio:         geo.municipio,
        distritoMunicipal: geo.distritoMunicipal || null,
        seccion:           geo.seccion           || null,
        sector:            geo.barrio            || null,
        subbarrio:         geo.subbarrio         || null,
        tipoMilitancia:    'Simpatizante',
        _t:      formLoadTime,
        website: '',
        verificationSessionId: verificationGate.sessionId,
      }
      const res  = await fetch('/api/militantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        const nombre = jceData?.nombres || 'compañero/a'
        const militanteId = json.data?.id ? `&militanteId=${encodeURIComponent(String(json.data.id))}` : ''
        router.push(`/bienvenida?nombre=${encodeURIComponent(nombre)}&cedula=${encodeURIComponent(cedula)}${militanteId}`)
      } else {
        show(json.error || 'Error al enviar', 'error')
      }
    } catch { show('Error de conexión.', 'error') }
    finally { setLoading(false) }
  }

  // ── Banner JCE ────────────────────────────────────────────────────────────
  const renderBannerJCE = () => {
    if (jceEstado === 'idle') return null
    if (jceEstado === 'buscando') return (
      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Verificando en el padrón electoral JCE...
      </div>
    )
    if (jceEstado === 'encontrado' && jceData) return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          Cédula verificada — datos pre-llenados automáticamente desde JCE
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-800">
          <span><strong>Nombre:</strong> {jceData.nombres} {jceData.apellidos}</span>
          <span><strong>Provincia JCE:</strong> {jceData.provincia}</span>
        </div>
      </div>
    )
    if (jceEstado === 'ya_registrado') return (
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
        <span>Esta cédula ya está registrada en APD con estado <strong>{jceData?.estadoAPD}</strong>.</span>
      </div>
    )
    if (jceEstado === 'inhabilitado') return (
      <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 text-sm text-orange-800">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
        </svg>
        Esta cédula aparece como <strong>inhabilitada</strong> en el padrón JCE.
      </div>
    )
    if (jceEstado === 'no_encontrado') return (
      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
        </svg>
        Cédula no encontrada en el padrón electoral JCE.
      </div>
    )
    return null
  }

  const puedeEnviar = jceEstado !== 'ya_registrado' && jceEstado !== 'inhabilitado' && cedulaDigitos(cedula).length === 11 && verificationGate.approved

  return (
    <>
      <Navbar/>
      <section className="bg-[#0D3B8C] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent"/>
        <div className="relative max-w-2xl mx-auto px-4 py-10 text-center">
          <Image src="/logo-apd.png" alt="APD" width={300} height={300} className="mx-auto mb-4 drop-shadow-xl object-contain"/>
          <h1 className="text-white text-2xl font-semibold mb-2">Formulario de Afiliación</h1>
          <p className="text-white/75 text-sm">Completa la ficha de afiliación, adjunta el soporte y confirma tu presencia humana antes de enviar la solicitud a la APD</p>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <RegistrationProgressStepper
          jceReady={jceEstado === 'encontrado'}
          livenessReady={verificationGate.approved}
          isSubmitting={loading}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot */}
          <div style={{position:'absolute',left:'-9999px',top:'-9999px',visibility:'hidden'}} aria-hidden="true">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue=""/>
          </div>

          {/* Cédula + verificación JCE */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <Sec title="Verificación de identidad"/>
            <F label="Cédula de identidad" req>
              <div className="relative">
                <input type="text" value={cedula}
                  onChange={e => setCedula(fmtCedula(e.target.value))}
                  placeholder="000-0000000-0" maxLength={13} inputMode="numeric" pattern="[0-9\-]*"
                  className={`${I} pr-10 ${
                    jceEstado==='encontrado'    ? 'border-green-400 bg-green-50/30' :
                    jceEstado==='no_encontrado' ? 'border-red-400' :
                    jceEstado==='ya_registrado' ? 'border-amber-400' :
                    jceEstado==='inhabilitado'  ? 'border-orange-400' : ''}`}/>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {jceEstado==='buscando' && <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {jceEstado==='encontrado' && <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>}
                  {['no_encontrado','ya_registrado','inhabilitado'].includes(jceEstado) && <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Al completar la cédula se verificará en JCE y tus datos se pre-llenarán automáticamente</p>
            </F>
            {renderBannerJCE()}

            <div className="pt-2">
              <PreRegistrationVerificationCard
                cedula={cedula}
                disabled={jceEstado !== 'encontrado'}
                onApproved={({ sessionId }) => setVerificationGate({ sessionId, approved: true })}
                onCleared={() => setVerificationGate({ sessionId: null, approved: false })}
              />
            </div>

            {/* Datos personales pre-llenados */}
            {jceEstado==='encontrado' && jceData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <F label="Nombres"><input className={`${I} bg-green-50/40`} value={jceData.nombres} readOnly/></F>
                <F label="Apellidos"><input className={`${I} bg-green-50/40`} value={jceData.apellidos} readOnly/></F>
                <F label="Fecha de nacimiento"><input className={`${I} bg-green-50/40`} value={jceData.fechaNac?jceData.fechaNac.slice(0,10):''} readOnly/></F>
                <F label="Sexo"><input className={`${I} bg-green-50/40`} value={jceData.sexo} readOnly/></F>
                <F label="Estado civil"><input className={`${I} bg-green-50/40`} value={jceData.estadoCivil} readOnly/></F>
              </div>
            )}
          </div>

          {/* Contacto — con máscara de teléfono */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <Sec title="Datos de contacto"/>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Teléfono celular" req>
                <input type="tel" className={I} value={form.telefono}
                  onChange={handleTel('telefono')} placeholder="+1(809)000-0000" maxLength={15}/>
              </F>
              <F label="Teléfono alternativo">
                <input type="tel" className={I} value={form.telefonoAlt}
                  onChange={handleTel('telefonoAlt')} placeholder="+1(809)000-0000" maxLength={15}/>
              </F>
              <div className="col-span-2">
                <F label="Correo electrónico">
                  <input type="email" className={I} value={form.email} onChange={sf('email')} placeholder="correo@ejemplo.com"/>
                </F>
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <Sec title="Ubicación geográfica"/>
            <SelectorGeografico valores={geo} onChange={setGeo} required/>
            <div className="mt-4">
              <F label="Dirección / Referencias">
                <input className={I} value={form.direccion} onChange={sf('direccion')} placeholder="Calle, número, referencias..."/>
              </F>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <Sec title="Datos de militancia"/>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                <strong>Nota:</strong> Este formulario funciona como ficha digital de afiliación. El tipo de militancia será asignado por el administrador una vez aprobada tu solicitud. Por defecto quedarás registrado/a como <strong>Simpatizante</strong>.
              </div>
              <F label="Ocupación / Profesión">
                <SelectorOcupacion value={ocupaciones} onChange={setOcupaciones}/>
              </F>
              <F label="Motivación o referencia de la afiliación">
                <textarea className={`${I} resize-y min-h-[80px]`} value={form.motivo} onChange={sf('motivo')}
                  placeholder="Cuéntenos sus motivaciones..."/>
              </F>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
              <button type="button"
                onClick={() => { setCedula(''); setForm(INIT_FORM); setGeo(VALORES_GEO_VACIO); setJceEstado('idle'); setJceData(null); setOcupaciones([]); setVerificationGate({ sessionId: null, approved: false }) }}
                className="h-10 px-5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
                Limpiar
              </button>
              <button type="submit" disabled={loading || !puedeEnviar}
                className="h-10 px-6 rounded-lg bg-[#0D3B8C] text-white font-medium text-sm
                           hover:opacity-90 active:scale-95 transition-all disabled:opacity-50
                           flex items-center gap-2">
                {!verificationGate.approved && !loading ? 'Complete la validación de vida para habilitar el envío' : loading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>Enviando...</>
                ) : 'Enviar solicitud de afiliación'}
              </button>
            </div>
          </div>
        </form>
      </main>
      <ToastContainer toasts={toasts} onRemove={remove}/>
    </>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"/>}>
      <RegistroForm/>
    </Suspense>
  )
}
