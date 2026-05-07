export interface VerificationAuditService {
  log(
    sessionId: string,
    action: string,
    actor?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void>;
}
