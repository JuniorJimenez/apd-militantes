'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type CameraState = 'idle' | 'requesting' | 'ready' | 'error'

type VideoDevice = {
  deviceId: string
  label: string
}

type NormalizedCameraError = {
  message: string
  technical?: string
}

function normalizeCameraError(error: unknown): NormalizedCameraError {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : ''
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        message:
          'El navegador o el sistema rechazaron abrir la cámara. En teléfonos, verifica que el navegador tenga permiso de cámara y vuelve a tocar “Activar cámara”.',
        technical: `${name}${message ? `: ${message}` : ''}`,
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        message: 'No se encontró ninguna cámara disponible en este dispositivo.',
        technical: `${name}${message ? `: ${message}` : ''}`,
      }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        message:
          'La cámara existe, pero no pudo iniciarse. Cierra otras apps que la estén usando y vuelve a intentarlo.',
        technical: `${name}${message ? `: ${message}` : ''}`,
      }
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        message:
          'La configuración solicitada no fue compatible con la cámara. El sistema intentó varios perfiles y ninguno respondió correctamente.',
        technical: `${name}${message ? `: ${message}` : ''}`,
      }
    case 'SecurityError':
      return {
        message: 'La cámara solo puede usarse desde HTTPS o desde localhost.',
        technical: `${name}${message ? `: ${message}` : ''}`,
      }
    default:
      return {
        message: 'No se pudo acceder a la cámara.',
        technical: `${name || 'Error'}${message ? `: ${message}` : ''}`,
      }
  }
}

async function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('La cámara no entregó video a tiempo.'))
    }, 8000)

    const onLoaded = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('No se pudo inicializar el video de la cámara.'))
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('canplay', onLoaded)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('canplay', onLoaded)
    video.addEventListener('error', onError)
  })
}

