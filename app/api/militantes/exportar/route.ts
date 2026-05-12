// app/api/militantes/exportar/route.ts — Protegido por requireAdmin
// Formato Art. 18 Reglamento JCE 2026: incluye Id Municipio e Id Distrito Municipal
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'
const db: any = prisma

export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  try {
    const { searchParams } = new URL(request.url)
    const estado    = searchParams.get('estado')    || undefined
    const provincia = searchParams.get('provincia') || ''
    const municipio = searchParams.get('municipio') || ''
    const buscar    = searchParams.get('q')         || ''

    const where = {
      ...(estado && estado !== 'TODOS' ? { estado: estado as any } : {}),
      ...(provincia ? { provincia: { contains: provincia, mode: 'insensitive' as const } } : {}),
      ...(municipio ? { municipio: { contains: municipio, mode: 'insensitive' as const } } : {}),
      ...(buscar ? {
        OR: [
          { nombres:   { contains: buscar, mode: 'insensitive' as const } },
          { apellidos: { contains: buscar, mode: 'insensitive' as const } },
          { cedula:    { contains: buscar } },
        ],
      } : {}),
    }

    const militantes = await db.militante.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    })

    const BOM  = '\uFEFF'

    // Columnas según Art. 18 Reglamento JCE 2026
    const COLS = [
      'Cédula', 'Nombres', 'Apellidos', 'Fecha Nac.', 'Sexo', 'Estado Civil',
      'Teléfono', 'Teléfono Alt.', 'Correo',
      'Provincia', 'Id Provincia (JCE)',
      'Municipio', 'Id Municipio (JCE)',
      'Distrito Municipal', 'Id Distrito Municipal (JCE)',
      'Sección', 'Sector/Barrio', 'Dirección',
      'Ocupación', 'Tipo Militancia', 'Motivo', 'Estado', 'Fecha Afiliación',
    ]

    const esc = (v: unknown) => {
      if (v === null || v === undefined || v === '') return ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }

    const rows = militantes.map((m: any) => [
      esc(m.cedula),
      esc(m.nombres),
      esc(m.apellidos),
      m.fechaNac ? new Date(m.fechaNac).toLocaleDateString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric' }) : '',
      esc(m.sexo),
      esc(m.estadoCivil),
      esc(m.telefono),
      esc(m.telefonoAlt),
      esc(m.email),
      esc(m.provincia),
      m.idProvinciaJCE ?? '',
      esc(m.municipio),
      m.idMunicipioJCE ?? '',
      esc(m.distritoMunicipal),
      m.idDistritoMunicipalJCE ?? '',
      esc(m.seccion),
      esc(m.sector),
      esc(m.direccion),
      esc(m.ocupacion),
      esc(m.tipoMilitancia ?? 'Simpatizante'),
      esc(m.motivo),
      esc(m.estado),
      new Date(m.createdAt).toLocaleDateString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric' }),
    ].join(','))

    const csv      = BOM + COLS.join(',') + '\n' + rows.join('\n')
    const filename = `padron-apd-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[exportar]', err)
    return NextResponse.json({ success: false, error: 'Error al exportar' }, { status: 500 })
  }
}
