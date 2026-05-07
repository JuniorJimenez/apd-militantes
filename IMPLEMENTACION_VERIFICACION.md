
## Iteración adicional: validación de vida antes del registro

- La validación de vida se activó dentro del formulario público de `/registro` y ahora es obligatoria antes de enviar la solicitud.
- Se añadió una compuerta de pre-registro (`pre-registration gate`) con sesiones mock temporales en memoria para desarrollo.
- El endpoint público de alta (`POST /api/militantes`) ahora exige `verificationSessionId` aprobado y cédula coincidente.
- Al crear el militante, la verificación previa aprobada se materializa en las tablas persistentes existentes (`verification_sessions`, `verification_attempts`, `verification_evidence`, `audit_logs`).
- Esta compuerta temporal en memoria es solo para desarrollo/mock y debe sustituirse por persistencia transaccional si se desea uso productivo.

# Implementación del módulo de verificación de identidad

## Diagnóstico del proyecto actual
- Stack detectado: Next.js 14 App Router, TypeScript, Tailwind, Prisma, PostgreSQL.
- El proyecto ya traía una base parcial del módulo de verificación: endpoints `/api/verification/*`, UI de wizard, mocks, servicio de aplicación y una bandeja administrativa básica.
- Problemas encontrados:
  - El esquema Prisma no incluía los modelos ni campos usados por el módulo.
  - El flujo del wizard podía perder el `sessionId` entre liveness y face match.
  - No existía una ruta de detalle/revisión manual por sesión.
  - El consentimiento, la referencia documental y la evidencia no estaban alineados con una política de no persistir biometría cruda.
  - La política de permisos del middleware bloqueaba cámara en todas las rutas.
  - El proyecto no podía regenerar Prisma ni ejecutar build completo en este entorno offline por descarga de binarios externos.

## Lo que quedó implementado
### Backend
- Esquema Prisma ampliado con:
  - `VerificationSession`
  - `VerificationConsent`
  - `VerificationAttempt`
  - `VerificationEvidence`
  - `ManualReview`
  - `AuditLog`
  - campos nuevos en `Militante` para geografía ampliada y estado de verificación.
- Migración SQL añadida en `prisma/migrations/20260404_identity_verification_module/migration.sql`.
- Servicio de aplicación endurecido:
  - inicio de sesión de verificación
  - consentimiento idempotente
  - liveness mock con límite de intentos
  - face match mock usando referencia del documento enviada en memoria
  - evidencias solo como metadatos + hash SHA-256, sin guardar imagen cruda
  - auditoría de eventos
  - decisión manual de aprobación/rechazo
- Factoría compartida para providers y configuración.
- Endpoints actualizados:
  - `/api/verification/start`
  - `/api/verification/consent`
  - `/api/verification/liveness`
  - `/api/verification/face-match`
  - `/api/verification/status`
  - `/api/admin/verificaciones`
  - `/api/admin/verificaciones/[id]`

### Frontend
- Wizard de verificación ampliado con paso explícito de imagen de referencia del documento.
- Consentimiento más claro y honesto sobre el carácter mock/no productivo.
- Flujo público nuevo en `/verificacion-identidad`.
- Redirección desde registro/bienvenida para continuar con el módulo mock.
- Página de detalle administrativo para revisión manual en `/admin/verificaciones/[id]`.
- Página simple de privacidad del módulo.

### Seguridad
- Rate limits específicos para verificación.
- Validación de tamaño y MIME de imágenes.
- Cámara permitida solo en la ruta de verificación de identidad.
- Persistencia limitada a metadatos y auditoría.

## Lo que queda como mock o stub
- Detección de vida real: mock.
- Face match real: mock.
- Revisión automática de documento: no implementada.
- Cifrado de evidencia: preparado a nivel de diseño, no implementado porque no se persiste biometría cruda.
- Integración con proveedor biométrico real: no implementada.

## Riesgos y requisitos antes de producción
- Falta base legal y política formal de consentimiento para biometría real.
- Falta proveedor autorizado y contrato de tratamiento.
- Falta cifrado de datos sensibles en reposo y gestión formal de secretos.
- Falta revisión de DPIA/PIA, auditoría de seguridad y pruebas de fraude/liveness reales.
- Falta flujo formal de almacenamiento, borrado y retención para imágenes reales.

## Validación realizada
- `tsc --noEmit` pasa en este entorno.
- No fue posible ejecutar `next build` completo por falta de acceso de red para descargar binarios SWC.
- No fue posible regenerar Prisma Client desde la CLI por falta de acceso de red a binarios de Prisma; se dejó el código tolerante a esta limitación para edición offline.

## Segunda iteración

- Se añadió acceso visible a la bandeja `/admin/verificaciones` desde la cabecera, una tarjeta destacada y la barra de herramientas del panel de administración.
- Se añadió una columna `Verificación` en la tabla principal de militantes con badge del estado mock y enlace al detalle cuando existe sesión.
- El slide-over del militante ahora muestra una tarjeta de estado de verificación con accesos directos a la bandeja o al detalle de la sesión.
- El panel `/admin` ahora acepta `?cedula=...&tab=TODOS` para abrir rápidamente el detalle de un militante desde la bandeja de verificaciones.
- La bandeja `/admin/verificaciones` y el detalle por sesión enlazan de vuelta al expediente del militante en `/admin`.


## Iteración 3 — Bandeja de verificaciones más operativa

Se añadió una tercera iteración en `/admin/verificaciones` para reducir la fricción operativa del equipo administrador:

- filtros visibles por estado: `manual_review`, `approved`, `rejected`, `pending`, `liveness_failed` y `all`;
- búsqueda directa por cédula o nombre del militante;
- tarjetas resumen por estado para saltar rápidamente entre bandejas;
- paginación simple en el listado;
- acción rápida para abrir el expediente del militante desde la misma bandeja.

### Ajustes técnicos

- `GET /api/admin/verificaciones` ahora acepta `q`, `status`, `page` y `limit`.
- El filtro `q` aplica sobre `cedula`, `nombres` y `apellidos` del militante relacionado.
- La respuesta ahora incluye `summary` para alimentar los contadores del tablero de verificaciones.

### Riesgos y notas

- El conteo `summary` se calcula con `groupBy` global del módulo de verificación; esto es adecuado para una bandeja administrativa mediana, pero podría requerir cache o métricas preagregadas si el volumen crece mucho.
- La búsqueda actual es parcial y orientada a uso interno; si se necesita precisión documental, convendría normalizar cédulas y nombres antes de indexar.

## Iteración 5 — Progreso visual del flujo público de registro

Se añadió una capa visual de seguimiento del proceso para que el usuario entienda claramente el orden obligatorio del alta:

- `JCE y documento`
- `Validación de vida`
- `Registro del militante`

### Cambios incluidos

- Nuevo componente `RegistrationProgressStepper` en la página `/registro`.
- El stepper refleja tres estados de alto nivel:
  - pendiente,
  - en curso,
  - completo.
- La tarjeta de validación previa ahora muestra además un mini-stepper interno con las etapas:
  - consentimiento,
  - documento,
  - captura facial,
  - validación de vida,
  - resultado.
- El usuario ve visualmente cuándo la validación JCE habilita la segunda etapa y cuándo la validación previa aprobada habilita el envío final del formulario.

### Nota operativa

Esta iteración mejora la comprensión del flujo, pero no cambia el carácter mock de la biometría. La obligatoriedad sigue siendo la misma: sin aprobación de la validación previa no se habilita el envío del registro.
