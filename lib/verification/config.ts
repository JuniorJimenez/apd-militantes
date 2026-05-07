export const VERIFICATION_ENABLED        = process.env.VERIFICATION_ENABLED        === 'true'
export const VERIFICATION_PRIVACY_POLICY_URL = process.env.NEXT_PUBLIC_VERIFICATION_PRIVACY_POLICY_URL || '/privacy/verification'
export const MAX_IMAGE_BYTES             = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES         = ['image/jpeg', 'image/png', 'image/webp']

// Solo usados en modo mock
export const LIVENESS_BEHAVIOR  = (process.env.MOCK_LIVENESS_BEHAVIOR  || 'always_pass') as
  'always_pass' | 'always_fail' | 'manual_review'
export const FACE_MATCH_BEHAVIOR = (process.env.MOCK_FACE_MATCH_BEHAVIOR || 'always_match') as
  'always_match' | 'always_no_match' | 'manual_review'

// Modo de proveedor: 'mock' (simulado) | 'real' (sharp + face-api)
export const VERIFICATION_MODE = (process.env.VERIFICATION_MODE || 'mock') as 'mock' | 'real'
