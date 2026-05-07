'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ToastContainer, { useToast } from '@/components/Toast'
import { PreRegistrationVerificationCard } from '@/components/verification/PreRegistrationVerificationCard'

const INPUT =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0D3B8C] transition-colors'

type ConsultaData = {
  cedula: string
  valida: boolean
  inhabilitado: boolean
  jce: {
    nombre: string | null
    nombres: string | null
    apellido1: string | null
    apellido2: string | null
    errorConexion?: string
  }
  apd: {
    registrado: boolean
    estado?: string
    ocupacion?: string | null
    tipoMilitancia?: string | null
    fechaRegistro?: string
  }
  mensaje: string
}

function fmtCedula(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10, 11)}`
}

function EstadoConsultaBadge({
  afiliadoVerificado,
  consultaRealizada,
  consultando,
}: {
  afiliadoVerificado: boolean
  consultaRealizada: boolean
  consultando: boolean
}) {
  if (consultando) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-[#0D3B8C]">
        Consultando padrón...
      </span>
    )
  }

  if (!consultaRealizada) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        Esperando cédula válida
      </span>
    )
  }

  if (afiliadoVerificado) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        Afiliación APD confirmada
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
      No figura afiliado en APD
    </span>
  )
}

function DesafiliacionForm() {
  const searchParams = useSearchParams()
  const { toasts, show, remove } = useToast()

  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<File | null>(null)
  const [consulta, setConsulta] = useState<ConsultaData | null>(null)
  const [consultaRealizada, setConsultaRealizada] = useState(false)
  const [afiliadoVerificado, setAfiliadoVerificado] = useState(false)
  const [verificationGate, setVerificationGate] = useState<{ sessionId: string | null; approved: boolean }>({ sessionId: null, approved: false })
  const lastQueriedCedulaRef = useRef('')

  const [form, setForm] = useState({
    cedula: fmtCedula(searchParams.get('cedula') || ''),
    nombres: '',
    apellidos: '',
    tipoSolicitud: 'renuncia_escrita',
    fechaSolicitud: new Date().toISOString().slice(0, 10),
    medioRecepcion: 'deposito_directo',
    referenciaDocumento: '',
    motivo: '',
    detallePrueba: '',
    declaracionVeracidad: false,
  })

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const cedulaDigits = useMemo(() => form.cedula.replace(/\D/g, ''), [form.cedula])
  const canCheck = cedulaDigits.length === 11

  const canSubmit = useMemo(() => {
    return (
      afiliadoVerificado &&
      verificationGate.approved &&
      cedulaDigits.length === 11 &&
      form.tipoSolicitud &&
      form.fechaSolicitud &&
      form.motivo.trim().length > 0 &&
      form.declaracionVeracidad
    )
  }, [afiliadoVerificado, verificationGate.approved, cedulaDigits.length, form])

  const handleCedulaChange = (value: string) => {
    const formatted = fmtCedula(value)
    setForm((prev) => ({ ...prev, cedula: formatted }))
    setConsulta(null)
    setConsultaRealizada(false)
    setAfiliadoVerificado(false)
    setVerificationGate({ sessionId: null, approved: false })
    lastQueriedCedulaRef.current = ''
  }

  const handleConsultarAfiliacion = async (cedulaToCheck?: string) => {
    const cedulaValue = (cedulaToCheck || form.cedula).trim()
    const digits = cedulaValue.replace(/\D/g, '')

    if (digits.length !== 11) return
    if (checking) return

    setChecking(true)
    try {
      const res = await fetch(`/api/consulta?cedula=${encodeURIComponent(cedulaValue)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo consultar el padrón APD')
      }

      const data = json.data as ConsultaData
      setConsulta(data)
      setConsultaRealizada(true)
      lastQueriedCedulaRef.current = cedulaValue

      const nombres = data.jce.nombres || data.jce.nombre?.split(' ').slice(0, -1).join(' ') || ''
      const apellidos =
        [data.jce.apellido1, data.jce.apellido2].filter(Boolean).join(' ') ||
        data.jce.nombre?.split(' ').slice(-1).join(' ') ||
        ''

      setForm((prev) => ({
        ...prev,
        nombres: prev.nombres || nombres,
        apellidos: prev.apellidos || apellidos,
      }))

      if (data.apd.registrado) {
        setAfiliadoVerificado(true)
      } else {
        setAfiliadoVerificado(false)
        show('La cédula consultada no figura afiliada en el padrón APD.', 'warning')
      }
    } catch (error: any) {
      setConsulta(null)
      setConsultaRealizada(true)
      setAfiliadoVerificado(false)
      show(error?.message || 'Error al consultar el padrón APD', 'error')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!canCheck) return
    if (checking) return
    if (lastQueriedCedulaRef.current === form.cedula.trim()) return

    const timer = window.setTimeout(() => {
      void handleConsultarAfiliacion(form.cedula)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [canCheck, checking, form.cedula])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!afiliadoVerificado) {
      show('Primero debe verificarse automáticamente que la persona figure afiliada en el padrón APD.', 'warning')
      return
    }
    if (!canSubmit) {
      show('Completa los datos obligatorios del formulario de desafiliación', 'warning')
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([key, value]) => fd.append(key, String(value)))
      if (files) fd.append('adjunto', files)
      fd.append('afiliacionAPDValidada', 'true')
      if (consulta?.apd.estado)         fd.append('estadoActualAPD',       consulta.apd.estado)
      if (consulta?.apd.tipoMilitancia) fd.append('tipoMilitanciaActual',   consulta.apd.tipoMilitancia)
      if (verificationGate.sessionId)   fd.append('verificationSessionId', verificationGate.sessionId)

      const res = await fetch('/api/desafiliaciones', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo registrar la solicitud de desafiliación')
      }

      show('Solicitud de desafiliación registrada correctamente', 'success')
      setFiles(null)
      setConsulta(null)
      setConsultaRealizada(false)
      setAfiliadoVerificado(false)
      setVerificationGate({ sessionId: null, approved: false })
      lastQueriedCedulaRef.current = ''
      setForm({
        cedula: '',
        nombres: '',
        apellidos: '',
        tipoSolicitud: 'renuncia_escrita',
        fechaSolicitud: new Date().toISOString().slice(0, 10),
        medioRecepcion: 'deposito_directo',
        referenciaDocumento: '',
        motivo: '',
        detallePrueba: '',
        declaracionVeracidad: false,
      })
    } catch (error: any) {
      show(error?.message || 'Error al registrar la solicitud', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <section className="relative overflow-hidden bg-[#C8001E]">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4 py-10 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-white">Formulario de Desafiliación</h1>
          <p className="text-sm text-white/80">
            La cédula se valida automáticamente en el padrón APD después de ser introducida. Solo si figura
            afiliado/a, se habilita el resto del proceso.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          <p className="mb-1 font-semibold">Paso obligatorio previo</p>
          <ul className="list-inside list-disc space-y-1 text-red-700">
            <li>Introduce la cédula completa del militante.</li>
            <li>La consulta al padrón APD se hará automáticamente.</li>
            <li>Solo si figura afiliado/a, se habilita el resto del formulario de desafiliación.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#C8001E]">
                Validación automática en padrón APD
              </p>
              <EstadoConsultaBadge
                afiliadoVerificado={afiliadoVerificado}
                consultaRealizada={consultaRealizada}
                consultando={checking}
              />
            </div>

            <div>
              <label className="font-medium text-sm text-gray-600">Cédula *</label>
              <input
                className={INPUT}
                value={form.cedula}
                onChange={(e) => handleCedulaChange(e.target.value)}
                maxLength={13}
                placeholder="000-0000000-0"
              />
              <p className="mt-1 text-xs text-gray-400">
                Al completar una cédula válida, el sistema consultará automáticamente el padrón APD.
              </p>
            </div>

            {consulta && (
              <div
                className={[
                  'rounded-xl border p-4 text-sm',
                  afiliadoVerificado
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800',
                ].join(' ')}
              >
                <p className="font-semibold">
                  {afiliadoVerificado
                    ? 'Afiliación encontrada en APD'
                    : 'La persona no figura como afiliada en APD'}
                </p>
                <p className="mt-1">{consulta.mensaje}</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-current/75">Nombre</span>
                    <p className="font-medium">
                      {[consulta.jce.nombres, consulta.jce.apellido1, consulta.jce.apellido2]
                        .filter(Boolean)
                        .join(' ') || 'No disponible'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-current/75">Estado APD</span>
                    <p className="font-medium">{consulta.apd.estado || 'No registrado'}</p>
                  </div>
                  {consulta.apd.tipoMilitancia && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-current/75">Tipo de militancia</span>
                      <p className="font-medium">{consulta.apd.tipoMilitancia}</p>
                    </div>
                  )}
                  {consulta.apd.fechaRegistro && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-current/75">Fecha de registro</span>
                      <p className="font-medium">{consulta.apd.fechaRegistro.slice(0, 10)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Verificación de identidad (liveness) — requerida para desafiliarse ── */}
          {afiliadoVerificado && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Verificación de identidad requerida
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Para procesar tu solicitud de desafiliación debes completar la validación de vida.
                  Esto confirma que eres tú quien realiza el trámite.
                </p>
              </div>
              {verificationGate.approved ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <span>✓</span>
                  <span>Identidad verificada correctamente. Puedes continuar con el formulario.</span>
                </div>
              ) : (
                <PreRegistrationVerificationCard
                  cedula={form.cedula}
                  disabled={!afiliadoVerificado}
                  onApproved={({ sessionId }) =>
                    setVerificationGate({ sessionId, approved: true })
                  }
                  onCleared={() =>
                    setVerificationGate({ sessionId: null, approved: false })
                  }
                />
              )}
            </div>
          )}

          <fieldset disabled={!afiliadoVerificado || !verificationGate.approved || loading} className="space-y-4 disabled:opacity-60">
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
              <p className="border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-widest text-[#C8001E]">
                Datos del afiliado
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-medium text-sm text-gray-600">Nombres</label>
                  <input className={INPUT} value={form.nombres} onChange={(e) => update('nombres', e.target.value)} />
                </div>
                <div>
                  <label className="font-medium text-sm text-gray-600">Apellidos</label>
                  <input className={INPUT} value={form.apellidos} onChange={(e) => update('apellidos', e.target.value)} />
                </div>
                <div>
                  <label className="font-medium text-sm text-gray-600">Fecha de solicitud *</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.fechaSolicitud}
                    onChange={(e) => update('fechaSolicitud', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
              <p className="border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-widest text-[#C8001E]">
                Detalle de la desafiliación
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-medium text-sm text-gray-600">Tipo de solicitud *</label>
                  <select className={INPUT} value={form.tipoSolicitud} onChange={(e) => update('tipoSolicitud', e.target.value)}>
                    <option value="renuncia_escrita">Renuncia escrita</option>
                    <option value="deposito_directo_jce">Depósito directo ante JCE</option>
                    <option value="declaracion_publica">Declaración pública / medio probatorio</option>
                    <option value="multiplicidad_afiliacion">Aclaración por múltiple afiliación</option>
                    <option value="otro">Otro supuesto reglamentario</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-sm text-gray-600">Medio de recepción *</label>
                  <select className={INPUT} value={form.medioRecepcion} onChange={(e) => update('medioRecepcion', e.target.value)}>
                    <option value="deposito_directo">Depósito directo</option>
                    <option value="partido">Presentada al partido</option>
                    <option value="correo">Correo electrónico</option>
                    <option value="mensajeria">Mensajería</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-medium text-sm text-gray-600">Referencia del documento</label>
                <input
                  className={INPUT}
                  value={form.referenciaDocumento}
                  onChange={(e) => update('referenciaDocumento', e.target.value)}
                  placeholder="Número de carta, expediente o referencia interna"
                />
              </div>
              <div>
                <label className="font-medium text-sm text-gray-600">Motivo o descripción *</label>
                <textarea
                  className={`${INPUT} min-h-[96px] resize-y`}
                  value={form.motivo}
                  onChange={(e) => update('motivo', e.target.value)}
                  placeholder="Describe el hecho, la renuncia o la situación de la desafiliación"
                />
              </div>
              <div>
                <label className="font-medium text-sm text-gray-600">Detalle del medio de prueba</label>
                <textarea
                  className={`${INPUT} min-h-[80px] resize-y`}
                  value={form.detallePrueba}
                  onChange={(e) => update('detallePrueba', e.target.value)}
                  placeholder="Indica qué documento, imagen o evidencia acompaña la solicitud"
                />
              </div>
              <div>
                <label className="font-medium text-sm text-gray-600">Adjunto documental</label>
                <input
                  type="file"
                  className={INPUT}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setFiles(e.target.files?.[0] || null)}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Puedes adjuntar carta de renuncia, documento firmado o imagen probatoria.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.declaracionVeracidad}
                  onChange={(e) => update('declaracionVeracidad', e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Declaro que la información suministrada y los documentos adjuntos corresponden a mi solicitud
                  de desafiliación o al medio probatorio que acompaño.
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="h-10 rounded-lg bg-[#C8001E] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Registrar solicitud'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </main>

      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  )
}

export default function DesafiliacionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <DesafiliacionForm />
    </Suspense>
  )
}
