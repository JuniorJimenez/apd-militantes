import { sha256Hex } from '@/lib/verification/hash'
import { LivenessProvider } from '../domain/interfaces/LivenessProvider'
import { FaceMatchProvider } from '../domain/interfaces/FaceMatchProvider'
import { VerificationAuditService } from '../domain/interfaces/VerificationAuditService'

const MAX_LIVENESS_ATTEMPTS = 3

type VerificationStatus =
  | 'pending'
  | 'liveness_in_progress'
  | 'liveness_passed'
  | 'liveness_failed'
  | 'face_match_pending'
  | 'approved'
  | 'rejected'
  | 'manual_review'

type VerificationDecision = 'approved' | 'rejected' | 'manual_review'
type ManualReviewStatus = 'pending' | 'approved' | 'rejected'

interface EvidenceDescriptor {
  buffer: Buffer
  kind: string
  fileName?: string | null
  mimeType?: string | null
  metadata?: Record<string, unknown>
}

export class IdentityVerificationService {
  constructor(
    private readonly livenessProvider: LivenessProvider,
    private readonly faceMatchProvider: FaceMatchProvider,
    private readonly auditService: VerificationAuditService,
    private readonly prisma: any,
  ) {}

  async startVerification(
    militanteId: number,
    options?: {
      referenceProvided?: boolean
      referenceFileName?: string | null
      privacyPolicyUrl?: string | null
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const militante = await this.prisma.militante.findUnique({ where: { id: militanteId } })
    if (!militante) throw new Error('Militante no encontrado')

    const existing = await this.prisma.verificationSession.findFirst({
      where: {
        militanteId,
        status: { in: ['pending', 'liveness_in_progress', 'liveness_passed', 'face_match_pending'] },
      },
    })

    if (existing) return existing.id

    const session = await this.prisma.verificationSession.create({
      data: {
        militanteId,
        status: 'pending',
        referenceProvided: options?.referenceProvided ?? false,
        referenceFileName: options?.referenceFileName ?? null,
        metadata: {
          mockOnly: true,
          privacyPolicyUrl: options?.privacyPolicyUrl ?? null,
        },
      },
    })

    await this.auditService.log(
      session.id,
      'verification_started',
      String(militanteId),
      {
        mockOnly: true,
        referenceProvided: options?.referenceProvided ?? false,
        referenceFileName: options?.referenceFileName ?? null,
      },
      ipAddress,
      userAgent,
    )

    return session.id
  }

  async recordConsent(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    privacyPolicyUrl?: string,
  ): Promise<void> {
    const session = await this.prisma.verificationSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sesión no encontrada')

    await this.prisma.verificationConsent.upsert({
      where: { sessionId },
      update: { ipAddress, userAgent, privacyPolicyUrl: privacyPolicyUrl ?? null },
      create: {
        sessionId,
        consentVersion: '1.0-mock-safe',
        ipAddress,
        userAgent,
        privacyPolicyUrl: privacyPolicyUrl ?? null,
      },
    })

    await this.auditService.log(
      sessionId,
      'consent_given',
      String(session.militanteId),
      { version: '1.0-mock-safe', privacyPolicyUrl: privacyPolicyUrl ?? null },
      ipAddress,
      userAgent,
    )
  }

  async submitLiveness(
    sessionId: string,
    imageBuffer: Buffer,
    evidence?: { fileName?: string | null; mimeType?: string | null },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; requiresManualReview?: boolean; message?: string }> {
    const session = await this.prisma.verificationSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sesión no encontrada')
    if (session.status === 'approved' || session.status === 'rejected') {
      throw new Error('Verificación ya completada')
    }

    const attemptCount = await this.prisma.verificationAttempt.count({
      where: { sessionId, type: 'liveness' },
    })

    if (attemptCount >= MAX_LIVENESS_ATTEMPTS) {
      await this.prisma.verificationSession.update({
        where: { id: sessionId },
        data: { status: 'manual_review' },
      })
      await this.createManualReview(sessionId)
      await this.auditService.log(
        sessionId,
        'max_liveness_attempts_reached',
        String(session.militanteId),
        { attempts: attemptCount },
        ipAddress,
        userAgent,
      )
      return {
        success: false,
        requiresManualReview: true,
        message: 'Demasiados intentos. Revisión manual requerida.',
      }
    }

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: { status: 'liveness_in_progress' },
    })

