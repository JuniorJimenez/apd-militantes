import { NextRequest, NextResponse } from 'next/server'
import { getPreRegistrationStatus } from '@/lib/verification/preregService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || ''
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 })
    }

    const session = getPreRegistrationStatus(sessionId)
    return NextResponse.json({ success: true, session })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
