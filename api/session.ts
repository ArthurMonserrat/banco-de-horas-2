import type { ApiRequest, ApiResponse } from './_lib/http'
import { getBearerToken, methodNotAllowed, sendError } from './_lib/http'
import { verifyBanco2Access, type EcosystemAccessResult, type EcosystemIdentity, type EcosystemRole } from './_lib/ecosystemAccess'
import type { SessionPerfil } from './_lib/sessionToken'

/**
 * POST /api/session
 * Recebe o token do login Microsoft (Supabase do Ecossistema), confere o acesso ao Banco 2
 * e devolve a sessão própria do Banco 2. É a única forma de entrar no Banco 2.
 */

export type Banco2User = {
  id: string
  nome: string
  email: string
  perfil: SessionPerfil
  supervisorId: string | null
}

export type SessionHandlerDeps = {
  verifyAccess: (accessToken: string) => Promise<EcosystemAccessResult>
  /** Compatibilidade de testes/legado; o caminho corporativo padrão não cria User duplicado. */
  createUser?: (identity: EcosystemIdentity & { perfil: SessionPerfil }) => Promise<Banco2User>
  createToken: (user: Banco2User) => string
}

const PERFIL_BY_ROLE: Record<EcosystemRole, SessionPerfil> = {
  colaborador: 'COLABORADOR',
  supervisor: 'SUPERVISOR',
  diretor: 'DIRETOR',
}

const defaultDeps: SessionHandlerDeps = {
  verifyAccess: (accessToken) => verifyBanco2Access(accessToken),
  // O token Supabase continua sendo a autoridade da sessão. O endpoint apenas
  // materializa a identidade verificada para o frontend; não cria uma segunda
  // conta local por e-mail.
  createToken: (_user) => '',
}

export function createSessionHandler(deps: SessionHandlerDeps = defaultDeps) {
  return async function sessionHandler(request: ApiRequest, response: ApiResponse) {
    if (request.method !== 'POST') return methodNotAllowed(response)

    const accessToken = getBearerToken(request)
    if (!accessToken) return sendError(response, 401, 'Login Microsoft obrigatório.')

    const access = await deps.verifyAccess(accessToken)
    if (!access.ok) {
      if (access.status !== 401) console.warn('[session] Acesso ao Banco 2 negado:', access.reason)
      return response.status(access.status).json({ error: access.message, reason: access.reason })
    }

    try {
      const perfil = PERFIL_BY_ROLE[access.identity.role]
      const user = deps.createUser
        ? await deps.createUser({ ...access.identity, perfil })
        : {
            id: access.identity.profileId,
            nome: access.identity.nome,
            email: access.identity.email,
            perfil,
            supervisorId: null,
          }
      return response.status(200).json({
        token: deps.createToken(user) || accessToken,
        user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil, supervisorId: user.supervisorId },
      })
    } catch (error) {
      console.error('[session] Não foi possível abrir a sessão do Banco 2:', error instanceof Error ? error.message : error)
      return response.status(500).json({ error: 'Não foi possível abrir a sessão do Banco 2.', reason: 'session_unavailable' })
    }
  }
}

export default createSessionHandler()
