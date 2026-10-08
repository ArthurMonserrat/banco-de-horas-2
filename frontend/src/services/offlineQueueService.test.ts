import { describe, expect, it, vi } from 'vitest'
import {
  OFFLINE_QUEUE_STORAGE_KEY,
  OfflineQueueService,
  buildApiApontamentoPayload,
} from './offlineQueueService'
import type { StorageLike } from './storage'
import type { CreateTimeEntryData } from '../features/time-entries/types'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

const baseEntry: CreateTimeEntryData = {
  entryDate: '2026-09-28',
  clientId: 'client-industrial',
  projectCode: 'SMA-100',
  activityId: 'activity-project-follow-up',
  disciplineCode: 'C',
  durationMinutes: 120,
  details: 'Atividade em campo',
}

describe('offline queue de apontamentos', () => {
  it('gera payload compatível com a API de apontamentos', () => {
    expect(buildApiApontamentoPayload('user-1', baseEntry, { startTime: '08:30' })).toEqual({
      userId: 'user-1',
      data: '2026-09-28',
      horaInicio: '08:30',
      horaFim: '10:30',
      horasTotal: 2,
      projeto: 'SMA-100',
      atividade: 'activity-project-follow-up',
      detalhamento: 'Atividade em campo',
      status: 'PENDENTE',
    })
  })

  it('salva apontamentos pendentes na chave offline oficial', () => {
    const storage = new MemoryStorage()
    const service = new OfflineQueueService({
      storage,
      createId: () => 'offline-1',
      now: () => '2026-09-28T12:00:00.000Z',
    })

    service.enqueueApontamento('user-1', baseEntry)

    const stored = JSON.parse(storage.getItem(OFFLINE_QUEUE_STORAGE_KEY) ?? '[]') as unknown[]
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      id: 'offline-1',
      type: 'APONTAMENTO',
      collaboratorId: 'user-1',
      entry: baseEntry,
    })
  })

  it('continua processando a fila quando um item falha e mantém o item com erro', async () => {
    const storage = new MemoryStorage()
    const syncApontamento = vi.fn()
      .mockRejectedValueOnce(new Error('erro 500: sem conexão'))
      .mockResolvedValueOnce({})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = new OfflineQueueService({
      storage,
      createId: vi.fn()
        .mockReturnValueOnce('offline-1')
        .mockReturnValueOnce('offline-2'),
      now: () => '2026-09-28T12:00:00.000Z',
      syncApontamento,
    })
    service.enqueueApontamento('user-1', baseEntry)
    service.enqueueApontamento('user-1', { ...baseEntry, entryDate: '2026-09-29' })

    const result = await service.sync()

    expect(result).toEqual({ synced: 1, remaining: 1 })
    expect(service.list()).toHaveLength(1)
    expect(service.list()[0].id).toBe('offline-1')
    expect(syncApontamento).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalledWith(
      'Falha ao sincronizar apontamento offline.',
      expect.objectContaining({
        id: 'offline-1',
        payload: expect.objectContaining({ projeto: 'SMA-100' }),
        error: expect.any(Error),
      }),
    )
    consoleError.mockRestore()
  })
})
