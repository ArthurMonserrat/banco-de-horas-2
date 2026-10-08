import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

export const prisma = globalThis.prismaClient ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL }),
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClient = prisma
}
