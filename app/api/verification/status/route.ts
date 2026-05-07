import { NextRequest, NextResponse } from 'next/server'
import { verificationService } from '@/lib/verification/factory'
import { sanitizeText } from '@/lib/security/sanitize'

export async function GET(request: NextRequest) {
  try {
    const sessionId = sanitizeText(request.nextUrl.searchParams.get('sessionId') ?? '', 80)
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    }
    const status = await verificationService.getVerificationStatus(sessionId)
    return NextResponse.json({ success: true, ...status })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
