'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type SessionRow = {
  id: string
  status: string
  createdAt: string
  updatedAt?: string
  militante?: {
    id?: string | number
    nombres?: string
    apellidos?: string
    cedula?: string
    telefono?: string | null
  } | null
  manualReview?: {
    reviewer?: string | null
    reviewedAt?: string | null
  } | null
}

const STATUS_OPTIONS = [
  { value: 'manual_review', label: 'Revisión manual' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'liveness_failed', label: 'Liveness fallido' },
  { value: 'all', label: 'Todas' },
]

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    manual_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-800',
    liveness_failed: 'bg-orange-100 text-orange-800',
    face_match_failed: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    manual_review: 'Revisión manual',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    pending: 'Pendiente',
    liveness_failed: 'Liveness fallido',
    face_match_failed: 'Face match fallido',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

function MetricCard({ label, value, active, onClick }: { label: string; value: number; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${active ? 'border-[#0D3B8C] bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </button>
  )
}

export default function AdminVerificacionesPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('manual_review')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 })
  const [summary, setSummary] = useState<Record<string, number>>({})

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setQuery(search.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  async function fetchSessions() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: filter, page: String(page), limit: '20' })
      if (query) params.set('q', query)
      const res = await fetch(`/api/admin/verificaciones?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setSessions(data.data)
        setPagination(data.pagination || { page: 1, pages: 1, total: data.data?.length || 0, limit: 20 })
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [filter, page, query])

  const totalManualReview = summary.manual_review || 0
  const totalApproved = summary.approved || 0
  const totalRejected = summary.rejected || 0
  const totalPending = summary.pending || 0
  const totalLivenessFailed = summary.liveness_failed || 0
  const totalAll = useMemo(() => Object.values(summary).reduce((acc, value) => acc + value, 0), [summary])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verificaciones de identidad</h1>
          <p className="text-sm text-gray-500">Bandeja de revisión manual, filtros por estado y búsqueda directa por cédula o nombre.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50">Volver al panel</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Revisión manual" value={totalManualReview} active={filter === 'manual_review'} onClick={() => { setFilter('manual_review'); setPage(1) }} />
        <MetricCard label="Aprobadas" value={totalApproved} active={filter === 'approved'} onClick={() => { setFilter('approved'); setPage(1) }} />
        <MetricCard label="Rechazadas" value={totalRejected} active={filter === 'rejected'} onClick={() => { setFilter('rejected'); setPage(1) }} />
        <MetricCard label="Pendientes" value={totalPending} active={filter === 'pending'} onClick={() => { setFilter('pending'); setPage(1) }} />
        <MetricCard label="Liveness fallido" value={totalLivenessFailed} active={filter === 'liveness_failed'} onClick={() => { setFilter('liveness_failed'); setPage(1) }} />
        <MetricCard label="Todas" value={totalAll} active={filter === 'all'} onClick={() => { setFilter('all'); setPage(1) }} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_auto_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Buscar por cédula o nombre</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej. 047-0165670-6 o Juan Pérez"
              className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition focus:border-[#0D3B8C] focus:ring-2 focus:ring-[#0D3B8C]/10"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Estado</span>
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1) }}
              className="h-11 min-w-[220px] rounded-xl border border-gray-200 px-3 text-sm outline-none transition focus:border-[#0D3B8C] focus:ring-2 focus:ring-[#0D3B8C]/10"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setQuery('')
                setFilter('manual_review')
                setPage(1)
              }}
              className="h-11 rounded-xl border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded-full bg-gray-100 px-3 py-1">{pagination.total} resultado(s)</span>
          {query ? <span className="rounded-full bg-blue-50 px-3 py-1 text-[#0D3B8C]">Búsqueda: {query}</span> : null}
          <span className="rounded-full bg-gray-100 px-3 py-1">Página {pagination.page} de {Math.max(1, pagination.pages)}</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white py-12 text-center shadow">Cargando...</div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl bg-white py-12 text-center text-gray-500 shadow">No hay verificaciones que coincidan con los filtros actuales.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Militante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Cédula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actualizada</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Revisión</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link href={`/admin?cedula=${encodeURIComponent(session.militante?.cedula || '')}&tab=TODOS`} className="font-medium text-[#0D3B8C] hover:underline">{session.militante?.nombres} {session.militante?.apellidos}</Link>
                        {session.militante?.telefono ? <span className="text-xs text-gray-400">{session.militante.telefono}</span> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">{session.militante?.cedula}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(session.updatedAt || session.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4">{getStatusBadge(session.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{session.manualReview?.reviewedAt ? `Revisada ${new Date(session.manualReview.reviewedAt).toLocaleDateString()}` : 'Pendiente'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/verificaciones/${session.id}`} className="inline-flex items-center rounded-lg border border-[#0D3B8C]/20 px-3 py-2 text-sm font-medium text-[#0D3B8C] hover:bg-blue-50">Revisar</Link>
                        {session.militante?.cedula ? (
                          <Link href={`/admin?cedula=${encodeURIComponent(session.militante.cedula)}&tab=TODOS`} className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Expediente</Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">Mostrando {sessions.length} de {pagination.total} registro(s)</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
                className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
