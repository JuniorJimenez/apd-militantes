'use client'

import { useMemo, useState } from 'react'

type LivenessGuideProps = {
  onComplete: () => void
  isLoading?: boolean
}

const CHECKLIST = [
  'Rostro completo visible en el encuadre',
  'Buena iluminación frontal',
  'Sin lentes oscuros ni obstrucciones',
  'Documento de referencia ya cargado',
] as const

export function LivenessGuide({ onComplete, isLoading = false }: LivenessGuideProps) {
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({})

  const completed = useMemo(
    () => CHECKLIST.every((_, index) => confirmed[index]),
    [confirmed],
  )

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-12 w-12 border-b-2 border-[#0D3B8C] mx-auto" />
        <p className="mt-4 text-sm text-gray-600">Procesando verificación del expediente...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <p className="text-sm font-semibold text-[#0D3B8C]">Verificación humana del expediente</p>
        <p className="mt-2 text-sm text-gray-700">
          Esta pantalla deja constancia de control humano y revisión del encuadre antes de continuar.
          No realiza una comparación biométrica facial automática.
        </p>
      </div>

      <div className="space-y-3">
        {CHECKLIST.map((item, index) => (
          <label
            key={item}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={!!confirmed[index]}
              onChange={(e) =>
                setConfirmed((prev) => ({ ...prev, [index]: e.target.checked }))
              }
            />
            <span className="text-sm text-gray-700">{item}</span>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onComplete}
          disabled={!completed}
          className="h-10 rounded-lg bg-[#0D3B8C] px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
