/**
 * Valida o login Microsoft feito no Ecossistema SM&A (Supabase do Banco 1) e confere,
 * na tabela profile_module_access, se a pessoa tem acesso liberado ao Banco 2.
 * Não usa Prisma: só HTTP para o Supabase, para poder ser testado isoladamente.
 */

export type EcosystemRole = 'colaborador' | 'supervisor' | 'diretor'

export type EcosystemIdentity = {
  email: string
  nome: string
  role: EcosystemRole
}

export type EcosystemAccessFailure = {
  ok: false
  status: 401 | 403 | 503
  reason: 'invalid_session' | 'not_microsoft' | 'profile_missing' | 'profile_inactive' | 'no_banco2_access' | 'config_missing' | 'ecosystem_unavailable'
  message: string
}

export type EcosystemAccessResult = { ok: true; identity: EcosystemIdentity } | EcosystemAccessFailure

export type EcosystemAuthConfig = {
  url: string
  anonKey: string
  serviceRoleKey: string
}

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const ROLES = new Set<EcosystemRole>(['colaborador', 'supervisor', 'diretor'])

export function readEcosystemAuthConfig(env: Record<string, string | undefined> = process.env): EcosystemAuthConfig | null {
  const url = env.ECOSYSTEM_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const anonKey = env.ECOSYSTEM_SUPABASE_ANON_KEY?.trim()
  const serviceRoleKey = env.ECOSYSTEM_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !anonKey || !serviceRoleKey) return null
  return { url, anonKey, serviceRoleKey }
}

function fail(status: EcosystemAccessFailure['status'], reason: EcosystemAccessFailure['reason'], message: string): EcosystemAccessFailure {
  return { ok: false, status, reason, message }
}

function isRole(value: unknown): value is EcosystemRole {
  return typeof value === 'string' && ROLES.has(value as EcosystemRole)
}

function nameFromEmail(email: string) {
  return (email.split('@')[0] ?? '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || email
}

export async function verifyBanco2Access(
  accessToken: string,
  config: EcosystemAuthConfig | null = readEcosystemAuthConfig(),
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<EcosystemAccessResult> {
  if (!config) return fail(503, 'config_missing', 'Integração com o Ecossistema não configurada no Banco 2.')

  const serviceHeaders = { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, Accept: 'application/json' }

  try {
    // 1) Token do Supabase é válido? (mesmo projeto usado pelo Ecossistema/Banco 1)
    const userResponse = await fetchImpl(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}` },
    })
    if (userResponse.status === 401 || userResponse.status === 403) return fail(401, 'invalid_session', 'Sessão Microsoft inválida ou expirada.')
    if (!userResponse.ok) return fail(503, 'ecosystem_unavailable', 'Não foi possível validar o login no Ecossistema.')
    const user = await userResponse.json() as { id?: unknown; app_metadata?: { provider?: unknown } }
    if (typeof user.id !== 'string' || !user.id) return fail(401, 'invalid_session', 'Sessão Microsoft inválida ou expirada.')
    if (user.app_metadata?.provider !== 'azure') return fail(403, 'not_microsoft', 'É necessário entrar com a conta Microsoft corporativa.')

    const userId = encodeURIComponent(user.id)

    // 2) Perfil corporativo ativo
    const profileResponse = await fetchImpl(`${config.url}/rest/v1/profiles?id=eq.${userId}&select=email,full_name,role,active`, { headers: serviceHeaders })
    if (!profileResponse.ok) return fail(503, 'ecosystem_unavailable', 'Não foi possível consultar o perfil corporativo.')
    const profiles = await profileResponse.json() as Array<Record<string, unknown>>
    const profile = Array.isArray(profiles) ? profiles[0] : undefined
    if (!profile || typeof profile.email !== 'string' || !isRole(profile.role)) return fail(403, 'profile_missing', 'Perfil corporativo não encontrado.')
    if (profile.active !== true) return fail(403, 'profile_inactive', 'Seu perfil corporativo está inativo. Contate a Administração.')

    // 3) Acesso liberado ao Banco 2
    const accessResponse = await fetchImpl(
      `${config.url}/rest/v1/profile_module_access?profile_id=eq.${userId}&module=eq.BANCO_2&active=eq.true&select=role`,
      { headers: serviceHeaders },
    )
    if (!accessResponse.ok) return fail(503, 'ecosystem_unavailable', 'Não foi possível consultar os acessos do Ecossistema.')
    const accessRows = await accessResponse.json() as Array<Record<string, unknown>>
    const access = Array.isArray(accessRows) ? accessRows[0] : undefined
    if (!access) return fail(403, 'no_banco2_access', 'Seu usuário não tem acesso ao Banco de Horas 2. Contate a Administração.')

    const email = profile.email.trim().toLowerCase()
    const fullName = typeof profile.full_name === 'string' && profile.full_name.includes(' ') ? profile.full_name.trim() : nameFromEmail(email)
    return {
      ok: true,
      identity: {
        email,
        nome: fullName,
        role: isRole(access.role) ? access.role : profile.role,
      },
    }
  } catch (error) {
    console.error('[ecosystem] Falha ao validar acesso ao Banco 2:', error instanceof Error ? error.message : error)
    return fail(503, 'ecosystem_unavailable', 'Não foi possível validar o acesso no Ecossistema.')
  }
}
