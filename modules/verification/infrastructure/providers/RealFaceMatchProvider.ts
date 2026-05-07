// RealFaceMatchProvider.ts
// Comparación de imágenes server-side usando sharp.
// Realiza una comparación de similitud de histogramas (no biometría facial real).
// Para cotejo biométrico productivo real se requiere un proveedor externo
// autorizado y cumplimiento con Ley 172-13 RD.

import sharp from 'sharp'
import type { FaceMatchResult, FaceMatchProvider } from '../../domain/interfaces/FaceMatchProvider'

const HISTOGRAM_BINS    = 64   // bins por canal RGB
const MATCH_THRESHOLD   = 0.72 // umbral de similitud para match automático
const REVIEW_THRESHOLD  = 0.50 // por debajo → rechazo, entre → revisión

export class RealFaceMatchProvider implements FaceMatchProvider {
  setMockBehavior(_: 'always_match' | 'always_no_match' | 'manual_review'): void {
    // No-op en proveedor real
  }

  async compareFaces(
    capturedBuffer: Buffer,
    referenceBuffer: Buffer,
    options?: { threshold?: number }
  ): Promise<FaceMatchResult> {
    const matchThreshold  = options?.threshold ?? MATCH_THRESHOLD
    const reviewThreshold = Math.min(matchThreshold * 0.7, REVIEW_THRESHOLD)

    try {
      const [capturedHist, referenceHist] = await Promise.all([
        computeNormalizedHistogram(capturedBuffer),
        computeNormalizedHistogram(referenceBuffer),
      ])

      const similarity = bhattacharyyaSimilarity(capturedHist, referenceHist)
      const confidence = Math.round(similarity * 100)

      if (similarity >= matchThreshold) {
        return {
          matched:             true,
          confidence,
          requiresManualReview: false,
          message:             `Similitud suficiente (${confidence}%)`,
        }
      }

      if (similarity >= reviewThreshold) {
        return {
          matched:             false,
          confidence,
          requiresManualReview: true,
          message:             `Similitud en zona gris (${confidence}%) — se requiere revisión manual`,
        }
      }

      return {
        matched:             false,
        confidence,
        requiresManualReview: false,
        message:             `Similitud insuficiente (${confidence}%)`,
      }

    } catch {
      // Error de imagen → revisión manual segura
      return {
        matched:             false,
        confidence:          0,
        requiresManualReview: true,
        message:             'No se pudo comparar las imágenes — se requiere revisión manual',
      }
    }
  }
}

// ── Utilidades ─────────────────────────────────────────────────────────────────

async function computeNormalizedHistogram(buf: Buffer): Promise<number[]> {
  // Redimensionar a 128×128 para normalizar las capturas y acelerar cómputo
  const { data } = await sharp(buf)
    .resize(128, 128, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bins = new Array(HISTOGRAM_BINS * 3).fill(0)
  const step = 256 / HISTOGRAM_BINS

  for (let i = 0; i < data.length; i += 3) {
    const r = Math.floor(data[i]     / step)
    const g = Math.floor(data[i + 1] / step)
    const b = Math.floor(data[i + 2] / step)
    bins[r]++
    bins[HISTOGRAM_BINS + g]++
    bins[HISTOGRAM_BINS * 2 + b]++
  }

  const totalPixels = (data.length / 3) * 3
  return bins.map(v => v / totalPixels)
}

/** Similitud de Bhattacharyya entre dos histogramas normalizados (0 = sin similitud, 1 = idénticos) */
function bhattacharyyaSimilarity(h1: number[], h2: number[]): number {
  let coeff = 0
  for (let i = 0; i < h1.length; i++) {
    coeff += Math.sqrt(h1[i] * h2[i])
  }
  return Math.min(1, Math.max(0, coeff))
}
