export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { VERIFICATION_ENABLED } from '@/lib/verification/config'
import { getClientIP } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { recordPreRegistrationConsent } from '@/lib/verification/preregService'

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:prereg:consent:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await request.json()
    if (!body?.sessionId || typeof body.sessionId !== 'string') {
      return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    }

    await recordPreRegistrationConsent(body.sessionId, clientIP, request.headers.get('user-agent') || '')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
