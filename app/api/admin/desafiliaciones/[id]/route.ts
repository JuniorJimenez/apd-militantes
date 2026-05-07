// app/api/admin/desafiliaciones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

const db: any = prisma
const ESTADOS_VALIDOS = ['PENDIENTE','RECIBIDA','REMITIDA','CERRADA','RECHAZADA']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  try {
    const s = await db.desafiliacionSolicitud.findUnique({
      where: { id: params.id },
      include: { militante: { select: { id:true, estado:true, tipoMilitancia:true } } },
    })
    if (!s) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data: s })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Error al obtener solicitud' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  try {
    const body = await request.json()
    const { estado, observaciones } = body

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 })
    }

    const data: any = {}
    if (estado)        data.estado        = estado
    if (observaciones !== undefined) data.observaciones = observaciones

    // Si se cierra la solicitud → marcar militante como INACTIVO
    if (estado === 'CERRADA') {
      const s = await db.desafiliacionSolicitud.findUnique({ where: { id: params.id } })
      if (s?.militanteId) {
        await db.militante.update({
          where: { id: s.militanteId },
          data:  { estado: 'INACTIVO' },
        })
      }
    }

    const updated = await db.desafiliacionSolicitud.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err: any) {
    console.error('[PATCH desafiliacion]', err)
    return NextResponse.json({ success: false, error: 'Error al actualizar solicitud' }, { status: 500 })
  }
}
