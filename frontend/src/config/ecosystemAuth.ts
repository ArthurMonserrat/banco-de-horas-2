/**
 * Login Microsoft do Ecossistema SM&A (mesmo projeto Supabase do Banco 1).
 * Variáveis próprias (VITE_ECOSYSTEM_*) para não colidir com VITE_SUPABASE_* da API de projetos.
 */
export type EcosystemAuthConfig = {
  url: string
  anonKey: string
  redirectTo: string
  ecosystemUrl: string | null
  enabled: boolean
}

type Env = Record<string, string | undefined>

function safeHttpsUrl(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return null
    return url.toString()
  } catch {
    return null
  }
}

export function getEcosystemAuthConfig(
  env: Env = import.meta.env as unknown as Env,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
  basePath = import.meta.env.BASE_URL || '/',
): EcosystemAuthConfig {
  const url = env.VITE_ECOSYSTEM_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.VITE_ECOSYSTEM_SUPABASE_ANON_KEY?.trim() ?? ''
  const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`
  const redirectTo = origin ? `${origin.replace(/\/$/, '')}${normalizedBase.replace(/\/$/, '')}/#/auth/callback` : ''
  return {
    url,
    anonKey,
    redirectTo,
    ecosystemUrl: safeHttpsUrl(env.VITE_ECOSYSTEM_URL),
    enabled: Boolean(url && anonKey && redirectTo),
  }
}

export const demoModeEnabled = import.meta.env.MODE === 'test' || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true')
