import assert from 'node:assert/strict'
import { test } from 'node:test'
import authHandler from '../api/auth'
import type { ApiResponse } from '../api/_lib/http'

test('GET /api/auth sem sessão responde 401 sem conexão com o banco', async () => {
  let status = 0
  let body: unknown
  const response: ApiResponse = {
    status(code) {
      status = code
      return this
    },
    json(value) {
      body = value
    },
  }

  await authHandler({ method: 'GET', headers: {} }, response)

  assert.equal(status, 401)
  assert.deepEqual(body, { error: 'Sessão inválida ou expirada.' })
})
