// app/bienvenida/page.tsx
// Página de bienvenida que aparece tras enviar el formulario de registro
// Muestra la filosofía institucional de la APD y el mensaje de bienvenida

'use client'
import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function BienvenidaContent() {
  const params  = useSearchParams()
  const nombre      = params.get('nombre') ?? 'compañero/a'
  const cedula      = params.get('cedula') ?? ''

  return (
    <div className="min-h-screen" style={{ background: "#f3f4f6" }}>

      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-6 px-4 text-center">
        <Image src="/logo-apd.png" alt="APD" width={280} height={280} className="object-contain drop-shadow-xl mb-4"/>
        <p className="text-blue/75 text-sm mt-1 tracking-widest uppercase">República Dominicana</p>
      </div>

      {/* Mensaje de bienvenida */}
      <div className="max-w-2xl mx-auto px-4 pb-12 space-y-5">

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-green-600 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-white">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">¡Solicitud enviada exitosamente!</p>
              <p className="text-white/80 text-sm">Tu registro quedó enviado con validación previa completada</p>
            </div>
          </div>
          <div className="px-5 py-5">
            <p className="text-gray-800 text-base leading-relaxed">
              Bienvenido/a, <strong>{nombre}</strong>. Tu solicitud de afiliación a la
              <strong> Alianza por la Democracia (APD)</strong> ha sido recibida correctamente.
              {cedula && <span className="text-gray-500 text-sm block mt-1">Cédula: {cedula}</span>}
            </p>
            <p className="text-gray-600 text-sm mt-3 leading-relaxed">
              Un miembro de nuestra organización revisará tu solicitud y te notificará cuando sea aprobada.
              La validación de vida y el cotejo previo quedaron completados antes del registro.
                        </p>
          </div>
        </div>

        {/* Filosofía institucional */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-[#0D3B8C] px-6 py-3">
            <p className="text-white font-semibold text-sm uppercase tracking-widest">Nuestra filosofía</p>
          </div>
          <div className="px-5 py-5 space-y-5">

            {/* Misión */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-[#0D3B8C] rounded-full"/>
                <h3 className="font-bold text-[#0D3B8C] text-sm uppercase tracking-wide">Misión</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed pl-3">
                Contribuir al fortalecimiento de la democracia dominicana mediante la participación activa
                de la ciudadanía en la vida política del país, promoviendo la justicia social, la libertad,
                el desarrollo sostenible y el bienestar de todos los dominicanos y dominicanas.
              </p>
            </div>

            {/* Visión */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-[#C8001E] rounded-full"/>
                <h3 className="font-bold text-[#C8001E] text-sm uppercase tracking-wide">Visión</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed pl-3">
                Ser una organización política moderna, incluyente y democrática, referente de la
                transformación social y política de la República Dominicana; reconocida por su
                compromiso con la ética, la transparencia y el servicio al pueblo.
              </p>
            </div>

            {/* Valores */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-[#F5C400] rounded-full"/>
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Valores institucionales</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3">
                {[
                  { icono: '🗳', valor: 'Democracia',       desc: 'Participación ciudadana activa'  },
                  { icono: '⚖',  valor: 'Justicia social',  desc: 'Equidad para todos'              },
                  { icono: '🤝',  valor: 'Solidaridad',      desc: 'Unidad y apoyo mutuo'            },
                  { icono: '✊',  valor: 'Libertad',         desc: 'Respeto a las libertades'        },
                  { icono: '🌿',  valor: 'Sostenibilidad',   desc: 'Desarrollo para el futuro'       },
                  { icono: '💡',  valor: 'Transparencia',    desc: 'Gestión honesta y abierta'       },
                  { icono: '🇩🇴', valor: 'Patriotismo',      desc: 'Amor a la nación dominicana'     },
                  { icono: '📚',  valor: 'Educación',        desc: 'Formación y conciencia política' },
                ].map(({ icono, valor, desc }) => (
                  <div key={valor} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <span className="text-lg flex-shrink-0">{icono}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{valor}</p>
                      <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Principios */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-gray-400 rounded-full"/>
                <h3 className="font-bold text-gray-600 text-sm uppercase tracking-wide">Principios</h3>
              </div>
              <ul className="space-y-1.5 pl-3">
                {[
                  'Defensa irrestricta de la Constitución y las leyes de la República.',
                  'Respeto a la voluntad popular expresada en procesos electorales libres y justos.',
                  'Compromiso con la participación de la mujer, la juventud y los sectores vulnerables.',
                  'Promoción de políticas públicas orientadas al bienestar social colectivo.',
                  'Rechazo a toda forma de corrupción, clientelismo e impunidad.',
                ].map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-[#0D3B8C] font-bold flex-shrink-0 mt-0.5">→</span>
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <div className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <strong>Validación previa:</strong> completada antes del alta del militante.
          </div>
          <Link href="/"
            className="w-full h-12 rounded-xl bg-[#0D3B8C] text-white font-semibold text-base
                       flex items-center justify-center hover:opacity-90 active:scale-95 transition-all">
            Volver a la consulta
          </Link>
          <Link href={`/?cedula=${encodeURIComponent(cedula)}`}
            className="w-full h-11 rounded-xl border-2 border-white/30 text-white font-medium text-sm
                       flex items-center justify-center hover:bg-white/10 transition-all">
            Verificar mi registro
          </Link>
        </div>

        {/* Barra tricolor */}
        <div className="h-1 rounded-full" style={{background:'linear-gradient(to right,#0D3B8C 33%,#F5C400 33%,#F5C400 66%,#C8001E 66%)'}}/>
      </div>
    </div>
  )
}

export default function BienvenidaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D3B8C]"/>}>
      <BienvenidaContent/>
    </Suspense>
  )
}
