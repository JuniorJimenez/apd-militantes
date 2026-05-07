'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConsentStep }          from './ConsentStep'
import { DocumentReferenceStep, type DocumentReferenceValue } from './DocumentReferenceStep'
import { LivenessCapture }      from './LivenessCapture'
import { ResultStep }           from './ResultStep'
import { usePreRegistrationVerificationFlow } from '@/hooks/usePreRegistrationVerificationFlow'

const FLOW_STEPS = [
  { key: 'consent',   label: 'Consentimiento' },
  { key: 'document',  label: 'Ficha y soporte' },
  { key: 'liveness',  label: 'Validación de vida' },
  { key: 'result',    label: 'Resultado' },
] as const

type FlowStep = 'intro' | 'consent' | 'document' | 'liveness' | 'result'

function FlowStepper({ currentStep }: { currentStep: FlowStep }) {
  const currentIndex = currentStep === 'intro'
    ? -1
    : FLOW_STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
        Progreso de la validación previa
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {FLOW_STEPS.map((step, index) => {
          const s = currentIndex > index ? 'complete'
            : currentIndex === index    ? 'current' : 'upcoming'
          return (
            <div key={step.key} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold border',
                  s === 'complete' ? 'bg-green-100 text-green-700 border-green-200' :
                  s === 'current'  ? 'bg-[#0D3B8C] text-white border-[#0D3B8C]' :
                                     'bg-gray-100 text-gray-500 border-gray-200',
                ].join(' ')}>
                  {s === 'complete' ? '✓' : index + 1}
                </span>
                <span className="text-xs font-medium text-gray-700">{step.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PreRegistrationVerificationCard({
  cedula,
  disabled,
  onApproved,
  onCleared,
}: {
  cedula:     string
  disabled?:  boolean
  onApproved: (payload: { sessionId: string; status: 'approved' }) => void
  onCleared?: () => void
}) {
  const [step,          setStep]         = useState<FlowStep>('intro')
  const [documentImage, setDocumentImage]= useState<DocumentReferenceValue | null>(null)
  const [localApproved, setLocalApproved]= useState(false)
  const [flowError,     setFlowError]    = useState<string | null>(null)
  const autoStartedRef  = useRef<string | null>(null)
  const lastCedulaRef   = useRef<string | null>(null)
  const onClearedRef    = useRef(onCleared)
  onClearedRef.current  = onCleared

  const { status, result, sessionId, start, consent, submitLiveness, reset, isLoading } =
    usePreRegistrationVerificationFlow(cedula)

  // Reset cuando cambia la cédula
  useEffect(() => {
    if (!cedula || cedula === lastCedulaRef.current) return
    lastCedulaRef.current   = cedula
    autoStartedRef.current  = null
    setStep('intro')
    setDocumentImage(null)
    setLocalApproved(false)
    setFlowError(null)
    reset()
    onClearedRef.current?.()
  }, [cedula, reset])

  // Arrancar automáticamente
  useEffect(() => {
    const digits = cedula.replace(/\D/g, '')
    if (digits.length < 11 || disabled || autoStartedRef.current === cedula) return
    autoStartedRef.current = cedula
    setStep('consent')
  }, [cedula, disabled])

  const handleConsentAccept = useCallback(async () => {
    setFlowError(null)
    try {
      const sid = await start({ referenceProvided: false })
      await consent(sid)
      setStep('document')
    } catch (err: any) {
      setFlowError(err?.message || 'Error al iniciar verificación')
    }
  }, [start, consent])

  const handleDocument = useCallback((value: DocumentReferenceValue) => {
    setDocumentImage(value)
    setStep('liveness')
  }, [])

  const handleLivenessComplete = useCallback(async (payload: import('@/components/verification/LivenessCapture').LivenessPayload) => {
    setFlowError(null)
    try {
      const res = await submitLiveness(payload, {
        referenceProvided: !!documentImage,
        referenceFileName: documentImage?.fileName ?? null,
      })

      setStep('result')

      if (res.approved && res.sessionId) {
        setLocalApproved(true)
        onApproved({ sessionId: res.sessionId, status: 'approved' })
      }
    } catch (err: any) {
      setFlowError(err?.message || 'Error durante la validación de vida')
      setStep('result')
    }
  }, [documentImage, submitLiveness, onApproved])

  const handleReset = useCallback(() => {
    setStep('consent')
    setDocumentImage(null)
    setLocalApproved(false)
    setFlowError(null)
    autoStartedRef.current = null
    reset()
    onClearedRef.current?.()
  }, [reset])

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 'intro') return null

  return (
    <div className="rounded-xl border border-[#0D3B8C]/20 bg-white p-4 space-y-4">
      <FlowStepper currentStep={step} />

      {flowError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {flowError}
          <button onClick={handleReset} className="ml-2 underline text-xs">Reintentar</button>
        </div>
      )}

      {step === 'consent' && (
        <ConsentStep onAccept={handleConsentAccept} isLoading={isLoading} />
      )}

      {step === 'document' && (
        <DocumentReferenceStep onContinue={handleDocument} isLoading={isLoading} />
      )}

      {step === 'liveness' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Validación de vida en tiempo real</p>
            <p className="text-xs">El sistema detectará tu rostro y te pedirá seguir instrucciones simples. La verificación ocurre en tu dispositivo — ninguna imagen se comparte con terceros.</p>
          </div>
          <LivenessCapture
            onComplete={handleLivenessComplete}
            onError={msg => setFlowError(msg)}
            isLoading={isLoading}
          />
        </div>
      )}

      {step === 'result' && (
        <ResultStep
          status={status}
          result={{ ...result, error: flowError }}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
