import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionHandler, type Banco2User, type SessionHandlerDeps } from '../api/session'
import type { ApiResponse } from '../api/_lib/http'

function response() {
  const state = { status: 0, body: undefined as unknown }
  const res: ApiResponse = {
    status(code) { state.status = code; return this },
    json(value) { state.body = value },
  }
  return { res, state }
}

function deps(overrides: Partial<SessionHandlerDeps> = {}): SessionHandlerDeps & { upserts: unknown[] } {
  const upserts: unknown[] = []
  return {
    upserts,
    verifyAccess: async () => ({ ok: true, identity: { email: 'fernando.almeida@sma-eng.com.br', nome: 'Fernando Almeida', role: 'diretor' } }),
    upsertUser: async (identity) => {
      upserts.push(identity)
      return { id: 'prisma-1', nome: identity.nome, email: identity.email, perfil: identity.perfil, supervisorId: null } satisfies Banco2User
    },
    createToken: (user) => `token-${user.id}-${user.perfil}`,
    ...overrides,
  }
}

test('login Microsoft com acesso ao Banco 2 abre sessão com o perfil certo', async () => {
  const d = deps()
  const { res, state } = response()
  await createSessionHandler(d)({ method: 'POST', headers: { authorization: 'Bearer supabase-token' } }, res)
  assert.equal(state.status, 200)
  assert.deepEqual(state.body, {
    token: 'token-prisma-1-DIRETOR',
    user: { id: 'prisma-1', nome: 'Fernando Almeida', email: 'fernando.almeida@sma-eng.com.br', perfil: 'DIRETOR', supervisorId: null },
  })
  assert.deepEqual(d.upserts, [{ email: 'fernando.almeida@sma-eng.com.br', nome: 'Fernando Almeida', role: 'diretor', perfil: 'DIRETOR' }])
})

test('sem acesso ao Banco 2: 403 e nenhum usuário criado', async () => {
  const d = deps({ verifyAccess: async () => ({ ok: false, status: 403, reason: 'no_banco2_access', message: 'Sem acesso' }) })
  const { res, state } = response()
  await createSessionHandler(d)({ method: 'POST', headers: { authorization: 'Bearer t' } }, res)
  assert.equal(state.status, 403)
  assert.deepEqual(state.body, { error: 'Sem acesso', reason: 'no_banco2_access' })
  assert.equal(d.upserts.length, 0)
})

test('sem token: 401; método errado: 405; banco fora do ar: 500', async () => {
  const noToken = response()
  await createSessionHandler(deps())({ method: 'POST', headers: {} }, noToken.res)
  assert.equal(noToken.state.status, 401)

  const wrongMethod = response()
  await createSessionHandler(deps())({ method: 'GET', headers: {} }, wrongMethod.res)
  assert.equal(wrongMethod.state.status, 405)

  const dbDown = response()
  await createSessionHandler(deps({ upsertUser: async () => { throw new Error('db down') } }))({ method: 'POST', headers: { authorization: 'Bearer t' } }, dbDown.res)
  assert.equal(dbDown.state.status, 500)
})
