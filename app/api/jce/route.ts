// app/api/jce/route.ts
// Consulta rápida al padrón JCE para auto-llenado del formulario
// Solo devuelve los campos necesarios para el formulario

import { NextRequest, NextResponse } from 'next/server'
import { consultarJCE }             from '@/lib/jce'
import { validarCedula, getClientIP } from '@/lib/security/sanitize'
import { rateLimit, LIMITS }         from '@/lib/security/rateLimit'
import { prisma }                    from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request)
  const rl       = rateLimit(`consulta:${clientIP}`, LIMITS.consulta)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas consultas. Espera un momento.' },
      { status: 429 }
    )
  }

  const cedula = request.nextUrl.searchParams.get('cedula')?.replace(/[-\s]/g, '') ?? ''

  if (!cedula || cedula.length !== 11) {
    return NextResponse.json({ success: false, error: 'Cédula incompleta' }, { status: 400 })
  }

  if (!validarCedula(cedula)) {
    return NextResponse.json({ success: false, error: 'Cédula inválida' }, { status: 400 })
  }

  try {
    // Consultar JCE y verificar si ya está en APD — en paralelo
    const [jce, yaRegistrado] = await Promise.all([
      consultarJCE(cedula),
      prisma.militante.findUnique({
        where: { cedula: `${cedula.slice(0,3)}-${cedula.slice(3,10)}-${cedula.slice(10)}` },
        select: { estado: true }
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        // Datos JCE para auto-llenado
        valida:       jce.valida,
        nombres:      jce.nombresPlastico  ?? jce.nombres   ?? '',
        apellidos:    jce.apellidosPlastico ?? `${jce.apellido1 ?? ''} ${jce.apellido2 ?? ''}`.trim(),
        fechaNac:     jce.fechaNacimiento  ?? '',
        sexo:         jce.sexo            ?? '',
        estadoCivil:  jce.estadoCivil     ?? '',
        provincia:    jce.provincia       ?? '',
        municipio:    jce.municipio       ?? '',
        inhabilitado: jce.inhabilitado,
        errorConexion:jce.errorConexion   ?? null,
        // Estado en APD
        enAPD:        !!yaRegistrado,
        estadoAPD:    yaRegistrado?.estado ?? null,
      }
    })
  } catch (err) {
    console.error('[GET /api/jce]', err)
    return NextResponse.json({ success: false, error: 'Error al consultar' }, { status: 500 })
  }
}
