export const dynamic = 'force-dynamic';
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
    const rl = rateLimit(`verification:liveness:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const sessionId = sanitizeText(formData.get('sessionId')?.toString() ?? '', 80)
    if (!image || !sessionId) {
      return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Imagen > 5MB' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return NextResponse.json({ success: false, error: 'Formato no válido' }, { status: 400 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const result = await verificationService.submitLiveness(
      sessionId,
      buffer,
      { fileName: image.name, mimeType: image.type },
      clientIP,
      request.headers.get('user-agent') || '',
    )
    return NextResponse.json({ success: result.success, requiresManualReview: result.requiresManualReview, message: result.message })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
