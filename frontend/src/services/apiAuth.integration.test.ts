import { describe, expect, it } from 'vitest'
import authHandler from '../../../api/auth'
import type { ApiResponse } from '../../../api/_lib/http'

describe('API de autenticação sem sessão', () => {
  it('responde 401 sem precisar iniciar uma conexão com o banco', async () => {
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

    expect(status).toBe(401)
    expect(body).toEqual({ error: 'Sessão inválida ou expirada.' })
  })
})
