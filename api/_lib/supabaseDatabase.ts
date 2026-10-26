type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type SupabaseRestClient = {
  select: (table: string, query: string) => Promise<unknown[]>
  insert: (table: string, payload: Record<string, unknown>) => Promise<unknown[]>
  update: (table: string, query: string, payload: Record<string, unknown>) => Promise<unknown[]>
}

function assertTable(table: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error('Tabela inválida.')
}

export function createSupabaseRestClient(
  baseUrl: string,
  anonKey: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
  schema = 'banco2',
): SupabaseRestClient {
  const root = `${baseUrl.replace(/\/+$/, '')}/rest/v1`
  const headers = () => ({
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': schema,
    'content-profile': schema,
  })

  async function request(path: string, init: RequestInit): Promise<unknown[]> {
    const response = await fetchImpl(`${root}/${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } })
    const body = await response.json().catch(() => null) as unknown
    if (!response.ok) throw new Error(`Supabase Data API respondeu ${response.status}.`)
    return Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : []
  }

  return {
    select: (table, query) => {
      assertTable(table)
      return request(`${table}?${query}`, { method: 'GET' })
    },
    insert: (table, payload) => {
      assertTable(table)
      return request(table, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(payload) })
    },
    update: (table, query, payload) => {
      assertTable(table)
      return request(`${table}?${query}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(payload) })
    },
  }
}

export function readSupabaseDataConfig(env: Record<string, string | undefined> = process.env) {
  const url = env.ECOSYSTEM_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const anonKey = env.ECOSYSTEM_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}
