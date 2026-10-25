import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionToken, sessionSecret, SESSION_TTL_SECONDS, validateSessionToken } from '../api/_lib/sessionToken'

const env = { SESSION_SECRET: 'segredo-de-teste' }
const now = 1_800_000_000

test('token válido dentro do prazo', () => {
  const token = createSessionToken({ id: 'u1', perfil: 'DIRETOR' }, env, now)
  assert.deepEqual(validateSessionToken(token, env, now + 60).payload, { sub: 'u1', perfil: 'DIRETOR', iat: now })
})

test('token expira depois de 12 horas', () => {
  const token = createSessionToken({ id: 'u1', perfil: 'COLABORADOR' }, env, now)
  const result = validateSessionToken(token, env, now + SESSION_TTL_SECONDS + 1)
  assert.equal(result.payload, null)
  assert.equal(result.reason, 'sessão expirada')
})

test('token assinado com outra chave é rejeitado', () => {
  const token = createSessionToken({ id: 'u1', perfil: 'DIRETOR' }, { SESSION_SECRET: 'outra' }, now)
  assert.equal(validateSessionToken(token, env, now).payload, null)
})

test('token adulterado (perfil trocado) é rejeitado', () => {
  const token = createSessionToken({ id: 'u1', perfil: 'COLABORADOR' }, env, now)
  const [, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ sub: 'u1', perfil: 'DIRETOR', iat: now })).toString('base64url')
  assert.equal(validateSessionToken(`${forged}.${signature}`, env, now).payload, null)
})

test('produção sem SESSION_SECRET não usa chave padrão', () => {
  assert.throws(() => sessionSecret({ NODE_ENV: 'production' }), /SESSION_SECRET/)
  assert.throws(() => sessionSecret({ VERCEL_ENV: 'preview' }), /SESSION_SECRET/)
  assert.equal(sessionSecret({ NODE_ENV: 'development' }), 'dev-session-secret-change-me')
})
