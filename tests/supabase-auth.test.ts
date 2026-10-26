import assert from 'node:assert/strict'
import { test } from 'node:test'
import { requireSupabaseUser } from '../api/_lib/auth'

test('a identidade Supabase validada produz o profile_id corporativo sem consultar e-mail local', async () => {
  const user = await requireSupabaseUser(
    { method: 'GET', headers: { authorization: 'Bearer supabase-token' } },
    async (token) => {
      assert.equal(token, 'supabase-token')
      return {
        ok: true,
        identity: {
          profileId: 'profile-1',
          email: 'colaborador@sma-eng.com.br',
          nome: 'Colaborador',
          role: 'colaborador',
        },
      }
    },
  )

  assert.deepEqual(user, {
    id: 'profile-1',
    nome: 'Colaborador',
    email: 'colaborador@sma-eng.com.br',
    perfil: 'COLABORADOR',
    supervisorId: null,
  })
})

test('sessão ausente ou acesso não autorizado falha sem fallback', async () => {
  assert.equal(await requireSupabaseUser({ method: 'GET', headers: {} }, async () => ({ ok: false, status: 403, reason: 'no_banco2_access', message: 'negado' })), null)
  assert.equal(await requireSupabaseUser({ method: 'GET', headers: {} }, async () => { throw new Error('não deve ser chamado') }), null)
})
