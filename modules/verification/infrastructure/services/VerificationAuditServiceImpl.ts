import { VerificationAuditService } from '../../domain/interfaces/VerificationAuditService'

export class VerificationAuditServiceImpl implements VerificationAuditService {
  constructor(private readonly prisma: any) {}

  async log(
    sessionId: string,
    action: string,
    actor?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        sessionId,
        action,
        actor: actor || null,
        details: details || {},
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    })
  }
}
