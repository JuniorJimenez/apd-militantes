import { LivenessProvider, LivenessCheckResult } from '../../domain/interfaces/LivenessProvider';

export class MockLivenessProvider implements LivenessProvider {
  private behavior: 'always_pass' | 'always_fail' | 'manual_review' = 'always_pass';
  
  async verifyLiveness(
    _imageBuffer: Buffer | string,
    _options?: { challenge?: string; movementRequired?: boolean }
  ): Promise<LivenessCheckResult> {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    switch (this.behavior) {
      case 'always_pass':
        return { success: true, score: 92 + Math.floor(Math.random() * 8), message: 'Verificación de vida exitosa (mock)', metadata: { mock: true } };
      case 'always_fail':
        return { success: false, score: 15 + Math.floor(Math.random() * 20), message: 'No se detectó movimiento de vida (mock)', metadata: { mock: true } };
      case 'manual_review':
        return { success: false, score: 45 + Math.floor(Math.random() * 15), requiresManualReview: true, message: 'Resultado incierto, requiere revisión manual', metadata: { mock: true } };
      default:
        return { success: false, message: 'Comportamiento no válido' };
    }
  }
  setMockBehavior(behavior: 'always_pass' | 'always_fail' | 'manual_review'): void {
    this.behavior = behavior;
  }
}
