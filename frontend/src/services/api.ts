const API_SESSION_STORAGE_KEY = 'sma:api-session:v1'

export type ApiPerfil = 'COLABORADOR' | 'SUPERVISOR' | 'DIRETOR'
export type ApiStatusApontamento = 'PENDENTE' | 'APROVADO' | 'REJEITADO'

export type ApiUser = {
  id: string
  nome: string
  email: string
  perfil: ApiPerfil
  supervisorId: string | null
  assinaturaBase64?: string | null
  dataCriacao?: string
}

export type ApiApontamento = {
  id: string
  userId: string
  userName: string
  supervisorId: string | null
  data: string
  horaInicio: string
  horaFim: string
  horasTotal: number
  projeto: string
  atividade: string
  detalhamento: string
  status: ApiStatusApontamento
  justificativa?: string | null
  versao: number
  dataCriacao: string
}

export type CreateApiApontamentoInput = {
  userId?: string
  data: string
  horaInicio: string
  horaFim: string
  horasTotal: number
  projeto: string
  atividade: string
  detalhamento: string
  status?: ApiStatusApontamento
  justificativa?: string
}

export type ApiSession = {
  token: string
  user: ApiUser
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly responseBody: unknown

  constructor(message: string, status: number, responseBody: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.responseBody = responseBody
  }
}

function readApiSession(): ApiSession | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(API_SESSION_STORAGE_KEY) ?? 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const session = parsed as Partial<ApiSession>
    if (typeof session.token !== 'string' || !session.user) return null
    return session as ApiSession
  } catch {
    return null
  }
}

export function saveApiSession(session: ApiSession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearApiSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(API_SESSION_STORAGE_KEY)
}

export function getApiSessionToken() {
  return readApiSession()?.token ?? null
}

async function apiFetch<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const session = readApiSession()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = accessToken ?? session?.token
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  const body = await response.json().catch(() => ({})) as unknown
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Não foi possível comunicar com o servidor.'
    throw new ApiRequestError(message, response.status, body)
  }
  return body as T
}

export const backendApi = {
  async login(email: string, senha: string) {
    const session = await apiFetch<ApiSession>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    })
    saveApiSession(session)
    return session
  },

  async validateSession(accessToken?: string) {
    return apiFetch<{ user: ApiUser }>('/api/auth', {}, accessToken)
  },

  async listUsers() {
    return apiFetch<{ users: ApiUser[] }>('/api/users')
  },

  async listApontamentos() {
    return apiFetch<{ apontamentos: ApiApontamento[] }>('/api/apontamentos')
  },

  async createApontamento(input: CreateApiApontamentoInput, accessToken?: string) {
    return apiFetch<{ apontamento: ApiApontamento }>('/api/apontamentos', {
      method: 'POST',
      body: JSON.stringify(input),
    }, accessToken)
  },

  async updateApontamentoStatus(id: string, status: ApiStatusApontamento, justificativa?: string) {
    return apiFetch<{ apontamento: ApiApontamento }>('/api/apontamentos', {
      method: 'PATCH',
      body: JSON.stringify({ id, status, justificativa }),
    })
  },
}
