import type { User } from '@prisma/client'
import type { ApiRequest } from './http'
import { getBearerToken } from './http'
import { prisma } from './prisma'
import { validateSessionToken } from './sessionToken'

export { createSessionToken, verifySessionToken } from './sessionToken'

export type AuthenticatedUser = Pick<User, 'id' | 'nome' | 'email' | 'perfil' | 'supervisorId'>

export async function requireApiUser(request: ApiRequest): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(request)
  if (!token) {
    console.warn('[auth] Sessão rejeitada: Bearer token ausente.')
    return null
  }
  let validation: ReturnType<typeof validateSessionToken>
  try {
    validation = validateSessionToken(token)
  } catch (error) {
    console.error('[auth] Validação de sessão indisponível:', error instanceof Error ? error.message : error)
    return null
  }
  if (!validation.payload) {
    console.warn(`[auth] Sessão rejeitada: ${validation.reason ?? 'token inválido'}.`)
    return null
  }
  // O perfil vale sempre o que está no banco agora, não o que foi gravado no token.
  return prisma.user.findUnique({
    where: { id: validation.payload.sub },
    select: { id: true, nome: true, email: true, perfil: true, supervisorId: true },
  })
}

export function publicUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    supervisorId: user.supervisorId,
  }
}
