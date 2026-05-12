// app/api/militantes/[cedula]/route.ts — Protegido con auth admin
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse }      from 'next/server'
import { prisma }                         from '@/lib/prisma'
import { requireAdmin, validateOrigin }   from '@/lib/security/authGuard'
import { TIPOS_MILITANCIA }               from '@/lib/types'
const db: any = prisma

function getCedula(params: { cedula: string }): string {
  return decodeURIComponent(params.cedula).trim()
}

/** Valida y parsea fechaNac de forma segura */
function parseFechaNac(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const d = new Date(raw.trim())
  if (isNaN(d.getTime())) return null
  if (d.getFullYear() < 1900 || d > new Date()) return null
  return d
}

// GET
export async function GET(_req: NextRequest, { params }: { params: { cedula: string } }) {
  const err = requireAdmin(_req)
  if (err) return err
  try {
    const m = await db.militante.findUnique({
      where: { cedula: getCedula(params) },
      include: {
        verificationSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            finalDecision: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
            manualReview: { select: { status: true } },
          },
        },
      },
    })
    if (!m) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })

    const latest = m.verificationSessions?.[0]
    const data = {
      ...m,
      latestVerification: latest ? {
        sessionId: latest.id,
        status: latest.status,
        finalDecision: latest.finalDecision,
        manualReviewStatus: latest.manualReview?.status ?? null,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
        completedAt: latest.completedAt,
      } : null,
    }
    delete (data as any).verificationSessions
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Error al obtener el registro' }, { status: 500 })
  }
}

// PUT
export async function PUT(request: NextRequest, { params }: { params: { cedula: string } }) {
  const err = requireAdmin(request)
  if (err) return err
  try {
    const body = await request.json()
    const tipoMilitancia = TIPOS_MILITANCIA.includes(body.tipoMilitancia) ? body.tipoMilitancia : undefined

    const m = await db.militante.update({
      where: { cedula: getCedula(params) },
      data: {
        nombres:        body.nombres?.trim()         ?? undefined,
        apellidos:      body.apellidos?.trim()        ?? undefined,
        fechaNac:       parseFechaNac(body.fechaNac),
        sexo:           body.sexo                    ?? null,
        estadoCivil:    body.estadoCivil             ?? null,
        telefono:       body.telefono?.trim()         ?? undefined,
        telefonoAlt:    body.telefonoAlt             ?? null,
        email:          body.email                   ?? null,
        provincia:         body.provincia               ?? undefined,
        municipio:         body.municipio               ?? undefined,
        distritoMunicipal: body.distritoMunicipal       ?? null,
        seccion:           body.seccion                 ?? null,
        sector:            body.sector                  ?? null,
        subbarrio:         body.subbarrio               ?? null,
        direccion:         body.direccion               ?? null,
        ocupacion:      body.ocupacion               ?? null,
        tipoMilitancia: tipoMilitancia,
        motivo:         body.motivo                  ?? null,
        estado:         body.estado                  ?? undefined,
      },
    })
    return NextResponse.json({ success: true, data: m })
  } catch (e) {
    console.error('[PUT militante]', e)
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 })
  }
}

// PATCH
export async function PATCH(request: NextRequest, { params }: { params: { cedula: string } }) {
  const err = requireAdmin(request)
  if (err) return err
  try {
    const body = await request.json()
    const tipoMilitancia = body.tipoMilitancia !== undefined
      ? (TIPOS_MILITANCIA.includes(body.tipoMilitancia) ? body.tipoMilitancia : undefined)
      : undefined

    // Validar estado si viene
    const ESTADOS_VALIDOS = ['ACTIVO', 'PENDIENTE', 'INACTIVO']
    const estado = body.estado && ESTADOS_VALIDOS.includes(body.estado) ? body.estado : undefined

    // CONTROL: bloquear reactivación directa SOLO si viene de INACTIVO
    // (no bloquear aprobación de un nuevo registro PENDIENTE tras re-afiliación)
    if (estado === 'ACTIVO') {
      const militanteActual = await db.militante.findUnique({
        where: { cedula: getCedula(params) },
        select: { estado: true },
      })
      // Solo bloquear si está INACTIVO (no si está PENDIENTE = nuevo registro)
      if (militanteActual?.estado === 'INACTIVO') {
        const solicitudCerrada = await db.desafiliacionSolicitud.findFirst({
          where: { cedula: getCedula(params), estado: 'CERRADA' },
          select: { id: true },
        })
        if (solicitudCerrada) {
          return NextResponse.json({
            success: false,
            error: 'Este militante se desafilió formalmente. La reafiliación solo puede realizarse mediante el formulario oficial de registro.',
            code: 'DESAFILIADO_FORMALMENTE',
          }, { status: 409 })
        }
      }
    }

    const m = await db.militante.update({
      where: { cedula: getCedula(params) },
      data: {
        ...(estado         !== undefined ? { estado }         : {}),
        ...(body.ocupacion !== undefined ? { ocupacion: body.ocupacion } : {}),
        ...(tipoMilitancia !== undefined ? { tipoMilitancia } : {}),
      },
    })
    return NextResponse.json({ success: true, data: m })
  } catch {
    return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: { cedula: string } }) {
  const err = requireAdmin(_req)
  if (err) return err
  try {
    await db.militante.delete({ where: { cedula: getCedula(params) } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}
