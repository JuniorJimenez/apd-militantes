import { Suspense } from 'react'
import AdminClient from './AdminClient'

function AdminFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div
        style={{
          height: '4px',
          background:
            'linear-gradient(to right,#0D3B8C 33%,#F5C400 33%,#F5C400 66%,#C8001E 66%)',
        }}
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-700">
            Cargando panel administrativo...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminClient />
    </Suspense>
  )
}