export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { verificationService } from '@/lib/verification/factory'
import { VERIFICATION_ENABLED, VERIFICATION_PRIVACY_POLICY_URL } from '@/lib/verification/config'
import { getClientIP, sanitizeText } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'

export async function POST(request: NextRequest) {
  try {
    if (!VERIFICATION_ENABLED) {
      return NextResponse.json({ success: false, error: 'Verificación deshabilitada' }, { status: 503 })
    }

    const clientIP = getClientIP(request)
    const rl = rateLimit(`verification:consent:${clientIP}`, LIMITS.verificationStep)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await request.json()
    const sessionId = sanitizeText(body?.sessionId ?? '', 80)
    const privacyPolicyUrl = sanitizeText(body?.privacyPolicyUrl ?? VERIFICATION_PRIVACY_POLICY_URL, 240)

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    }

    await verificationService.recordConsent(
      sessionId,
      clientIP,
      request.headers.get('user-agent') || '',
      privacyPolicyUrl,
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
