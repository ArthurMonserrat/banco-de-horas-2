import { requireSupabaseUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, sendError } from './_lib/http'
import { createSupabaseRestClient, readSupabaseDataConfig } from './_lib/supabaseDatabase'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return methodNotAllowed(response)
  const user = await requireSupabaseUser(request)
  if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')
  const authorization = request.headers.authorization
  const token = Array.isArray(authorization) ? authorization[0]?.slice('Bearer '.length) : authorization?.slice('Bearer '.length)
  const config = readSupabaseDataConfig()
  if (!token || !config) return sendError(response, 503, 'Persistência do Banco 2 não configurada.')

  try {
    const client = createSupabaseRestClient(config.url, config.anonKey, token, fetch, 'public')
    const rows = await client.select('profiles', 'select=id,email,full_name,role,active,squad_id&order=full_name.asc')
    const users = rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => {
        const item = row as Record<string, unknown>
        return {
          id: String(item.id ?? ''),
          nome: typeof item.full_name === 'string' ? item.full_name : '',
          email: typeof item.email === 'string' ? item.email : '',
          perfil: item.role === 'diretor' ? 'DIRETOR' : item.role === 'supervisor' ? 'SUPERVISOR' : 'COLABORADOR',
          supervisorId: null,
          assinaturaBase64: null,
          dataCriacao: typeof item.created_at === 'string' ? item.created_at : undefined,
        }
      })
    return response.status(200).json({ users })
  } catch (error) {
    console.error('[users] Falha ao consultar perfis no Supabase:', error instanceof Error ? error.message : error)
    return sendError(response, 502, 'Não foi possível consultar os perfis corporativos.')
  }
}
