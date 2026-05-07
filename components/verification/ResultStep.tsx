'use client'

export function ResultStep({
  status,
  result,
  onReset,
}: {
  status: string | null
  result?: any
  onReset: () => void
}) {
  const approved      = status === 'approved' || result?.approved === true
  const manual        = status === 'manual_review' || result?.requiresManualReview === true
  const livenessFailed = status === 'liveness_failed'
  const rejected      = status === 'rejected'

  // ── Aprobado — sin botón de cerrar, el wizard avanza automáticamente ─────
  if (approved) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="w-20 h-20 bg-green-100 rounded-full flex mx-auto items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-green-700">Presencia humana confirmada</h3>
        <p className="text-sm text-gray-600">
          La solicitud puede continuar con la evidencia documental y la bitácora digital del proceso.
        </p>
        {/* Sin botón — el formulario se habilita automáticamente */}
      </div>
    )
  }

  // ── Revisión manual — solo cerrar, no reiniciar ──────────────────────────
  if (manual) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex mx-auto items-center justify-center">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-yellow-700">Revisión manual requerida</h3>
        <p className="text-gray-600 text-sm">
          La evidencia fue enviada a la bandeja administrativa para comprobación y decisión humana.
        </p>
        {/* Sin reiniciar — ya fue registrado, no tiene sentido repetir */}
      </div>
    )
  }

  // ── Fallo de liveness — solo reiniciar, sin cerrar ───────────────────────
  if (livenessFailed || rejected) {
    const mensaje = result?.message || (
      livenessFailed
        ? 'No se pudo verificar tu presencia. Asegúrate de tener buena iluminación y el rostro visible en el óvalo.'
        : 'La validación fue rechazada. Puedes intentarlo de nuevo.'
    )
    return (
      <div className="text-center py-6 space-y-3">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex mx-auto items-center justify-center">
          <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-orange-700">Prueba de presencia no superada</h3>
        <p className="text-sm text-gray-600 max-w-xs mx-auto">{mensaje}</p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 text-left max-w-xs mx-auto space-y-1">
          <p className="font-semibold">Para mejorar el resultado:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Colócate frente a una fuente de luz (ventana, lámpara)</li>
            <li>Centra tu rostro dentro del óvalo</li>
            <li>Realiza los gestos claramente y sin prisa</li>
            <li>Evita fondos muy brillantes detrás tuyo</li>
          </ul>
        </div>

        {/* Solo Reiniciar — sin Cerrar */}
        <button
          onClick={onReset}
          className="mt-2 px-6 py-2.5 bg-[#0D3B8C] text-white rounded-xl text-sm font-semibold hover:opacity-90"
        >
          Reiniciar verificación
        </button>
      </div>
    )
  }

  return <div className="text-center py-6 text-sm text-gray-500">Procesando...</div>
}
