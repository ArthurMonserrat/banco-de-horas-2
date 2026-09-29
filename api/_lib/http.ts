export type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

export function methodNotAllowed(response: ApiResponse) {
  response.status(405).json({ error: 'Method not allowed' })
}

export function parseString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getBearerToken(request: ApiRequest) {
  const authorization = request.headers.authorization
  const value = Array.isArray(authorization) ? authorization[0] : authorization
  if (!value?.startsWith('Bearer ')) return null
  return value.slice('Bearer '.length).trim() || null
}

export function sendError(response: ApiResponse, status: number, message: string) {
  response.status(status).json({ error: message })
}
