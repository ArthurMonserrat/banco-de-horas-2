import { describe, expect, it } from 'vitest'
import type { CreateTimeEntryData } from './types'
import { persistEntries } from './useTimeEntryForm'

const entry: CreateTimeEntryData = {
  entryDate: '2026-10-31',
  clientId: 'client-1',
  projectCode: 'PRJ-1',
  activityId: 'activity-1',
  disciplineCode: 'C',
  durationMinutes: 60,
  details: 'Registro sintético',
}

describe('persistência do formulário de apontamentos', () => {
  it('envia cada apontamento uma única vez pelo serviço selecionado', async () => {
    const calls: Array<{ collaboratorId: string; entry: CreateTimeEntryData }> = []

    await persistEntries('profile-1', [entry, { ...entry, entryDate: '2026-11-01' }], async (collaboratorId, data) => {
      calls.push({ collaboratorId, entry: data })
      return {} as never
    })

    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.entry.entryDate)).toEqual(['2026-10-31', '2026-11-01'])
  })
})
