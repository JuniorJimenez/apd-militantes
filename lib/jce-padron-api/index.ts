// lib/jce-padron-api/index.ts
// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: Verificación de multiplicidad de afiliaciones via API JCE
// ══════════════════════════════════════════════════════════════════════════════
//
// PROPÓSITO REGLAMENTARIO:
//   Art. 2(j) — Multiplicidad de afiliaciones: ciudadano en dos o más padrones
//   Art. 2(k) — Inactivo/a: afiliado en múltiples organizaciones sin oficializar
//   Art. 4, Párr. III — La JCE realiza cruces de padrones y marca inactivos
//
// INTEGRACIÓN REQUERIDA:
//   Este módulo está estructurado para conectarse con la API oficial de la JCE
//   una vez esta esté disponible. Actualmente opera en modo MOCK/STUB.
//
//   Para activar la integración real:
//   1. Obtener credenciales en la Dirección de Partidos Políticos - JCE
//   2. Configurar las variables de entorno (ver .env.example abajo)
//   3. Cambiar JCE_PADRON_API_MODE=real en .env.production
//
// VARIABLES DE ENTORNO REQUERIDAS:
//   JCE_PADRON_API_URL=https://api.jce.gob.do/v1/padron        (URL base)
//   JCE_PADRON_API_KEY=<clave-otorgada-por-JCE>                 (API key)
//   JCE_PADRON_API_SECRET=<secreto-otorgado-por-JCE>            (secret)
//   JCE_PADRON_API_PARTY_CODE=APD                               (código partido)
//   JCE_PADRON_API_MODE=mock                                    (mock|real)
//   JCE_PADRON_API_TIMEOUT=8000                                 (ms)
//
// ══════════════════════════════════════════════════════════════════════════════

export type AfiliacionEstadoJCE =
  | 'no_afiliado'          // No figura en ningún padrón activo
  | 'afiliado_otro_partido' // Figura activo en otra organización política
  | 'inactivo_multiple'    // Figura en múltiples padrones — estado inactivo JCE
  | 'afiliado_mismo_partido' // Ya figura en APD (coincidencia de padrón)
  | 'error_consulta'       // No se pudo consultar la API JCE
  | 'api_no_disponible'    // API JCE no configurada (modo mock)

export interface AfiliacionJCEResponse {
  cedula:          string
  estado:          AfiliacionEstadoJCE
  nombrePartido?:  string   // Nombre del partido donde figura afiliado
  idPartido?:      string   // Código numérico JCE del partido
  fechaAfiliacion?: string  // Fecha de afiliación en ese partido (si disponible)
  consultadoEn:    string   // ISO timestamp de la consulta
  fuente:          'api_jce' | 'mock'
}

// ── Configuración ─────────────────────────────────────────────────────────────
const API_URL        = process.env.JCE_PADRON_API_URL    ?? ''
const API_KEY        = process.env.JCE_PADRON_API_KEY    ?? ''
const API_SECRET     = process.env.JCE_PADRON_API_SECRET ?? ''
const PARTY_CODE     = process.env.JCE_PADRON_API_PARTY_CODE ?? 'APD'
const MODE           = process.env.JCE_PADRON_API_MODE   ?? 'mock'
const TIMEOUT_MS     = parseInt(process.env.JCE_PADRON_API_TIMEOUT ?? '8000', 10)

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — punto de entrada para el módulo de registro
// ══════════════════════════════════════════════════════════════════════════════

