// lib/verification/factory.ts
// VERIFICATION_MODE=real  → proveedores reales (sharp + análisis de imagen)
// VERIFICATION_MODE=mock  → simulados (comportamiento configurable)

import { prisma } from '@/lib/prisma'
import { IdentityVerificationService }       from '@/modules/verification/application/IdentityVerificationService'
import { MockLivenessProvider }             from '@/modules/verification/infrastructure/providers/MockLivenessProvider'
import { MockFaceMatchProvider }            from '@/modules/verification/infrastructure/providers/MockFaceMatchProvider'
import { RealLivenessProvider }             from '@/modules/verification/infrastructure/providers/RealLivenessProvider'
import { RealFaceMatchProvider }            from '@/modules/verification/infrastructure/providers/RealFaceMatchProvider'
import { VerificationAuditServiceImpl }     from '@/modules/verification/infrastructure/services/VerificationAuditServiceImpl'
import { FACE_MATCH_BEHAVIOR, LIVENESS_BEHAVIOR } from './config'

const mode = (process.env.VERIFICATION_MODE ?? 'mock') as 'mock' | 'real'
const auditService = new VerificationAuditServiceImpl(prisma)

function buildLivenessProvider() {
  if (mode === 'real') return new RealLivenessProvider()
  const p = new MockLivenessProvider()
  p.setMockBehavior(LIVENESS_BEHAVIOR)
  return p
}

function buildFaceMatchProvider() {
  if (mode === 'real') return new RealFaceMatchProvider()
  const p = new MockFaceMatchProvider()
  p.setMockBehavior(FACE_MATCH_BEHAVIOR)
  return p
}

export const verificationService = new IdentityVerificationService(
  buildLivenessProvider(),
  buildFaceMatchProvider(),
  auditService,
  prisma,
)

export { mode as verificationMode }
