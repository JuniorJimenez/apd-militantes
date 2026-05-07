import { randomUUID } from 'crypto'

export type PreRegVerificationStatus =
  | 'pending'
  | 'liveness_in_progress'
  | 'liveness_passed'
  | 'liveness_failed'
  | 'face_match_pending'
  | 'approved'
  | 'rejected'
  | 'manual_review'

export interface PreRegAuditEntry {
  at: string
  action: string
  actor?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
}

export interface PreRegVerificationSession {
  id: string
  cedula: string
  status: PreRegVerificationStatus
  consentGiven: boolean
  consentVersion?: string | null
  privacyPolicyUrl?: string | null
  referenceProvided: boolean
  referenceFileName?: string | null
  liveEvidence?: {
    fileName?: string | null
    mimeType?: string | null
    sizeBytes?: number | null
    sha256?: string | null
    metadata?: Record<string, unknown>
  }
  referenceEvidence?: {
    fileName?: string | null
    mimeType?: string | null
    sizeBytes?: number | null
    sha256?: string | null
    metadata?: Record<string, unknown>
  }
  attempts: {
    liveness: number
    faceMatch: number
  }
  livenessResult?: {
    success: boolean
    score?: number
    requiresManualReview?: boolean
    message?: string
    metadata?: Record<string, unknown>
  }
  faceMatchResult?: {
    matched: boolean
    confidence?: number
    requiresManualReview?: boolean
    message?: string
  }
  consumedAt?: string | null
  materializedAt?: string | null
  materializedSessionId?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  audit: PreRegAuditEntry[]
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000

type StoreShape = {
  sessions: Map<string, PreRegVerificationSession>
}

function getStore(): StoreShape {
  const g = globalThis as typeof globalThis & { __apdPreRegVerificationStore?: StoreShape }
  if (!g.__apdPreRegVerificationStore) {
    g.__apdPreRegVerificationStore = { sessions: new Map<string, PreRegVerificationSession>() }
  }
  return g.__apdPreRegVerificationStore
}

function nowIso() {
  return new Date().toISOString()
}

export function cleanupPreRegSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS
  const store = getStore()
  for (const [id, session] of store.sessions.entries()) {
    if (new Date(session.updatedAt).getTime() < cutoff) {
      store.sessions.delete(id)
    }
  }
}

export function createPreRegSession(input: {
  cedula: string
  referenceProvided?: boolean
  referenceFileName?: string | null
}): PreRegVerificationSession {
  cleanupPreRegSessions()
  const createdAt = nowIso()
  const session: PreRegVerificationSession = {
    id: `prereg_${randomUUID()}`,
    cedula: input.cedula,
    status: 'pending',
    consentGiven: false,
    referenceProvided: input.referenceProvided ?? false,
    referenceFileName: input.referenceFileName ?? null,
    attempts: { liveness: 0, faceMatch: 0 },
    createdAt,
    updatedAt: createdAt,
    audit: [],
  }
  getStore().sessions.set(session.id, session)
  return session
}

export function getPreRegSession(sessionId: string) {
  cleanupPreRegSessions()
  return getStore().sessions.get(sessionId) ?? null
}

export function findOpenPreRegSessionByCedula(cedula: string) {
  cleanupPreRegSessions()
  const sessions = [...getStore().sessions.values()]
    .filter((s) => s.cedula === cedula && !s.consumedAt && !s.materializedAt)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  return sessions.find((s) => ['pending', 'liveness_in_progress', 'liveness_passed', 'face_match_pending', 'approved'].includes(s.status)) ?? null
}

export function patchPreRegSession(sessionId: string, patch: Partial<PreRegVerificationSession>) {
  const existing = getPreRegSession(sessionId)
  if (!existing) return null
  const next: PreRegVerificationSession = {
    ...existing,
    ...patch,
    attempts: patch.attempts ? { ...existing.attempts, ...patch.attempts } : existing.attempts,
    liveEvidence: patch.liveEvidence ? { ...existing.liveEvidence, ...patch.liveEvidence } : existing.liveEvidence,
    referenceEvidence: patch.referenceEvidence ? { ...existing.referenceEvidence, ...patch.referenceEvidence } : existing.referenceEvidence,
    livenessResult: patch.livenessResult ? { ...existing.livenessResult, ...patch.livenessResult } : existing.livenessResult,
    faceMatchResult: patch.faceMatchResult ? { ...existing.faceMatchResult, ...patch.faceMatchResult } : existing.faceMatchResult,
    updatedAt: nowIso(),
  }
  getStore().sessions.set(sessionId, next)
  return next
}

export function appendPreRegAudit(sessionId: string, entry: Omit<PreRegAuditEntry, 'at'>) {
  const existing = getPreRegSession(sessionId)
  if (!existing) return null
  existing.audit.push({ at: nowIso(), ...entry })
  existing.updatedAt = nowIso()
  getStore().sessions.set(sessionId, existing)
  return existing
}

export function markPreRegConsumed(sessionId: string) {
  return patchPreRegSession(sessionId, { consumedAt: nowIso() })
}

export function markPreRegMaterialized(sessionId: string, materializedSessionId: string) {
  return patchPreRegSession(sessionId, {
    materializedAt: nowIso(),
    materializedSessionId,
  })
}
