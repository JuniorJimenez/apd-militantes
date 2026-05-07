// app/api/carta/[cedula]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { getClientIP } from '@/lib/security/sanitize'

const db: any = prisma

export async function GET(
  request: NextRequest,
  { params }: { params: { cedula: string } }
) {
  const clientIP = getClientIP(request)
  const rl = rateLimit(`carta:${clientIP}`, LIMITS.consulta)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Demasiadas solicitudes. Intenta más tarde.' }, { status: 429 })
  }

  const tipo   = request.nextUrl.searchParams.get('tipo') ?? 'afiliacion'
  const cedulaRaw    = decodeURIComponent(params.cedula)
  const cedulaDigits = cedulaRaw.replace(/\D/g, '')
  // La BD puede tener la cédula con guiones (001-0000000-0) o sin ellos
  const cedulaFmt    = cedulaDigits.length === 11
    ? `${cedulaDigits.slice(0,3)}-${cedulaDigits.slice(3,10)}-${cedulaDigits.slice(10)}`
    : cedulaRaw.trim()

  if (cedulaDigits.length !== 11) {
    return NextResponse.json({ success: false, error: 'Cédula inválida' }, { status: 400 })
  }

  // Buscar con formato con guiones primero, luego sin guiones
  const findMilitante = async () => {
    const m = await db.militante.findFirst({ where: { cedula: cedulaFmt } })
    if (m) return m
    return db.militante.findFirst({ where: { cedula: cedulaDigits } })
  }

  const cedula = cedulaFmt  // para búsquedas de desafiliación usar mismo formato
  if (tipo !== 'afiliacion' && tipo !== 'desafiliacion') {
    return NextResponse.json({ success: false, error: 'Tipo de carta inválido' }, { status: 400 })
  }

  try {
    const militante = await findMilitante()

    if (!militante) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró un registro de militante para esa cédula.',
      }, { status: 404 })
    }

    const cedulaBD = militante.cedula  // formato real guardado en BD

    if (tipo === 'afiliacion' && militante.estado !== 'ACTIVO') {
      return NextResponse.json({
        success: false,
        error: 'La constancia de afiliación solo está disponible para militantes con estado ACTIVO.',
      }, { status: 400 })
    }

    let solicitudDesaf = null
    if (tipo === 'desafiliacion') {
      solicitudDesaf = await db.desafiliacionSolicitud.findFirst({
        where: {
          OR: [{ cedula: cedulaBD }, { cedula: cedulaDigits }, { cedula: cedulaFmt }],
          estado: 'CERRADA',
        },
        orderBy: { updatedAt: 'desc' },
      })
      if (!solicitudDesaf) {
        return NextResponse.json({
          success: false,
          error: 'No existe solicitud de desafiliación procesada para esta cédula.',
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
    console.error('[GET /api/carta]', err)
    return NextResponse.json({ success: false, error: 'Error al generar la carta' }, { status: 500 })
  }
}
