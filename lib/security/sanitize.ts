// lib/security/sanitize.ts

// ─── Sanitizar texto libre (elimina HTML/scripts, conserva apóstrofes y guiones) ──
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')              // elimina tags HTML
    .replace(/javascript:/gi, '')         // elimina js: URIs
    .replace(/on\w+\s*=/gi, '')           // elimina event handlers
    .replace(/\x00/g, '')                 // elimina null bytes
    .trim()
    .slice(0, maxLen)
}

// ─── Sanitizar nombre propio ────────────────────────────────────────────────
// Permite: letras (incluyendo acentos, ñ), espacios, guiones, apóstrofes y puntos
export function sanitizeName(input: unknown, maxLen = 100): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[^a-záéíóúüñàèìòùâêîôûçäëïöüA-ZÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÇÄËÏÖÜ\s\-'\.0-9,#]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

// ─── Validar cédula dominicana (Luhn modificado) ────────────────────────────
export function validarCedula(cedula: string): boolean {
  const clean = cedula.replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(clean)) return false
  const digits = clean.split('').map(Number)
  const check  = digits[10]
  const sum    = digits.slice(0, 10).reduce((acc, d, i) => {
    const n = d * (i % 2 === 0 ? 1 : 2)
    return acc + (n > 9 ? n - 9 : n)
  }, 0)
  return (10 - (sum % 10)) % 10 === check
}

// ─── Validar teléfono ────────────────────────────────────────────────────────
export function validarTelefono(tel: string): boolean {
  if (!tel) return false
  const clean  = tel.replace(/\D/g, '')
  const digits = (clean.startsWith('1') && clean.length === 11) ? clean.slice(1) : clean
  return digits.length === 10
}

// ─── Validar email ───────────────────────────────────────────────────────────
export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

// ─── Detectar patrones de inyección realmente peligrosos ────────────────────
// C10: Rediseñado para no bloquear ' o -- en nombres y textos legítimos.
// Solo actúa cuando hay combinaciones que indican ataque real.
export function detectaInyeccion(input: string): boolean {
  const SCRIPT = [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /document\.(cookie|write|location)/i,
    /window\.(location|open)/i,
    /<iframe/i,
    /\x00/,                               // null byte
  ]

  // SQL injection: solo patrones que combinan palabras clave con contexto peligroso
  const SQL = [
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|TRUNCATE)\b/i,
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    /'\s*OR\s+'?\d/i,                     // ' OR '1
    /'\s*OR\s+'\w+'\s*=\s*'\w+/i,        // ' OR 'a'='a
    /'\s*;\s*--/,                          // '; --
    /xp_\w+/i,                            // SQL Server stored procs
  ]

  return SCRIPT.some(p => p.test(input)) || SQL.some(p => p.test(input))
}

// ─── Validar payload completo de militante ───────────────────────────────────
export interface ValidacionResult {
  valido:  boolean
  errores: string[]
  datos:   Record<string, string | null>
}

export function validarPayloadMilitante(body: Record<string, unknown>): ValidacionResult {
  const errores: string[] = []
  const datos: Record<string, string | null> = {}

  // C10: Detectar inyección campo por campo con la función rediseñada
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' && detectaInyeccion(v)) {
      errores.push(`Campo '${k}' contiene caracteres no permitidos`)
    }
  }
  if (errores.length > 0) return { valido: false, errores, datos }

  const nombres   = sanitizeName(body.nombres,   80)
  const apellidos = sanitizeName(body.apellidos, 80)
  const cedula    = typeof body.cedula   === 'string' ? body.cedula.trim()   : ''
  const telefono  = typeof body.telefono === 'string' ? body.telefono.trim() : ''
  const provincia = sanitizeName(body.provincia, 60)
  const municipio = sanitizeName(body.municipio, 80)

  if (!nombres   || nombres.length   < 2) errores.push('Nombres inválidos')
  if (!apellidos || apellidos.length < 2) errores.push('Apellidos inválidos')
  if (!validarCedula(cedula))             errores.push('Cédula inválida')
  if (!validarTelefono(telefono))         errores.push('Teléfono inválido')
  if (!provincia)                         errores.push('Provincia requerida')
  if (!municipio)                         errores.push('Municipio requerido')

  const email = typeof body.email === 'string' && body.email ? body.email.trim() : null
  if (email && !validarEmail(email)) errores.push('Correo electrónico inválido')

  datos.nombres     = nombres
  datos.apellidos   = apellidos
  datos.cedula      = cedula
  datos.telefono    = telefono
  datos.provincia   = provincia
  datos.municipio   = municipio
  datos.email       = email
  datos.telefonoAlt = typeof body.telefonoAlt === 'string' ? sanitizeText(body.telefonoAlt, 20) : null
  datos.sexo        = typeof body.sexo        === 'string' ? sanitizeText(body.sexo,        30) : null
  datos.estadoCivil = typeof body.estadoCivil === 'string' ? sanitizeText(body.estadoCivil, 30) : null
  datos.sector      = typeof body.sector      === 'string' ? sanitizeName(body.sector,     100) : null
  datos.direccion   = typeof body.direccion   === 'string' ? sanitizeText(body.direccion,  250) : null
  datos.ocupacion   = typeof body.ocupacion   === 'string' ? sanitizeText(body.ocupacion,  200) : null
  datos.motivo      = typeof body.motivo      === 'string' ? sanitizeText(body.motivo,    1000) : null

  return { valido: errores.length === 0, errores, datos }
}

// ─── Obtener IP real del cliente ─────────────────────────────────────────────
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP    = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIP)    return realIP.trim()
  return 'unknown'
}
