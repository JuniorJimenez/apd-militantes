import { NextRequest, NextResponse } from 'next/server'
import { verificationService } from '@/lib/verification/factory'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, VERIFICATION_ENABLED } from '@/lib/verification/config'
import { getClientIP, sanitizeText } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:face-match:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const formData = await request.formData()
    const liveImage = formData.get('liveImage') as File | null
    const referenceImage = formData.get('referenceImage') as File | null
    const sessionId = sanitizeText(formData.get('sessionId')?.toString() ?? '', 80)

    if (!liveImage || !referenceImage || !sessionId) {
      return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
    }

    const files = [liveImage, referenceImage]
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ success: false, error: 'Imagen > 5MB' }, { status: 400 })
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ success: false, error: 'Formato no válido' }, { status: 400 })
      }
    }

    const [liveBuffer, referenceBuffer] = await Promise.all([
      liveImage.arrayBuffer().then((b) => Buffer.from(b)),
      referenceImage.arrayBuffer().then((b) => Buffer.from(b)),
    ])

    const result = await verificationService.requestFaceMatch(
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
