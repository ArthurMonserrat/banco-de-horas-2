import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSupabaseRestClient } from '../api/_lib/supabaseDatabase'

test('cliente de dados usa o token do usuário e o schema banco2', async () => {
  let captured: { url: string; init?: RequestInit } | undefined
  const client = createSupabaseRestClient('https://supabase.test', 'anon-key', 'user-token', async (url, init) => {
    captured = { url, init }
    return new Response(JSON.stringify([{ id: 'entry-1' }]), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  const rows = await client.select('apontamentos', 'select=*')
  assert.deepEqual(rows, [{ id: 'entry-1' }])
  assert.equal(captured?.url, 'https://supabase.test/rest/v1/apontamentos?select=*')
  assert.equal(new Headers(captured?.init?.headers).get('authorization'), 'Bearer user-token')
  assert.equal(new Headers(captured?.init?.headers).get('accept-profile'), 'banco2')
})

test('erro da Data API não vira sucesso local', async () => {
  const client = createSupabaseRestClient('https://supabase.test', 'anon-key', 'user-token', async () => new Response('denied', { status: 403 }))
  await assert.rejects(() => client.select('apontamentos', 'select=*'), /Supabase Data API respondeu 403/)
})
