import { describe, expect, it, vi } from 'vitest'
import { fetchProjetos } from './projetosService'

describe('projetosService', () => {
  it('consulta os projetos com os campos e headers exigidos pelo Supabase', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { cliente: 'Vale', pro_st_apelido: '25M020E', pro_st_descricao: 'Obra elétrica' },
    ]), { status: 200 }))

    await expect(fetchProjetos(fetcher)).resolves.toEqual([
      { cliente: 'Vale', pro_st_apelido: '25M020E', pro_st_descricao: 'Obra elétrica' },
    ])

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/projetos?select=cliente%2Cpro_st_apelido%2Cpro_st_descricao'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: expect.any(String),
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    )
  })

  it('falha com mensagem útil quando a API responde com erro', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('forbidden', { status: 403 }))

    await expect(fetchProjetos(fetcher)).rejects.toThrow('Não foi possível carregar os projetos.')
  })
})
