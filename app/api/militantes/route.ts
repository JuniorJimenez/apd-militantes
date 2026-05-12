// app/api/militantes/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse }    from 'next/server'
import { prisma }                       from '@/lib/prisma'
import { rateLimit, LIMITS }            from '@/lib/security/rateLimit'
import { validarPayloadMilitante }      from '@/lib/security/sanitize'
import { requireAdmin, isSuspiciousUA } from '@/lib/security/authGuard'
import { getClientIP }                  from '@/lib/security/sanitize'
import { EstadoMilitante }              from '@/lib/types'
import { getPreRegistrationStatus, materializeApprovedPreRegistration } from '@/lib/verification/preregService'
import { findProvinciaId, findMunicipioId, findDistritoMunicipalId } from '@/lib/jce-geo-lookup'
import { verificarAfiliacionEnJCE } from '@/lib/jce-padron-api'
const db: any = prisma

const ESTADOS_VALIDOS: EstadoMilitante[] = ['ACTIVO', 'PENDIENTE', 'INACTIVO']

// ─── GET — listar militantes (solo admin) ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const estado  = searchParams.get('estado') ?? 'TODOS'
  const q       = searchParams.get('q')?.trim() ?? ''

  // B6: validar limite — NaN seguro con valor por defecto
  const limiteRaw = parseInt(searchParams.get('limite') ?? '100', 10)
  const limite    = isNaN(limiteRaw) ? 100 : Math.min(Math.max(limiteRaw, 1), 500)

  const prov    = searchParams.get('provincia')?.trim() ?? ''
  const mun     = searchParams.get('municipio')?.trim() ?? ''
  const sector  = searchParams.get('sector')?.trim()    ?? ''

  // B7: inicio del mes correctamente a 00:00:00.000
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  try {
    const where: any = {}
    // Validar que el estado sea uno de los permitidos
    if (estado !== 'TODOS' && ESTADOS_VALIDOS.includes(estado as EstadoMilitante)) {
      where.estado = estado as EstadoMilitante
    }
    if (prov)   where.provincia = { contains: prov, mode: 'insensitive' }
    if (mun)    where.municipio = { contains: mun,  mode: 'insensitive' }
    if (sector) where.sector    = { contains: sector, mode: 'insensitive' }
    if (q) {
      where.OR = [
        { nombres:   { contains: q, mode: 'insensitive' } },
        { apellidos: { contains: q, mode: 'insensitive' } },
        { cedula:    { contains: q } },
      ]
    }

    const [militantes, total, activos, pendientes, mes] = await Promise.all([
      db.militante.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limite,
        include: {
          verificationSessions: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              id: true, status: true, finalDecision: true,
              createdAt: true, updatedAt: true, completedAt: true,
              manualReview: { select: { status: true } },
            },
          },
          desafiliaciones: {
            where: { estado: 'CERRADA' },
            take: 1,
            select: { id: true },
          },
        },
      }).then((rows: any[]) => rows.map((m: any) => {
        const latest = m.verificationSessions?.[0]
        return {
          ...m,
          desafiliadoFormalmente: (m.desafiliaciones?.length ?? 0) > 0,
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
      })),
      db.militante.count(),
      db.militante.count({ where: { estado: 'ACTIVO'    } }),
      db.militante.count({ where: { estado: 'PENDIENTE' } }),
      db.militante.count({ where: { createdAt: { gte: inicioMes } } }),
    ])

    return NextResponse.json({
      success: true,
      data: { militantes, stats: { total, activos, pendientes, mes } },
    })
  } catch (err) {
    console.error('[GET /api/militantes]', err)
    return NextResponse.json({ success: false, error: 'Error al obtener militantes' }, { status: 500 })
  }
}

