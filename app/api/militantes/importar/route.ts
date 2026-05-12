// app/api/militantes/importar/route.ts — Protegido con auth admin
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireAdmin, validateOrigin } from '@/lib/security/authGuard'
import { validarCedula }             from '@/lib/security/sanitize'
import { rateLimit }                 from '@/lib/security/rateLimit'
import { getClientIP }               from '@/lib/security/sanitize'

interface FilaImport {
  cedula: string; nombres: string; apellidos: string; telefono: string
  provincia: string; municipio: string; email?: string; sexo?: string
  estadoCivil?: string; sector?: string; direccion?: string
  ocupacion?: string; motivo?: string
}

export async function POST(request: NextRequest) {
  // Requiere sesión admin
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  // Validar origen CSRF
  if (!validateOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Origen inválido' }, { status: 403 })
  }

  // Rate limiting especial para importación: máx 3 cargas por hora por IP
  const clientIP = getClientIP(request)
  const rl = rateLimit(`importar:${clientIP}`, { windowMs: 3_600_000, max: 3, blockMs: 3_600_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `Límite de importaciones alcanzado. Intenta en ${Math.ceil(rl.retryAfter / 60)} minutos.` },
      { status: 429 }
    )
  }

  // Tamaño máximo 10MB
  const contentLength = parseInt(request.headers.get('content-length') || '0')
  if (contentLength > 10_000_000) {
    return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 10MB)' }, { status: 413 })
  }

  try {
    const body = await request.json()
    const { filas } = body as { filas: FilaImport[] }

    if (!filas || !Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ success: false, error: 'No se recibieron datos' }, { status: 400 })
    }
    if (filas.length > 5000) {
      return NextResponse.json({ success: false, error: 'Máximo 5,000 registros por carga' }, { status: 400 })
    }

    const resultados = {
      total: filas.length, importados: 0, duplicados: 0, errores: 0,
      detalles: [] as { fila: number; cedula: string; error: string }[],
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]
      const numFila = i + 2

      const cedula   = (fila.cedula   || '').replace(/[-\s]/g, '').trim()
      const nombres  = (fila.nombres  || '').trim()
      const apellidos= (fila.apellidos|| '').trim()
      const telefono = (fila.telefono || '').trim()
      const provincia= (fila.provincia|| '').trim()
      const municipio= (fila.municipio|| '').trim()

      if (!cedula || !nombres || !apellidos || !telefono || !provincia || !municipio) {
        resultados.errores++
        resultados.detalles.push({ fila: numFila, cedula: cedula||'—', error: 'Faltan campos requeridos' })
        continue
      }
      if (!validarCedula(cedula)) {
        resultados.errores++
        resultados.detalles.push({ fila: numFila, cedula, error: 'Cédula inválida' })
        continue
      }

      const cedulaFmt = `${cedula.slice(0,3)}-${cedula.slice(3,10)}-${cedula.slice(10)}`

      try {
        await prisma.militante.create({
          data: {
            cedula: cedulaFmt, nombres, apellidos, telefono, provincia, municipio,
            email:          fila.email       || null,
            sexo:           fila.sexo        || null,
            estadoCivil:    fila.estadoCivil || null,
            sector:         fila.sector      || null,
            direccion:      fila.direccion   || null,
            ocupacion:      fila.ocupacion   || null,
            motivo:         fila.motivo      || null,
            tipoMilitancia: 'Simpatizante',
            estado:         'PENDIENTE',
          },
        })
        resultados.importados++
      } catch (err: any) {
        if (err?.code === 'P2002') {
          resultados.duplicados++
          resultados.detalles.push({ fila: numFila, cedula: cedulaFmt, error: 'Cédula duplicada' })
        } else {
          resultados.errores++
          resultados.detalles.push({ fila: numFila, cedula: cedulaFmt, error: 'Error al insertar' })
        }
      }
    }

    return NextResponse.json({ success: true, data: resultados })
  } catch (err) {
    console.error('[importar]', err)
    return NextResponse.json({ success: false, error: 'Error al procesar la importación' }, { status: 500 })
  }
}
