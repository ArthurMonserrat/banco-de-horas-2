import { requireSupabaseUser, type AuthenticatedUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, parseString, sendError } from './_lib/http'
import { createSupabaseRestClient, readSupabaseDataConfig, type SupabaseRestClient } from './_lib/supabaseDatabase'

type Banco2Row = Record<string, unknown>

function statusFromDatabase(value: unknown) {
  if (value === 'approved') return 'APROVADO' as const
  if (value === 'rejected') return 'REJEITADO' as const
  if (value === 'cancelled') return 'CANCELADO' as const
  return 'PENDENTE' as const
}

function toNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function serialize(row: Banco2Row, user: AuthenticatedUser) {
  const durationMinutes = toNumber(row.duration_minutes)
  return {
    id: String(row.id ?? ''),
    userId: String(row.profile_id ?? user.id),
    userName: user.nome,
    supervisorId: user.supervisorId,
    data: String(row.entry_date ?? ''),
    horaInicio: String(row.start_time ?? ''),
    horaFim: String(row.end_time ?? ''),
    horasTotal: durationMinutes / 60,
    projeto: String(row.project_code ?? ''),
    atividade: String(row.activity_id ?? ''),
    detalhamento: String(row.details ?? ''),
    status: statusFromDatabase(row.status),
    justificativa: typeof row.rejection_reason === 'string' ? row.rejection_reason : null,
    versao: toNumber(row.version) || 1,
    dataCriacao: String(row.created_at ?? ''),
    emObra: row.em_obra === true,
    numeroObra: typeof row.numero_obra === 'string' ? row.numero_obra : undefined,
    clientId: typeof row.client_id === 'string' ? row.client_id : undefined,
    disciplineCode: typeof row.discipline_code === 'string' ? row.discipline_code : undefined,
    funcaoContrato: typeof row.funcao_contrato === 'string' ? row.funcao_contrato : undefined,
  }
}

function bodyOf(request: ApiRequest) {
  return request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
}

function clientForToken(token: string): SupabaseRestClient | null {
  const config = readSupabaseDataConfig()
  return config ? createSupabaseRestClient(config.url, config.anonKey, token) : null
}

export function createApontamentosHandler(
  authenticate = requireSupabaseUser,
  getClient: (token: string) => SupabaseRestClient | null = clientForToken,
) {
  return async function handler(request: ApiRequest, response: ApiResponse) {
    const user = await authenticate(request)
    if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')
    const authorization = request.headers.authorization
    const token = Array.isArray(authorization) ? authorization[0]?.slice('Bearer '.length) : authorization?.slice('Bearer '.length)
    if (!token) return sendError(response, 401, 'Sessão inválida ou expirada.')
    const client = getClient(token)
    if (!client) return sendError(response, 503, 'Persistência do Banco 2 não configurada.')

    try {
      if (request.method === 'GET') {
        const rows = await client.select('apontamentos', 'select=*&order=entry_date.desc,created_at.desc')
        return response.status(200).json({ apontamentos: rows.map((row) => serialize(row as Banco2Row, user)) })
      }

      if (request.method === 'POST') {
        const body = bodyOf(request)
        const data = parseString(body.data)
        const projeto = parseString(body.projeto)
        const atividade = parseString(body.atividade)
        const detalhamento = parseString(body.detalhamento)
        const horasTotal = Number(body.horasTotal)
        if (!data || !projeto || !atividade || !detalhamento || !Number.isFinite(horasTotal) || horasTotal <= 0) {
          return sendError(response, 400, 'Dados obrigatórios do apontamento incompletos.')
        }
        const rows = await client.insert('apontamentos', {
          profile_id: user.id,
          entry_date: data,
          start_time: parseString(body.horaInicio) || null,
          end_time: parseString(body.horaFim) || null,
          duration_minutes: Math.round(horasTotal * 60),
          client_id: parseString(body.clientId) || null,
          project_code: projeto,
          activity_id: atividade,
          discipline_code: parseString(body.disciplineCode) || null,
          details: detalhamento,
          em_obra: body.emObra === true,
          numero_obra: parseString(body.numeroObra) || null,
          funcao_contrato: parseString(body.funcaoContrato) || null,
        })
        const row = rows[0]
        if (!row) return sendError(response, 502, 'O banco não confirmou o apontamento.')
        return response.status(201).json({ apontamento: serialize(row as Banco2Row, user) })
      }

      if (request.method === 'PATCH' || request.method === 'PUT') {
        const body = bodyOf(request)
        const id = parseString(body.id ?? request.query?.id)
        const expectedVersion = Number(body.versao ?? body.expectedVersion)
        if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) return sendError(response, 400, 'Informe o apontamento e a versão esperada.')
        const payload: Record<string, unknown> = {}
        for (const [input, column] of [['data', 'entry_date'], ['horaInicio', 'start_time'], ['horaFim', 'end_time'], ['projeto', 'project_code'], ['atividade', 'activity_id'], ['detalhamento', 'details'], ['clientId', 'client_id'], ['disciplineCode', 'discipline_code'], ['numeroObra', 'numero_obra'], ['funcaoContrato', 'funcao_contrato']] as const) {
          if (typeof body[input] !== 'undefined') payload[column] = parseString(body[input]) || null
        }
        if (typeof body.horasTotal !== 'undefined') payload.duration_minutes = Math.round(Number(body.horasTotal) * 60)
        if (!Object.keys(payload).length) return sendError(response, 400, 'Nenhuma alteração informada.')
        payload.last_edit_reason = parseString(body.editReason ?? body.motivo)
        const rows = await client.update('apontamentos', `id=eq.${encodeURIComponent(id)}&profile_id=eq.${encodeURIComponent(user.id)}&version=eq.${expectedVersion}&status=in.(pending,rejected)`, payload)
        const row = rows[0]
        if (!row) return sendError(response, 409, 'O apontamento foi alterado, aprovado ou não pertence ao usuário atual.')
        return response.status(200).json({ apontamento: serialize(row as Banco2Row, user) })
      }

      if (request.method === 'DELETE') return sendError(response, 405, 'Cancelamento deve usar a operação transacional do Banco 2.')
      return methodNotAllowed(response)
    } catch (error) {
      console.error('[apontamentos] Falha na persistência Supabase:', error instanceof Error ? error.message : error)
      return sendError(response, 502, 'Não foi possível persistir o apontamento no Supabase.')
    }
  }
}

export default createApontamentosHandler()
