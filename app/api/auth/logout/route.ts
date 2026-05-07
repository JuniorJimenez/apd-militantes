import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('apd-admin-auth', '', {
    httpOnly: true, secure: false,
    sameSite: 'strict', path: '/', maxAge: 0,
  })
  return response
}
