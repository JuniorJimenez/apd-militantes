// app/api/admin/carta/[cedula]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

const db: any = prisma

export async function GET(
  request: NextRequest,
  { params }: { params: { cedula: string } }
) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  const tipo   = request.nextUrl.searchParams.get('tipo') ?? 'afiliacion'
  const cedulaRaw    = decodeURIComponent(params.cedula)
  const cedulaDigits = cedulaRaw.replace(/\D/g, '')
  const cedulaFmt    = cedulaDigits.length === 11
    ? `${cedulaDigits.slice(0,3)}-${cedulaDigits.slice(3,10)}-${cedulaDigits.slice(10)}`
    : cedulaRaw.trim()

  try {
    // Buscar con formato con guiones primero, luego sin guiones
    let militante = await db.militante.findFirst({ where: { cedula: cedulaFmt } })
    if (!militante) militante = await db.militante.findFirst({ where: { cedula: cedulaDigits } })
    if (!militante) militante = await db.militante.findFirst({ where: { cedula: cedulaRaw.trim() } })

    if (!militante) {
      return NextResponse.json({ success: false, error: 'Militante no encontrado' }, { status: 404 })
    }

    if (tipo === 'afiliacion' && militante.estado !== 'ACTIVO') {
      return NextResponse.json({
        success: false,
        error: 'La carta de afiliación solo puede emitirse para militantes ACTIVOS',
      }, { status: 400 })
    }

    // Buscar solicitud CERRADA directamente por cédula (militanteId puede ser null)
    let solicitudDesaf = null
    if (tipo === 'desafiliacion') {
      solicitudDesaf = await db.desafiliacionSolicitud.findFirst({
        where: {
          OR: [
            { cedula: militante.cedula },
            { cedula: cedulaDigits },
            { cedula: cedulaFmt },
          ],
          estado: 'CERRADA',
        },
        orderBy: { updatedAt: 'desc' },
      })
      if (!solicitudDesaf) {
        return NextResponse.json({
          success: false,
          error: 'No existe solicitud de desafiliación cerrada para esta cédula',
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tipo,
        militante: {
          cedula:         militante.cedula,
          nombres:        militante.nombres,
          apellidos:      militante.apellidos,
          tipoMilitancia: militante.tipoMilitancia ?? 'Simpatizante',
          provincia:      militante.provincia,
          municipio:      militante.municipio,
          estado:         militante.estado,
          createdAt:      militante.createdAt,
          verifiedAt:     militante.verifiedAt ?? null,
        },
        solicitudDesafiliacion: solicitudDesaf ? {
          tipoSolicitud:  solicitudDesaf.tipoSolicitud,
          fechaSolicitud: solicitudDesaf.fechaSolicitud,
          fechaCierre:    solicitudDesaf.updatedAt,
          motivo:         solicitudDesaf.motivo,
        } : null,
        emitidaEn: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[admin/carta]', err)
    return NextResponse.json({ success: false, error: 'Error al generar datos de la carta' }, { status: 500 })
  }
}
