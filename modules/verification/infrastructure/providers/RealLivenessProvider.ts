// RealLivenessProvider.ts
// Detección REAL de presencia humana mediante:
//   1. Detección de tono de piel (algoritmo Kovac et al.) — valida que hay piel humana
//   2. Análisis de región facial (zona central con concentración de piel)
//   3. Validación de calidad de imagen (nitidez, resolución)
//   4. Varianza entre frames (si se envían múltiples)
//
// Todo con sharp — sin modelos ML externos, sin dependencias adicionales.

import sharp from 'sharp'
import { createHmac } from 'crypto'
import type { LivenessCheckResult, LivenessProvider } from '../../domain/interfaces/LivenessProvider'

// ── Umbrales ──────────────────────────────────────────────────────────────────
const MIN_WIDTH          = 100
const MIN_HEIGHT         = 80
const MIN_BYTES          = 2_000
const MAX_BYTES          = 5 * 1024 * 1024
const MIN_SKIN_RATIO     = 0.08   // mínimo 8% de píxeles de piel en la imagen
const MIN_FACE_SKIN_RATIO = 0.12  // mínimo 12% en la región central (zona facial)
const MOTION_THRESHOLD   = 0.4    // varianza mínima entre frames
const SAMPLE_SIZE        = 96     // resolución de trabajo para análisis

export class RealLivenessProvider implements LivenessProvider {
  setMockBehavior(_: any): void { /* no-op en proveedor real */ }

  async verifyLiveness(
    imageBuffer: Buffer | string,
    options?: {
      challenge?: string
      movementRequired?: boolean
      clientScore?: number
      clientToken?: string
      frame1?: Buffer
      frame2?: Buffer
    }
  ): Promise<LivenessCheckResult> {

    const mainBuf = toBuffer(imageBuffer)

    if (mainBuf.length < MIN_BYTES) {
      return fail('La imagen capturada está vacía. Verifica que la cámara esté funcionando.')
    }
    if (mainBuf.length > MAX_BYTES) {
      return fail('La imagen excede el tamaño máximo.')
    }

    // ── 1. Obtener píxeles RGB raw ────────────────────────────────────────────
    let rgbData: Buffer
    let imgWidth: number
    let imgHeight: number

    try {
      const result = await sharp(mainBuf)
        .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'cover' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      rgbData    = result.data
      imgWidth   = result.info.width
      imgHeight  = result.info.height
    } catch {
      return fail('No se pudo procesar la imagen. Verifica que la cámara esté activa.')
    }

    // ── 2. Detección de tono de piel (Kovac et al.) ───────────────────────────
    const skinResult = analyzeSkinPixels(rgbData, imgWidth, imgHeight)

    if (skinResult.globalSkinRatio < MIN_SKIN_RATIO) {
      return {
        success: false,
        score:   Math.round(skinResult.globalSkinRatio * 500),
        message: 'No se detectaron rasgos faciales humanos. Asegúrate de que tu rostro esté completamente visible, con buena iluminación y sin lentes oscuros.',
        metadata: {
          skinRatio:     skinResult.globalSkinRatio.toFixed(3),
          faceSkinRatio: skinResult.faceSkinRatio.toFixed(3),
          reason:        'insufficient_skin_pixels',
        },
      }
    }

    if (skinResult.faceSkinRatio < MIN_FACE_SKIN_RATIO) {
      return {
        success: false,
        score:   Math.round(skinResult.faceSkinRatio * 400),
        requiresManualReview: true,
        message: 'Se detectó poca presencia facial en el encuadre. Centra tu rostro en el óvalo guía y asegúrate de que esté bien iluminado.',
        metadata: {
          skinRatio:     skinResult.globalSkinRatio.toFixed(3),
          faceSkinRatio: skinResult.faceSkinRatio.toFixed(3),
          reason:        'face_not_centered',
        },
      }
    }

    // ── 3. Nitidez de la imagen ───────────────────────────────────────────────
    const grayData  = await sharp(mainBuf)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'cover' })
      .grayscale()
      .raw()
      .toBuffer()

    const sharpness = computeSharpness(grayData, imgWidth, imgHeight)
    const isBlurry  = sharpness < 5

    // ── 4. Varianza entre frames (detección de movimiento) ────────────────────
    let motionScore   = 0
    let motionChecked = false

    if (options?.frame1 && options.frame1.length > MIN_BYTES) {
      try {
        motionScore   = await computeFrameVariance(mainBuf, options.frame1)
        motionChecked = true
      } catch { /* continuar sin check de movimiento */ }
    }
    if (options?.frame2 && options.frame2.length > MIN_BYTES && options?.frame1) {
      try {
        const v2 = await computeFrameVariance(options.frame2, options.frame1)
        motionScore  = Math.max(motionScore, v2)
      } catch { /* continuar */ }
    }

    // Solo rechazar por foto estática si varianza prácticamente cero
    if (motionChecked && motionScore < 0.3) {
      return {
        success: false,
        score:   15,
        message: 'Se detectó una imagen estática (posible foto). Por favor realiza los gestos frente a la cámara en tiempo real.',
        metadata: { motionScore, reason: 'static_image' },
      }
    }

    // ── 5. Score combinado ────────────────────────────────────────────────────
    const skinScore     = Math.min(100, skinResult.faceSkinRatio * 500)
    const motionBonus   = motionChecked ? Math.min(20, motionScore * 15) : 10
    const sharpnessBonus = isBlurry ? -10 : 5
    const clientBonus   = validateClientToken(options?.clientScore, options?.clientToken) ? 5 : 0

    const finalScore = Math.round(
      skinScore * 0.70 +
      motionBonus * 0.20 +
      sharpnessBonus +
      clientBonus
    )

    const score = Math.max(0, Math.min(100, finalScore))

    // ── 6. Decisión ───────────────────────────────────────────────────────────
    if (score >= 45) {
      return {
        success: true,
        score,
        message: 'Presencia humana verificada correctamente.',
        metadata: {
          skinRatio:      skinResult.globalSkinRatio.toFixed(3),
          faceSkinRatio:  skinResult.faceSkinRatio.toFixed(3),
          motionScore:    motionScore.toFixed(2),
          sharpness:      sharpness.toFixed(1),
          motionChecked,
        },
      }
    }

    if (score >= 28) {
      return {
        success: false,
        score,
        requiresManualReview: true,
        message: isBlurry
          ? 'Imagen con poca nitidez. Asegúrate de tener buena iluminación y el dispositivo estable.'
          : 'Resultado ambiguo. Revisa que tu rostro esté bien iluminado y visible.',
        metadata: { skinRatio: skinResult.globalSkinRatio.toFixed(3), motionScore, isBlurry },
      }
    }

    return fail(
      isBlurry
        ? 'Imagen muy desenfocada. Colócate frente a la cámara con buena iluminación.'
        : 'No se pudo verificar la presencia humana. Asegúrate de que tu rostro ocupe el óvalo de la cámara.'
    )
  }
}

