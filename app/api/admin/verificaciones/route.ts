import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

function buildStatusWhere(status: string) {
  if (status === 'all') return {}
  if (status === 'pending_review' || status === 'manual_review') return { status: 'manual_review' }
  if (status === 'approved') return { status: 'approved' }
  if (status === 'rejected') return { status: 'rejected' }
  if (status === 'pending') return { status: 'pending' }
  if (status === 'liveness_failed') return { status: 'liveness_failed' }
  if (status === 'face_match_failed') return { status: 'face_match_failed' }
  return { status: { in: ['manual_review', 'pending', 'liveness_failed'] } }
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError

  const db: any = prisma
  const status = request.nextUrl.searchParams.get('status') || 'manual_review'
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20))
  const skip = (page - 1) * limit

  try {
    const where: any = {
      ...buildStatusWhere(status),
    }

    if (q) {
      where.militante = {
        OR: [
          { cedula: { contains: q } },
          { nombres: { contains: q, mode: 'insensitive' } },
          { apellidos: { contains: q, mode: 'insensitive' } },
        ],
      }
    }

    const [sessions, total, summary] = await Promise.all([
      db.verificationSession.findMany({
        where,
        include: {
          militante: { select: { id: true, nombres: true, apellidos: true, cedula: true, telefono: true } },
          manualReview: true,
          attempts: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.verificationSession.count({ where }),
      db.verificationSession.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { status, q },
      summary: summary.reduce((acc: Record<string, number>, item: any) => {
        acc[item.status] = item._count._all
        return acc
      }, {}),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
