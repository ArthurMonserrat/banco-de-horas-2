import { publicUser, requireSupabaseUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, sendError } from './_lib/http'

/**
 * GET  /api/auth  -> valida a sessão atual do Banco 2.
 * POST /api/auth  -> desativado: o login por e-mail e senha foi substituído pelo login Microsoft
 *                    do Ecossistema SM&A (POST /api/session).
 */
export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'GET') {
    const user = await requireSupabaseUser(request)
    if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')
    return response.status(200).json({ user: publicUser(user) })
  }

  if (request.method === 'POST') {
    return sendError(response, 410, 'Login por senha desativado. Entre pelo Ecossistema SM&A com sua conta Microsoft.')
  }

  return methodNotAllowed(response)
}
