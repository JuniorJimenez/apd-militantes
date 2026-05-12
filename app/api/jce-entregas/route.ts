// app/api/jce-entregas/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

const db: any = prisma

export async function GET(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  try {
    const entregas = await db.jCEEntrega.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 20,
    })
    return NextResponse.json({ success: true, data: entregas })
  } catch (e) {
    console.error('[GET jce-entregas]', e)
    return NextResponse.json({ success: false, error: 'Error al obtener historial' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const err = requireAdmin(req)
  if (err) return err
  try {
    const body = await req.json()
    const entrega = await db.jCEEntrega.create({
      data: {
        anio:           Number(body.anio),
        fechaCorte:     new Date(body.fechaCorte),
        totalRegistros: Number(body.totalRegistros),
        estadoFiltro:   String(body.estadoFiltro),
        notas:          body.notas ? String(body.notas).slice(0, 500) : null,
      },
    })
    return NextResponse.json({ success: true, data: entrega }, { status: 201 })
  } catch (e) {
    console.error('[POST jce-entregas]', e)
    return NextResponse.json({ success: false, error: 'Error al registrar entrega' }, { status: 500 })
  }
}
