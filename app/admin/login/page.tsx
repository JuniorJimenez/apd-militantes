// app/admin/login/page.tsx
'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const from         = searchParams.get('from') || '/admin'

  const [usuario,    setUsuario]    = useState('')
  const [contrasena, setContrasena] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [showPass,   setShowPass]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario || !contrasena) { setError('Completa todos los campos'); return }

    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuario, contrasena }),
      })
      const json = await res.json()

      if (json.success) {
        router.push(from)
        router.refresh()
      } else {
        setError(json.error || 'Credenciales incorrectas')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D3B8C] via-[#1a4fa8] to-[#e8edf5]
                    flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-white pt-6 pb-5 px-6 sm:px-8 text-center border-b border-gray-100">
            <Image
              src="/logo-apd.png"
              alt="APD"
              width={64}
              height={64}
              className="mx-auto mb-3 object-contain drop-shadow-md"
            />
            <h1 className="text-gray-900 text-xl font-bold">Panel de Administración</h1>
            <p className="text-gray-500 text-sm mt-1">Alianza por la Democracia</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-6 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200
                              rounded-xl px-4 py-3 text-sm text-red-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                {error}
              </div>
            )}

            {/* Usuario */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={e => { setUsuario(e.target.value); setError('') }}
                placeholder="Nombre de usuario"
                autoComplete="username"
                disabled={loading}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-4 text-base
                           text-gray-800 placeholder-gray-400 outline-none
                           focus:border-[#0D3B8C] transition-colors disabled:opacity-60"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={contrasena}
                  onChange={e => { setContrasena(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-4 pr-11 text-base
                             text-gray-800 placeholder-gray-400 outline-none
                             focus:border-[#0D3B8C] transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600 transition-colors p-1"
                >
                  {showPass ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || !usuario || !contrasena}
              className="w-full h-12 rounded-xl bg-[#0D3B8C] text-white font-semibold
                         text-base hover:bg-blue-900 active:scale-95 transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verificando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>

        </div>

        {/* Nota de seguridad */}
        <p className="text-center text-white/60 text-xs mt-6">
          Acceso restringido · Alianza por la Democracia
        </p>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D3B8C]" />}>
      <LoginForm />
    </Suspense>
  )
}
