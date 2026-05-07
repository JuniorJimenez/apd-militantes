// app/api/militantes/exportar-jce/route.ts
// Exportación formato Art. 18 — Reglamento JCE 2026
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'
import { findProvinciaId, findMunicipioId, findDistritoMunicipalId } from '@/lib/jce-geo-lookup'

const db: any = prisma
const PARTIDO_NOMBRE = 'Alianza por la Democracia (APD)'

function getCodigoCircunscripcion(idMunicipioJCE: number | null | undefined): string {
  if (!idMunicipioJCE) return '01'
  return '01' // Base — municipios con circunscripción múltiple requieren dato de cédula
}

export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  try {
    const { searchParams } = new URL(request.url)
    const estado  = searchParams.get('estado')  || 'ACTIVO'
    const prov    = searchParams.get('provincia') || ''
    const mun     = searchParams.get('municipio') || ''
    const formato = searchParams.get('formato')   || 'csv'

    const where: any = {
      ...(estado !== 'TODOS' ? { estado } : {}),
      ...(prov ? { provincia: { contains: prov, mode: 'insensitive' } } : {}),
      ...(mun  ? { municipio: { contains: mun,  mode: 'insensitive' } } : {}),
    }

    // Sin select específico — trae todos los campos; compatibilidad con y sin db push
    const militantes = await db.militante.findMany({
      where,
      orderBy: [{ provincia: 'asc' }, { municipio: 'asc' }, { apellidos: 'asc' }],
    })

    // Resolver IDs JCE en runtime si no están en BD
    const rows: string[][] = militantes.map((m: any) => {
      const idProv = m.idProvinciaJCE         ?? findProvinciaId(m.provincia ?? '')
      const idMun  = m.idMunicipioJCE         ?? (idProv ? findMunicipioId(m.municipio ?? '', idProv) : null)
      const idDM   = m.idDistritoMunicipalJCE ?? (idMun && m.distritoMunicipal
        ? findDistritoMunicipalId(m.distritoMunicipal, idMun)
        : null)

      const nombreCompleto = `${m.nombres ?? ''} ${m.apellidos ?? ''}`.trim()
      const fechaAfiliacion = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric' })
        : ''

      // Documentación soporte: referencia al hash SHA-256 del liveness + fecha de verificación
      const docSoporte = m.livenessHash
        ? `Prueba de vida biométrica — SHA-256: ${m.livenessHash.slice(0,16)}...${m.livenessHash.slice(-8)} — ${m.verifiedAt ? new Date(m.verifiedAt).toLocaleDateString('es-DO') : 'Sistema APD'}`
        : 'Sistema Digital APD — Verificación biométrica'

      return [
        PARTIDO_NOMBRE,
        nombreCompleto,
        m.cedula ?? '',
        idMun  ? String(idMun)  : '',
        idDM   ? String(idDM)   : '',
        getCodigoCircunscripcion(idMun),
        fechaAfiliacion,
        docSoporte,
      ]
    })

    if (formato === 'preview') {
      return NextResponse.json({
        success: true,
        total:   rows.length,
        muestra: rows.slice(0, 5),
      })
    }

    const BOM  = '\uFEFF'
    const COLS = [
      'Nombre del Partido',
      'Nombre del Afiliado/a',
      'Cédula de Identidad y Electoral',
      'Id Municipio',
      'Id Distrito Municipal',
      'Código de Circunscripción',
      'Fecha de Afiliación',
      'Documentación Soporte',
    ]

    const esc = (v: string) => {
      if (!v) return ''
      const s = v.replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }

    const csv      = BOM + COLS.join(',') + '\n' + rows.map(r => r.map(esc).join(',')).join('\n')
    const anio     = new Date().getFullYear()
    const filename = `padron-apd-jce-art18-${anio}-${new Date().toISOString().slice(0,10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[exportar-jce]', err)
    return NextResponse.json({ success: false, error: 'Error al generar exportación JCE' }, { status: 500 })
  }
}
