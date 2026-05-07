// lib/verification/preregService.ts
import { prisma }                from '@/lib/prisma'
import { VERIFICATION_PRIVACY_POLICY_URL } from './config'
import { sha256Hex }             from './hash'
import {
  appendPreRegAudit, createPreRegSession,
  findOpenPreRegSessionByCedula, getPreRegSession,
  markPreRegConsumed, markPreRegMaterialized, patchPreRegSession,
} from './preregStore'
import { verificationMode }      from './factory'
import { RealLivenessProvider }  from '@/modules/verification/infrastructure/providers/RealLivenessProvider'
import { MockLivenessProvider }  from '@/modules/verification/infrastructure/providers/MockLivenessProvider'
import { RealFaceMatchProvider } from '@/modules/verification/infrastructure/providers/RealFaceMatchProvider'
import { MockFaceMatchProvider } from '@/modules/verification/infrastructure/providers/MockFaceMatchProvider'
import { LIVENESS_BEHAVIOR, FACE_MATCH_BEHAVIOR } from './config'

const db: any = prisma

function getLivenessProvider() {
  if (verificationMode === 'real') return new RealLivenessProvider()
  const p = new MockLivenessProvider(); p.setMockBehavior(LIVENESS_BEHAVIOR); return p
}
function getFaceMatchProvider() {
  if (verificationMode === 'real') return new RealFaceMatchProvider()
  const p = new MockFaceMatchProvider(); p.setMockBehavior(FACE_MATCH_BEHAVIOR); return p
}

export async function startPreRegistrationVerification(
  cedula: string,
  options?: { referenceProvided?: boolean; referenceFileName?: string | null },
  ipAddress?: string, userAgent?: string,
) {
  const existing = findOpenPreRegSessionByCedula(cedula)
  if (existing) return existing.id
  const session = createPreRegSession({ cedula, ...options })
  appendPreRegAudit(session.id, {
    action: 'prereg_verification_started', actor: cedula, ipAddress, userAgent,
    details: { mode: verificationMode, referenceProvided: options?.referenceProvided ?? false },
  })
  return session.id
}

export async function recordPreRegistrationConsent(
  sessionId: string, ipAddress?: string, userAgent?: string,
) {
  const session = getPreRegSession(sessionId)
  if (!session) throw new Error('Sesión no encontrada')
  patchPreRegSession(sessionId, {
    consentGiven: true, consentVersion: '1.0-apd', privacyPolicyUrl: VERIFICATION_PRIVACY_POLICY_URL,
  })
  appendPreRegAudit(sessionId, {
    action: 'prereg_consent_given', actor: session.cedula, ipAddress, userAgent,
    details: { version: '1.0-apd', mode: verificationMode },
  })
}

export async function submitPreRegistrationLiveness(
  sessionId: string,
  imageBuffer: Buffer,
  evidence?: { fileName?: string | null; mimeType?: string | null },
  ipAddress?: string,
  userAgent?: string,
  extras?: { clientScore?: number; clientToken?: string; frame1?: Buffer; frame2?: Buffer },
) {
  const session = getPreRegSession(sessionId)
  if (!session) throw new Error('Sesión no encontrada')
  if (!session.consentGiven) throw new Error('Debes aceptar el consentimiento antes de continuar')

  patchPreRegSession(sessionId, {
    status: 'liveness_in_progress',
    attempts: { ...session.attempts, liveness: session.attempts.liveness + 1 },
  })

  const provider = getLivenessProvider()
  const result   = await provider.verifyLiveness(imageBuffer, {
    challenge: 'blink_turn_smile',
    movementRequired: true,
    clientScore: extras?.clientScore,
    clientToken: extras?.clientToken,
    frame1:      extras?.frame1,
    frame2:      extras?.frame2,
  } as any)

  const nextStatus = result.success
    ? 'approved'
    : result.requiresManualReview ? 'manual_review' : 'liveness_failed'

  patchPreRegSession(sessionId, {
    status: nextStatus,
    livenessResult: result,
    completedAt: new Date().toISOString(),
    liveEvidence: {
      fileName:  evidence?.fileName ?? 'liveness-capture.jpg',
      mimeType:  evidence?.mimeType ?? 'image/jpeg',
      sizeBytes: imageBuffer.length,
      sha256:    sha256Hex(imageBuffer),
      metadata:  { kind: 'live_capture', mode: verificationMode },
    },
  })

  appendPreRegAudit(sessionId, {
    action: 'prereg_liveness_processed', actor: session.cedula, ipAddress, userAgent,
    details: {
      success: result.success, score: result.score ?? null,
      requiresManualReview: result.requiresManualReview ?? false, mode: verificationMode,
    },
  })

  return {
    success:             result.success,
    approved:            result.success,
    status:              nextStatus,
    requiresManualReview: result.requiresManualReview ?? false,
    message:             result.message ?? null,
    error:               result.success ? undefined : (result.message ?? 'Verificación no exitosa'),
  }
}

