import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApontamentosHandler } from '../api/apontamentos'
import type { ApiResponse } from '../api/_lib/http'

function response() {
  const state = { status: 0, body: undefined as unknown }
  const res: ApiResponse = { status(code) { state.status = code; return this }, json(value) { state.body = value } }
  return { res, state }
}

const identity = async () => ({ id: 'profile-1', nome: 'A', email: 'a@example.com', perfil: 'COLABORADOR' as const, supervisorId: null })

test('criação usa o profile autenticado e ignora userId enviado pelo navegador', async () => {
  let inserted: Record<string, unknown> | undefined
  const handler = createApontamentosHandler(identity, () => ({
    select: async () => [],
    insert: async (_table, payload) => { inserted = payload; return [{ id: 'entry-1', profile_id: payload.profile_id, entry_date: '2026-10-26', duration_minutes: 60, project_code: 'P1', activity_id: 'A1', details: 'teste', status: 'pending', version: 1, created_at: '2026-10-26T10:00:00Z' }] },
    update: async () => [],
  }))
  const { res, state } = response()
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { userId: 'attacker', data: '2026-10-26', horasTotal: 1, projeto: 'P1', atividade: 'A1', detalhamento: 'teste' } }, res)
  assert.equal(state.status, 201)
  assert.equal(inserted?.profile_id, 'profile-1')
  assert.notEqual(inserted?.profile_id, 'attacker')
})

test('falha de persistência retorna erro e não simula gravação local', async () => {
  const handler = createApontamentosHandler(identity, () => ({
    select: async () => { throw new Error('down') },
    insert: async () => { throw new Error('down') },
    update: async () => { throw new Error('down') },
  }))
  const { res, state } = response()
  await handler({ method: 'GET', headers: { authorization: 'Bearer token' } }, res)
  assert.equal(state.status, 502)
})

test('edição exige versão esperada para evitar sobrescrita concorrente', async () => {
  let query = ''
  const handler = createApontamentosHandler(identity, () => ({
    select: async () => [],
    insert: async () => [],
    update: async (_table, where) => { query = where; return [{ id: 'entry-1', profile_id: 'profile-1', entry_date: '2026-10-26', duration_minutes: 60, project_code: 'P1', activity_id: 'A1', details: 'corrigido', status: 'pending', version: 2, created_at: '2026-10-26T10:00:00Z' }] },
  }))
  const { res, state } = response()
  await handler({ method: 'PATCH', headers: { authorization: 'Bearer token' }, body: { id: 'entry-1', versao: 1, detalhamento: 'corrigido', motivo: 'corrigir' } }, res)
  assert.equal(state.status, 200)
  assert.match(query, /profile_id=eq\.profile-1/)
  assert.match(query, /version=eq\.1/)
  assert.match(query, /status=in\.\(pending,rejected\)/)
})
