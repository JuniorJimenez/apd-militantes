'use client'

import { useState } from 'react'

export function ConsentStep({ onAccept, isLoading }: { onAccept: () => void; isLoading?: boolean }) {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-[#0D3B8C] mb-2">Consentimiento informado</h3>
        <p className="text-sm text-gray-600 mb-3">Este módulo de identidad está preparado para integración futura y actualmente usa validadores mock controlados.</p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Captura facial guiada desde la cámara</li>
          <li>Prueba de vida simulada mediante instrucciones de movimiento</li>
          <li>Cotejo mock contra una imagen de referencia del documento</li>
          <li>Bitácora, estados y revisión manual sin guardar biometría cruda por defecto</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">Antes de un uso productivo real se requiere base legal, proveedor autorizado, evaluación de seguridad y política formal de retención.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 text-[#0D3B8C] rounded"
        />
        <span className="text-sm text-gray-700">
          Acepto el tratamiento temporal y controlado de mis imágenes para esta verificación mock y entiendo que el resultado no constituye una validación biométrica productiva.
        </span>
      </label>

      <button
        onClick={onAccept}
        disabled={!accepted || isLoading}
        className="w-full py-3 bg-[#0D3B8C] text-white font-semibold rounded-lg hover:bg-blue-900 disabled:opacity-50"
      >
        {isLoading ? 'Procesando...' : 'Aceptar y continuar'}
      </button>
    </div>
  )
}
