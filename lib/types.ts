export type EstadoMilitante = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO'
export type VerificationDecision = 'approved' | 'rejected' | 'manual_review'
export type VerificationStatus =
  | 'pending'
  | 'liveness_in_progress'
  | 'liveness_passed'
  | 'liveness_failed'
  | 'face_match_pending'
  | 'approved'
  | 'rejected'
  | 'manual_review'

export const TIPOS_MILITANCIA = [
  'Simpatizante',
  'Adherente',
  'Militante',
  'Militante activo',
  'Militante de base',
  'Militante orgánico',
  'Dirigente',
  'Militante electoral',
  'Voluntario político',
  'Exmilitante',
] as const

export type TipoMilitancia = typeof TIPOS_MILITANCIA[number]

export const OCUPACIONES = [
  'Abogado/a', 'Médico/a', 'Ingeniero/a civil', 'Ingeniero/a de sistemas',
  'Arquitecto/a', 'Contador/a público/a', 'Economista', 'Psicólogo/a',
  'Odontólogo/a', 'Farmacéutico/a', 'Enfermero/a', 'Veterinario/a',
  'Docente / Profesor/a', 'Director/a de escuela', 'Orientador/a',
  'Técnico en informática', 'Técnico electricista', 'Técnico mecánico',
  'Técnico en refrigeración', 'Técnico agropecuario',
  'Comerciante', 'Empresario/a', 'Vendedor/a', 'Empleado/a público/a',
  'Empleado/a privado/a', 'Conductor/a', 'Chofer / Transportista',
  'Agricultor/a', 'Ganadero/a', 'Pescador/a',
  'Albañil / Constructor/a', 'Plomero/a', 'Carpintero/a', 'Pintor/a',
  'Mecánico/a automotriz', 'Soldador/a',
  'Peluquero/a / Estilista', 'Costurero/a / Modista', 'Chef / Cocinero/a',
  'Mesero/a', 'Seguridad privada',
  'Servidor/a público/a', 'Político/a', 'Regidor/a', 'Director/a institucional',
  'Ama de casa', 'Estudiante', 'Jubilado/a / Pensionado/a',
  'Desempleado/a', 'Otra',
] as const



export interface LatestVerificationSummary {
  sessionId: string
  status: VerificationStatus
  finalDecision?: VerificationDecision | null
  manualReviewStatus?: 'pending' | 'approved' | 'rejected' | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

export interface Militante {
  id: number
  cedula: string
  nombres: string
  apellidos: string
  fechaNac?: string | null
  sexo?: string | null
  estadoCivil?: string | null
  telefono: string
  telefonoAlt?: string | null
  email?: string | null
  provincia: string
  municipio: string
  distritoMunicipal?: string | null
  seccion?: string | null
  sector?: string | null
  subbarrio?: string | null
  direccion?: string | null
  idProvinciaJCE?: number | null
  idMunicipioJCE?: number | null
  idDistritoMunicipalJCE?: number | null
  ocupacion?: string | null
  tipoMilitancia?: string | null
  motivo?: string | null
  estado: EstadoMilitante
  verificationStatus?: VerificationDecision | null
  verifiedAt?: string | null
  verifiedBy?: string | null
  createdAt: string
  updatedAt: string
  latestVerification?: LatestVerificationSummary | null
  desafiliadoFormalmente?: boolean  // tiene solicitud CERRADA — solo puede reactivarse por formulario
}

export interface VerificationSessionSummary {
  id: string
  militanteId: number
  status: VerificationStatus
  finalDecision?: VerificationDecision | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}
