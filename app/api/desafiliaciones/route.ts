import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIP, sanitizeName, sanitizeText, validarCedula } from '@/lib/security/sanitize'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { sha256Hex } from '@/lib/verification/hash'

const db: any = prisma
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_BYTES = 5 * 1024 * 1024

type ConsultaResponse = {
  success: boolean
  data?: {
    cedula: string
    valida: boolean
    inhabilitado: boolean
    jce?: {
      nombre?: string | null
      nombres?: string | null
      apellido1?: string | null
      apellido2?: string | null
      errorConexion?: string
    }
    apd?: {
      registrado: boolean
      estado?: string
      ocupacion?: string | null
      tipoMilitancia?: string | null
      fechaRegistro?: string
    }
    mensaje?: string
  }
  error?: string
}

async function consultarEstadoAfiliacion(request: NextRequest, cedula: string): Promise<ConsultaResponse> {
  const origin = request.nextUrl.origin
  const res = await fetch(`${origin}/api/consulta?cedula=${encodeURIComponent(cedula)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      cookie: request.headers.get('cookie') || '',
    },
    cache: 'no-store',
  })

  let payload: ConsultaResponse
  try {
    payload = (await res.json()) as ConsultaResponse
  } catch {
    payload = { success: false, error: 'No se pudo interpretar la respuesta de /api/consulta' }
  }

  if (!res.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'No se pudo validar la cédula en JCE/APD')
  }

  return payload
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)
  const rl = rateLimit(`desafiliacion:${clientIP}`, LIMITS.registro)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  try {
    const formData = await request.formData()
    const cedula = sanitizeText(String(formData.get('cedula') || ''), 13)
    const nombres = sanitizeName(formData.get('nombres'), 120)
    const apellidos = sanitizeName(formData.get('apellidos'), 120)
    const tipoSolicitud = sanitizeText(formData.get('tipoSolicitud'), 80)
    const fechaSolicitud = sanitizeText(formData.get('fechaSolicitud'), 20)
    const medioRecepcion = sanitizeText(formData.get('medioRecepcion'), 80)
    const referenciaDocumento = sanitizeText(formData.get('referenciaDocumento'), 120)
    const motivo = sanitizeText(formData.get('motivo'), 2000)
    const detallePrueba = sanitizeText(formData.get('detallePrueba'), 2000)
    const declaracionVeracidad = String(formData.get('declaracionVeracidad') || '') === 'true'
    const adjunto = formData.get('adjunto') as File | null

    if (!validarCedula(cedula)) {
      return NextResponse.json({ success: false, error: 'Cédula inválida' }, { status: 400 })
    }
    if (!tipoSolicitud || !fechaSolicitud || !motivo || !declaracionVeracidad) {
      return NextResponse.json(
        { success: false, error: 'Completa los campos obligatorios del formulario de desafiliación' },
        { status: 400 },
      )
    }

    const consulta = await consultarEstadoAfiliacion(request, cedula)
    const data = consulta.data!

    if (!data.valida || data.inhabilitado) {
      return NextResponse.json(
        {
          success: false,
          error: 'La persona no figura habilitada en el padrón electoral de la JCE. No se puede continuar con la desafiliación.',
        },
        { status: 409 },
      )
    }

    if (!data.apd?.registrado) {
      return NextResponse.json(
        {
          success: false,
          error: 'La persona no figura afiliada en el padrón APD. No se puede registrar la desafiliación.',
        },
        { status: 409 },
      )
    }

    let adjuntoInfo: Record<string, any> = {}
    if (adjunto && adjunto.size > 0) {
      if (!ALLOWED_TYPES.includes(adjunto.type)) {
        return NextResponse.json({ success: false, error: 'Tipo de archivo no permitido' }, { status: 400 })
      }
      if (adjunto.size > MAX_FILE_BYTES) {
        return NextResponse.json({ success: false, error: 'El archivo excede 5MB' }, { status: 400 })
      }
      const buffer = Buffer.from(await adjunto.arrayBuffer())
      adjuntoInfo = {
        adjuntoNombre: adjunto.name,
        adjuntoMimeType: adjunto.type,
        adjuntoSha256: sha256Hex(buffer),
      }
    }

    const militante = await db.militante.findUnique({ where: { cedula } }).catch(() => null)

    const solicitud = await db.desafiliacionSolicitud.create({
      data: {
        cedula,
        nombres: nombres || data.jce?.nombres || data.jce?.nombre || null,
        apellidos:
          apellidos ||
          [data.jce?.apellido1, data.jce?.apellido2].filter(Boolean).join(' ') ||
          null,
        militanteId: militante?.id ?? null,
        tipoSolicitud,
        fechaSolicitud: new Date(fechaSolicitud),
        fechaRecepcion: new Date(),
        medioRecepcion: medioRecepcion || null,
        referenciaDocumento: referenciaDocumento || null,
        motivo,
        detallePrueba: detallePrueba || null,
        estado: 'PENDIENTE',
        observaciones: null,
        metadata: {
          ipAddress: clientIP,
          userAgent: request.headers.get('user-agent') || null,
          declaracionVeracidad,
          origen: 'formulario_publico_desafiliacion',
          validacionPrevia: {
            jceValida: data.valida,
            jceInhabilitado: data.inhabilitado,
            apdRegistrado: data.apd?.registrado || false,
            estadoAPD: data.apd?.estado || null,
            tipoMilitanciaAPD: data.apd?.tipoMilitancia || null,
          },
        },
        ...adjuntoInfo,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: solicitud.id,
          estado: solicitud.estado,
          validacionPrevia: {
            jceHabilitado: data.valida && !data.inhabilitado,
            afiliadoAPD: data.apd?.registrado || false,
          },
        },
      },
      { status: 201 },
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar la solicitud de desafiliación' },
      { status: 500 },
    )
  }
}
