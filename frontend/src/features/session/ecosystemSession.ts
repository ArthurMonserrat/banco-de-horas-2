import type { ApiPerfil, ApiSession } from '../../services/api'
import type { DemoRole, DemoSession } from './types'

const ROLE_BY_PERFIL: Record<ApiPerfil, DemoRole> = {
  COLABORADOR: 'COLLABORATOR',
  SUPERVISOR: 'SUPERVISOR',
  DIRETOR: 'DIRECTOR_ADMIN',
}

/** Converte a sessão do servidor do Banco 2 na sessão usada pelas telas. O cargo vem sempre do servidor. */
export function toEcosystemSession(apiSession: ApiSession, now = new Date().toISOString()): DemoSession | null {
  const role = ROLE_BY_PERFIL[apiSession.user.perfil]
  if (!role || !apiSession.user.id) return null
  return {
    id: apiSession.user.id,
    name: apiSession.user.nome,
    email: apiSession.user.email,
    role,
    createdAt: apiSession.user.dataCriacao ?? now,
    explicitLoginAt: now,
    isDemo: false,
    version: 2,
    authProvider: 'ecosystem',
  }
}
