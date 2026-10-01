export type ProjetoApi = {
  cliente: string | null
  pro_st_apelido: string | null
  pro_st_descricao: string | null
}

const DEFAULT_PROJETOS_URL = 'https://supabase.sma-apps.com.br/rest/v1/projetos'
const PROJETOS_SELECT = 'cliente,pro_st_apelido,pro_st_descricao'
const projetosUrl = import.meta.env.VITE_SUPABASE_PROJETOS_URL?.trim() || DEFAULT_PROJETOS_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

function isProjetoApi(value: unknown): value is ProjetoApi {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const project = value as Record<string, unknown>
  return (typeof project.cliente === 'string' || project.cliente === null)
    && (typeof project.pro_st_apelido === 'string' || project.pro_st_apelido === null)
    && (typeof project.pro_st_descricao === 'string' || project.pro_st_descricao === null)
}

export async function fetchProjetos(fetcher: typeof fetch = fetch): Promise<ProjetoApi[]> {
  const url = `${projetosUrl}?select=${encodeURIComponent(PROJETOS_SELECT)}`
  const response = await fetcher(url, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  })

  if (!response.ok) throw new Error('Não foi possível carregar os projetos.')
  const payload: unknown = await response.json()
  return Array.isArray(payload) ? payload.filter(isProjetoApi) : []
}
