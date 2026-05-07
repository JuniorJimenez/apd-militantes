// app/api/auth/login/route.ts

import { NextRequest, NextResponse }  from 'next/server'
import { sanitizeText }               from '@/lib/security/sanitize'
import { getSessionTokenValue }        from '@/lib/security/authGuard'
import crypto                          from 'crypto'

/** Comparación en tiempo constante */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let acc = 1
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      acc |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length))
    }
    return false
  }
  let acc = 0
  for (let i = 0; i < a.length; i++) {
    acc |= (a.charCodeAt(i) ^ b.charCodeAt(i))
  }
  return acc === 0
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function POST(request: NextRequest) {
  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0')
    if (isNaN(contentLength) || contentLength > 1000) {
      return NextResponse.json({ success: false, error: 'Petición inválida' }, { status: 400 })
    }

    let body: { usuario?: unknown; contrasena?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Formato inválido' }, { status: 400 })
    }

    const usuario    = sanitizeText(String(body.usuario    ?? ''), 50)
    const contrasena = sanitizeText(String(body.contrasena ?? ''), 128)

    if (!usuario || !contrasena) {
      await delay(500)
      return NextResponse.json({ success: false, error: 'Completa todos los campos' }, { status: 400 })
    }

    const ADMIN_USER = process.env.ADMIN_USER ?? ''
    const ADMIN_PASS = process.env.ADMIN_PASS ?? ''

    if (!ADMIN_USER || !ADMIN_PASS) {
      console.error('[login] ADMIN_USER o ADMIN_PASS no configurados')
      await delay(500)
      return NextResponse.json({ success: false, error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const usuarioCorrecto    = timingSafeEqual(usuario,    ADMIN_USER)
    const contrasenaCorrecto = timingSafeEqual(contrasena, ADMIN_PASS)

    if (!usuarioCorrecto || !contrasenaCorrecto) {
      await delay(800 + Math.random() * 400)
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    // Token derivado de variable de entorno — no hardcodeado
    const sessionToken = getSessionTokenValue()

    const response = NextResponse.json({ success: true })
    response.cookies.set('apd-admin-auth', sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path:     '/',
      maxAge:   8 * 60 * 60, // 8 horas
    })

    return response
  } catch (error) {
    console.error('[POST /api/auth/login]', error)
    await delay(500)
    return NextResponse.json({ success: false, error: 'Error en el servidor' }, { status: 500 })
  }
}
