import { useCallback, useRef, useState } from 'react'
import { VERIFICATION_PRIVACY_POLICY_URL } from '@/lib/verification/config'

type StartOptions = {
  referenceProvided?: boolean
  referenceFileName?: string | null
}

export function useVerificationFlow(militanteId: number) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const updateSessionId = useCallback((value: string | null) => {
    sessionIdRef.current = value
    setSessionId(value)
  }, [])

  const start = useCallback(async (options?: StartOptions) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/verification/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          militanteId,
          referenceProvided: options?.referenceProvided ?? false,
          referenceFileName: options?.referenceFileName ?? null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo iniciar la verificación')
      updateSessionId(data.sessionId)
      return data.sessionId as string
    } finally {
      setIsLoading(false)
    }
  }, [militanteId, updateSessionId])

  const consent = useCallback(async (sid: string) => {
    const res = await fetch('/api/verification/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, privacyPolicyUrl: VERIFICATION_PRIVACY_POLICY_URL }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'No se pudo registrar el consentimiento')
  }, [])

  const submitLiveness = useCallback(async (imageDataUrl: string, options?: StartOptions) => {
    let sid = sessionIdRef.current
    if (!sid) {
      sid = await start(options)
      await consent(sid)
    }

    setIsLoading(true)
    try {
      const blob = await fetch(imageDataUrl).then((r) => r.blob())
      const file = new File([blob], 'liveness-capture.jpg', { type: blob.type || 'image/jpeg' })
      const fd = new FormData()
      fd.append('image', file)
      fd.append('sessionId', sid)
      const res = await fetch('/api/verification/liveness', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo validar liveness')
      setStatus(data.success ? 'liveness_passed' : data.requiresManualReview ? 'manual_review' : 'liveness_failed')
      setResult({ message: data.message, requiresManualReview: data.requiresManualReview })
      return {
        success: !!data.success,
        requiresManualReview: !!data.requiresManualReview,
        message: data.message as string | undefined,
      }
    } finally {
      setIsLoading(false)
    }
  }, [consent, start])

  const requestFaceMatch = useCallback(async (liveImageDataUrl: string, referenceImageDataUrl: string) => {
    const sid = sessionIdRef.current
    if (!sid) throw new Error('No hay sesión activa')

    setIsLoading(true)
    try {
      const [liveBlob, referenceBlob] = await Promise.all([
        fetch(liveImageDataUrl).then((r) => r.blob()),
        fetch(referenceImageDataUrl).then((r) => r.blob()),
      ])
      const fd = new FormData()
      fd.append('liveImage', new File([liveBlob], 'live-capture.jpg', { type: liveBlob.type || 'image/jpeg' }))
      fd.append('referenceImage', new File([referenceBlob], 'document-reference.jpg', { type: referenceBlob.type || 'image/jpeg' }))
      fd.append('sessionId', sid)
      const res = await fetch('/api/verification/face-match', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No se pudo ejecutar el cotejo mock')
      const nextStatus = data.matched ? 'approved' : data.requiresManualReview ? 'manual_review' : 'rejected'
      setResult({
        matched: data.matched,
        requiresManualReview: data.requiresManualReview,
        confidence: data.confidence,
        message: data.message,
      })
      setStatus(nextStatus)
      return { matched: !!data.matched, requiresManualReview: !!data.requiresManualReview }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    updateSessionId(null)
    setStatus(null)
    setResult(null)
  }, [updateSessionId])

  return {
    sessionId,
    isLoading,
    status,
    result,
    submitLiveness,
    requestFaceMatch,
    reset,
  }
}
