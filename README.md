# APD · Padrón de Militantes

Sistema de consulta y registro de militantes de la **Alianza por la Democracia (APD)**.

Construido con **Next.js 14 + TypeScript + Tailwind CSS + Prisma + PostgreSQL**.

---

## 🗂️ Estructura del proyecto

```
apd-militantes/
├── app/
│   ├── layout.tsx              # Layout raíz (fuentes, metadata)
│   ├── globals.css             # Estilos globales + variables APD
│   ├── page.tsx                # Vista: Consulta por cédula
│   ├── registro/
│   │   └── page.tsx            # Vista: Formulario de registro
│   ├── admin/
│   │   └── page.tsx            # Vista: Panel de administración
│   └── api/
│       └── militantes/
│           ├── route.ts        # GET /api/militantes (lista) + POST (crear)
│           └── [cedula]/
│               └── route.ts   # GET/PATCH/DELETE por cédula
├── components/
│   └── Navbar.tsx              # Barra de navegación con logo
├── lib/
│   ├── prisma.ts               # Cliente Prisma singleton
│   └── types.ts                # Tipos TypeScript compartidos
├── prisma/
│   ├── schema.prisma           # Modelo de base de datos
│   └── seed.ts                 # Datos iniciales de prueba
├── public/
│   └── logo-apd.png            # ⚠️ Coloca aquí el logo del partido
├── .env.example                # Variables de entorno requeridas
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Instalación paso a paso

### 1. Prerequisitos

- **Node.js** v18 o superior → https://nodejs.org
- **PostgreSQL** instalado localmente o cuenta en un servicio cloud:
  - 🆓 **Neon** (recomendado): https://neon.tech
  - 🆓 **Railway**: https://railway.app
  - 🆓 **Supabase**: https://supabase.com

### 2. Clonar / descomprimir el proyecto

```bash
cd apd-militantes
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y coloca tu URL de PostgreSQL:

```env
DATABASE_URL="postgresql://usuario:contraseña@host:5432/apd_militantes"
```

**Ejemplo con Neon (cloud gratuito):**
```env
DATABASE_URL="postgresql://usuario:contraseña@ep-xxx.us-east-2.aws.neon.tech/apd_militantes?sslmode=require"
```

### 5. Colocar el logo

Copia el archivo `LOGO_APD_PNF__3_.png` a la carpeta `public/` con el nombre `logo-apd.png`:

```bash
cp /ruta/al/logo/LOGO_APD_PNF__3_.png public/logo-apd.png
```

### 6. Crear la base de datos

```bash
# Genera el cliente Prisma
npm run db:generate

# Crea las tablas en PostgreSQL
npm run db:migrate
```

Cuando te pida nombre para la migración, escribe: `init`

### 7. Cargar datos de prueba (opcional)

```bash
npm run db:seed
```

Esto inserta 7 militantes de ejemplo para que puedas probar la consulta.

### 8. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

---

## 📱 Vistas del sistema

| Ruta | Descripción |
|------|-------------|
| `/` | Consulta de militante por cédula |
| `/registro` | Formulario de registro de nuevos militantes |
| `/admin` | Panel de administración con estadísticas y tabla |

---

## 🔌 API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/api/militantes` | Lista paginada con filtros y estadísticas |
| `POST` | `/api/militantes` | Registrar nuevo militante |
| `GET`  | `/api/militantes/:cedula` | Consultar militante por cédula |
| `PATCH`| `/api/militantes/:cedula` | Actualizar estado del militante |
| `DELETE`| `/api/militantes/:cedula` | Eliminar militante |

### Parámetros GET /api/militantes

```
?estado=ACTIVO|PENDIENTE|INACTIVO|TODOS
&q=texto (busca en nombre y cédula)
&pagina=1
&limite=50
```

---

## 🌐 Despliegue en producción

### Opción A: Vercel + Neon (recomendado, ambos gratuitos)

1. Sube el proyecto a GitHub
2. Entra a https://vercel.com → **New Project** → importa el repositorio
3. En **Environment Variables**, agrega `DATABASE_URL` con la URL de Neon
4. Vercel detecta Next.js automáticamente y despliega

### Opción B: Railway

1. Crea un proyecto en Railway
2. Agrega un servicio PostgreSQL
3. Conecta tu repositorio de GitHub
4. Railway inyecta `DATABASE_URL` automáticamente

---

## 🗃️ Modelo de datos

```prisma
model Militante {
  id          Int              @id @default(autoincrement())
  cedula      String           @unique
  nombres     String
  apellidos   String
  fechaNac    DateTime?
  sexo        String?
  estadoCivil String?
  telefono    String
  telefonoAlt String?
  email       String?
  provincia   String
  municipio   String
  sector      String?
  direccion   String?
  comite      String?
  ocupacion   String?
  motivo      String?
  estado      EstadoMilitante  @default(PENDIENTE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

enum EstadoMilitante { ACTIVO | PENDIENTE | INACTIVO }
```

---

## 🔒 Próximos pasos sugeridos

- [ ] Autenticación para el panel `/admin` (NextAuth.js)
- [ ] Exportar padrón a Excel/CSV
- [ ] Filtros por provincia y municipio
- [ ] Envío de correo de confirmación al registrarse (Resend / SendGrid)
- [ ] Carga masiva de militantes desde Excel
- [ ] Mapa interactivo de militantes por provincia

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Despliegue | Vercel |

JCE_PADRON_API_URL=https://api.jce.gob.do/v1/padron
JCE_PADRON_API_KEY=<clave-JCE>
JCE_PADRON_API_SECRET=<secreto-JCE>
JCE_PADRON_API_PARTY_CODE=APD
JCE_PADRON_API_MODE=real