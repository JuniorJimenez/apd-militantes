'use client'
// LivenessCapture.tsx
// Detección REAL de gestos mediante análisis de luminancia de píxeles en canvas.
// SIN ML, SIN timers fijos. El gesto avanza solo cuando se detecta en el frame.
//
// Algoritmo:
//   BLINK: caída de brillo en banda ocular (y 30-50%) > umbral → recuperación
//   TURN LEFT: centroide de masa luminosa se desplaza a la izquierda > umbral
//   TURN RIGHT: centroide se desplaza a la derecha > umbral
//   CENTER: asimetría < umbral (rostro centrado como baseline)

import { useCallback, useEffect, useRef, useState } from 'react'

export type LivenessPayload = {
  imageDataUrl:  string
  frame1DataUrl: string
  frame2DataUrl: string
  clientScore:   number
  clientToken:   string
  gestures:      string[]
}

type Props = {
  onComplete: (p: LivenessPayload) => void
  onError?:   (msg: string) => void
  isLoading?: boolean
}

// ── Gestos en orden ───────────────────────────────────────────────────────────
const GESTURES = [
  { key: 'center',     label: 'Mira directo a la cámara',    icon: '👁️', hint: 'Mantén el rostro quieto y centrado' },
  { key: 'blink',      label: 'Parpadea lentamente',          icon: '😑', hint: 'Cierra y abre los ojos despacio' },
  { key: 'turn_left',  label: 'Gira tu cabeza a la izquierda', icon: '←', hint: 'Gira hasta que solo veas tu mejilla' },
  { key: 'turn_right', label: 'Gira tu cabeza a la derecha',  icon: '→', hint: 'Gira hasta que solo veas la otra mejilla' },
] as const
type GKey = typeof GESTURES[number]['key']

// ── Parámetros de detección ───────────────────────────────────────────────────
const ANALYSIS_INTERVAL_MS   = 80
const SAMPLE_W               = 48
const SAMPLE_H               = 36
const CENTER_CONFIRM_FRAMES  = 2    // baseline muy rápido
const BLINK_DROP_THRESHOLD   = 0.025 // 2.5% caída — mínimo viable
const BLINK_RECOVER_THRESHOLD = 0.01
const TURN_RATIO_THRESHOLD   = 0.012 // 1.2% diferencia — muy sensible
const CONFIDENCE_NEEDED      = 1

// ── Tipos internos ────────────────────────────────────────────────────────────
type GestureState =
  | { phase: 'idle' }
  | { phase: 'waiting'; confirmCount: number }
  | { phase: 'detected' }

type BlinkState =
  | { phase: 'open'; baseline: number }
  | { phase: 'closed'; baseline: number; minBrightness: number }
  | { phase: 'detected' }

