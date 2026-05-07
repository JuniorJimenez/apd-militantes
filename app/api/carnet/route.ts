// app/api/carnet/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { consultarJCE } from '@/lib/jce'
import { validarCedula } from '@/lib/security/sanitize'
const db: any = prisma

export async function GET(request: NextRequest) {
  const cedula = request.nextUrl.searchParams.get('cedula')?.trim() ?? ''

  if (!cedula) {
    return NextResponse.json({ success: false, error: 'Cédula requerida' }, { status: 400 })
  }

  // Validar formato de cédula antes de consultar BD
  const cedulaLimpia = cedula.replace(/[-\s]/g, '')
  if (!validarCedula(cedulaLimpia)) {
    return NextResponse.json({ success: false, error: 'Cédula inválida' }, { status: 400 })
  }

  // 1. Datos APD
  let m: any
  try {
    m = await db.militante.findUnique({ where: { cedula } })
  } catch {
    // No exponer detalles del error de BD al cliente
    return NextResponse.json({ success: false, error: 'Error al obtener datos' }, { status: 500 })
  }

  if (!m) {
    return NextResponse.json({ success: false, error: 'Militante no encontrado' }, { status: 404 })
  }
  if (m.estado !== 'ACTIVO') {
    return NextResponse.json(
      { success: false, error: 'El carnet solo está disponible para militantes activos' },
      { status: 403 }
    )
  }

  // 2. Datos JCE — falla silenciosamente, no bloquea el carnet
  let jce: any = {}
  try { jce = await consultarJCE(cedula) } catch { /* JCE no disponible */ }

  // 3. QR generado en servidor
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const verifyUrl = `${appUrl}/verificar?cedula=${encodeURIComponent(cedula)}`
  let qrDataUrl   = ''

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QRCode = require('qrcode')
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 120, margin: 1,
      color: { dark: '#0D3B8C', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
  } catch {
    // Fallback a QR Server externo sin exponer error interno
    qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=0D3B8C&bgcolor=FFFFFF&data=${encodeURIComponent(verifyUrl)}`
  }

  return NextResponse.json({
    success: true,
    data: {
      cedula:             m.cedula,
      nombres:            m.nombres,
      apellidos:          m.apellidos,
      provincia:          m.provincia,
      municipio:          m.municipio,
      seccion:            m.seccion    ?? null,
      sector:             m.sector     ?? null,
      direccion:          m.direccion  ?? null,
      tipoMilitancia:     m.tipoMilitancia ?? 'Simpatizante',
      estado:             m.estado,
      fechaRegistro:      m.createdAt?.toISOString() ?? null,
      ocupacion:          m.ocupacion ?? null,
      qrDataUrl,
      verifyUrl,
      codigoColegio:      jce.codigoColegio?.trim()     ?? null,
      descripcionColegio: jce.descripcionColegio        ?? null,
      codigoRecinto:      jce.codigoRecinto?.trim()     ?? null,
      nombreRecinto:      jce.nombreRecinto             ?? null,
      direccionRecinto:   jce.direccionLarga || jce.direccionRecinto || null,
      circunscripcion:    jce.circunscripcion           ?? null,
      posPagina:          jce.posPagina                 ?? null,
      electoralProvincia: jce.provincia                 ?? null,
      electoralMunicipio: jce.municipio                 ?? null,
    },
  })
}