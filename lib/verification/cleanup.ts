import { prisma } from '@/lib/prisma'

const RETENTION_DAYS = parseInt(process.env.VERIFICATION_RETENTION_DAYS || '30', 10)

export async function cleanupOldVerificationData() {
  const db: any = prisma
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

  const deletedEvidence = await db.verificationEvidence.deleteMany({
    where: { capturedAt: { lt: cutoff } },
  })
  const deletedSessions = await db.verificationSession.deleteMany({
    where: { completedAt: { lt: cutoff }, status: { in: ['approved', 'rejected'] } },
  })

  console.log(`Cleanup: ${deletedEvidence.count} evidencias, ${deletedSessions.count} sesiones`)
  return { deletedEvidence: deletedEvidence.count, deletedSessions: deletedSessions.count }
}
