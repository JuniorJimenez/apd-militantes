// middleware.ts — Seguridad completa
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, LIMITS }         from '@/lib/security/rateLimit'

const COOKIE_NAME = 'apd-admin-auth'
const LOGIN_PATH  = '/admin/login'

const BOT_UA = [
  'curl/', 'wget/', 'python-requests', 'java/', 'go-http-client',
  'libwww-perl', 'scrapy', 'okhttp', 'node-fetch', 'httpie',
]

/** Token de sesión — leído directamente del env, sin crypto en Edge */
function getSessionToken(): string {
  return process.env.ADMIN_SESSION_SECRET
    ?? process.env.ADMIN_PASS
    ?? 'dev-only-fallback'
}

/** Comparación carácter a carácter sin timing leaks */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function applySecurityHeaders(res: NextResponse, pathname = ""): NextResponse {
  const h = res.headers
  h.set('X-Frame-Options',        'DENY')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-XSS-Protection',       '1; mode=block')
  h.set('Referrer-Policy',        'strict-origin-when-cross-origin')
  const allowCamera = pathname.startsWith('/verificacion-identidad') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/desafiliacion')
  h.set('Permissions-Policy', allowCamera ? 'camera=(self), microphone=(), geolocation=(), payment=()' : 'camera=(), microphone=(), geolocation=(), payment=()')
  if (process.env.NODE_ENV === 'production') {
    h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  h.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.qrserver.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

function jsonError(msg: string, status: number, retryAfter?: number): NextResponse {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (retryAfter) headers['Retry-After'] = String(retryAfter)
  return new NextResponse(JSON.stringify({ success: false, error: msg }), { status, headers })
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase()

  // 1. Métodos no permitidos
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  if (!allowedMethods.includes(request.method)) {
    return new NextResponse(null, { status: 405, headers: { Allow: allowedMethods.join(', ') } })
  }

  // 2. Content-Type en rutas mutantes
  if (['POST', 'PUT', 'PATCH'].includes(request.method) && pathname.startsWith('/api/')) {
    const ct = request.headers.get('content-type') ?? ''
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
      return jsonError('Content-Type no permitido', 415)
    }
  }

  // 3. Bloquear bots en registro
  if (pathname === '/api/militantes' && request.method === 'POST') {
    if (!ua || BOT_UA.some(b => ua.includes(b))) {
      return new NextResponse(
        JSON.stringify({ success: true, data: { id: 0 } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // 4. Rate limiting
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/auth/login') {
      const r = rateLimit(`login:${clientIP}`, LIMITS.login)
      if (!r.allowed) return jsonError(`Demasiados intentos. Espera ${r.retryAfter}s.`, 429, r.retryAfter)
    }
    if (pathname === '/api/militantes' && request.method === 'POST') {
      const r = rateLimit(`registro:${clientIP}`, LIMITS.registro)
      if (!r.allowed) return jsonError(`Límite alcanzado. Intenta en ${Math.ceil(r.retryAfter / 60)} min.`, 429, r.retryAfter)
    }
    if (pathname === '/api/consulta' || pathname === '/api/jce') {
      const r = rateLimit(`consulta:${clientIP}`, LIMITS.consulta)
      if (!r.allowed) return jsonError('Demasiadas consultas. Espera un momento.', 429, r.retryAfter)
    }
    const r = rateLimit(`api:${clientIP}`, LIMITS.api)
    if (!r.allowed) return jsonError('Límite de peticiones excedido.', 429, r.retryAfter)
  }

  // 5. Proteger rutas /admin (páginas y APIs de admin excepto login)
  if (pathname.startsWith('/admin') && !pathname.startsWith(LOGIN_PATH)) {
    const authCookie = request.cookies.get(COOKIE_NAME)
    const sessionToken = getSessionToken()
    if (!authCookie || !safeEqual(authCookie.value, sessionToken)) {
      const loginUrl = new URL(LOGIN_PATH, request.url)
      loginUrl.searchParams.set('from', pathname)
      return applySecurityHeaders(NextResponse.redirect(loginUrl), pathname)
    }
  }

  // 6. Proteger /api/reporte y /api/militantes GET con cookie admin
  if (pathname === '/api/reporte' && request.method === 'GET') {
    const authCookie = request.cookies.get(COOKIE_NAME)
    const sessionToken = getSessionToken()
    if (!authCookie || !safeEqual(authCookie.value, sessionToken)) {
      return jsonError('No autorizado', 401)
    }
  }

  if (pathname.startsWith('/api/verification/start')) {
    const r = rateLimit(`verification:start:${clientIP}`, LIMITS.verificationStart)
    if (!r.allowed) return jsonError('Demasiados intentos. Espera un momento.', 429, r.retryAfter)
  }

  if (pathname.startsWith('/api/verification/')) {
    const r = rateLimit(`verification:step:${clientIP}`, LIMITS.verificationStep)
    if (!r.allowed) return jsonError('Demasiados intentos de verificación. Espera un momento.', 429, r.retryAfter)
  }

  return applySecurityHeaders(NextResponse.next(), pathname)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|geo/).*)',
  ],
}