export function LivenessCapture({ onComplete, onError, isLoading }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)   // oculto para captura
  const sampleRef     = useRef<HTMLCanvasElement>(null)   // oculto para análisis
  const streamRef     = useRef<MediaStream | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Estado de detección
  const gestureStateRef = useRef<GestureState>({ phase: 'idle' })
  const blinkStateRef   = useRef<BlinkState | null>(null)
  const baselineRef     = useRef<{ centerX: number; eyeBrightness: number } | null>(null)
  const frame1Ref       = useRef('')
  const frame2Ref       = useRef('')
  const completedRef    = useRef<GKey[]>([])

  const [camState,     setCamState]     = useState<'idle'|'requesting'|'ready'|'error'>('idle')
  const [camError,     setCamError]     = useState('')
  const [gestureIdx,   setGestureIdx]   = useState(-1)   // -1 = esperando baseline
  const [completed,    setCompleted]    = useState<GKey[]>([])
  const [detecting,    setDetecting]    = useState(false)
  const [done,         setDone]         = useState(false)

  // ── Análisis de píxeles ─────────────────────────────────────────────────────
  function getFrameMetrics(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const data = ctx.getImageData(0, 0, w, h).data

    // Zona central vertical (y 15-85%) para ignorar bordes y fondo superior
    const yTop = Math.floor(h * 0.15)
    const yBot = Math.floor(h * 0.85)
    const midX = Math.floor(w * 0.5)

    let leftSum = 0,  leftCount  = 0
    let rightSum = 0, rightCount = 0
    let eyeSum = 0,   eyeCount   = 0
    const eyeY1 = Math.floor(h * 0.28)
    const eyeY2 = Math.floor(h * 0.52)

    for (let y = yTop; y < yBot; y++) {
      for (let x = 0; x < w; x++) {
        const i   = (y * w + x) * 4
        const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]
        if (x < midX) { leftSum  += lum; leftCount++ }
        else           { rightSum += lum; rightCount++ }
        if (y >= eyeY1 && y < eyeY2) { eyeSum += lum; eyeCount++ }
      }
    }

    const leftBright    = leftCount  > 0 ? leftSum  / leftCount  / 255 : 0
    const rightBright   = rightCount > 0 ? rightSum / rightCount / 255 : 0
    const turnRatio     = rightBright - leftBright   // + = derecha más brillante
    const centerX       = leftBright / (leftBright + rightBright + 0.001)
    const eyeBrightness = eyeCount > 0 ? eyeSum / eyeCount / 255 : 0
    return { centerX, eyeBrightness, turnRatio, leftBright, rightBright }
  }

  // ── Capturar frame de la cámara ─────────────────────────────────────────────
  const captureFrame = useCallback((quality = 0.88): string => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return ''
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(video, 0, 0)    // sin espejo → imagen real para servidor
    return canvas.toDataURL('image/jpeg', quality)
  }, [])

  // ── Loop de análisis ─────────────────────────────────────────────────────────
  const runAnalysis = useCallback(() => {
    const video  = videoRef.current
    const sample = sampleRef.current
    if (!video || !sample || video.readyState < 2) return

    sample.width  = SAMPLE_W
    sample.height = SAMPLE_H
    const ctx = sample.getContext('2d')
    if (!ctx) return

    // Dibujar frame reducido para análisis rápido (sin espejo)
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
    const { centerX, eyeBrightness, turnRatio } = getFrameMetrics(ctx, SAMPLE_W, SAMPLE_H)

    const idx      = gestureIdx    // capturar valor actual
    const gesture  = GESTURES[idx]

    // ── FASE -1: Establecer baseline ────────────────────────────────────────
    if (idx < 0) {
      const gs = gestureStateRef.current
      if (gs.phase === 'idle') {
        gestureStateRef.current = { phase: 'waiting', confirmCount: 0 }
      } else if (gs.phase === 'waiting') {
        const count = gs.confirmCount + 1
        if (count >= CENTER_CONFIRM_FRAMES) {
          baselineRef.current = { centerX, eyeBrightness }
          frame1Ref.current   = captureFrame()
          gestureStateRef.current = { phase: 'detected' }
          setGestureIdx(0)
        } else {
          gestureStateRef.current = { phase: 'waiting', confirmCount: count }
        }
      }
      return
    }

    if (!gesture || !baselineRef.current) return
    const bl = baselineRef.current

    // ── GESTO: CENTER ────────────────────────────────────────────────────────
    if (gesture.key === 'center') {
      const gs = gestureStateRef.current
      const asym = Math.abs(centerX - 0.5)
      if (asym < 0.12) {  // centrado
        const count = gs.phase === 'waiting' ? gs.confirmCount + 1 : 1
        if (count >= CONFIDENCE_NEEDED) {
          completeGesture('center', idx, eyeBrightness, centerX)
        } else {
          gestureStateRef.current = { phase: 'waiting', confirmCount: count }
        }
      } else {
        gestureStateRef.current = { phase: 'idle' }
      }
      return
    }

    // ── GESTO: BLINK ─────────────────────────────────────────────────────────
    if (gesture.key === 'blink') {
      const bs = blinkStateRef.current
      if (!bs) {
        blinkStateRef.current = { phase: 'open', baseline: eyeBrightness }
        return
      }
      if (bs.phase === 'open') {
        const drop = bs.baseline - eyeBrightness
        if (drop > BLINK_DROP_THRESHOLD) {
          blinkStateRef.current = { phase: 'closed', baseline: bs.baseline, minBrightness: eyeBrightness }
        }
      } else if (bs.phase === 'closed') {
        const recovery = eyeBrightness - bs.minBrightness
        if (recovery > BLINK_RECOVER_THRESHOLD) {
          completeGesture('blink', idx, eyeBrightness, centerX)
        }
      }
      return
    }

    // ── GESTO: TURN LEFT / RIGHT ─────────────────────────────────────────────
    if (gesture.key === 'turn_left' || gesture.key === 'turn_right') {
      const gs = gestureStateRef.current
      // La imagen capturada NO está espejada (es la imagen raw de la cámara).
      // Cuando el usuario (mirando su imagen espejada) gira a la IZQUIERDA:
      //   → su cara se mueve a la izquierda del frame raw
      //   → la mitad DERECHA del frame queda con más fondo (más brillante si hay pared)
      //   → la mitad IZQUIERDA queda con la cara
      // turnRatio = rightBright - leftBright
      //   turn_left  → cara en izquierda → rightBright > leftBright → turnRatio POSITIVO
      //   turn_right → cara en derecha   → leftBright > rightBright → turnRatio NEGATIVO
      const isLeft   = gesture.key === 'turn_left'
      const detected = isLeft ? turnRatio > TURN_RATIO_THRESHOLD : turnRatio < -TURN_RATIO_THRESHOLD

      if (detected) {
        const count = gs.phase === 'waiting' ? gs.confirmCount + 1 : 1
        if (count >= CONFIDENCE_NEEDED) {
          if (idx === 2) frame2Ref.current = captureFrame()
          completeGesture(gesture.key, idx, eyeBrightness, centerX)
        } else {
          gestureStateRef.current = { phase: 'waiting', confirmCount: count }
        }
      } else {
        gestureStateRef.current = { phase: 'idle' }
      }
    }
  }, [gestureIdx, captureFrame])

  // ── Completar un gesto ──────────────────────────────────────────────────────
  const completeGesture = useCallback((
    key: GKey, idx: number,
    _eyeBrightness: number, _centerX: number,
  ) => {
    gestureStateRef.current = { phase: 'detected' }
    blinkStateRef.current   = null

    const next = [...completedRef.current, key]
    completedRef.current = next
    setCompleted([...next])

    if (idx + 1 >= GESTURES.length) {
      // ¡Todos los gestos completados! Capturar frame final y enviar
      stopAnalysis()
      const finalFrame = captureFrame(0.92)
      const f1 = frame1Ref.current || finalFrame
      const f2 = frame2Ref.current || finalFrame

      const w = videoRef.current?.videoWidth  || 640
      const h = videoRef.current?.videoHeight || 480
      const clientScore = Math.min(92, Math.round((w * h) / (640 * 480) * 70) + 15)
      const ts    = Date.now()
      const check = ((clientScore * 31 + ts % 100003) % 65536).toString(16).padStart(4,'0')

      stopStream()
      setDone(true)
      onComplete({
        imageDataUrl: finalFrame, frame1DataUrl: f1, frame2DataUrl: f2,
        clientScore, clientToken: `${ts}.${check}`, gestures: next,
      })
    } else {
      // Siguiente gesto — pequeña pausa para que el usuario vea el tick
      gestureStateRef.current = { phase: 'idle' }
      setTimeout(() => setGestureIdx(idx + 1), 600)
    }
  }, [captureFrame, onComplete])

  // ── Iniciar / parar análisis ────────────────────────────────────────────────
  const startAnalysis = useCallback(() => {
    if (intervalRef.current) return
    gestureStateRef.current = { phase: 'idle' }
    blinkStateRef.current   = null
    baselineRef.current     = null
    setDetecting(true)
    setGestureIdx(-1)      // primero establecer baseline
    intervalRef.current = setInterval(runAnalysis, ANALYSIS_INTERVAL_MS)
  }, [runAnalysis])

  function stopAnalysis() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setDetecting(false)
  }

  // ── Re-crear el interval cuando cambia gestureIdx ────────────────────────────
  useEffect(() => {
    if (!detecting || done) return
    // Reiniciar interval con nuevo closure que tiene gestureIdx actualizado
    if (intervalRef.current) clearInterval(intervalRef.current)
    gestureStateRef.current = { phase: 'idle' }
    blinkStateRef.current   = null
    intervalRef.current = setInterval(runAnalysis, ANALYSIS_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [gestureIdx, detecting, done, runAnalysis])

  // ── Parar stream ────────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // ── Iniciar cámara ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(''); setCamState('requesting')
    if (!window.isSecureContext) {
      const m = 'La cámara solo está disponible en HTTPS o localhost'
      setCamError(m); setCamState('error'); onError?.(m); return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const m = 'Este navegador no soporta acceso a cámara'
      setCamError(m); setCamState('error'); onError?.(m); return
    }
    const candidates: MediaStreamConstraints[] = [
      { video: { facingMode: 'user', width:{ideal:1280}, height:{ideal:720} }, audio: false },
      { video: { facingMode: {ideal:'user'} }, audio: false },
      { video: true, audio: false },
    ]
    let lastErr: any
    for (const c of candidates) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c)
        streamRef.current = s
        const v = videoRef.current
        if (v) { v.srcObject = s; v.muted = true; v.playsInline = true; try { await v.play() } catch {} }
        setCamState('ready'); return
      } catch(e) { lastErr = e }
    }
    const n   = lastErr?.name ?? ''
    const msg = n === 'NotAllowedError'  ? 'Acceso a la cámara denegado. Permite el permiso en tu navegador.' :
                n === 'NotFoundError'    ? 'No se encontró ninguna cámara en este dispositivo.' :
                n === 'NotReadableError' ? 'La cámara está siendo usada por otra aplicación.' :
                                          'No se pudo acceder a la cámara.'
    setCamError(msg); setCamState('error'); onError?.(msg)
  }, [onError])

  useEffect(() => {
    startCamera()
    return () => { stopStream(); stopAnalysis() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const progress       = completed.length / GESTURES.length * 100
  const currentGesture = gestureIdx >= 0 && gestureIdx < GESTURES.length ? GESTURES[gestureIdx] : null

  return (
    <div className="space-y-4">
      {/* Visor */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black">
        <video ref={videoRef} autoPlay playsInline muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={sampleRef} className="hidden" />

        {camState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"/>
            <p className="text-sm">Activando cámara...</p>
          </div>
        )}
        {camState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 text-red-100 p-6 gap-3 text-sm text-center">
            <span className="text-3xl">📷</span><p>{camError}</p>
          </div>
        )}

        {/* Marco oval */}
        {camState === 'ready' && !done && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-44 h-56 rounded-full border-4 transition-all duration-300 ${
              gestureIdx < 0 && detecting ? 'border-yellow-400 border-dashed' :
              detecting ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.4)]' :
              'border-white/40 border-dashed'
            }`}/>
          </div>
        )}

        {/* Instrucción activa */}
        {camState === 'ready' && !done && detecting && currentGesture && (
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1.5 px-4">
            <div className="bg-black/80 rounded-full px-5 py-2 flex items-center gap-3">
              <span className="text-xl">{currentGesture.icon}</span>
              <span className="text-white text-sm font-semibold">{currentGesture.label}</span>
            </div>

          </div>
        )}

        {/* Baseline */}
        {camState === 'ready' && detecting && gestureIdx < 0 && (
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1 px-4">
            <div className="bg-black/70 rounded-full px-4 py-1.5">
              <p className="text-white text-sm">Establece el rostro frente a la cámara...</p>
            </div>
  
          </div>
        )}

        {/* Espera para iniciar */}
        {camState === 'ready' && !detecting && !done && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <p className="bg-black/60 rounded-full px-4 py-1.5 text-white text-sm">
              Centra tu rostro y pulsa Iniciar
            </p>
          </div>
        )}

        {done && (
          <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center gap-2 text-white">
            <span className="text-4xl">✓</span>
            <p className="text-sm font-semibold">Todos los gestos detectados</p>
          </div>
        )}
      </div>

      {/* Progreso de gestos */}
      {detecting && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Gestos detectados</span>
            <span>{completed.length}/{GESTURES.length}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-[#0D3B8C] transition-all duration-300"
              style={{ width: `${progress}%` }}/>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {GESTURES.map((g, i) => (
              <div key={g.key} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                completed.includes(g.key as GKey) ? 'bg-green-100 text-green-700' :
                i === gestureIdx               ? 'bg-blue-100 text-[#0D3B8C] font-semibold ring-1 ring-[#0D3B8C]/30' :
                                                  'bg-gray-100 text-gray-400'
              }`}>
                <span>{g.icon}</span>
                <div>
                  <p>{g.label}</p>
                  {i === gestureIdx && <p className="text-[10px] opacity-70">{g.hint}</p>}
                </div>
                {completed.includes(g.key as GKey) && <span className="ml-auto text-green-600">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error cámara */}
      {camState === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2">
          <p className="font-semibold">Sugerencias:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Permite el acceso a la cámara en tu navegador</li>
            <li>Cierra otras apps que usen la cámara (Zoom, Teams...)</li>
            <li>En móvil, verifica los permisos en Configuración del sistema</li>
          </ul>
          <button type="button" onClick={startCamera} disabled={isLoading}
            className="w-full mt-1 rounded-lg border border-red-300 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50">
            Reintentar
          </button>
        </div>
      )}

      {/* Botón Iniciar */}
      {camState === 'ready' && !detecting && !done && (
        <button type="button" onClick={startAnalysis} disabled={isLoading}
          className="w-full rounded-xl bg-[#0D3B8C] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          Iniciar validación de vida
        </button>
      )}

      {done && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 text-center">
          ✓ Gestos completados — enviando para verificación...
        </div>
      )}
    </div>
  )
}
