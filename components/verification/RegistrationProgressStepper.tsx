'use client'

type StepStatus = 'complete' | 'current' | 'upcoming'

type RegistrationProgressStepperProps = {
  jceReady: boolean
  livenessReady: boolean
  isSubmitting?: boolean
}

type StepItem = {
  key: string
  title: string
  description: string
  status: StepStatus
}

function StepBadge({ index, status }: { index: number; status: StepStatus }) {
  if (status === 'complete') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 border border-green-200">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }

  if (status === 'current') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D3B8C] text-white border border-[#0D3B8C] shadow-sm">
        {index + 1}
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      {index + 1}
    </span>
  )
}

export function RegistrationProgressStepper({ jceReady, livenessReady, isSubmitting = false }: RegistrationProgressStepperProps) {
  const steps: StepItem[] = [
    {
      key: 'jce',
      title: 'JCE y documento',
      description: 'Validar cédula y cargar la imagen de referencia.',
      status: jceReady ? 'complete' : 'current',
    },
    {
      key: 'liveness',
      title: 'Validación de vida',
      description: 'Consentimiento, captura facial y cotejo mock.',
      status: !jceReady ? 'upcoming' : livenessReady ? 'complete' : 'current',
    },
    {
      key: 'registro',
      title: 'Registro del militante',
      description: isSubmitting ? 'Guardando la solicitud en el sistema.' : 'Enviar la solicitud cuando los pasos previos estén aprobados.',
      status: !jceReady || !livenessReady ? 'upcoming' : isSubmitting ? 'current' : 'complete',
    },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Progreso del registro</p>
          <p className="mt-1 text-xs text-gray-500">Completa estos tres pasos en orden antes de enviar la solicitud.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-[#0D3B8C] border border-blue-100">
          Flujo previo obligatorio
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.key} className="relative rounded-xl border border-gray-200 p-4 bg-gray-50/50">
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-7 -right-3 w-6 h-px bg-gray-300" aria-hidden="true" />
            )}
            <div className="flex items-start gap-3">
              <StepBadge index={index} status={step.status} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <span className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    step.status === 'complete'
                      ? 'bg-green-100 text-green-700'
                      : step.status === 'current'
                      ? 'bg-[#0D3B8C]/10 text-[#0D3B8C]'
                      : 'bg-gray-200 text-gray-600',
                  ].join(' ')}>
                    {step.status === 'complete' ? 'Completo' : step.status === 'current' ? 'En curso' : 'Pendiente'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
