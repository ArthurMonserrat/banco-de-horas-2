import { describe, expect, it } from 'vitest'
import { filterSupervisorHistoryEntries } from '../features/supervisor/historyFilters'
import type { SupervisorPendingEntry } from '../features/supervisor/types'

const entries: SupervisorPendingEntry[] = [
  { id: 'entry-1', collaboratorId: 'tech-1', collaboratorName: 'Ana Lima', entryDate: '2026-10-02', projectCode: 'SMA-100', durationMinutes: 480, status: 'APPROVED' },
  { id: 'entry-2', collaboratorId: 'tech-2', collaboratorName: 'Bruno Dias', entryDate: '2026-10-03', projectCode: 'SMA-200', durationMinutes: 540, status: 'PENDING' },
]

describe('filtros do histórico do supervisor', () => {
  it('combina técnico, projeto, período e status', () => {
    expect(filterSupervisorHistoryEntries(entries, {
      technician: 'ana',
      project: 'SMA-100',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      status: 'APPROVED',
    })).toEqual([entries[0]])
  })

  it('retorna vazio quando nenhum registro atende aos filtros', () => {
    expect(filterSupervisorHistoryEntries(entries, {
      technician: 'carla',
      project: 'Todos',
      startDate: '',
      endDate: '',
      status: 'ALL',
    })).toEqual([])
  })
})
