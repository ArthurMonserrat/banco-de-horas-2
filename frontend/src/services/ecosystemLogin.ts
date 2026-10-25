import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEcosystemAuthConfig } from '../config/ecosystemAuth'
import { ApiRequestError, saveApiSession, type ApiSession } from './api'

let client: SupabaseClient | null | undefined

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const config = getEcosystemAuthConfig()
  client = config.enabled
    ? createClient(config.url, config.anonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sma:banco2:ecosystem-auth' },
    })
    : null
  return client
}

export function isEcosystemLoginConfigured() {
  return getClient() !== null
}

/** Abre o login Microsoft (Supabase Azure, mesmo tenant e mesmo projeto do Ecossistema). */
export async function startMicrosoftLogin(): Promise<{ error: string | null }> {
  const supabase = getClient()
  const config = getEcosystemAuthConfig()
  if (!supabase) return { error: 'Login Microsoft não configurado neste ambiente do Banco 2.' }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: config.redirectTo, scopes: 'openid profile email' },
  })
  return { error: error ? 'Não foi possível iniciar o login Microsoft.' : null }
}

export function readCallbackCode(search: string, hash = ''): string | null {
  const searchParams = new URLSearchParams(search)
  const hashSearch = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const code = (searchParams.get('code') ?? new URLSearchParams(hashSearch).get('code'))?.trim()
  return code || null
}

export type Banco2LoginResult =
  | { ok: true; session: ApiSession }
  | { ok: false; reason: string; message: string }

/** Troca a sessão Microsoft pela sessão do Banco 2 (o servidor confere o acesso BANCO_2). */
export async function exchangeForBanco2Session(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<Banco2LoginResult> {
  const response = await fetchImpl('/api/session', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
  const body = await response.json().catch(() => ({})) as Partial<ApiSession> & { error?: string; reason?: string }
  if (!response.ok || typeof body.token !== 'string' || !body.user) {
    return { ok: false, reason: body.reason ?? `http_${response.status}`, message: body.error ?? 'Não foi possível abrir a sessão do Banco 2.' }
  }
  const session = { token: body.token, user: body.user } as ApiSession
  saveApiSession(session)
  return { ok: true, session }
}

/** Callback do OAuth: código -> sessão Supabase -> sessão do Banco 2. */
export async function completeMicrosoftLogin(code: string): Promise<Banco2LoginResult> {
  const supabase = getClient()
  if (!supabase) return { ok: false, reason: 'config_missing', message: 'Login Microsoft não configurado neste ambiente do Banco 2.' }
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    const accessToken = data.session?.access_token
    if (error || !accessToken) return { ok: false, reason: 'invalid_callback', message: 'Não foi possível validar o retorno do login Microsoft. Tente novamente.' }
    return await exchangeForBanco2Session(accessToken)
  } catch (error) {
    if (error instanceof ApiRequestError) return { ok: false, reason: `http_${error.status}`, message: error.message }
    return { ok: false, reason: 'network', message: 'Falha de comunicação ao concluir o login. Tente novamente.' }
  }
}

export async function signOutMicrosoft() {
  try {
    await getClient()?.auth.signOut()
  } catch {
    // A sessão local do Banco 2 já foi apagada; falha no Supabase não deve travar a saída.
  }
}
