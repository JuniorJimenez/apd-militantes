// app/api/consulta/route.ts

import { NextRequest, NextResponse } from 'next/server'

export interface ConsultaResponse {
  cedula:       string
  valida:       boolean
  inhabilitado: boolean
  jce: {
    nombre:             string | null
    nombres:            string | null
    apellido1:          string | null
    apellido2:          string | null
    nombresPlastico:    string | null
    apellidosPlastico:  string | null
    sexo:               string | null
    estadoCivil:        string | null
    categoria:          string | null
    fechaNacimiento:    string | null
    provincia:          string | null
    municipio:          string | null
    codigoColegio:      string | null
    descripcionColegio: string | null
    codigoRecinto:      string | null
    nombreRecinto:      string | null
    direccionRecinto:   string | null
    direccionLarga:     string | null
    circunscripcion:    string | null
    errorConexion?:     string
  }
  apd: {
    registrado:             boolean
    estado?:                string
    ocupacion?:             string | null
    tipoMilitancia?:        string | null
    fechaRegistro?:         string
    desafiliadoFormalmente?: boolean
  }
  mensaje: string
}

const JCE_VACIO: ConsultaResponse['jce'] & { valida: boolean; inhabilitado: boolean } = {
  nombre: null, nombres: null, apellido1: null, apellido2: null,
  nombresPlastico: null, apellidosPlastico: null, sexo: null,
  estadoCivil: null, categoria: null, fechaNacimiento: null,
  provincia: null, municipio: null,
  codigoColegio: null, descripcionColegio: null, codigoRecinto: null,
  nombreRecinto: null, direccionRecinto: null, direccionLarga: null,
  circunscripcion: null,
  valida: false, inhabilitado: false, errorConexion: undefined as string | undefined,
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cedula = searchParams.get('cedula')?.trim()

  if (!cedula) {
    return NextResponse.json({ success: false, error: 'Parámetro cédula requerido' }, { status: 400 })
  }

  const soloDigitos = cedula.replace(/[-\s]/g, '')
  if (soloDigitos.length !== 11 || !/^\d+$/.test(soloDigitos)) {
    return NextResponse.json({ success: false, error: 'Formato de cédula inválido' }, { status: 400 })
  }

  // ── 1. Consultar JCE ─────────────────────────────────────────────────────
  let jceResult = { ...JCE_VACIO }
  const jceHost = process.env.JCE_DB_HOST || ''

  // Intentar JCE si el host está configurado
  if (jceHost && jceHost !== '') {
    try {
      const { consultarJCE } = await import('@/lib/jce')
      const jce = await consultarJCE(cedula)
      jceResult = {
        nombre:             jce.nombre             ?? null,
        nombres:            jce.nombres            ?? null,
        apellido1:          jce.apellido1          ?? null,
        apellido2:          jce.apellido2          ?? null,
        nombresPlastico:    jce.nombresPlastico    ?? null,
        apellidosPlastico:  jce.apellidosPlastico  ?? null,
        sexo:               jce.sexo               ?? null,
        estadoCivil:        jce.estadoCivil        ?? null,
        categoria:          jce.categoria          ?? null,
        fechaNacimiento:    jce.fechaNacimiento    ?? null,
        provincia:          jce.provincia          ?? null,
        municipio:          jce.municipio          ?? null,
        codigoColegio:      jce.codigoColegio      ?? null,
        descripcionColegio: jce.descripcionColegio ?? null,
        codigoRecinto:      jce.codigoRecinto      ?? null,
        nombreRecinto:      jce.nombreRecinto      ?? null,
        direccionRecinto:   jce.direccionRecinto   ?? null,
        direccionLarga:     jce.direccionLarga     ?? null,
        circunscripcion:    jce.circunscripcion    ?? null,
        valida:             jce.valida,
        inhabilitado:       jce.inhabilitado,
        errorConexion:      jce.errorConexion,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      jceResult.errorConexion = `JCE no disponible: ${msg}`
      jceResult.valida = true
    }
  }

  // ── 2. Consultar BD APD ──────────────────────────────────────────────────
  let militanteAPD: {
    estado: string; ocupacion: string | null
    tipoMilitancia: string | null; createdAt: Date
    desafiliaciones?: { id: string }[]
  } | null = null

  try {
    const { prisma } = await import('@/lib/prisma')
    militanteAPD = await prisma.militante.findUnique({
      where:  { cedula },
      select: {
        estado: true, ocupacion: true, tipoMilitancia: true, createdAt: true,
        desafiliaciones: { where: { estado: 'CERRADA' }, take: 1, select: { id: true } },
      },
    }) as any
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[APD DB error]', msg)
    return NextResponse.json(
      { success: false, error: `Error al consultar la base de datos APD: ${msg}` },
      { status: 500 }
    )
  }

  // ── 3. Mensaje ────────────────────────────────────────────────────────────
  const nombre = jceResult.nombre ?? `Cédula ${cedula}`
  let mensaje: string

  if (jceResult.errorConexion && !jceResult.nombre) {
    mensaje = militanteAPD
      ? `La cédula está en el padrón APD (${militanteAPD.estado.toLowerCase()}). JCE no disponible.`
      : `No se pudo verificar el padrón JCE. La cédula tampoco figura en APD.`
  } else if (!jceResult.valida) {
    mensaje = `La cédula ${cedula} no existe en el padrón electoral de la JCE.`
  } else if (jceResult.inhabilitado && !militanteAPD) {
    mensaje = `${nombre} figura en el padrón JCE pero está inhabilitado/a y no está en APD.`
  } else if (jceResult.inhabilitado && militanteAPD) {
    mensaje = `${nombre} está en APD (${militanteAPD.estado.toLowerCase()}), aunque inhabilitado/a en JCE.`
  } else if (militanteAPD) {
    const lbl = militanteAPD.estado === 'ACTIVO' ? 'militante activo/a' :
                militanteAPD.estado === 'PENDIENTE' ? 'registro pendiente' : 'militante inactivo/a'
    mensaje = `${nombre} está registrado/a como ${lbl} de la Alianza por la Democracia.`
  } else {
    mensaje = `${nombre} no está registrado/a como militante de la Alianza por la Democracia.`
  }

  const response: ConsultaResponse = {
    cedula,
    valida:       jceResult.valida,
    inhabilitado: jceResult.inhabilitado,
    jce: {
      nombre:             jceResult.nombre,
      nombres:            jceResult.nombres,
      apellido1:          jceResult.apellido1,
      apellido2:          jceResult.apellido2,
      nombresPlastico:    jceResult.nombresPlastico,
      apellidosPlastico:  jceResult.apellidosPlastico,
      sexo:               jceResult.sexo,
      estadoCivil:        jceResult.estadoCivil,
      categoria:          jceResult.categoria,
      fechaNacimiento:    jceResult.fechaNacimiento,
      provincia:          jceResult.provincia,
      municipio:          jceResult.municipio,
      codigoColegio:      jceResult.codigoColegio,
      descripcionColegio: jceResult.descripcionColegio,
      codigoRecinto:      jceResult.codigoRecinto,
      nombreRecinto:      jceResult.nombreRecinto,
      direccionRecinto:   jceResult.direccionRecinto,
      direccionLarga:     jceResult.direccionLarga,
      circunscripcion:    jceResult.circunscripcion,
      errorConexion:      jceResult.errorConexion,
    },
    apd: {
      registrado:           !!militanteAPD,
      estado:               militanteAPD?.estado,
      ocupacion:            militanteAPD?.ocupacion,
      tipoMilitancia:       militanteAPD?.tipoMilitancia,
      fechaRegistro:        militanteAPD?.createdAt.toISOString(),
      desafiliadoFormalmente: (militanteAPD?.desafiliaciones?.length ?? 0) > 0,
    },
    mensaje,
  }

  return NextResponse.json({ success: true, data: response })
}
