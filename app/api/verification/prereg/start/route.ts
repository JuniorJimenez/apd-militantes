import { NextRequest, NextResponse } from 'next/server'
import { VERIFICATION_ENABLED } from '@/lib/verification/config'
import { getClientIP, sanitizeText } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { startPreRegistrationVerification } from '@/lib/verification/preregService'

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:prereg:start:${clientIP}`, LIMITS.verificationStart)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await request.json()
    const cedula = sanitizeText(String(body?.cedula ?? ''), 13)
    const referenceProvided = Boolean(body?.referenceProvided)
    const referenceFileName = sanitizeText(body?.referenceFileName ?? '', 120) || null

    if (!/^\d{3}-?\d{7}-?\d{1}$/.test(cedula)) {
      return NextResponse.json({ success: false, error: 'Cédula inválida' }, { status: 400 })
    }

    const sessionId = await startPreRegistrationVerification(
      cedula,
      { referenceProvided, referenceFileName },
      clientIP,
      request.headers.get('user-agent') || '',
    )

    return NextResponse.json({ success: true, sessionId })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