    await this.recordEvidenceMetadata(sessionId, {
      buffer: imageBuffer,
      kind: 'liveness_capture',
      fileName: evidence?.fileName,
      mimeType: evidence?.mimeType,
      metadata: { storedRawImage: false },
    })

    const result = await this.livenessProvider.verifyLiveness(imageBuffer)

    await this.prisma.verificationAttempt.create({
      data: {
        sessionId,
        attemptNumber: attemptCount + 1,
        type: 'liveness',
        status: result.success ? 'success' : result.requiresManualReview ? 'error' : 'failure',
        errorReason: result.success ? undefined : result.message,
        score: typeof result.score === 'number' ? result.score : undefined,
        metadata: result.metadata ?? {},
        ipAddress,
        userAgent,
      },
    })

    const newStatus: VerificationStatus = result.success
      ? 'liveness_passed'
      : result.requiresManualReview
        ? 'manual_review'
        : 'liveness_failed'

    if (newStatus === 'manual_review') {
      await this.createManualReview(sessionId)
    }

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: { status: newStatus },
    })

    await this.auditService.log(
      sessionId,
      result.success
        ? 'liveness_passed'
        : result.requiresManualReview
          ? 'liveness_manual_review'
          : 'liveness_failed',
      String(session.militanteId),
      {
        score: result.score,
        attempt: attemptCount + 1,
        message: result.message,
      },
      ipAddress,
      userAgent,
    )

    return {
      success: result.success,
      requiresManualReview: result.requiresManualReview,
      message: result.message,
    }
  }

  async requestFaceMatch(
    sessionId: string,
    capturedImageBuffer: Buffer,
    referenceBuffer: Buffer,
    evidence?: {
      liveFileName?: string | null
      liveMimeType?: string | null
      referenceFileName?: string | null
      referenceMimeType?: string | null
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ matched: boolean; requiresManualReview?: boolean; confidence?: number; message?: string }> {
    const session = await this.prisma.verificationSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sesión no encontrada')
    if (session.status !== 'liveness_passed') throw new Error('Prueba de vida no superada')
    if (!referenceBuffer || referenceBuffer.length === 0) throw new Error('No hay imagen de referencia')

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: {
        status: 'face_match_pending',
        referenceProvided: true,
        referenceFileName: evidence?.referenceFileName ?? session.referenceFileName ?? null,
      },
    })

    await Promise.all([
      this.recordEvidenceMetadata(sessionId, {
        buffer: capturedImageBuffer,
        kind: 'face_live_capture',
        fileName: evidence?.liveFileName,
        mimeType: evidence?.liveMimeType,
        metadata: { storedRawImage: false },
      }),
      this.recordEvidenceMetadata(sessionId, {
        buffer: referenceBuffer,
        kind: 'document_reference',
        fileName: evidence?.referenceFileName,
        mimeType: evidence?.referenceMimeType,
        metadata: { storedRawImage: false },
      }),
    ])

    const result = await this.faceMatchProvider.compareFaces(capturedImageBuffer, referenceBuffer)

    await this.prisma.verificationAttempt.create({
      data: {
        sessionId,
        attemptNumber: 1,
        type: 'face_match',
        status: result.matched ? 'success' : result.requiresManualReview ? 'error' : 'failure',
        errorReason: result.matched ? undefined : result.message,
        score: typeof result.confidence === 'number' ? result.confidence : undefined,
        metadata: { confidence: result.confidence ?? null, mockOnly: true },
        ipAddress,
        userAgent,
      },
    })

    let newStatus: VerificationStatus
    let finalDecision: VerificationDecision | undefined

    if (result.requiresManualReview) {
      newStatus = 'manual_review'
      await this.createManualReview(sessionId)
    } else if (result.matched) {
      newStatus = 'approved'
      finalDecision = 'approved'
    } else {
      newStatus = 'rejected'
      finalDecision = 'rejected'
    }

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        completedAt: newStatus === 'approved' || newStatus === 'rejected' ? new Date() : undefined,
        finalDecision,
        metadata: {
          ...(session.metadata && typeof session.metadata === 'object' ? session.metadata as Record<string, unknown> : {}),
          faceMatchConfidence: result.confidence ?? null,
          mockOnly: true,
        },
      },
    })

    if (newStatus === 'approved') {
      await this.prisma.militante.update({
        where: { id: session.militanteId },
        data: {
          verificationStatus: 'approved',
          verifiedAt: new Date(),
          verifiedBy: 'system-mock',
        },
      })
    } else if (newStatus === 'rejected') {
      await this.prisma.militante.update({
        where: { id: session.militanteId },
        data: {
          verificationStatus: 'rejected',
          verifiedAt: new Date(),
          verifiedBy: 'system-mock',
        },
      })
    }

    await this.auditService.log(
      sessionId,
      result.matched
        ? 'face_match_approved'
        : result.requiresManualReview
          ? 'face_match_manual_review'
          : 'face_match_rejected',
      String(session.militanteId),
      { confidence: result.confidence ?? null, message: result.message },
      ipAddress,
      userAgent,
    )

    return {
      matched: result.matched,
      requiresManualReview: result.requiresManualReview,
      confidence: result.confidence,
      message: result.message,
    }
  }

  async getVerificationStatus(sessionId: string): Promise<{
    status: VerificationStatus
    finalDecision?: VerificationDecision
    requiresManualReview?: boolean
    attemptsRemaining?: number
  }> {
    const session = await this.prisma.verificationSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: { where: { type: 'liveness' }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!session) throw new Error('Sesión no encontrada')

    const livenessAttempts = session.attempts.length
    const attemptsRemaining = Math.max(0, MAX_LIVENESS_ATTEMPTS - livenessAttempts)

    return {
      status: session.status,
      finalDecision: session.finalDecision || undefined,
      requiresManualReview: session.status === 'manual_review',
      attemptsRemaining: session.status === 'liveness_failed' ? attemptsRemaining : undefined,
    }
  }

  async getVerificationDetail(sessionId: string) {
    const session = await this.prisma.verificationSession.findUnique({
      where: { id: sessionId },
      include: {
        militante: true,
        attempts: { orderBy: { createdAt: 'desc' } },
        evidences: { orderBy: { capturedAt: 'desc' } },
        consent: true,
        manualReview: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!session) throw new Error('Sesión no encontrada')
    return session
  }

  async decideManualReview(
    sessionId: string,
    decision: 'approved' | 'rejected',
    reviewer: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const session = await this.prisma.verificationSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sesión no encontrada')

    const reviewStatus: ManualReviewStatus = decision === 'approved' ? 'approved' : 'rejected'
    const verificationDecision: VerificationDecision = decision === 'approved' ? 'approved' : 'rejected'

    await this.prisma.manualReview.upsert({
      where: { sessionId },
      update: {
        status: reviewStatus,
        reviewer,
        decisionNotes: notes ?? null,
        reviewedAt: new Date(),
      },
      create: {
        sessionId,
        status: reviewStatus,
        reviewer,
        decisionNotes: notes ?? null,
        reviewedAt: new Date(),
      },
    })

    await this.prisma.verificationSession.update({
      where: { id: sessionId },
      data: {
        status: verificationDecision,
        finalDecision: verificationDecision,
        completedAt: new Date(),
      },
    })

    await this.prisma.militante.update({
      where: { id: session.militanteId },
      data: {
        verificationStatus: verificationDecision,
        verifiedAt: new Date(),
        verifiedBy: reviewer,
      },
    })

    await this.auditService.log(
      sessionId,
      `manual_review_${decision}`,
      reviewer,
      { notes: notes ?? null },
      ipAddress,
      userAgent,
    )
  }

  private async createManualReview(sessionId: string): Promise<void> {
    const existing = await this.prisma.manualReview.findUnique({ where: { sessionId } })
    if (!existing) {
      await this.prisma.manualReview.create({ data: { sessionId, status: 'pending' } })
    }
  }

  private async recordEvidenceMetadata(sessionId: string, evidence: EvidenceDescriptor): Promise<void> {
    await this.prisma.verificationEvidence.create({
      data: {
        sessionId,
        kind: evidence.kind,
        fileName: evidence.fileName ?? null,
        mimeType: evidence.mimeType ?? null,
        sizeBytes: evidence.buffer.length,
        sha256: sha256Hex(evidence.buffer),
        metadata: evidence.metadata ?? {},
      },
    })
  }
}