export async function verificarAfiliacionEnJCE(
  cedula: string
): Promise<AfiliacionJCEResponse> {
  const cedulaLimpia = cedula.replace(/\D/g, '')

  if (MODE !== 'real' || !API_URL || !API_KEY) {
    // Modo mock — no bloquea el registro, solo registra que no hay API configurada
    return {
      cedula:       cedulaLimpia,
      estado:       'api_no_disponible',
      consultadoEn: new Date().toISOString(),
      fuente:       'mock',
    }
  }

  return consultarAPIJCE(cedulaLimpia)
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPLEMENTACIÓN REAL — conecta con la API HTTP de la JCE
// Se activa cuando JCE_PADRON_API_MODE=real y las credenciales están configuradas
// ══════════════════════════════════════════════════════════════════════════════

async function consultarAPIJCE(cedula: string): Promise<AfiliacionJCEResponse> {
  const consultadoEn = new Date().toISOString()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    // ── Aquí va el endpoint real de la JCE ─────────────────────────────────
    // La estructura exacta (ruta, método, formato de autenticación y body)
    // debe confirmarse con la Dirección Nacional de Informática de la JCE
    // al momento de gestionar las credenciales de acceso.
    //
    // Estructura tentativa (sujeta a confirmación JCE):
    //   POST https://api.jce.gob.do/v1/padron/afiliaciones/consulta
    //   Authorization: Bearer <token>
    //   X-Party-Code: APD
    //   X-Api-Key: <API_KEY>
    //   Body: { cedula: "00100000017" }
    //
    // Respuesta esperada (estructura tentativa):
    //   {
    //     cedula: "00100000017",
    //     estado: "activo" | "inactivo" | "no_registrado",
    //     partido: { id: "12", nombre: "PRM" },
    //     fechaAfiliacion: "2023-08-01"
    //   }
    // ───────────────────────────────────────────────────────────────────────

    const res = await fetch(`${API_URL}/afiliaciones/consulta`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-Api-Secret':  API_SECRET,
        'X-Party-Code':  PARTY_CODE,
      },
      body: JSON.stringify({ cedula }),
    })
    clearTimeout(timer)

    if (!res.ok) {
      console.warn(`[JCE padron API] HTTP ${res.status} para cédula ${cedula}`)
      return { cedula, estado: 'error_consulta', consultadoEn, fuente: 'api_jce' }
    }

    const data = await res.json()
    return mapearRespuestaJCE(cedula, data, consultadoEn)

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[JCE padron API] Timeout para cédula ${cedula}`)
    } else {
      console.error(`[JCE padron API] Error:`, err?.message)
    }
    return { cedula, estado: 'error_consulta', consultadoEn, fuente: 'api_jce' }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAPPER — adapta la respuesta JCE al tipo interno
// Ajustar según la estructura real de respuesta cuando se reciban las credenciales
// ══════════════════════════════════════════════════════════════════════════════

function mapearRespuestaJCE(
  cedula: string,
  data:   any,
  consultadoEn: string
): AfiliacionJCEResponse {
  const base = { cedula, consultadoEn, fuente: 'api_jce' as const }

  // Ajustar los nombres de campo según la respuesta real de la JCE
  const estadoJCE    = data?.estado ?? data?.status ?? null
  const partidoNombre = data?.partido?.nombre ?? data?.organizacion?.nombre ?? null
  const partidoId    = String(data?.partido?.id ?? data?.organizacion?.id ?? '')

  // El ciudadano no figura en ningún padrón activo
  if (!estadoJCE || estadoJCE === 'no_registrado' || estadoJCE === 'no_afiliado') {
    return { ...base, estado: 'no_afiliado' }
  }

  // El ciudadano ya figura en APD — coincidencia de padrón
  if (partidoNombre?.toUpperCase().includes('ALIANZA') ||
      partidoNombre?.toUpperCase().includes('APD') ||
      partidoId === PARTY_CODE) {
    return { ...base, estado: 'afiliado_mismo_partido', nombrePartido: partidoNombre, idPartido: partidoId }
  }

  // Ciudadano inactivo por multiplicidad (figura en más de un padrón)
  if (estadoJCE === 'inactivo' || estadoJCE === 'multiple') {
    return {
      ...base, estado: 'inactivo_multiple',
      nombrePartido:  partidoNombre,
      idPartido:      partidoId,
      fechaAfiliacion: data?.fechaAfiliacion ?? null,
    }
  }

  // Ciudadano activo en otro partido
  if (estadoJCE === 'activo' || estadoJCE === 'afiliado') {
    return {
      ...base, estado: 'afiliado_otro_partido',
      nombrePartido:  partidoNombre,
      idPartido:      partidoId,
      fechaAfiliacion: data?.fechaAfiliacion ?? null,
    }
  }

  // Estado desconocido — tratar como error no bloqueante
  return { ...base, estado: 'error_consulta' }
}
