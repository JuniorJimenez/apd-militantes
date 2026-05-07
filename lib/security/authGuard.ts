// lib/security/authGuard.ts
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'apd-admin-auth'

/** Token de sesión — leído directamente del env, compatible con Edge y Node */
function getSessionToken(): string {
  return process.env.ADMIN_SESSION_SECRET
    ?? process.env.ADMIN_PASS
    ?? 'dev-only-fallback'
}

/** Comparación en tiempo constante */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const cookie       = request.cookies.get(COOKIE_NAME)
  const sessionToken = getSessionToken()
  if (!cookie || !safeEqual(cookie.value, sessionToken)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  return null
}

export function getSessionTokenValue(): string {
  return getSessionToken()
}

export function validateOrigin(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin  = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host    = request.headers.get('host') ?? ''
  if (origin  && !origin.includes(host))  return false
  if (referer && !referer.includes(host)) return false
  return true
}

export function isSuspiciousUA(request: NextRequest): boolean {
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
  if (!ua) return true
  const bots = [
    'curl/', 'wget/', 'python-requests', 'java/', 'go-http-client',
    'libwww-perl', 'scrapy', 'okhttp', 'axios/0', 'node-fetch', 'httpie',
  ]
  return bots.some(b => ua.includes(b))
}
