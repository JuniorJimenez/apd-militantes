// lib/prisma.ts
// Uso dinámico para evitar dependencia de cliente generado durante edición offline.
const { PrismaClient } = require('@prisma/client') as any

const globalForPrisma = globalThis as unknown as { prisma: any }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
