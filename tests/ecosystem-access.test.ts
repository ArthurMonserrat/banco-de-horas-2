import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyBanco2Access, type EcosystemAuthConfig } from '../api/_lib/ecosystemAccess'

const config: EcosystemAuthConfig = { url: 'https://eco.supabase.co', anonKey: 'anon', serviceRoleKey: 'service' }

type Route = { status?: number; body: unknown }

function fakeFetch(routes: { user: Route; profile?: Route; access?: Route }) {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = []
  const impl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers })
    const route = url.includes('/auth/v1/user') ? routes.user : url.includes('/rest/v1/profiles') ? routes.profile! : routes.access!
    const status = route.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => route.body }
  }
  return { impl, calls }
}

const azureUser: Route = { body: { id: 'auth-1', app_metadata: { provider: 'azure' } } }
const activeProfile: Route = { body: [{ id: 'auth-1', email: 'Fernando.Almeida@sma-eng.com.br', full_name: 'Fernando Almeida', role: 'colaborador', active: true }] }

test('libera quem tem perfil ativo e acesso BANCO_2, usando o cargo do banco', async () => {
  const { impl, calls } = fakeFetch({ user: azureUser, profile: activeProfile, access: { body: [{ role: 'diretor' }] } })
  const result = await verifyBanco2Access('token-supabase', config, impl)
  assert.deepEqual(result, { ok: true, identity: { profileId: 'auth-1', email: 'fernando.almeida@sma-eng.com.br', nome: 'Fernando Almeida', role: 'diretor' } })
  assert.equal(calls[0].headers?.Authorization, 'Bearer token-supabase')
  assert.equal(calls[0].headers?.apikey, 'anon')
  assert.match(calls[2].url, /profile_module_access\?profile_id=eq\.auth-1&module=eq\.BANCO_2&active=eq\.true/)
  assert.equal(calls[2].headers?.Authorization, 'Bearer service')
})

test('cargo vazio no acesso herda o cargo do perfil', async () => {
  const { impl } = fakeFetch({ user: azureUser, profile: activeProfile, access: { body: [{ role: null }] } })
  const result = await verifyBanco2Access('t', config, impl)
  assert.equal(result.ok && result.identity.role, 'colaborador')
})

test('nega quem não tem acesso ao Banco 2', async () => {
  const { impl } = fakeFetch({ user: azureUser, profile: activeProfile, access: { body: [] } })
  const result = await verifyBanco2Access('t', config, impl)
  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.reason, 'no_banco2_access')
  assert.equal(!result.ok && result.status, 403)
})

test('nega perfil inativo, sem perfil e login que não é Microsoft', async () => {
  const inactive = await verifyBanco2Access('t', config, fakeFetch({ user: azureUser, profile: { body: [{ email: 'a@b.c', role: 'diretor', active: false }] }, access: { body: [{}] } }).impl)
  assert.equal(!inactive.ok && inactive.reason, 'profile_inactive')
  const missing = await verifyBanco2Access('t', config, fakeFetch({ user: azureUser, profile: { body: [] }, access: { body: [{}] } }).impl)
  assert.equal(!missing.ok && missing.reason, 'profile_missing')
  const google = await verifyBanco2Access('t', config, fakeFetch({ user: { body: { id: 'x', app_metadata: { provider: 'google' } } } }).impl)
  assert.equal(!google.ok && google.reason, 'not_microsoft')
})

test('token inválido vira 401; Supabase fora do ar vira 503; sem configuração vira 503', async () => {
  const invalid = await verifyBanco2Access('t', config, fakeFetch({ user: { status: 401, body: {} } }).impl)
  assert.equal(!invalid.ok && invalid.status, 401)
  const down = await verifyBanco2Access('t', config, fakeFetch({ user: { status: 502, body: {} } }).impl)
  assert.equal(!down.ok && down.status, 503)
  const noConfig = await verifyBanco2Access('t', null)
  assert.equal(!noConfig.ok && noConfig.reason, 'config_missing')
})

test('nome derivado do e-mail quando o perfil não tem nome completo', async () => {
  const { impl } = fakeFetch({ user: azureUser, profile: { body: [{ email: 'pedro.xavier@sma-eng.com.br', full_name: 'pedro.xavier', role: 'colaborador', active: true }] }, access: { body: [{ role: null }] } })
  const result = await verifyBanco2Access('t', config, impl)
  assert.equal(result.ok && result.identity.nome, 'Pedro Xavier')
})
