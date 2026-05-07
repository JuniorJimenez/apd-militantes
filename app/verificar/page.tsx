// app/verificar/page.tsx
// Página pública de verificación de militancia — se accede escaneando el QR del carnet
// Muestra solo datos básicos no sensibles

'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface VerifData {
  cedula: string; nombres: string; apellidos: string
  provincia: string; municipio: string
  tipoMilitancia: string; estado: string; fechaRegistro: string
}

function VerificarContent() {
  const params  = useSearchParams()
  const cedula  = params.get('cedula') ?? ''
  const [datos, setDatos]   = useState<VerifData | null>(null)
  const [estado, setEstado] = useState<'loading'|'ok'|'error'|'inactivo'>('loading')
  const [msg,   setMsg]     = useState('')

  useEffect(() => {
    if (!cedula) { setEstado('error'); setMsg('No se proporcionó una cédula'); return }
    fetch(`/api/carnet?cedula=${encodeURIComponent(cedula)}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) { setDatos(j.data); setEstado('ok') }
        else if (j.error?.includes('activo')) { setEstado('inactivo'); setMsg(j.error) }
        else { setEstado('error'); setMsg(j.error || 'No encontrado') }
      })
      .catch(() => { setEstado('error'); setMsg('Error de conexión') })
  }, [cedula])

  const colorTipo: Record<string,string> = {
    'Dirigente':'#C8001E','Militante orgánico':'#0D3B8C',
    'Militante activo':'#1a7f37','Militante':'#2d6a4f','Adherente':'#7b5ea7',
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-10 pb-16" style={{ background: "#f3f4f6" }}>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <Image src="/logo-apd.png" alt="APD" width={64} height={64} className="mx-auto mb-4 object-contain drop-shadow-xl"/>
          <h1 className="text-white text-xl font-bold">Verificación de Militancia</h1>
          <p className="text-white/70 text-sm mt-1">Alianza por la Democracia</p>
        </div>

        {/* Loading */}
        {estado === 'loading' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
            <svg className="animate-spin w-8 h-8 text-[#0D3B8C] mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-gray-500 text-sm">Verificando militancia...</p>
          </div>
        )}

        {/* Verificado OK */}
        {estado === 'ok' && datos && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Badge verificado */}
            <div className="bg-green-600 px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Militante verificado</p>
                <p className="text-white/80 text-xs">Registro activo y válido</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Nombre */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-[#0D3B8C] font-bold text-xl flex items-center justify-center mx-auto mb-2">
                  {`${datos.nombres?.[0]??''}${datos.apellidos?.[0]??''}`.toUpperCase()}
                </div>
                <p className="font-bold text-gray-900 text-lg leading-tight">{datos.nombres} {datos.apellidos}</p>
                <p className="text-gray-500 text-sm font-mono mt-0.5">{datos.cedula}</p>
              </div>

              {/* Tipo de militancia */}
              <div className="text-center">
                <span className="inline-block text-white text-sm font-bold px-4 py-1.5 rounded-full"
                  style={{ backgroundColor: colorTipo[datos.tipoMilitancia] ?? '#0D3B8C' }}>
                  {datos.tipoMilitancia}
                </span>
              </div>

              {/* Detalles */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">Provincia</p>
                  <p className="text-sm font-medium text-gray-800">{datos.provincia}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">Municipio</p>
                  <p className="text-sm font-medium text-gray-800">{datos.municipio}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">Estado</p>
                  <p className="text-sm font-bold text-green-700">{datos.estado}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">Miembro desde</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(datos.fechaRegistro).toLocaleDateString('es-DO', { year:'numeric', month:'short' })}
                  </p>
                </div>
              </div>

              <p className="text-center text-[11px] text-gray-400 pt-1">
                Verificación generada el {new Date().toLocaleDateString('es-DO')}
              </p>
            </div>
          </div>
        )}

        {/* Inactivo */}
        {estado === 'inactivo' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gray-500 px-5 py-3 flex items-center gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-white flex-shrink-0">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/>
              </svg>
              <p className="text-white font-bold text-sm">Militante no activo</p>
            </div>
            <div className="px-5 py-5 text-center">
              <p className="text-gray-600 text-sm">{msg}</p>
              <p className="text-gray-400 text-xs mt-2">Cédula: {cedula}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-[#C8001E] px-5 py-3 flex items-center gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-white flex-shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-white font-bold text-sm">No encontrado</p>
            </div>
            <div className="px-5 py-5 text-center">
              <p className="text-gray-600 text-sm">{msg}</p>
            </div>
          </div>
        )}

        {/* Link volver */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-white/70 hover:text-white text-sm underline">
            Ir a la consulta pública
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerificarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D3B8C] flex items-center justify-center"><p className="text-white">Cargando...</p></div>}>
      <VerificarContent/>
    </Suspense>
  )
}
