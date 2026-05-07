'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

function Badge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    manual_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-800',
    liveness_failed: 'bg-orange-100 text-orange-800',
    liveness_passed: 'bg-blue-100 text-blue-800',
    face_match_pending: 'bg-indigo-100 text-indigo-800',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>{status}</span>
}

export default function AdminVerificationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [error, setError] = useState('')

  const sessionId = useMemo(() => String(params?.id || ''), [params])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/verificaciones/${sessionId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo cargar')
      setDetail(data.data)
      setNotes(data.data?.manualReview?.decisionNotes || '')
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionId) load()
  }, [sessionId])

  async function decide(decision: 'approved' | 'rejected') {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/verificaciones/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo guardar')
      router.push('/admin/verificaciones')
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">Cargando detalle...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!detail) return <div className="p-6">No encontrado</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/verificaciones" className="text-sm text-[#0D3B8C] hover:underline">← Volver a verificaciones</Link>
          <h1 className="text-2xl font-bold mt-2">Revisión de verificación</h1>
          <p className="text-gray-500 text-sm">Sesión {detail.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {detail.militante?.cedula && (
            <Link href={`/admin?cedula=${encodeURIComponent(detail.militante.cedula)}&tab=TODOS`} className="inline-flex items-center h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Ver militante</Link>
          )}
          <Badge status={detail.status} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-lg">Militante</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400">Nombre</p><p className="font-medium">{detail.militante?.nombres} {detail.militante?.apellidos}</p></div>
            <div><p className="text-gray-400">Cédula</p><p className="font-medium">{detail.militante?.cedula}</p></div>
            <div><p className="text-gray-400">Teléfono</p><p className="font-medium">{detail.militante?.telefono || '—'}</p></div>
            <div><p className="text-gray-400">Estado final</p><p className="font-medium">{detail.finalDecision || '—'}</p></div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-lg">Consentimiento y sesión</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400">Creada</p><p className="font-medium">{new Date(detail.createdAt).toLocaleString()}</p></div>
            <div><p className="text-gray-400">Completada</p><p className="font-medium">{detail.completedAt ? new Date(detail.completedAt).toLocaleString() : '—'}</p></div>
            <div><p className="text-gray-400">Consentimiento</p><p className="font-medium">{detail.consent ? 'Sí' : 'No'}</p></div>
            <div><p className="text-gray-400">Referencia</p><p className="font-medium">{detail.referenceProvided ? detail.referenceFileName || 'Sí' : 'No'}</p></div>
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-lg mb-4">Intentos</h2>
        <div className="space-y-3">
          {detail.attempts?.length ? detail.attempts.map((attempt: any) => (
            <div key={attempt.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{attempt.type}</div>
                <Badge status={attempt.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-gray-600">
                <p>Intento: {attempt.attemptNumber}</p>
                <p>Puntaje: {attempt.score ?? '—'}</p>
                <p>Fecha: {new Date(attempt.createdAt).toLocaleString()}</p>
                <p>Motivo: {attempt.errorReason || '—'}</p>
              </div>
            </div>
          )) : <p className="text-sm text-gray-500">No hay intentos registrados.</p>}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-lg mb-4">Evidencia almacenada</h2>
        <div className="space-y-2 text-sm">
          {detail.evidences?.length ? detail.evidences.map((evidence: any) => (
            <div key={evidence.id} className="border border-gray-100 rounded-lg p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              <p><span className="text-gray-400">Tipo:</span> {evidence.kind}</p>
              <p><span className="text-gray-400">Archivo:</span> {evidence.fileName || '—'}</p>
              <p><span className="text-gray-400">MIME:</span> {evidence.mimeType || '—'}</p>
              <p><span className="text-gray-400">Bytes:</span> {evidence.sizeBytes || '—'}</p>
              <p className="truncate"><span className="text-gray-400">SHA-256:</span> {evidence.sha256 || '—'}</p>
            </div>
          )) : <p className="text-sm text-gray-500">Solo se almacenan metadatos; no hay imágenes crudas persistidas.</p>}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="font-semibold text-lg">Decisión manual</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full min-h-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Observaciones de revisión manual"
        />
        <div className="flex gap-3">
          <button disabled={saving} onClick={() => decide('approved')} className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50">Aprobar</button>
          <button disabled={saving} onClick={() => decide('rejected')} className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50">Rechazar</button>
        </div>
      </section>
    </div>
  )
}
