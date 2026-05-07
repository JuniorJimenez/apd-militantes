// lib/jce.ts
// Conexión al SQL Server local de la JCE — Padrón Electoral Dominicano
// Incluye colegio electoral, recinto y circunscripción

import sql from 'mssql'

const usarWindowsAuth = !process.env.JCE_DB_USER || process.env.JCE_DB_USER === ''

const JCE_CONFIG: sql.config = {
  server:   process.env.JCE_DB_HOST || 'localhost\\SQLEXPRESS',
  port:     parseInt(process.env.JCE_DB_PORT || '1433'),
  database: process.env.JCE_DB_NAME || 'dbPadronFeb2024',
  ...(usarWindowsAuth ? {} : {
    user:     process.env.JCE_DB_USER,
    password: process.env.JCE_DB_PASS,
  }),
  options: {
    encrypt:                false,
    trustServerCertificate: true,
    enableArithAbort:       true,
    trustedConnection:      usarWindowsAuth,
    useUTC:                 false,
  },
  connectionTimeout: 10000,
  requestTimeout:    10000,
}

let pool: sql.ConnectionPool | null = null

async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  pool = await new sql.ConnectionPool(JCE_CONFIG).connect()
  return pool
}

export interface JCEResultado {
  valida:             boolean
  cedula:             string
  nombres:            string | null
  apellido1:          string | null
  apellido2:          string | null
  nombresPlastico:    string | null
  apellidosPlastico:  string | null
  nombre:             string | null
  fechaNacimiento:    string | null
  sexo:               string | null
  estadoCivil:        string | null
  categoria:          string | null
  provincia:          string | null
  municipio:          string | null
  // Colegio electoral
  codigoColegio:      string | null
  descripcionColegio: string | null
  codigoRecinto:      string | null
  nombreRecinto:      string | null
  direccionRecinto:   string | null
  direccionLarga:     string | null
  circunscripcion:    string | null
  posPagina:          number | null
  // Estado
  inhabilitado:       boolean
  errorConexion?:     string
  error?:             string
}

