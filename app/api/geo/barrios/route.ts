// app/api/geo/barrios/route.ts
// Devuelve los barrios/parajes de un municipio específico
// Los datos vienen de barrios_lookup.json (ONE 2019 — 11,931 barrios)
// Se carga solo cuando el usuario selecciona un municipio

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

let cache: Record<string, string[]> | null = null

function getLookup(): Record<string, string[]> {
  if (cache) return cache
  const filePath = join(process.cwd(), 'lib', 'barrios_lookup.json')
  const raw = readFileSync(filePath, 'utf-8')
  cache = JSON.parse(raw)
  return cache!
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const codigo = searchParams.get('municipio')?.trim()  // e.g. "25-01"

  if (!codigo) {
    return NextResponse.json(
      { success: false, error: 'Parámetro municipio requerido (ej: 25-01)' },
      { status: 400 }
    )
  }

  try {
    const lookup  = getLookup()
    const barrios = lookup[codigo] ?? []

    return NextResponse.json(
      { success: true, municipio: codigo, barrios },
      {
        headers: {
          // Cache por 24 horas — los datos no cambian frecuentemente
          'Cache-Control': 'public, max-age=86400',
        },
      }
    )
  } catch (err) {
    console.error('[GET /api/geo/barrios]', err)
    return NextResponse.json(
      { success: false, error: 'Error al cargar los datos geográficos' },
      { status: 500 }
    )
  }
}
