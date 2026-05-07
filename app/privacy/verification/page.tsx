export default function VerificationPrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">Privacidad del módulo de verificación</h1>
        <p className="text-sm text-gray-600">
          Este módulo opera en modo mock seguro. Se capturan imágenes solo para el flujo de demostración y no se persisten imágenes biométricas crudas por defecto.
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>Se conserva el consentimiento, estados del flujo y metadatos técnicos mínimos.</li>
          <li>Se registran hashes y tamaños de archivo para auditoría, no el contenido crudo.</li>
          <li>Los casos inciertos pueden enviarse a revisión manual administrativa.</li>
          <li>Antes de producción real se requiere base legal, proveedor autorizado y controles criptográficos completos.</li>
        </ul>
      </div>
    </div>
  )
}
