// app/api/verification/prereg/liveness/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse }     from 'next/server'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, VERIFICATION_ENABLED } from '@/lib/verification/config'
import { getClientIP }                   from '@/lib/security/sanitize'
import { rateLimit, LIMITS }             from '@/lib/security/rateLimit'
import { sha256Hex }                     from '@/lib/verification/hash'
import { VERIFICATION_PRIVACY_POLICY_URL } from '@/lib/verification/config'
import {
  getPreRegSession, patchPreRegSession, appendPreRegAudit,
  findOpenPreRegSessionByCedula, createPreRegSession,
} from '@/lib/verification/preregStore'
// Importar DIRECTAMENTE el proveedor real — sin pasar por factory
import { RealLivenessProvider }          from '@/modules/verification/infrastructure/providers/RealLivenessProvider'

const livenessProvider = new RealLivenessProvider()

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:prereg:liveness:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const fd        = await request.formData()
    const sessionId = String(fd.get('sessionId') || '')
    const image     = fd.get('image')  as File | null
    const file1     = fd.get('frame1') as File | null
    const file2     = fd.get('frame2') as File | null

    if (!sessionId) return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    if (!image)     return NextResponse.json({ success: false, error: 'Imagen requerida' }, { status: 400 })

    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de imagen no permitido (use JPEG, PNG o WebP)' }, { status: 400 })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Imagen excede el tamaño máximo de 5MB' }, { status: 413 })
    }

    const session = getPreRegSession(sessionId)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Sesión no encontrada o expirada' }, { status: 404 })
    }
    if (!session.consentGiven) {
      return NextResponse.json({ success: false, error: 'Debes aceptar el consentimiento antes de continuar' }, { status: 400 })
    }

    // Convertir imágenes a Buffer
    const buffer  = Buffer.from(await image.arrayBuffer())
    const frame1  = file1 && file1.size > 2000 ? Buffer.from(await file1.arrayBuffer()) : undefined
    const frame2  = file2 && file2.size > 2000 ? Buffer.from(await file2.arrayBuffer()) : undefined

    const clientScore = parseFloat(String(fd.get('clientScore') || '0')) || undefined
    const clientToken = String(fd.get('clientToken') || '')

    // Actualizar intento
    patchPreRegSession(sessionId, {
      status: 'liveness_in_progress',
      attempts: { ...session.attempts, liveness: session.attempts.liveness + 1 },
    })

    // ── Análisis REAL con RealLivenessProvider ────────────────────────────────
    const result = await livenessProvider.verifyLiveness(buffer, {
      challenge: 'blink_turn_smile',
      movementRequired: true,
      clientScore,
      clientToken,
      frame1,
      frame2,
    } as any)

    const nextStatus = result.success
      ? 'approved'
      : result.requiresManualReview ? 'manual_review' : 'liveness_failed'

    patchPreRegSession(sessionId, {
      status: nextStatus,
      livenessResult: result,
      completedAt: new Date().toISOString(),
      liveEvidence: {
        fileName:  image.name || 'liveness.jpg',
        mimeType:  image.type,
        sizeBytes: buffer.length,
        sha256:    sha256Hex(buffer),
        metadata:  {
          kind: 'live_capture', mode: 'real',
          score: result.score, framesReceived: [!!frame1, !!frame2],
        },
      },
    })

    appendPreRegAudit(sessionId, {
      action: 'prereg_liveness_processed',
      actor:  session.cedula,
      ipAddress: clientIP,
      userAgent: request.headers.get('user-agent') || '',
      details: {
        success: result.success, score: result.score ?? null,
        requiresManualReview: result.requiresManualReview ?? false,
        mode: 'real', hasFrame1: !!frame1, hasFrame2: !!frame2,
        metadata: result.metadata,
      },
    })

    return NextResponse.json({
      success:              result.success,
      approved:             result.success,
      status:               nextStatus,
      requiresManualReview: result.requiresManualReview ?? false,
      message:              result.message ?? null,
      error:                result.success ? undefined : (result.message ?? 'Verificación no superada'),
    })

  } catch (error: any) {
    console.error('[prereg/liveness]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
