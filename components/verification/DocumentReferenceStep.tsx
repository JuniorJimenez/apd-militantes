'use client'

import { useMemo, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface DocumentReferenceValue {
  dataUrl: string
  fileName: string
  mimeType: string
}

export function DocumentReferenceStep({
  onContinue,
  isLoading,
}: {
  onContinue: (value: DocumentReferenceValue) => void
  isLoading?: boolean
}) {
  const [error, setError] = useState('')
  const [value, setValue] = useState<DocumentReferenceValue | null>(null)

  const helperText = useMemo(
    () => 'Sube una imagen clara del rostro del documento. Esta versión solo la usa en memoria para un cotejo mock y no persiste la imagen cruda.',
    [],
  )

  async function onFileChange(file?: File | null) {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('La imagen de referencia no puede exceder 5 MB.')
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WEBP.')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      reader.readAsDataURL(file)
    })
    setError('')
    setValue({ dataUrl, fileName: file.name, mimeType: file.type })
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <h3 className="font-semibold mb-1">Imagen de referencia del documento</h3>
        <p>{helperText}</p>
      </div>

      <label className="block border border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#0D3B8C] transition-colors">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-800">Seleccionar imagen</p>
          <p className="mt-1">JPG, PNG o WEBP. Máximo 5 MB.</p>
        </div>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {value && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.dataUrl} alt="Referencia del documento" className="w-full rounded-xl border border-gray-200" />
          <p className="text-xs text-gray-500">Archivo: {value.fileName}</p>
        </div>
      )}

      <button
        onClick={() => value && onContinue(value)}
        disabled={!value || isLoading}
        className="w-full py-3 bg-[#0D3B8C] text-white font-semibold rounded-lg hover:bg-blue-900 disabled:opacity-50"
      >
        {isLoading ? 'Procesando...' : 'Continuar con captura facial'}
      </button>
    </div>
  )
}
