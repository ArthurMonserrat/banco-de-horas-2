import { describe, expect, it } from 'vitest'
import { filterDirectorHistoryRows, type DirectorHistoryFilters } from './directorHistoryFilters'
import type { ReportRow } from '../../services/reportService'

const rows: ReportRow[] = [
  { id: 'row-1', collaborator: 'Ana Lima', supervisor: 'Supervisão Alpha', date: '2026-10-02', activity: 'Serviços em campo', project: 'SMA-100', hours: 9, status: 'APPROVED', durationMinutes: 540, emObra: true },
  { id: 'row-2', collaborator: 'Bruno Dias', supervisor: 'Supervisão Beta', date: '2026-10-03', activity: 'Atividade interna', project: 'SMA-200', hours: 8, status: 'PENDING', durationMinutes: 480, emObra: false },
]

const defaultFilters: DirectorHistoryFilters = {
  supervisor: 'Todos',
  collaborator: '',
  project: 'Todos',
  startDate: '',
  endDate: '',
  status: 'ALL',
}

describe('filtros do histórico da diretoria', () => {
  it('combina equipe, colaborador, projeto, período e status', () => {
    expect(filterDirectorHistoryRows(rows, {
      ...defaultFilters,
      supervisor: 'Supervisão Alpha',
      collaborator: 'ana',
      project: 'SMA-100',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      status: 'APPROVED',
    })).toEqual([rows[0]])
  })

  it('retorna vazio quando nenhum apontamento atende aos filtros atuais', () => {
    expect(filterDirectorHistoryRows(rows, { ...defaultFilters, collaborator: 'Carla' })).toEqual([])
  })
})