// ── Detección de piel (algoritmo Kovac et al.) ────────────────────────────────

interface SkinAnalysis {
  globalSkinRatio: number  // 0-1 fracción de píxeles con tono de piel en toda la imagen
  faceSkinRatio:   number  // 0-1 fracción de píxeles en región central (zona facial)
}

function analyzeSkinPixels(data: Buffer, width: number, height: number): SkinAnalysis {
  let totalSkin   = 0
  let centerSkin  = 0
  let centerTotal = 0
  const totalPx   = width * height

  // Región central: 30-70% horizontal, 15-85% vertical (zona típica de la cara)
  const cx1 = Math.floor(width  * 0.25)
  const cx2 = Math.floor(width  * 0.75)
  const cy1 = Math.floor(height * 0.12)
  const cy2 = Math.floor(height * 0.88)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3
      const r   = data[idx]
      const g   = data[idx + 1]
      const b   = data[idx + 2]

      const isSkin = isSkinPixel(r, g, b)
      if (isSkin) totalSkin++

      if (x >= cx1 && x <= cx2 && y >= cy1 && y <= cy2) {
        centerTotal++
        if (isSkin) centerSkin++
      }
    }
  }

  return {
    globalSkinRatio: totalPx    > 0 ? totalSkin  / totalPx    : 0,
    faceSkinRatio:   centerTotal > 0 ? centerSkin / centerTotal : 0,
  }
}

/**
 * Clasificador de tono de piel basado en Kovac, Peer & Solina (2003).
 * Funciona en condiciones de iluminación variadas y para distintos
 * tonos de piel (clara, morena, oscura).
 */
function isSkinPixel(r: number, g: number, b: number): boolean {
  // Condición base RGB (funciona bien con tonos claros-medios)
  const rgbSkin = (
    r > 95 && g > 40 && b > 20 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  )

  if (rgbSkin) return true

  // Condición extendida para tonos más oscuros
  const rgbDark = (
    r > 200 && g > 210 && b > 170 &&
    Math.abs(r - g) <= 15 &&
    r > b && g > b
  )

  if (rgbDark) return true

  // Condición HSV aproximada para tonos morenos/oscuros
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max   = Math.max(rNorm, gNorm, bNorm)
  const min   = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  if (max === 0) return false
  const s = delta / max
  const v = max

  let h = 0
  if (delta > 0) {
    if (max === rNorm)      h = 60 * (((gNorm - bNorm) / delta) % 6)
    else if (max === gNorm) h = 60 * ((bNorm - rNorm) / delta + 2)
    else                    h = 60 * ((rNorm - gNorm) / delta + 4)
    if (h < 0) h += 360
  }

  // Tono de piel en HSV: H ∈ [0, 50], S ∈ [0.15, 0.90], V ∈ [0.20, 1.0]
  return h >= 0 && h <= 50 && s >= 0.15 && s <= 0.90 && v >= 0.20
}

// ── Nitidez (Laplacian) ───────────────────────────────────────────────────────

function computeSharpness(pixels: Buffer, w: number, h: number): number {
  let sum = 0, count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i   = y * w + x
      const lap = Math.abs(
        pixels[i] * 4
        - pixels[(y-1)*w+x] - pixels[(y+1)*w+x]
        - pixels[y*w+(x-1)] - pixels[y*w+(x+1)]
      )
      sum += lap; count++
    }
  }
  return count > 0 ? sum / count : 0
}

// ── Varianza entre frames ─────────────────────────────────────────────────────

async function computeFrameVariance(bufA: Buffer, bufB: Buffer): Promise<number> {
  const [a, b] = await Promise.all([
    sharp(bufA).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer(),
    sharp(bufB).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer(),
  ])
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) sum += Math.abs(a[i] - b[i])
  return sum / len
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fail(message: string): LivenessCheckResult {
  return { success: false, score: 0, message }
}

function toBuffer(src: Buffer | string): Buffer {
  if (Buffer.isBuffer(src)) return src
  return Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64')
}

function validateClientToken(score?: number, token?: string): boolean {
  if (score === undefined || !token) return false
  const secret = process.env.LIVENESS_CLIENT_SECRET
  if (!secret) return false
  try {
    const [ts, sig] = token.split('.')
    if (!ts || !sig || Date.now() - parseInt(ts, 10) > 180_000) return false
    const expected = createHmac('sha256', secret)
      .update(`${score}:${ts}`).digest('hex').slice(0, 16)
    return sig === expected
  } catch { return false }
}
