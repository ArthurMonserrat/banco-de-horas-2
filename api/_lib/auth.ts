import type { User } from '@prisma/client'
import type { ApiRequest } from './http'
import { getBearerToken } from './http'
import { prisma } from './prisma'
import { validateSessionToken } from './sessionToken'
import { verifyBanco2Access, type EcosystemAccessResult } from './ecosystemAccess'

export { createSessionToken, verifySessionToken } from './sessionToken'

export type AuthenticatedUser = Pick<User, 'id' | 'nome' | 'email' | 'perfil' | 'supervisorId'>

export type SupabaseAccessVerifier = (accessToken: string) => Promise<EcosystemAccessResult>

/**
 * Autoridade de sessão para o runtime corporativo. O token Supabase é validado
 * contra o projeto do Ecossistema e o id retornado pelo perfil é usado como
 * identidade canônica; não há lookup local por e-mail nem criação implícita.
 */
export async function requireSupabaseUser(
  request: ApiRequest,
  verifyAccess: SupabaseAccessVerifier = (token) => verifyBanco2Access(token),
): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(request)
  if (!token) return null
  try {
    const access = await verifyAccess(token)
    if (!access.ok) return null
    const perfil = access.identity.role === 'diretor' ? 'DIRETOR' : access.identity.role === 'supervisor' ? 'SUPERVISOR' : 'COLABORADOR'
    return {
      id: access.identity.profileId,
      nome: access.identity.nome,
      email: access.identity.email,
      perfil,
      supervisorId: null,
    }
  } catch (error) {
    console.error('[auth] Falha ao validar sessão Supabase:', error instanceof Error ? error.message : error)
    return null
  }
}

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
