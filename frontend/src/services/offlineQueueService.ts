import type { CreateTimeEntryData } from '../features/time-entries/types'
import { ApiRequestError, backendApi, type CreateApiApontamentoInput } from './api'
import { createBrowserStorage, type StorageLike } from './storage'

export const OFFLINE_QUEUE_STORAGE_KEY = '@sma_offline_queue'
export const OFFLINE_QUEUE_CHANGED_EVENT = 'sma:offline-queue-changed'

export type OfflineQueueItem = {
  id: string
  type: 'APONTAMENTO'
  collaboratorId: string
  createdAt: string
  entry: CreateTimeEntryData
  apiPayload: CreateApiApontamentoInput
}

type OfflineQueueDependencies = {
  storage: StorageLike
  createId?: () => string
  now?: () => string
  syncApontamento?: (input: CreateApiApontamentoInput, accessToken?: string) => Promise<unknown>
}

function isTime(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function addMinutesToTime(start: string, minutes: number) {
  const [hours, mins] = start.split(':').map(Number)
  const total = Math.max(0, Math.min((hours * 60) + mins + minutes, 24 * 60 - 1))
  const endHours = Math.floor(total / 60)
  const endMinutes = total % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}

export function buildApiApontamentoPayload(
  collaboratorId: string,
  entry: CreateTimeEntryData,
  options: { startTime?: string; endTime?: string } = {},
): CreateApiApontamentoInput {
  const horaInicio = isTime(options.startTime) ? options.startTime : '00:00'
  const horaFim = isTime(options.endTime) ? options.endTime : addMinutesToTime(horaInicio, entry.durationMinutes)

  return {
    userId: collaboratorId,
    data: entry.entryDate,
    horaInicio,
    horaFim,
    horasTotal: Number((entry.durationMinutes / 60).toFixed(2)),
    projeto: entry.projectCode,
    atividade: entry.activityId,
    detalhamento: entry.details,
    status: 'PENDENTE',
  }
}

function parseQueue(raw: string | null): OfflineQueueItem[] {
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<OfflineQueueItem>
    if (
      typeof candidate.id !== 'string'
      || candidate.type !== 'APONTAMENTO'
      || typeof candidate.collaboratorId !== 'string'
      || typeof candidate.createdAt !== 'string'
      || !candidate.entry
      || !candidate.apiPayload
    ) return []
    return [candidate as OfflineQueueItem]
  })
}

function notifyQueueChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
}

export class OfflineQueueService {
  private readonly storage: StorageLike
  private readonly createId: () => string
  private readonly now: () => string
  private readonly syncApontamento: (input: CreateApiApontamentoInput, accessToken?: string) => Promise<unknown>

  constructor({ storage, createId, now, syncApontamento }: OfflineQueueDependencies) {
    this.storage = storage
    this.createId = createId ?? (() => crypto.randomUUID())
    this.now = now ?? (() => new Date().toISOString())
    this.syncApontamento = syncApontamento ?? ((input, accessToken) => backendApi.createApontamento(input, accessToken))
  }

  list(): OfflineQueueItem[] {
    try {
      return parseQueue(this.storage.getItem(OFFLINE_QUEUE_STORAGE_KEY))
    } catch {
      return []
    }
  }

  enqueueApontamento(collaboratorId: string, entry: CreateTimeEntryData, options: { startTime?: string; endTime?: string } = {}) {
    const item: OfflineQueueItem = {
      id: this.createId(),
      type: 'APONTAMENTO',
      collaboratorId,
      createdAt: this.now(),
      entry,
      apiPayload: buildApiApontamentoPayload(collaboratorId, entry, options),
    }
    this.write([...this.list(), item])
    return item
  }

  remove(id: string) {
    this.write(this.list().filter((item) => item.id !== id))
  }

  async sync(accessToken?: string) {
    const results = { synced: 0, remaining: 0 }
    for (const item of this.list()) {
      try {
        await this.syncApontamento(item.apiPayload, accessToken)
        this.remove(item.id)
        results.synced += 1
      } catch (error) {
        console.error('Falha ao sincronizar apontamento offline.', {
          id: item.id,
          payload: item.apiPayload,
          status: error instanceof ApiRequestError ? error.status : undefined,
          response: error instanceof ApiRequestError ? error.responseBody : undefined,
          error,
        })
      }
    }
    results.remaining = this.list().length
    return results
  }

  private write(items: OfflineQueueItem[]) {
    this.storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items))
    notifyQueueChanged()
  }
}

export const offlineQueueService = new OfflineQueueService({ storage: createBrowserStorage() })
