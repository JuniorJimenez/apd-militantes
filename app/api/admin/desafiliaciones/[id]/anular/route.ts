// app/api/admin/desafiliaciones/[id]/anular/route.ts
// Anulación de desafiliación inadvertida — Art. 13 Reglamento JCE 2026
//
// Art. 13: "En el caso de que se haya realizado una desafiliación inadvertida,
// el/la afectado/a podrá manifestar su intención de permanecer en la organización
// política... a los fines de que proceda a reestablecer su condición de miembro o afiliado."
//
// Acciones que ejecuta:
//   1. Cambia estado de la solicitud → ANULADA
//   2. Reactiva al militante         → ACTIVO
//   3. Registra en AuditLog          → trazabilidad completa
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { requireAdmin } from '@/lib/security/authGuard'

const db: any = prisma

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = requireAdmin(request)
  if (authErr) return authErr

  try {
    const body  = await request.json()
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''

    if (!motivo || motivo.length < 20) {
      return NextResponse.json({
        success: false,
        error: 'La justificación es obligatoria y debe tener al menos 20 caracteres (Art. 13).',
      }, { status: 400 })
    }

    // Verificar que la solicitud existe y está en estado CERRADA
    const solicitud = await db.desafiliacionSolicitud.findUnique({
      where: { id: params.id },
    })

    if (!solicitud) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (solicitud.estado !== 'CERRADA') {
      return NextResponse.json({
        success: false,
        error: `Solo pueden anularse solicitudes en estado CERRADA. Estado actual: ${solicitud.estado}`,
      }, { status: 409 })
    }

    // Ejecutar en transacción: anular solicitud + reactivar militante + audit
    const [solicitudActualizada, militanteActualizado] = await db.$transaction(async (tx: any) => {
      // 1. Marcar solicitud como ANULADA con observación Art. 13
      const sol = await tx.desafiliacionSolicitud.update({
        where: { id: params.id },
        data:  {
          estado:       'ARCHIVADA', // Archivada con flag de anulación en observaciones
          observaciones: [
            solicitud.observaciones,
            `[ANULACIÓN ART. 13 — ${new Date().toLocaleDateString('es-DO')}] ${motivo}`,
          ].filter(Boolean).join('\n---\n'),
        },
      })

      // 2. Reactivar militante — buscar por cedula o militanteId
      let militante = null
      if (solicitud.militanteId) {
        militante = await tx.militante.update({
          where: { id: solicitud.militanteId },
          data:  { estado: 'ACTIVO', causalInactividad: null },
        })
      } else if (solicitud.cedula) {
        const m = await tx.militante.findFirst({
          where: { cedula: { in: [
            solicitud.cedula,
            solicitud.cedula.replace(/\D/g,''),
          ]}},
        })
        if (m) {
          militante = await tx.militante.update({
            where: { id: m.id },
            data:  { estado: 'ACTIVO', causalInactividad: null },
          })
        }
      }

      // 3. Registrar en AuditLog para trazabilidad completa
      await tx.auditLog.create({
        data: {
          action:    'desafiliacion_anulada_art13',
          actor:     'admin',
          details:   {
            solicitudId:   params.id,
            cedula:        solicitud.cedula,
            militanteId:   solicitud.militanteId ?? militante?.id ?? null,
            motivo,
            estadoAnterior: 'CERRADA',
            estadoNuevo:   'ARCHIVADA (anulada Art. 13)',
            reglamento:    'Art. 13 — Reglamento JCE 15 enero 2026',
          },
        },
      })

      return [sol, militante]
    })

    return NextResponse.json({
      success: true,
      data: {
        solicitud:  solicitudActualizada,
        militante:  militanteActualizado,
      },
    })

  } catch (err: any) {
    console.error('[anular desafiliacion]', err)
    return NextResponse.json({
      success: false,
      error: 'Error al procesar la anulación. Intenta de nuevo.',
    }, { status: 500 })
  }
}
