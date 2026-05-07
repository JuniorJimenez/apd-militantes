'use client'

import { useCallback, useState } from 'react'
import { ConsentStep } from './ConsentStep'
import { DocumentReferenceStep, type DocumentReferenceValue } from './DocumentReferenceStep'
import { CameraCapture } from './CameraCapture'
import { LivenessGuide } from './LivenessGuide'
import { ResultStep } from './ResultStep'
import { useVerificationFlow } from '@/hooks/useVerificationFlow'

export function VerificationWizard({
  militanteId,
  onComplete,
}: {
  militanteId: number
  onComplete?: (success: boolean) => void
}) {
  const [step, setStep] = useState<'consent' | 'document' | 'capture' | 'liveness' | 'result'>('consent')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [documentImage, setDocumentImage] = useState<DocumentReferenceValue | null>(null)
  const { status, result, submitLiveness, requestFaceMatch, reset, isLoading } = useVerificationFlow(militanteId)

  const handleConsentAccept = useCallback(() => setStep('document'), [])
  const handleDocument = useCallback((value: DocumentReferenceValue) => {
    setDocumentImage(value)
    setStep('capture')
  }, [])
  const handleCapture = useCallback((img: string) => {
    setCapturedImage(img)
    setStep('liveness')
  }, [])

  const handleLivenessComplete = useCallback(async () => {
    if (!capturedImage || !documentImage) return
    const liveness = await submitLiveness(capturedImage, {
      referenceProvided: true,
      referenceFileName: documentImage.fileName,
    })

    if (liveness.success) {
      const faceMatch = await requestFaceMatch(capturedImage, documentImage.dataUrl)
      setStep('result')
      onComplete?.(!!faceMatch.matched)
      return
    }

    setStep('result')
    onComplete?.(false)
  }, [capturedImage, documentImage, onComplete, requestFaceMatch, submitLiveness])

  const handleReset = useCallback(() => {
    reset()
    setCapturedImage(null)
    setDocumentImage(null)
    setStep('consent')
  }, [reset])

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-[#0D3B8C] px-6 py-4">
        <h2 className="text-white text-xl font-bold">Verificación de identidad</h2>
        <p className="text-blue-100 text-sm mt-1">Módulo mock seguro y desacoplado</p>
      </div>
      <div className="p-6">
        {step === 'consent' && <ConsentStep onAccept={handleConsentAccept} isLoading={isLoading} />}
        {step === 'document' && <DocumentReferenceStep onContinue={handleDocument} isLoading={isLoading} />}
        {step === 'capture' && <CameraCapture onCapture={handleCapture} isLoading={isLoading} />}
        {step === 'liveness' && <LivenessGuide onComplete={handleLivenessComplete} isLoading={isLoading} />}
        {step === 'result' && <ResultStep status={status} result={result} onReset={handleReset} />}
      </div>
    </div>
  )
}
