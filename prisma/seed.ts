// prisma/seed.ts
const { PrismaClient } = require('@prisma/client') as any

const prisma = new PrismaClient()

const datos = [
  { nombres: 'María Elena', apellidos: 'Santos Rodríguez', cedula: '001-1234567-8', telefono: '809-555-0101', provincia: 'Distrito Nacional', municipio: 'Santo Domingo', estado: 'ACTIVO' },
  { nombres: 'Carlos Andrés', apellidos: 'Jiménez Marte', cedula: '002-3456789-0', telefono: '809-555-0102', provincia: 'Santiago', municipio: 'Santiago de los Caballeros', estado: 'ACTIVO' },
  { nombres: 'Rosa Ana', apellidos: 'Peña Guzmán', cedula: '003-5678901-2', telefono: '809-555-0103', provincia: 'La Vega', municipio: 'Concepción de La Vega', estado: 'PENDIENTE' },
  { nombres: 'Luis Miguel', apellidos: 'Féliz Castillo', cedula: '004-7890123-4', telefono: '809-555-0104', provincia: 'San Cristóbal', municipio: 'San Cristóbal', estado: 'ACTIVO' },
  { nombres: 'Ana Belén', apellidos: 'Domínguez Cruz', cedula: '005-9012345-6', telefono: '809-555-0105', provincia: 'Espaillat', municipio: 'Moca', estado: 'PENDIENTE' },
  { nombres: 'Pedro Pablo', apellidos: 'Herrera Núñez', cedula: '006-0123456-8', telefono: '809-555-0106', provincia: 'Puerto Plata', municipio: 'Puerto Plata', estado: 'ACTIVO' },
  { nombres: 'Yadira', apellidos: 'Morales Tejada', cedula: '007-2345678-0', telefono: '809-555-0107', provincia: 'Duarte', municipio: 'San Francisco de Macorís', estado: 'ACTIVO' },
]

async function main() {
  console.log('🌱 Iniciando seed...')
  for (const m of datos) {
    await prisma.militante.upsert({ where: { cedula: m.cedula }, update: {}, create: m })
  }
  console.log(`✅ ${datos.length} militantes insertados.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
