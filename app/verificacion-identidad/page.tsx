'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { VerificationWizard } from '@/components/verification/VerificationWizard'

function Content() {
  const params = useSearchParams()
  const militanteId = Number(params.get('militanteId') || 0)

  if (!Number.isInteger(militanteId) || militanteId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">No se pudo iniciar la verificación</h1>
          <p className="text-sm text-gray-600">Falta el identificador del militante. Vuelve al flujo de registro o entra desde el panel.</p>
          <Link href="/" className="inline-flex px-4 py-2 rounded-lg bg-[#0D3B8C] text-white">Ir al inicio</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Verificación de identidad</h1>
          <p className="text-sm text-gray-600">Flujo mock con consentimiento, captura facial, liveness simulado, cotejo mock, auditoría y revisión manual.</p>
        </div>
        <VerificationWizard militanteId={militanteId} />
      </div>
    </div>
  )
}

export default function VerificationIdentityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <Content />
    </Suspense>
  )
}
