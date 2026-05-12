export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
    const rl = rateLimit(`verification:start:${clientIP}`, LIMITS.verificationStart)
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await request.json()
    const militanteId = Number(body?.militanteId)
    const referenceProvided = Boolean(body?.referenceProvided)
    const referenceFileName = sanitizeText(body?.referenceFileName ?? '', 120) || null

    if (!Number.isInteger(militanteId) || militanteId <= 0) {
      return NextResponse.json({ success: false, error: 'militanteId inválido' }, { status: 400 })
    }

    const exists = await prisma.militante.findUnique({ where: { id: militanteId }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ success: false, error: 'Militante no encontrado' }, { status: 404 })
    }

    const sessionId = await verificationService.startVerification(
      militanteId,
      {
        referenceProvided,
        referenceFileName,
        privacyPolicyUrl: VERIFICATION_PRIVACY_POLICY_URL,
      },
      clientIP,
      request.headers.get('user-agent') || '',
    )

    return NextResponse.json({ success: true, sessionId })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