export async function consultarJCE(cedula: string): Promise<JCEResultado> {
  const cedulaLimpia = cedula.replace(/[-\s]/g, '')

  const base: Omit<JCEResultado, 'valida' | 'cedula' | 'inhabilitado'> = {
    nombres: null, apellido1: null, apellido2: null,
    nombresPlastico: null, apellidosPlastico: null, nombre: null,
    fechaNacimiento: null, sexo: null, estadoCivil: null,
    categoria: null, provincia: null, municipio: null,
    codigoColegio: null, descripcionColegio: null,
    codigoRecinto: null, nombreRecinto: null,
    direccionRecinto: null, direccionLarga: null,
    circunscripcion: null, posPagina: null,
  }

  try {
    const db  = await getPool()
    const req = db.request().input('cedula', sql.VarChar(11), cedulaLimpia)

    const result = await req.query(`
      SELECT TOP 1
        p.Cedula,
        p.nombres,
        p.apellido1,
        p.apellido2,
        p.NombresPlastico,
        p.ApellidosPlastico,
        CONVERT(VARCHAR(10), p.FechaNacimiento, 120)  AS FechaNacimiento,
        p.CodigoColegio,
        p.CodigoRecinto,
        p.CodigoCircunscripcion,
        p.PosPagina,
        -- Lookups personales
        s.Descripcion                                  AS Sexo,
        ec.Descripcion                                 AS EstadoCivil,
        cat.Descripcion                                AS Categoria,
        prov.Descripcion                               AS Provincia,
        mun.Descripcion                                AS Municipio,
        -- Colegio electoral
        col.Descripcion                                AS DescripcionColegio,
        -- Recinto
        rec.CodigoRecinto                              AS CodigoRecintoDesc,
        rec.Descripcion                                AS NombreRecinto,
        rec.Direccion                                  AS DireccionRecinto,
        rec.DireccionLarga                             AS DireccionLarga,
        -- Circunscripción
        circ.Descripcion                               AS Circunscripcion
      FROM   Padron              p
      LEFT JOIN Sexo             s    ON s.IdSexo              = p.IdSexo
      LEFT JOIN EstadoCivil      ec   ON ec.ID                 = p.IdEstadoCivil
      LEFT JOIN Categoria        cat  ON cat.ID                = p.IdCategoria
      LEFT JOIN Provincia        prov ON prov.ID               = p.IdProvincia
      LEFT JOIN Municipio        mun  ON mun.ID                = p.IdMunicipio
      LEFT JOIN Colegio          col  ON col.CodigoColegio          = p.CodigoColegio
                                      AND col.IDMunicipio           = p.IdMunicipio
      LEFT JOIN Recinto          rec  ON rec.ID                     = col.IDRecinto
      LEFT JOIN Circunscripcion  circ ON circ.CodigoCircunscripcion = p.CodigoCircunscripcion
                                      AND circ.IDProvincia          = p.IdProvincia
      WHERE  p.Cedula = @cedula
    `)

    if (result.recordset.length === 0) {
      const inhResult = await db.request()
        .input('cedula', sql.VarChar(11), cedulaLimpia)
        .query(`
          SELECT TOP 1 Cedula, Nombres, Apellido1, Apellido2
          FROM   Inhabilitados
          WHERE  Cedula = @cedula
        `)

      if (inhResult.recordset.length > 0) {
        const r = inhResult.recordset[0]
        const nombreCompleto = [r.Nombres, r.Apellido1, r.Apellido2].filter(Boolean).join(' ').trim()
        return {
          ...base, valida: true, cedula,
          nombres: r.Nombres || null, apellido1: r.Apellido1 || null,
          apellido2: r.Apellido2 || null, nombre: nombreCompleto || null,
          inhabilitado: true,
        }
      }
      return { ...base, valida: false, cedula, inhabilitado: false }
    }

    const r = result.recordset[0]

    const nombreCompleto = (
      r.NombresPlastico
        ? `${r.NombresPlastico} ${r.ApellidosPlastico ?? ''}`.trim()
        : [r.nombres, r.apellido1, r.apellido2].filter(Boolean).join(' ').trim()
    ) || null

    const inhCheck = await db.request()
      .input('cedula2', sql.VarChar(11), cedulaLimpia)
      .query(`SELECT TOP 1 1 AS existe FROM Inhabilitados WHERE Cedula = @cedula2`)
    const inhabilitado = inhCheck.recordset.length > 0

    return {
      valida:            true,
      cedula,
      nombres:           r.nombres           || null,
      apellido1:         r.apellido1         || null,
      apellido2:         r.apellido2         || null,
      nombresPlastico:   r.NombresPlastico   || null,
      apellidosPlastico: r.ApellidosPlastico || null,
      nombre:            nombreCompleto,
      fechaNacimiento:   r.FechaNacimiento   || null,
      sexo:              r.Sexo              || null,
      estadoCivil:       r.EstadoCivil       || null,
      categoria:         r.Categoria         || null,
      provincia:         r.Provincia         || null,
      municipio:         r.Municipio         || null,
      // Colegio electoral
      codigoColegio:     r.CodigoColegio     || null,
      descripcionColegio:r.DescripcionColegio|| null,
      codigoRecinto:     r.CodigoRecintoDesc || null,
      nombreRecinto:     r.NombreRecinto     || null,
      direccionRecinto:  r.DireccionRecinto  || null,
      direccionLarga:    r.DireccionLarga    || null,
      circunscripcion:   r.Circunscripcion   || null,
      posPagina:         r.PosPagina         ?? null,
      inhabilitado,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[JCE consultarJCE]', msg)
    return {
      ...base, valida: false, cedula, inhabilitado: false,
      errorConexion: `No se pudo conectar al padrón JCE: ${msg}`,
    }
  }
}
