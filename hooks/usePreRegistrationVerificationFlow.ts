import { useCallback, useRef, useState } from 'react'
import type { LivenessPayload } from '@/components/verification/LivenessCapture'

type StartOptions = {
  referenceProvided?: boolean
  referenceFileName?: string | null
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(',')
  if (!meta || !base64) throw new Error('Imagen inválida')
  const mime   = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], fileName, { type: mime })
}

async function parseJson(res: Response) {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} }
  catch { throw new Error(text || 'Respuesta inválida del servidor') }
}

export function usePreRegistrationVerificationFlow(cedula: string) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status,    setStatus]    = useState<string | null>(null)
  const [result,    setResult]    = useState<any>(null)

  const updateSid = useCallback((v: string | null) => {
    sessionIdRef.current = v; setSessionId(v)
  }, [])

  const start = useCallback(async (options?: StartOptions) => {
    setIsLoading(true)
    try {
      const res  = await fetch('/api/verification/prereg/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, ...options }),
      })
      const data = await parseJson(res)
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'No se pudo iniciar la verificación')
      updateSid(data.sessionId)
      return data.sessionId as string
    } finally { setIsLoading(false) }
  }, [cedula, updateSid])

  const consent = useCallback(async (sid: string) => {
    const res  = await fetch('/api/verification/prereg/consent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    })
    const data = await parseJson(res)
    if (!res.ok || !data.success) throw new Error(data.error || data.message || 'No se pudo registrar el consentimiento')
  }, [])

  const submitLiveness = useCallback(async (
    payload: LivenessPayload | string,
    options?: StartOptions,
  ) => {
    const isObj        = typeof payload === 'object'
    const imageDataUrl = isObj ? payload.imageDataUrl : payload
    const frame1Url    = isObj ? payload.frame1DataUrl : undefined
    const frame2Url    = isObj ? payload.frame2DataUrl : undefined
    const clientScore  = isObj ? payload.clientScore  : undefined
    const clientToken  = isObj ? payload.clientToken  : undefined
    const gestures     = isObj ? payload.gestures     : []

    let sid = sessionIdRef.current
    if (!sid) {
      sid = await start(options)
      await consent(sid)
    }

    setIsLoading(true)
    try {
      const fd = new FormData()
      fd.append('sessionId', sid)
      fd.append('image',     dataUrlToFile(imageDataUrl,  'liveness.jpg'))
      if (frame1Url) fd.append('frame1', dataUrlToFile(frame1Url, 'frame1.jpg'))
      if (frame2Url) fd.append('frame2', dataUrlToFile(frame2Url, 'frame2.jpg'))
      if (clientScore !== undefined) fd.append('clientScore', String(clientScore))
      if (clientToken)               fd.append('clientToken', clientToken)

      const res  = await fetch('/api/verification/prereg/liveness', { method: 'POST', body: fd })
      const data = await parseJson(res)

      // Error de servidor (5xx) → lanzar
      if (!res.ok) throw new Error(data.error || data.message || 'Error del servidor')

      // Liveness fallido → NO lanzar, retornar resultado para que la UI lo muestre
      const nextStatus = data.status || (
        data.approved            ? 'approved'       :
        data.requiresManualReview ? 'manual_review' : 'liveness_failed'
      )
      setStatus(nextStatus)
      setResult({
        approved:            !!data.approved,
        requiresManualReview: !!data.requiresManualReview,
        message:             data.message ?? data.error ?? null,
      })

      return {
        approved:            !!data.approved,
        requiresManualReview: !!data.requiresManualReview,
        sessionId:           sid,
        status:              nextStatus,
        message:             data.message ?? data.error,
      }
    } finally { setIsLoading(false) }
  }, [consent, start])

  const reset = useCallback(() => {
    updateSid(null); setStatus(null); setResult(null)
  }, [updateSid])

  return { sessionId, isLoading, status, result, start, consent, submitLiveness, reset }
}
