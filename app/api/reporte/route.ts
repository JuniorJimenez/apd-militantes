// app/api/reporte/route.ts — Protegido por middleware (cookie admin)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ESTADOS_VALIDOS = ['ACTIVO', 'PENDIENTE', 'INACTIVO', 'TODOS'] as const

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const estadoRaw = searchParams.get('estado') ?? 'TODOS'
  const estado    = ESTADOS_VALIDOS.includes(estadoRaw as any) ? estadoRaw : 'TODOS'
  const provincia = searchParams.get('provincia')?.trim() ?? ''
  const municipio = searchParams.get('municipio')?.trim() ?? ''
  const q         = searchParams.get('q')?.trim() ?? ''

  try {
    const where: any = {}
    if (estado !== 'TODOS') where.estado = estado
    if (provincia) where.provincia = { contains: provincia, mode: 'insensitive' }
    if (municipio) where.municipio = { contains: municipio, mode: 'insensitive' }
    if (q) {
      where.OR = [
        { nombres:   { contains: q, mode: 'insensitive' } },
        { apellidos: { contains: q, mode: 'insensitive' } },
        { cedula:    { contains: q } },
      ]
    }

    const militantes = await prisma.militante.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      take: 5000,
    })

    return NextResponse.json({ success: true, data: militantes })
  } catch (err) {
    console.error('[GET /api/reporte]', err)
    return NextResponse.json({ success: false, error: 'Error al generar el reporte' }, { status: 500 })
  }
}
