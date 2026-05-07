export interface FaceMatchResult {
  matched: boolean;
  confidence?: number;
  requiresManualReview: boolean;
  message?: string;
}

export interface FaceMatchProvider {
  compareFaces(
    capturedBuffer: Buffer,
    referenceBuffer: Buffer,
    options?: { threshold?: number }
  ): Promise<FaceMatchResult>;
  setMockBehavior(behavior: 'always_match' | 'always_no_match' | 'manual_review'): void;
}
