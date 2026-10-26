import { describe, expect, it } from 'vitest'
import { isMedicaoRdo, parseMedicaoRdoPages, rdoNameMatches, type RdoPage } from './rdoMedicaoParser'
import { parseRDOPages } from './rdoParser'
import { findClientIdByRdoName } from './rdoClient'

type Row = { name: string; times: Array<[number, string]>; y: number }

/** Página no mesmo layout do RDO ArcelorMittal (coordenadas do PDF real, nomes fictícios). */
function page(date: string, rows: Row[], activities: string[]): RdoPage {
  return [
    { text: 'RELATÓRIO DIÁRIO DE OBRA', x: 398, y: 549.6 },
    { text: 'CONTRATADA', x: 87.7, y: 532.4 },
    { text: 'CONTRATANTE / CLIENTE:', x: 213.3, y: 532.4 },
    { text: 'LOCALIZAÇÃO (CIDADE/ESTADO):', x: 340.2, y: 532.4 },
    { text: 'NÚMERO DA OBRA (CENTRO CUSTO SM&A):', x: 520.3, y: 532.4 },
    { text: 'NÚMERO DO CONTRATO / PEDIDO COMPRA', x: 648.7, y: 532.4 },
    { text: 'ARCELORMITTAL', x: 213.5, y: 521 },
    { text: 'JUÍZ DE FORA - MG', x: 340.3, y: 521 },
    { text: '24AM018E', x: 520.4, y: 521 },
    { text: '5800036287/EC-24AM000-027-04', x: 648.8, y: 521 },
    { text: 'SM&A SISTEMAS ELÉTRICOS E AUTOMAÇÃO', x: 94.1, y: 520 },
    { text: 'DATA DA ATIVIDADE (DD/MM/AA):', x: 87.7, y: 494.3 },
    { text: date, x: 207.4, y: 477.1 },
    { text: 'NOME DO PROFISSIONAL', x: 210.6, y: 457.7 },
    { text: 'Horário de Trabalho (hh:mm)', x: 413, y: 457.7 },
    { text: 'Intervalo Almoço/Janta (hh:mm)', x: 545.4, y: 457.7 },
    { text: 'Horas Normais', x: 657.8, y: 453.2 },
    { text: 'Horas Extraordinárias', x: 708.5, y: 453.2 },
    { text: 'Início', x: 404.9, y: 448.8 },
    { text: 'Término', x: 473.4, y: 448.8 },
    { text: 'Início', x: 546.5, y: 448.8 },
    { text: 'Término', x: 607.3, y: 448.3 },
    { text: 'EFETIVO', x: 96.5, y: 425.4 },
    { text: 'DIRETO', x: 103.1, y: 426.7 },
    ...rows.flatMap((row) => [
      { text: row.name, x: 180, y: row.y - 1.6 },
      ...row.times.map(([x, text]) => ({ text, x, y: x === 611 ? row.y - 0.5 : row.y })),
    ]),
    { text: 'EQUIPAMENTO', x: 259.7, y: 385.2 },
    { text: 'NOTEBOOK', x: 263.9, y: 374.6 },
    { text: '2.00', x: 494, y: 375.7 },
    { text: 'PRINCIPAIS ATIVIDADES E COMENTÁRIOS', x: 374.4, y: 294.7 },
    { text: date, x: 110.8, y: 285.4 },
    ...activities.map((text, index) => ({ text, x: 110.8, y: 278.3 - index * 7.1 })),
    { text: 'SM&A', x: 99.7, y: 205.7 },
    { text: 'CONTRATANTE', x: 99.7, y: 88.1 },
    { text: 'ASSINATURAS / VALIDAÇÃO DO DOCUMENTO', x: 370.6, y: 73.6 },
    { text: 'SM&A SISTEMAS ELÉTRICOS', x: 237.5, y: 30.1 },
  ]
}

const fullDay = (name: string, y: number, end = '18:00', normal = '9:00', extra?: string): Row => ({
  name, y, times: [[406.6, '8:00'], [477, '12:00'], [546.8, '13:00'], [611, end], [670.7, normal], ...(extra ? [[720, extra] as [number, string]] : [])],
})

const pages: RdoPage[] = [
  page('19/10/2026', [
    fullDay('Ana Paula Souza - Eng. Sênior', 439.8),
    { name: 'Bruno de Lima - Técnico de Campo', y: 430.7, times: [[406.6, '8:00'], [477, '12:30'], [670.7, '4:30']] },
  ], ['-Deslocamento até a planta do cliente;', '-Teste do relé de proteção. Não foi possível concluir porque o software', 'estava desatualizado;']),
  page('20/10/2026', [fullDay('Ana Paula Souza - Eng. Sênior', 439.8, '19:00', '9:00', '1:00')], ['-Substituição do relé do cubículo 03C.']),
  page('21/10/2026', [fullDay('Bruno de Lima - Técnico de Campo', 439.8)], ['-Treinamento local.']),
]

