import { NextRequest, NextResponse } from 'next/server'
import { verificationService } from '@/lib/verification/factory'
import { requireAdmin, validateOrigin } from '@/lib/security/authGuard'
import { getClientIP, sanitizeText } from '@/lib/security/sanitize'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAdmin(request)
  if (authError) return authError

  try {
    const detail = await verificationService.getVerificationDetail(params.id)
    return NextResponse.json({ success: true, data: detail })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAdmin(request)
  if (authError) return authError
  if (!validateOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Origen inválido' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const decision = body?.decision === 'approved' ? 'approved' : body?.decision === 'rejected' ? 'rejected' : null
    const notes = sanitizeText(body?.notes ?? '', 2000) || undefined
    if (!decision) {
      return NextResponse.json({ success: false, error: 'Decisión inválida' }, { status: 400 })
    }

    await verificationService.decideManualReview(
      params.id,
      decision,
      'admin',
      notes,
      getClientIP(request),
      request.headers.get('user-agent') || '',
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
