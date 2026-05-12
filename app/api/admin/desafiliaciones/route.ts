// app/api/admin/desafiliaciones/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma }        from '@/lib/prisma'
import { requireAdmin }  from '@/lib/security/authGuard'

const db: any = prisma

const ESTADOS_VALIDOS = ['PENDIENTE','RECIBIDA','REMITIDA','CERRADA','RECHAZADA','TODOS']

export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  const { searchParams } = request.nextUrl
  const estado  = searchParams.get('estado') ?? 'TODOS'
  const q       = searchParams.get('q')?.trim() ?? ''
  const limiteRaw = parseInt(searchParams.get('limite') ?? '200', 10)
  const limite  = isNaN(limiteRaw) ? 200 : Math.min(limiteRaw, 500)

  try {
    const where: any = {}
    if (estado !== 'TODOS' && ESTADOS_VALIDOS.includes(estado)) {
      where.estado = estado
    }
    if (q) {
      where.OR = [
        { cedula:    { contains: q } },
        { nombres:   { contains: q, mode: 'insensitive' } },
        { apellidos: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [solicitudes, total, porEstado] = await Promise.all([
      db.desafiliacionSolicitud.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limite,
        select: {
          id: true, cedula: true, nombres: true, apellidos: true,
          tipoSolicitud: true, fechaSolicitud: true, fechaRecepcion: true,
          medioRecepcion: true, referenciaDocumento: true, motivo: true,
          estado: true, observaciones: true, createdAt: true, updatedAt: true,
          adjuntoNombre: true, adjuntoMimeType: true,
        },
      }),
      db.desafiliacionSolicitud.count({ where }),
      db.desafiliacionSolicitud.groupBy({
        by: ['estado'],
        _count: { id: true },
      }),
    ])

    const stats: Record<string, number> = {}
    for (const e of porEstado) stats[e.estado] = e._count.id

    return NextResponse.json({ success: true, data: { solicitudes, total, stats } })
  } catch (err: any) {
    console.error('[GET /api/admin/desafiliaciones]', err)
    return NextResponse.json({ success: false, error: 'Error al obtener solicitudes' }, { status: 500 })
  }
}