export async function requestPreRegistrationFaceMatch(
  sessionId: string, liveBuffer: Buffer, referenceBuffer: Buffer,
  evidence?: { liveFileName?: string|null; liveMimeType?: string|null; referenceFileName?: string|null; referenceMimeType?: string|null },
  ipAddress?: string, userAgent?: string,
) {
  const session = getPreRegSession(sessionId)
  if (!session) throw new Error('Sesión no encontrada')
  if (session.status !== 'liveness_passed') throw new Error('Debes completar primero la validación de vida')

  patchPreRegSession(sessionId, {
    status: 'face_match_pending',
    attempts: { ...session.attempts, faceMatch: session.attempts.faceMatch + 1 },
  })

  const provider = getFaceMatchProvider()
  const result   = await provider.compareFaces(liveBuffer, referenceBuffer, { threshold: 0.72 })
  const nextStatus = result.matched ? 'approved' : result.requiresManualReview ? 'manual_review' : 'rejected'

  patchPreRegSession(sessionId, {
    status: nextStatus, faceMatchResult: result, completedAt: new Date().toISOString(),
    liveEvidence: {
      fileName: evidence?.liveFileName ?? session.liveEvidence?.fileName ?? 'live.jpg',
      mimeType: evidence?.liveMimeType ?? 'image/jpeg',
      sizeBytes: liveBuffer.length, sha256: sha256Hex(liveBuffer),
      metadata: { kind: 'live_capture', mode: verificationMode },
    },
    referenceEvidence: {
      fileName: evidence?.referenceFileName ?? 'documento.jpg',
      mimeType: evidence?.referenceMimeType ?? 'image/jpeg',
      sizeBytes: referenceBuffer.length, sha256: sha256Hex(referenceBuffer),
      metadata: { kind: 'document_reference', mode: verificationMode },
    },
  })

  appendPreRegAudit(sessionId, {
    action: 'prereg_face_match_processed', actor: session.cedula, ipAddress, userAgent,
    details: { matched: result.matched, confidence: result.confidence ?? null, mode: verificationMode },
  })

  return result
}

export function getPreRegistrationStatus(sessionId: string) {
  const session = getPreRegSession(sessionId)
  if (!session) throw new Error('Sesión no encontrada')
  return session
}

export async function materializeApprovedPreRegistration(sessionId: string, militanteId: number) {
  const session = getPreRegSession(sessionId)
  if (!session) throw new Error('Sesión de pre-registro no encontrada')
  if (session.status !== 'approved') throw new Error('La verificación previa no está aprobada')
  if (session.materializedAt && session.materializedSessionId) return session.materializedSessionId
  if (session.consumedAt) throw new Error('La sesión ya fue consumida')

  const vs = await db.verificationSession.create({
    data: {
      militanteId, status: 'approved', finalDecision: 'approved',
      referenceProvided: session.referenceProvided, referenceFileName: session.referenceFileName ?? null,
      metadata: { source: 'pre_registration_gate', mode: verificationMode, cedula: session.cedula },
      completedAt: session.completedAt ? new Date(session.completedAt) : new Date(),
    },
  })

  await db.verificationConsent.create({
    data: {
      sessionId: vs.id, consentVersion: session.consentVersion ?? '1.0-apd',
      ipAddress: null, userAgent: null,
      privacyPolicyUrl: session.privacyPolicyUrl ?? VERIFICATION_PRIVACY_POLICY_URL,
      createdAt: new Date(session.createdAt),
    },
  })

  if (session.liveEvidence) {
    await db.verificationEvidence.create({
      data: { sessionId: vs.id, kind: 'live_capture',
        fileName: session.liveEvidence.fileName ?? null, mimeType: session.liveEvidence.mimeType ?? null,
        sizeBytes: session.liveEvidence.sizeBytes ?? null, sha256: session.liveEvidence.sha256 ?? null,
        metadata: session.liveEvidence.metadata ?? { mode: verificationMode } },
    })
  }

  if (session.livenessResult) {
    await db.verificationAttempt.create({
      data: { sessionId: vs.id, attemptNumber: 1, type: 'liveness',
        status: session.livenessResult.success ? 'success' : session.livenessResult.requiresManualReview ? 'error' : 'failure',
        score: typeof session.livenessResult.score === 'number' ? session.livenessResult.score : null,
        errorReason: session.livenessResult.success ? null : session.livenessResult.message ?? 'Liveness no superado',
        metadata: { ...(session.livenessResult.metadata ?? {}), mode: verificationMode } },
    })
  }

  if (session.audit.length > 0) {
    await db.auditLog.createMany({
      data: session.audit.map(e => ({
        sessionId: vs.id, action: e.action, actor: e.actor ?? null,
        details: e.details ?? null, ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null, createdAt: new Date(e.at),
      })),
    })
  }

  await db.militante.update({
    where: { id: militanteId },
    data: {
      verificationStatus: 'approved',
      verifiedAt:         new Date(),
      verifiedBy:         `prereg-${verificationMode}-gate`,
      // SHA-256 del frame de prueba de vida — evidencia auditable Art. 5 Párr. II
      livenessHash:       session.liveEvidence?.sha256 ?? null,
    },
  })

  markPreRegMaterialized(sessionId, vs.id)
  markPreRegConsumed(sessionId)
  return vs.id as string
}
