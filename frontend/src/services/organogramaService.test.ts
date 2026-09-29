import { describe, expect, it } from 'vitest'
import type { DEPGerencia } from '../data/mockDEP'
import { createManagerCalendarTeamData } from './organogramaService'

const organograma: DEPGerencia[] = [
  {
    gerente: 'Gerência A',
    squads: [
      {
        nome: 'S1 - CAMPO',
        supervisor: 'Supervisora Campo',
        colaboradores: [
          { nome: 'Técnica Ana', cargo: 'Projetista' },
          { nome: 'Técnico Bruno', cargo: 'Desenhista' },
        ],
      },
      {
        nome: 'S2 - ESTUDOS',
        supervisor: 'Supervisor Estudos',
        colaboradores: [
          { nome: 'Técnica Carla', cargo: 'Engenheiro' },
        ],
      },
    ],
  },
]

describe('organogramaService', () => {
  it('gera a fonte unica de supervisores e colaboradores para o calendário da diretoria', () => {
    const data = createManagerCalendarTeamData(organograma)

    expect(data.supervisors).toEqual([
      { id: 'S1 - CAMPO', name: 'Supervisora Campo', squadName: 'S1 - CAMPO' },
      { id: 'S2 - ESTUDOS', name: 'Supervisor Estudos', squadName: 'S2 - ESTUDOS' },
    ])
    expect(data.collaborators).toEqual([
      { id: 'Técnica Ana', name: 'Técnica Ana', supervisorId: 'S1 - CAMPO', squadName: 'S1 - CAMPO' },
      { id: 'Técnico Bruno', name: 'Técnico Bruno', supervisorId: 'S1 - CAMPO', squadName: 'S1 - CAMPO' },
      { id: 'Técnica Carla', name: 'Técnica Carla', supervisorId: 'S2 - ESTUDOS', squadName: 'S2 - ESTUDOS' },
    ])
  })
})
