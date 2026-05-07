// lib/security/rateLimit.ts
// Rate limiting con ventana deslizante en memoria
// Para producción con múltiples instancias, reemplazar con Redis

interface RateLimitStore {
  count:     number
  resetAt:   number
  blocked:   boolean
  blockedAt: number
}

const store = new Map<string, RateLimitStore>()

// Limpiar entradas expiradas cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((v, k) => {
      if (now > v.resetAt && !v.blocked) store.delete(k)
    })
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  windowMs:   number   // ventana en ms
  max:        number   // máx peticiones por ventana
  blockMs:    number   // tiempo de bloqueo tras exceder
}

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number
  retryAfter: number   // segundos hasta desbloqueo (0 si no bloqueado)
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)

  // Si está bloqueado
  if (entry?.blocked) {
    const retryAfter = Math.ceil((entry.blockedAt + config.blockMs - now) / 1000)
    if (retryAfter > 0) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter }
    }
    // Bloqueo expirado — resetear
    entry = undefined
    store.delete(key)
  }

  // Nueva entrada o ventana expirada
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + config.windowMs, blocked: false, blockedAt: 0 }
    store.set(key, entry)
    return { allowed: true, remaining: config.max - 1, resetAt: entry.resetAt, retryAfter: 0 }
  }

  entry.count++

  // Excedió el límite — bloquear
  if (entry.count > config.max) {
    entry.blocked   = true
    entry.blockedAt = now
    store.set(key, entry)
    const retryAfter = Math.ceil(config.blockMs / 1000)
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter }
  }

  store.set(key, entry)
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt, retryAfter: 0 }
}

// ─── Configuraciones predefinidas ─────────────────────────────────────────────
export const LIMITS = {
  // Consulta pública: 30 por minuto, bloqueo 5 min
  consulta:   { windowMs: 60_000,   max: 30,  blockMs: 5 * 60_000 },
  // Registro: 5 por hora, bloqueo 1 hora (evita spam de registros)
  registro:   { windowMs: 3_600_000, max: 5,  blockMs: 60 * 60_000 },
  // Login admin: 5 intentos por 15 min, bloqueo 30 min
  login:      { windowMs: 15 * 60_000, max: 5, blockMs: 30 * 60_000 },
  // API general: 100 por minuto
  api:        { windowMs: 60_000,   max: 100, blockMs: 5 * 60_000 },
  // Verificación de identidad mock
  verificationStart: { windowMs: 15 * 60_000, max: 10, blockMs: 30 * 60_000 },
  verificationStep:  { windowMs: 15 * 60_000, max: 30, blockMs: 30 * 60_000 },
}

