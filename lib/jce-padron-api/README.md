# Módulo: Verificación de Multiplicidad de Afiliaciones JCE

## Base legal
- **Art. 2(j)** — Define "multiplicidad de afiliaciones"
- **Art. 2(k)** — Define "inactivo/a" (afiliado en múltiples organizaciones)
- **Art. 4, Párr. III** — La JCE realiza cruces de padrones y marca inactivos
- **Art. 14, Párr. II** — La plataforma JCE arroja aviso si la cédula está en otra organización

## Estado actual
**Modo: MOCK** — El módulo está estructurado pero no conectado.
La función `verificarAfiliacionEnJCE()` retorna `api_no_disponible` hasta configurar credenciales.

## Pasos para activar

### 1. Gestionar credenciales JCE
Contactar la **Dirección de Partidos Políticos de la JCE** y solicitar:
- Acceso a la API de consulta de afiliaciones (Art. 15 — Plataforma Digital)
- API Key y Secret para APD
- Documentación técnica del endpoint (URL, método, esquema de autenticación)
- Código de partido APD en el sistema JCE

### 2. Configurar variables de entorno
Agregar en `.env.production`:
```
JCE_PADRON_API_URL=https://api.jce.gob.do/v1/padron
JCE_PADRON_API_KEY=<clave-otorgada-por-JCE>
JCE_PADRON_API_SECRET=<secreto-otorgado-por-JCE>
JCE_PADRON_API_PARTY_CODE=APD
JCE_PADRON_API_MODE=real
JCE_PADRON_API_TIMEOUT=8000
```

### 3. Ajustar el mapper
En `lib/jce-padron-api/index.ts`, función `mapearRespuestaJCE()`,
ajustar los nombres de campo según la respuesta real de la API JCE.

### 4. Activar en el flujo de registro
El hook `app/api/militantes/route.ts` ya tiene el punto de integración preparado.
Descomentar el bloque `// [JCE-PADRON-API-HOOK]` cuando las credenciales estén listas.

## Comportamiento por estado

| Estado JCE           | Acción del sistema                                    |
|----------------------|-------------------------------------------------------|
| `no_afiliado`        | Continúa registro normalmente                        |
| `afiliado_otro_partido` | Registra como `INACTIVO` con causal `multiplicidad` |
| `inactivo_multiple`  | Registra como `INACTIVO` con causal `multiplicidad_jce` |
| `afiliado_mismo_partido` | Bloquea — ya existe en APD                      |
| `error_consulta`     | Registra como `PENDIENTE` (no bloquea) + log de error |
| `api_no_disponible`  | Registra normalmente (modo mock)                     |

## Flujo de datos
```
Formulario de registro
       │
       ▼
verificarAfiliacionEnJCE(cedula)
       │
       ├── api_no_disponible → PENDIENTE (sin causal)
       ├── no_afiliado       → PENDIENTE (normal)
       ├── afiliado_otro_partido → INACTIVO + causal = "multiplicidad_otro_partido:PRM"
       ├── inactivo_multiple → INACTIVO + causal = "multiplicidad_jce"
       ├── afiliado_mismo_partido → 409 Conflict
       └── error_consulta    → PENDIENTE + log warning
```
