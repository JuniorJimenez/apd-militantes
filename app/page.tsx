'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ToastContainer, { useToast } from '@/components/Toast'

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
    registrado:             boolean
    estado?:                string   // ACTIVO | PENDIENTE | INACTIVO
    ocupacion?:             string | null
    tipoMilitancia?:        string | null
    fechaRegistro?:         string
    desafiliadoFormalmente?: boolean
  }
  mensaje: string
}

function fmtCedula(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10, 11)}`
}

function StepBadge({
  done,
  current,
  title,
  subtitle,
}: {
  done?: boolean
  current?: boolean
  title: string
  subtitle: string
}) {
  const tone = done
    ? 'border-green-200 bg-green-50 text-green-700'
    : current
      ? 'border-[#0D3B8C]/20 bg-blue-50 text-[#0D3B8C]'
      : 'border-gray-200 bg-gray-50 text-gray-500'

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-sm">{subtitle}</p>
    </div>
  )
}

export default function HomePage() {
  const { toasts, show, remove } = useToast()
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState(false)
  const [consulta, setConsulta] = useState<ConsultaData | null>(null)

  const canSearch = useMemo(() => cedula.replace(/\D/g, '').length === 11, [cedula])

  const jceHabilitado       = !!consulta && consulta.valida && !consulta.inhabilitado
  // Afiliado = existe en APD, estado ACTIVO, y NO tiene desafiliación formal cerrada
  const apdActivo           = !!consulta?.apd?.registrado && consulta.apd.estado === 'ACTIVO'
  const desafiliadoFormal   = !!(consulta?.apd as any)?.desafiliadoFormalmente
  const apdAfiliado         = jceHabilitado && apdActivo && !desafiliadoFormal
  const apdPendiente        = !!consulta?.apd?.registrado && consulta.apd.estado === 'PENDIENTE'
  const apdInactivo         = !!consulta?.apd?.registrado && consulta.apd.estado === 'INACTIVO' && !desafiliadoFormal

  const handleConsultar = async () => {
    if (!canSearch) {
      show('Introduce una cédula válida para realizar la consulta', 'warning')
      return
    }

    setLoading(true)
    setConsulta(null)

    try {
      const res = await fetch(`/api/consulta?cedula=${encodeURIComponent(cedula)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo completar la consulta')
      }

      setConsulta(json.data as ConsultaData)
    } catch (error: any) {
      show(error?.message || 'Error al consultar la cédula', 'error')
    } finally {
      setLoading(false)
    }
  }

  const nombreCompleto = consulta
    ? [consulta.jce.nombres || consulta.jce.nombre, consulta.jce.apellido1, consulta.jce.apellido2]
        .filter(Boolean)
        .join(' ')
    : ''

  return (
    <>
      <Navbar />

      <section className="relative overflow-hidden bg-[#0D3B8C]">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <Image
              src="/logo-apd.png"
              alt="APD"
              width={180}
              height={180}
              className="h-36 w-auto object-contain"
              priority
            />
            <h1 className="text-3xl font-semibold text-white">Verifícate</h1>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D3B8C]">Módulo de consulta</p>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr,auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Cédula</label>
              <input
                value={cedula}
                onChange={(e) => {
                  setCedula(fmtCedula(e.target.value))
                  setConsulta(null)
                }}
                className={INPUT}
                maxLength={13}
                placeholder="000-0000000-0"
                inputMode="numeric"
                pattern="[0-9\-]*"
                autoComplete="off"
              />
            </div>
            <div className="md:pt-6">
              <button
                type="button"
                onClick={handleConsultar}
                disabled={!canSearch || loading}
                className="h-11 rounded-lg bg-[#C8001E] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <StepBadge
              current={!consulta}
              done={jceHabilitado}
              title="Paso 1 · JCE"
              subtitle={
                !consulta
                  ? 'Verificar habilitación en el padrón electoral.'
                  : jceHabilitado
                    ? 'La persona figura habilitada en el padrón electoral.'
                    : 'La persona no figura habilitada o presenta restricción en el padrón electoral.'
              }
            />
            <StepBadge
              current={!!consulta && jceHabilitado && !apdAfiliado}
              done={apdAfiliado}
              title="Paso 2 · APD"
              subtitle={
                !consulta
                  ? 'La afiliación APD se verifica después de confirmar la habilitación JCE.'
                  : !jceHabilitado
                    ? 'La validación APD queda detenida hasta que la JCE confirme habilitación.'
                    : apdAfiliado
                      ? 'La persona figura afiliada en el padrón APD.'
                      : 'La persona no figura afiliada en el padrón APD.'
              }
            />
          </div>
        </div>

        {consulta && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D3B8C]">Resultado de la consulta</p>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{nombreCompleto || 'Nombre no disponible'}</p>
                <p className="mt-1 text-sm text-gray-600">Cédula: {consulta.cedula}</p>
                <p className="mt-2 text-sm text-gray-700">{consulta.mensaje}</p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Habilitación JCE</p>
                  <p className={`mt-2 text-sm font-medium ${jceHabilitado ? 'text-green-700' : 'text-red-700'}`}>
                    {jceHabilitado ? 'Habilitado en padrón electoral' : 'No habilitado o restringido'}
                  </p>
                  {consulta.jce.errorConexion && (
                    <p className="mt-2 text-xs text-red-600">Detalle JCE: {consulta.jce.errorConexion}</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Afiliación APD</p>
                  {apdAfiliado && (
                    <>
                      <p className="mt-2 text-sm font-semibold text-green-700">✓ Figura afiliado/a en APD</p>
                      {consulta.apd.tipoMilitancia && <p className="mt-1 text-xs text-gray-600">Tipo: {consulta.apd.tipoMilitancia}</p>}
                      {/* Carta prominente dentro del panel APD cuando está activo */}
                      <a
                        href={`/carta/${encodeURIComponent(consulta.cedula)}?tipo=afiliacion`}
                        target="_blank" rel="noreferrer"
                        className="mt-3 flex items-center gap-2 rounded-lg border border-[#0D3B8C]/20 bg-blue-50 px-3 py-2 text-xs font-medium text-[#0D3B8C] hover:bg-blue-100"
                      >
                        📄 Descargar constancia de afiliación
                      </a>
                    </>
                  )}
                  {apdPendiente && (
                    <p className="mt-2 text-sm font-semibold text-amber-700">⏳ Solicitud pendiente de aprobación</p>
                  )}
                  {desafiliadoFormal && (
                    <>
                      <p className="mt-2 text-sm font-semibold text-[#C8001E]">✗ Desafiliado/a formalmente</p>
                      <p className="mt-1 text-xs text-gray-500">Esta persona procesó una solicitud de desafiliación. No figura actualmente como militante activo/a.</p>
                      <a
                        href={`/carta/${encodeURIComponent(consulta.cedula)}?tipo=desafiliacion`}
                        target="_blank" rel="noreferrer"
                        className="mt-3 flex items-center gap-2 rounded-lg border border-[#C8001E]/20 bg-red-50 px-3 py-2 text-xs font-medium text-[#C8001E] hover:bg-red-100"
                      >
                        📄 Constancia de desafiliación
                      </a>
                    </>
                  )}
                  {apdInactivo && (
                    <p className="mt-2 text-sm font-semibold text-gray-500">— Militante inactivo/a</p>
                  )}
                  {!consulta.apd.registrado && (
                    <p className="mt-2 text-sm font-medium text-amber-700">No figura en el padrón APD</p>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">Acciones disponibles</p>
                <div className="mt-4 space-y-2">
                  {/* Afiliación — solo si NO está activo en APD */}
                  {(!consulta.apd.registrado || apdInactivo) && (
                    <Link
                      href={`/registro?cedula=${encodeURIComponent(consulta.cedula)}`}
                      className={`block rounded-xl border px-4 py-3 text-sm ${
                        jceHabilitado
                          ? 'border-blue-200 bg-blue-50 text-[#0D3B8C] hover:bg-blue-100'
                          : 'border-gray-200 bg-gray-50 text-gray-400 pointer-events-none'
                      }`}
                    >
                      Continuar a afiliación
                    </Link>
                  )}

                  {/* Solicitud en trámite — informativa */}
                  {apdPendiente && (
                    <div className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Solicitud en proceso de aprobación
                    </div>
                  )}

                  {/* Desafiliación — solo si está ACTIVO */}
                  {apdAfiliado && (
                    <Link
                      href={`/desafiliacion?cedula=${encodeURIComponent(consulta.cedula)}`}
                      className="block rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C8001E] hover:bg-red-100"
                    >
                      Continuar a desafiliación
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm font-semibold text-amber-800">Orden de validación aplicado</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-700">
                  <li>Habilitación en padrón electoral JCE.</li>
                  <li>Afiliación en el padrón APD.</li>
                </ol>
              </div>
            </aside>
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  )
}