async function listVideoDevices(): Promise<VideoDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Cámara ${index + 1}`,
    }))
}

function isProbablyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || navigator.maxTouchPoints > 1
}

export function CameraCapture({ onCapture, isLoading }: { onCapture: (dataUrl: string) => void; isLoading?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openInFlightRef = useRef(false)
  const mobileRef = useRef(isProbablyMobileDevice())

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [technicalError, setTechnicalError] = useState<string | null>(null)
  const [devices, setDevices] = useState<VideoDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [permissionState, setPermissionState] = useState<string>('unknown')

  const stopStream = useCallback(async () => {
    const stream = streamRef.current
    streamRef.current = null

    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {
        // no-op
      }
      videoRef.current.srcObject = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }
  }, [])

  const refreshDevices = useCallback(async () => {
    try {
      const nextDevices = await listVideoDevices()
      setDevices(nextDevices)
      setSelectedDeviceId((current) => {
        if (current && nextDevices.some((device) => device.deviceId === current)) return current
        return nextDevices[0]?.deviceId || ''
      })
    } catch {
      // no-op
    }
  }, [])

  const readPermissionState = useCallback(async () => {
    try {
      if (!('permissions' in navigator) || !navigator.permissions?.query) {
        setPermissionState('unknown')
        return
      }

      const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
      setPermissionState(result.state)
      result.onchange = () => setPermissionState(result.state)
    } catch {
      setPermissionState('unknown')
    }
  }, [])

  const attachStream = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current
    if (!video) throw new Error('Elemento de video no disponible.')

    streamRef.current = stream
    video.srcObject = stream
    video.muted = true
    video.autoplay = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    try {
      await video.play()
    } catch {
      // algunos móviles no permiten play() inmediato; waitForVideoReady capturará el estado real
    }

    await waitForVideoReady(video)
  }, [])

  const buildConstraints = useCallback((deviceId?: string): MediaStreamConstraints[] => {
    const isMobile = mobileRef.current
    const list: MediaStreamConstraints[] = []

    if (deviceId) {
      list.push({ video: { deviceId: { exact: deviceId } }, audio: false })
      list.push({ video: { deviceId: { ideal: deviceId } }, audio: false })
    }

    if (isMobile) {
      list.push(
        { video: { facingMode: { exact: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: true, audio: false },
      )
    } else {
      list.push(
        { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } }, audio: false },
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: true, audio: false },
      )
    }

    return list
  }, [])

  const requestCamera = useCallback(async (preferredDeviceId?: string) => {
    if (openInFlightRef.current) return
    openInFlightRef.current = true

    try {
      setError(null)
      setTechnicalError(null)
      setCameraState('requesting')

      if (typeof window === 'undefined' || !window.isSecureContext) {
        setCameraState('error')
        setError('La cámara solo puede usarse desde HTTPS o en localhost.')
        return
      }

      if (window.top !== window.self) {
        setCameraState('error')
        setError('La página está abierta dentro de un marco embebido. Abre el sitio directamente en el navegador.')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error')
        setError('Este navegador no soporta acceso a cámara.')
        return
      }

      await stopStream()
      await readPermissionState()

      const targetDeviceId = preferredDeviceId || selectedDeviceId
      const constraintsList = buildConstraints(targetDeviceId)

      let lastError: unknown = null
      for (const constraints of constraintsList) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          await attachStream(stream)
          await refreshDevices()
          await readPermissionState()
          setCameraState('ready')
          return
        } catch (err) {
          lastError = err
        }
      }

      const normalized = normalizeCameraError(lastError)
      setCameraState('error')
      setError(normalized.message)
      setTechnicalError(normalized.technical || null)
      await refreshDevices()
      await readPermissionState()
    } finally {
      openInFlightRef.current = false
    }
  }, [attachStream, buildConstraints, readPermissionState, refreshDevices, selectedDeviceId, stopStream])

  useEffect(() => {
    void refreshDevices()
    void readPermissionState()

    const mediaDevices = navigator.mediaDevices
    const onDeviceChange = () => {
      void refreshDevices()
    }

    mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    return () => {
      mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
      void stopStream()
    }
  }, [readPermissionState, refreshDevices, stopStream])

  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    onCapture(dataUrl)
  }, [onCapture])

  const switchCamera = useCallback(async () => {
    if (devices.length < 2) return
    const currentIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % devices.length : 0
    const nextDeviceId = devices[nextIndex]?.deviceId || ''
    setSelectedDeviceId(nextDeviceId)
    await requestCamera(nextDeviceId)
  }, [devices, requestCamera, selectedDeviceId])

  const availableDeviceOptions = useMemo(() => devices.filter((device) => !!device.deviceId), [devices])
  const canCapture = cameraState === 'ready' && !isLoading
  const isMobile = mobileRef.current

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black">
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 text-white text-sm px-6 text-center">
            Activando cámara...
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/80 text-red-100 text-sm px-6 text-center gap-3">
            <p>{error}</p>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <p className="text-xs text-gray-500 text-center">
        {isMobile
          ? 'En teléfonos, usa la cámara frontal, mantén el rostro completo dentro del encuadre y evita mover el equipo mientras abre la cámara.'
          : 'Usa buena iluminación, evita lentes oscuros y mantén el rostro completo dentro del encuadre.'}
      </p>

      {permissionState !== 'unknown' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
          <strong>Permiso detectado por el navegador:</strong> {permissionState}
        </div>
      )}

      {availableDeviceOptions.length > 1 && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Cámara detectada</label>
          <div className="flex gap-2">
            <select
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              {availableDeviceOptions.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={switchCamera}
              disabled={cameraState === 'requesting'}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700 space-y-2">
          <p><strong>Revisa esto:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Abre el sitio directamente en el navegador, no dentro de otra app o marco embebido.</li>
            <li>Si estás en móvil, confirma que el navegador tenga permiso de cámara en Android o iPhone.</li>
            <li>Cierra Zoom, Teams, Meet, WhatsApp Desktop, OBS o la app Cámara.</li>
            <li>Si tienes varias cámaras, intenta cambiar de cámara y vuelve a activar.</li>
            <li>En teléfonos, vuelve a pulsar <strong>Activar cámara</strong> después de conceder el permiso.</li>
          </ul>
          {technicalError && (
            <p className="break-words text-gray-500">
              <strong>Detalle técnico:</strong> {technicalError}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => requestCamera()}
          disabled={cameraState === 'requesting'}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50"
        >
          {cameraState === 'ready' ? 'Reiniciar cámara' : 'Activar cámara'}
        </button>

        <button
          type="button"
          onClick={capture}
          disabled={!canCapture}
          className="flex-1 py-3 bg-[#0D3B8C] text-white rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Procesando...' : 'Capturar rostro'}
        </button>
      </div>
    </div>
  )
}
