export interface LivenessCheckResult {
  success: boolean;
  score?: number;
  requiresManualReview?: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface LivenessProvider {
  verifyLiveness(
    imageBuffer: Buffer | string,
    options?: { challenge?: string; movementRequired?: boolean }
  ): Promise<LivenessCheckResult>;
  setMockBehavior(behavior: 'always_pass' | 'always_fail' | 'manual_review'): void;
}