// ─── POST — registrar nuevo militante (público, con anti-bot) ─────────────────
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)

  if (isSuspiciousUA(request)) {
    return NextResponse.json({ success: true, data: { id: 0 } }, { status: 201 })
  }

  const rl = rateLimit(`registro:${clientIP}`, LIMITS.registro)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `Límite alcanzado. Intenta en ${Math.ceil(rl.retryAfter / 60)} minutos.` },
      { status: 429 }
    )
  }

  const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
  if (isNaN(contentLength) || contentLength > 100_000) {
    return NextResponse.json({ success: false, error: 'Petición demasiado grande' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  // Honeypot anti-bot
  if (body.website || body.url || body.hp) {
    return NextResponse.json({ success: true, data: { id: 0 } }, { status: 201 })
  }

  // Timestamp mínimo anti-bot
  const formTime = Number(body._t || 0)
  if (formTime && (Date.now() - formTime) < 1500) {
    return NextResponse.json({ success: true, data: { id: 0 } }, { status: 201 })
  }

  const verificationSessionId = typeof body.verificationSessionId === 'string' ? body.verificationSessionId.trim() : ''
  if (!verificationSessionId) {
    return NextResponse.json({ success: false, error: 'Debes completar la validación de vida antes de registrarte' }, { status: 400 })
  }

  let preRegSession: any
  try {
    preRegSession = getPreRegistrationStatus(verificationSessionId)
  } catch {
    return NextResponse.json({ success: false, error: 'La sesión de validación no existe o expiró' }, { status: 400 })
  }

  const { valido, errores, datos } = validarPayloadMilitante(body)
  if (!valido) {
    return NextResponse.json({ success: false, error: errores.join('. ') }, { status: 400 })
  }

  if (preRegSession.cedula !== datos.cedula!) {
    return NextResponse.json({ success: false, error: 'La validación de vida no corresponde con la cédula digitada' }, { status: 400 })
  }
  if (preRegSession.status !== 'approved') {
    return NextResponse.json({ success: false, error: 'Debes aprobar la validación de vida antes de registrarte' }, { status: 400 })
  }

  const existe = await db.militante.findUnique({ where: { cedula: datos.cedula! } })
  if (existe) {
    return NextResponse.json(
      { success: false, error: 'Esta cédula ya está registrada en el padrón' },
      { status: 409 }
    )
  }

  try {
    // B8: validar fechaNac antes de pasarla a Prisma
    let fechaNac: Date | null = null
    if (typeof body.fechaNac === 'string' && body.fechaNac.trim()) {
      const parsed = new Date(body.fechaNac.trim())
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed < new Date()) {
        fechaNac = parsed
      }
    }

    // ── [JCE-PADRON-API-HOOK] Verificación de multiplicidad de afiliaciones ──
    const jceAfiliacion = await verificarAfiliacionEnJCE(datos.cedula!)
    let estadoInicial: 'PENDIENTE' | 'INACTIVO' = 'PENDIENTE'
    let causalInactividad: string | null = null

    if (jceAfiliacion.estado === 'afiliado_otro_partido') {
      estadoInicial     = 'INACTIVO'
      causalInactividad = `multiplicidad_otro_partido:${jceAfiliacion.nombrePartido ?? jceAfiliacion.idPartido ?? 'DESCONOCIDO'}`
    } else if (jceAfiliacion.estado === 'inactivo_multiple') {
      estadoInicial     = 'INACTIVO'
      causalInactividad = 'multiplicidad_jce'
    }
    // error_consulta y api_no_disponible → PENDIENTE sin causal (no bloquea)
    // ─────────────────────────────────────────────────────────────────────────

    const militante = await db.militante.create({
      data: {
        nombres:        datos.nombres!,
        apellidos:      datos.apellidos!,
        cedula:         datos.cedula!,
        fechaNac,
        sexo:           datos.sexo,
        estadoCivil:    datos.estadoCivil,
        telefono:       datos.telefono!,
        telefonoAlt:    datos.telefonoAlt,
        email:          datos.email,
        provincia:      datos.provincia!,
        municipio:      datos.municipio!,
        distritoMunicipal: typeof body.distritoMunicipal === 'string' && body.distritoMunicipal ? body.distritoMunicipal.trim().slice(0, 150) : null,
        seccion:        typeof body.seccion === 'string' && body.seccion ? body.seccion.trim().slice(0, 150) : null,
        sector:         datos.sector,
        subbarrio:      typeof body.subbarrio === 'string' && body.subbarrio ? body.subbarrio.trim().slice(0, 150) : null,
        direccion:      datos.direccion,
        // IDs numéricos JCE para reporte Art. 18 Reglamento 2026
        idProvinciaJCE:         findProvinciaId(datos.provincia!),
        idMunicipioJCE:         (() => {
          const idProv = findProvinciaId(datos.provincia!)
          return idProv ? findMunicipioId(datos.municipio!, idProv) : null
        })(),
        idDistritoMunicipalJCE: (() => {
          const dm = typeof body.distritoMunicipal === 'string' ? body.distritoMunicipal.trim() : ''
          if (!dm) return null
          const idProv = findProvinciaId(datos.provincia!)
          const idMun  = idProv ? findMunicipioId(datos.municipio!, idProv) : null
          return idMun ? findDistritoMunicipalId(dm, idMun) : null
        })(),
        ocupacion:      datos.ocupacion,
        motivo:         datos.motivo,
        tipoMilitancia: 'Simpatizante',
        estado:         estadoInicial,
        causalInactividad,

        // ── [JCE-PADRON-API-HOOK] ────────────────────────────────────────────
        // Verificación de multiplicidad de afiliaciones — Art. 2(j)(k), Art. 4 Párr. III
        // En modo mock: siempre retorna 'api_no_disponible', no altera el flujo
        // En modo real: puede cambiar estado a INACTIVO con causal si hay multiplicidad
        // Para activar: configurar JCE_PADRON_API_MODE=real y credenciales en .env
        // ────────────────────────────────────────────────────────────────────
      },
    })
    await materializeApprovedPreRegistration(verificationSessionId, militante.id)
    return NextResponse.json({ success: true, data: militante }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/militantes]', err)
    return NextResponse.json({ success: false, error: 'Error al registrar militante' }, { status: 500 })
  }
}
