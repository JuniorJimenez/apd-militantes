import { FaceMatchProvider, FaceMatchResult } from '../../domain/interfaces/FaceMatchProvider';

export class MockFaceMatchProvider implements FaceMatchProvider {
  private behavior: 'always_match' | 'always_no_match' | 'manual_review' = 'always_match';
  
  async compareFaces(
    _capturedBuffer: Buffer,
    _referenceBuffer: Buffer,
    _options?: { threshold?: number }
  ): Promise<FaceMatchResult> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
    switch (this.behavior) {
      case 'always_match':
        return { matched: true, confidence: 94 + Math.floor(Math.random() * 5), requiresManualReview: false, message: 'Los rostros coinciden (mock)' };
      case 'always_no_match':
        return { matched: false, confidence: 12 + Math.floor(Math.random() * 15), requiresManualReview: false, message: 'Los rostros NO coinciden (mock)' };
      case 'manual_review':
        return { matched: false, confidence: 58 + Math.floor(Math.random() * 10), requiresManualReview: true, message: 'Resultado incierto, requiere revisión manual' };
      default:
        return { matched: false, requiresManualReview: true, message: 'Comportamiento no válido' };
    }
  }
  setMockBehavior(behavior: 'always_match' | 'always_no_match' | 'manual_review'): void {
    this.behavior = behavior;
  }
}
