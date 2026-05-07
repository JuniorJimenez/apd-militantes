import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, VERIFICATION_ENABLED } from '@/lib/verification/config'
import { getClientIP } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { requestPreRegistrationFaceMatch } from '@/lib/verification/preregService'

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:prereg:face-match:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const formData = await request.formData()
    const sessionId = String(formData.get('sessionId') || '')
    const liveImage = formData.get('liveImage') as File | null
    const referenceImage = formData.get('referenceImage') as File | null

    if (!sessionId) return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    if (!liveImage || !referenceImage) {
      return NextResponse.json({ success: false, error: 'Imágenes requeridas' }, { status: 400 })
    }

    for (const file of [liveImage, referenceImage]) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ success: false, error: 'Tipo de imagen no permitido' }, { status: 400 })
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ success: false, error: 'La imagen excede el tamaño máximo permitido' }, { status: 413 })
      }
    }

    const [liveBuffer, referenceBuffer] = await Promise.all([
      liveImage.arrayBuffer().then((b) => Buffer.from(b)),
      referenceImage.arrayBuffer().then((b) => Buffer.from(b)),
    ])

    const result = await requestPreRegistrationFaceMatch(
      sessionId,
      liveBuffer,
      referenceBuffer,
      {
        liveFileName: liveImage.name,
        liveMimeType: liveImage.type,
        referenceFileName: referenceImage.name,
        referenceMimeType: referenceImage.type,
      },
      clientIP,
      request.headers.get('user-agent') || '',
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