describe('RDO por profissional (modelo ArcelorMittal)', () => {
  it('reconhece o modelo e lê obra, contrato e cliente do cabeçalho', () => {
    expect(isMedicaoRdo(pages)).toBe(true)
    const parsed = parseMedicaoRdoPages(pages, { collaboratorName: 'Ana Souza' })
    expect(parsed.numeroObra).toBe('24AM018E')
    expect(parsed.numeroContrato).toBe('5800036287/EC-24AM000-027-04')
    expect(parsed.cliente).toBe('ARCELORMITTAL')
  })

  it('lê só as horas do usuário logado, somando normais e extras, um dia por página', () => {
    const parsed = parseMedicaoRdoPages(pages, { collaboratorName: 'Ana Souza' })
    expect(parsed.dias.map(({ data, horas, minutos }) => ({ data, horas, minutos }))).toEqual([
      { data: '2026-10-19', horas: 9, minutos: 0 },
      { data: '2026-10-20', horas: 10, minutos: 0 },
    ])
    expect(parsed.dias[0].detalhamento).toBe([
      'Jornada: 08:00 - 12:00 | 13:00 - 18:00',
      '-Deslocamento até a planta do cliente;',
      '-Teste do relé de proteção. Não foi possível concluir porque o software estava desatualizado;',
    ].join('\n'))
  })

  it('ignora dias em que o profissional não aparece e lê jornada de meio período', () => {
    const parsed = parseMedicaoRdoPages(pages, { collaboratorName: 'Bruno Lima' })
    expect(parsed.dias.map(({ data, horas, minutos }) => ({ data, horas, minutos }))).toEqual([
      { data: '2026-10-19', horas: 4, minutos: 30 },
      { data: '2026-10-21', horas: 9, minutos: 0 },
    ])
    expect(parsed.dias[0].detalhamento.split('\n')[0]).toBe('Jornada: 08:00 - 12:30')
  })

  it('avisa quando o usuário não está no RDO com vários profissionais', () => {
    const parsed = parseMedicaoRdoPages(pages, { collaboratorName: 'Carlos Pereira' })
    expect(parsed.dias).toEqual([])
    expect(parsed.aviso).toContain('Ana Paula Souza')
    expect(parsed.aviso).toContain('Bruno de Lima')
  })

  it('usa o único profissional quando o RDO tem só uma pessoa', () => {
    const single = [page('19/10/2026', [fullDay('Ana Paula Souza - Eng. Sênior', 439.8)], ['-Atividade.'])]
    expect(parseMedicaoRdoPages(single, { collaboratorName: 'Outro Nome' }).dias).toHaveLength(1)
  })

  it('compara nomes sem acento, maiúsculas ou preposições', () => {
    expect(rdoNameMatches('ana souza', 'Ana Paula Souza - Eng. Sênior')).toBe(true)
    expect(rdoNameMatches('Bruno Lima', 'Bruno de Lima - Técnico')).toBe(true)
    expect(rdoNameMatches('Ana Lima', 'Ana Paula Souza - Eng. Sênior')).toBe(false)
  })

  it('parseRDOPages devolve o modelo, o contrato e o cliente cadastrado', () => {
    const parsed = parseRDOPages(pages, { collaboratorName: 'Ana Souza' })
    expect(parsed.modelo).toBe('medicao')
    expect(parsed.numeroContrato).toBe('5800036287/EC-24AM000-027-04')
    expect(findClientIdByRdoName(parsed.cliente)).toBe('client-arcelormittal')
    expect(parsed.dias[0]).not.toHaveProperty('profissional')
  })

  it('o RDO padrão continua sendo lido pelo texto', () => {
    const padrao: RdoPage = [
      { text: 'Obra 12345', x: 50, y: 700 },
      { text: 'Data OS: 05/01/2026', x: 50, y: 680 },
      { text: 'Total de Horas 8,5', x: 50, y: 600 },
    ]
    const parsed = parseRDOPages([padrao])
    expect(parsed.modelo).toBe('padrao')
    expect(parsed.numeroObra).toBe('12345')
    expect(parsed.dias[0]).toMatchObject({ data: '2026-01-05', horas: 8, minutos: 30 })
  })
})
