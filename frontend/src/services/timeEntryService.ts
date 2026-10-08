import { MAX_ENTRY_MINUTES, MAX_HISTORY_PAGE_SIZE, MAX_PROJECT_CODE_LENGTH } from '../config/business'
import { calculateDaySummary } from '../features/calendar/domain'
import type { DailySummary } from '../features/calendar/types'
import type { AuditEvent } from '../features/audit/types'
import type { AssignmentSnapshot } from '../features/squads/types'
import type { CreateTimeEntryData, DisciplineCode, TimeEntry } from '../features/time-entries/types'
import { expandTimeEntryDates, requiresWorkSiteNumber } from '../features/time-entries/domain'
import type { WorkloadVersion } from '../features/workloads/types'
import { isIsoDate, isWeekend } from '../shared/utils/date'
import { createBrowserStorage, type StorageLike } from './storage'
import { auditService } from './auditService'
import { profileService } from './profileService'
import type { EntryDateBlock } from '../features/calendar/entryDatePolicy'
import { entryDateAvailabilityService } from './entryDateAvailabilityService'
import {
  LEGACY_V1_TIME_ENTRY_STORAGE_KEY,
  LEGACY_V2_TIME_ENTRY_STORAGE_KEY,
  migrateV1TimeEntries,
  migrateV2TimeEntries,
  normalizeTimeEntry,
  type TimeEntryStorageV3,
} from './timeEntryMigration'

export { LEGACY_V1_TIME_ENTRY_STORAGE_KEY, LEGACY_V2_TIME_ENTRY_STORAGE_KEY } from './timeEntryMigration'
export type { StorageLike } from './storage'

export const TIME_ENTRY_STORAGE_KEY = 'apontamentos_sma'
const LEGACY_V3_TIME_ENTRY_STORAGE_KEY = 'sma:time-entries:v3'

export type TimeEntryFilters = {
  clientId?: string
  projectCode?: string
  activityId?: string
  disciplineCode?: DisciplineCode
  status?: TimeEntry['status']
}

export type TimeEntryListQuery = {
  collaboratorId: string
  startDate: string
  endDate: string
  cursor?: string
  pageSize: number
  filters?: TimeEntryFilters
}

export type TimeEntryPage = {
  items: TimeEntry[]
  nextCursor: string | null
  total: number
}

export interface EntryDateGuard {
  getBlock(collaboratorId: string, date: string): Promise<EntryDateBlock>
}

export interface AuditRecorder {
  record(event: AuditEvent): Promise<void>
}

export interface TimeEntryService {
  list(query: TimeEntryListQuery): Promise<TimeEntryPage>
  listByDate(collaboratorId: string, date: string): Promise<TimeEntry[]>
  listByRange(collaboratorId: string, startDate: string, endDate: string): Promise<TimeEntry[]>
  getById(collaboratorId: string, id: string): Promise<TimeEntry | null>
  create(collaboratorId: string, data: CreateTimeEntryData): Promise<TimeEntry>
  update(collaboratorId: string, id: string, expectedVersion: number, data: CreateTimeEntryData, reason: string): Promise<TimeEntry>
  duplicate(collaboratorId: string, id: string, expectedVersion: number, overrides: Partial<CreateTimeEntryData>): Promise<TimeEntry>
  cancel(collaboratorId: string, id: string, expectedVersion: number, reason: string): Promise<TimeEntry>
  clearAll(): Promise<void>
  getDailySummary(collaboratorId: string, date: string, workloadVersions: WorkloadVersion[]): Promise<DailySummary>
}

type ServiceDependencies = {
  storage: StorageLike
  createId?: () => string
  now?: () => string
  resolveAssignment?: (collaboratorId: string) => AssignmentSnapshot | null
  dateGuard?: EntryDateGuard
  audit?: AuditRecorder
  onStorageError?: (message: string, error: unknown) => void
  onAuditError?: (message: string, error: unknown) => void
}

type ReadResult = {
  data: TimeEntryStorageV3
  canWrite: boolean
}

const disciplineCodes: readonly DisciplineCode[] = ['C']
const dayTypes = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'] as const

function normalizeOptionalMinutes(value: number | undefined) {
  if (value === undefined) return 0
  if (!Number.isInteger(value) || value < 0 || value > MAX_ENTRY_MINUTES) throw new Error('Informe uma classificação de horas válida.')
  return value
}

function resolveDayType(data: CreateTimeEntryData) {
  if (data.isHoliday) return 'HOLIDAY'
  if (data.dayType && dayTypes.includes(data.dayType)) return data.dayType
  return isWeekend(data.entryDate) ? 'WEEKEND' : 'WEEKDAY'
}

function normalizeCreateData(data: CreateTimeEntryData): CreateTimeEntryData {
  const { endDate: _endDate, weekdaysOnly: _weekdaysOnly, ...baseData } = data
  const emObra = data.emObra ?? false
  const numeroObra = data.numeroObra?.trim()
  const projectCode = data.projectCode.trim()
  const details = data.details.trim()
  const funcaoContrato = data.funcaoContrato?.trim()
  const needsWorkSiteNumber = emObra || requiresWorkSiteNumber(data.activityId)
  if (!isIsoDate(data.entryDate)) throw new Error('Informe uma data válida.')
  if (data.endDate && !isIsoDate(data.endDate)) throw new Error('Informe uma data final válida.')
  if (data.endDate && data.endDate < data.entryDate) throw new Error('A data final deve ser igual ou posterior à data inicial.')
  if (!data.clientId) throw new Error('Informe o cliente.')
  if (!projectCode || projectCode.length > MAX_PROJECT_CODE_LENGTH) throw new Error('Informe um código de projeto válido.')
  if (!data.activityId) throw new Error('Informe a atividade.')
  if (needsWorkSiteNumber && !numeroObra) throw new Error('Informe o número da obra para esta atividade.')
  if (!disciplineCodes.includes(data.disciplineCode)) throw new Error('Informe a disciplina.')
  if (!Number.isInteger(data.durationMinutes) || data.durationMinutes <= 0 || data.durationMinutes > MAX_ENTRY_MINUTES) {
    throw new Error('Informe uma duração válida.')
  }
  if (!details) throw new Error('Informe o detalhamento.')
  return {
    ...baseData,
    emObra,
    numeroObra: needsWorkSiteNumber ? numeroObra : undefined,
    projectCode,
    details,
    funcaoContrato: funcaoContrato || undefined,
    dayType: resolveDayType(data),
    isHoliday: Boolean(data.isHoliday),
    overtimeMinutes: normalizeOptionalMinutes(data.overtimeMinutes),
    nightMinutes: normalizeOptionalMinutes(data.nightMinutes),
    partialDayOffMinutes: normalizeOptionalMinutes(data.partialDayOffMinutes),
  }
}

function emptyStorage(): TimeEntryStorageV3 {
  return { version: 3, entriesByCollaborator: {} }
}

function serializeStorage(data: TimeEntryStorageV3) {
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error('Erro no Storage:', error)
    throw new Error('Os dados do apontamento não podem ser serializados para o armazenamento local.')
  }
}

export class LocalStorageTimeEntryService implements TimeEntryService {
  private readonly storage: StorageLike
  private readonly createId: () => string
  private readonly now: () => string
  private readonly resolveAssignment: (collaboratorId: string) => AssignmentSnapshot | null
  private readonly dateGuard: EntryDateGuard
  private readonly audit?: AuditRecorder
  private readonly onStorageError: (message: string, error: unknown) => void
  private readonly onAuditError: (message: string, error: unknown) => void

  constructor({ storage, createId, now, resolveAssignment, dateGuard, audit, onStorageError, onAuditError }: ServiceDependencies) {
    this.storage = storage
    this.createId = createId ?? (() => crypto.randomUUID())
    this.now = now ?? (() => new Date().toISOString())
    this.resolveAssignment = resolveAssignment ?? (() => null)
    this.dateGuard = dateGuard ?? { getBlock: async () => ({ blocked: false }) }
    this.audit = audit
    this.onStorageError = onStorageError ?? ((message, error) => console.error(message, error))
    this.onAuditError = onAuditError ?? ((message, error) => console.error(message, error))
  }

  private normalizeEntriesByCollaborator(entriesByCollaborator: Record<string, unknown>): TimeEntryStorageV3 {
    return {
      version: 3,
      entriesByCollaborator: Object.fromEntries(
        Object.entries(entriesByCollaborator).map(([collaboratorId, entries]) => [
          collaboratorId,
          Array.isArray(entries)
            ? entries.flatMap((entry) => {
                const normalized = normalizeTimeEntry(entry, collaboratorId)
                return normalized ? [normalized] : []
              })
            : [],
        ]),
      ),
    }
  }

  private parseV3(raw: string): TimeEntryStorageV3 {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') throw new Error('Estrutura v3 inválida.')
    if (Array.isArray(parsed)) {
      const entriesByCollaborator = parsed.reduce<Record<string, unknown[]>>((grouped, entry) => {
        if (!entry || typeof entry !== 'object') return grouped
        const collaboratorId = (entry as Record<string, unknown>).collaboratorId
        if (typeof collaboratorId !== 'string') return grouped
        grouped[collaboratorId] = [...(grouped[collaboratorId] ?? []), entry]
        return grouped
      }, {})
      return this.normalizeEntriesByCollaborator(entriesByCollaborator)
    }
    const candidate = parsed as Partial<TimeEntryStorageV3>
    if (candidate.version !== 3 || !candidate.entriesByCollaborator || typeof candidate.entriesByCollaborator !== 'object') {
      throw new Error('Versão ou coleção v3 inválida.')
    }
    return this.normalizeEntriesByCollaborator(candidate.entriesByCollaborator)
  }

  private read(): ReadResult {
    const empty = emptyStorage()
    let rawV3: string | null = null
    try {
      rawV3 = this.storage.getItem(TIME_ENTRY_STORAGE_KEY)
      if (rawV3 !== null) return { data: this.parseV3(rawV3), canWrite: true }
      const legacyRawV3 = this.storage.getItem(LEGACY_V3_TIME_ENTRY_STORAGE_KEY)
      if (legacyRawV3 !== null) {
        const legacyData = this.parseV3(legacyRawV3)
        this.writeAndValidate(legacyData)
        return { data: legacyData, canWrite: true }
      }

      let rawV2 = this.storage.getItem(LEGACY_V2_TIME_ENTRY_STORAGE_KEY)
      if (rawV2 === null) {
        const rawV1 = this.storage.getItem(LEGACY_V1_TIME_ENTRY_STORAGE_KEY)
        if (rawV1 === null) return { data: empty, canWrite: true }
        const v1Migration = migrateV1TimeEntries(rawV1)
        const serializedV2 = JSON.stringify(v1Migration.data)
        this.storage.setItem(LEGACY_V2_TIME_ENTRY_STORAGE_KEY, serializedV2)
        rawV2 = this.storage.getItem(LEGACY_V2_TIME_ENTRY_STORAGE_KEY)
        if (rawV2 === null) throw new Error('A v2 não foi encontrada após a migração.')
        if (rawV2 !== serializedV2) throw new Error('A v2 gravada diverge dos dados convertidos da v1.')
      }
      const migration = migrateV2TimeEntries(rawV2)
      const serialized = JSON.stringify(migration.data)
      this.storage.setItem(TIME_ENTRY_STORAGE_KEY, serialized)
      const persistedRaw = this.storage.getItem(TIME_ENTRY_STORAGE_KEY)
      if (persistedRaw === null) throw new Error('A v3 não foi encontrada após a migração.')
      const persisted = this.parseV3(persistedRaw)
      if (JSON.stringify(persisted) !== serialized) throw new Error('A v3 gravada diverge dos dados migrados.')
      return { data: persisted, canWrite: true }
    } catch (error) {
      console.error('Erro no Storage:', error)
      this.onStorageError('Não foi possível ler os apontamentos locais. Uma coleção vazia será utilizada.', error)

      // Uma v3 corrompida pode ser reinicializada com segurança. Backups legados
      // continuam intactos para que uma migração futura não perca dados.
      if (rawV3 !== null) {
        try {
          const serializedEmpty = serializeStorage(empty)
          this.storage.setItem(TIME_ENTRY_STORAGE_KEY, serializedEmpty)
          const persistedRaw = this.storage.getItem(TIME_ENTRY_STORAGE_KEY)
          if (persistedRaw === serializedEmpty) return { data: empty, canWrite: true }
        } catch (resetError) {
          console.error('Erro no Storage:', resetError)
          this.onStorageError('Não foi possível reinicializar o armazenamento local.', resetError)
        }
      }
      return { data: empty, canWrite: false }
    }
  }

  private writeAndValidate(data: TimeEntryStorageV3) {
    const serialized = serializeStorage(data)
    this.storage.setItem(TIME_ENTRY_STORAGE_KEY, serialized)
    const persistedRaw = this.storage.getItem(TIME_ENTRY_STORAGE_KEY)
    if (persistedRaw === null) throw new Error('A gravação local não pôde ser confirmada.')
    const persisted = this.parseV3(persistedRaw)
    if (JSON.stringify(persisted) !== serialized) throw new Error('A validação da gravação local falhou.')
  }

  private async ensureMutable(_collaboratorId: string, _date: string) {
    // Banco de Horas 2 não bloqueia lançamentos por competência fechada ou dia aprovado.
    // O apontamento criado permanece disponível para validação posterior pelo Supervisor.
  }

  private async ensureDateAvailable(collaboratorId: string, date: string) {
    const block = await this.dateGuard.getBlock(collaboratorId, date)
    if (block.blocked) throw new Error(block.message)
  }

  private getOwnEntry(data: TimeEntryStorageV3, collaboratorId: string, id: string) {
    const entries = data.entriesByCollaborator[collaboratorId] ?? []
    const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0) throw new Error('Apontamento não encontrado para este colaborador.')
    return { entries, index, entry: entries[index] }
  }

  private assertVersion(entry: TimeEntry, expectedVersion: number) {
    if (entry.version !== expectedVersion) throw new Error('A versão do apontamento foi alterada. Recarregue os dados.')
  }

  private async record(type: AuditEvent['type'], actorId: string, entry: TimeEntry, options: Partial<AuditEvent> = {}) {
    if (!this.audit) return
    try {
      await this.audit.record({
        id: crypto.randomUUID(),
        type,
        occurredAt: this.now(),
        actorId,
        actorRole: 'COLLABORATOR',
        entityType: 'TimeEntry',
        entityId: entry.id,
        ...options,
      })
    } catch (error) {
      this.onAuditError('Não foi possível registrar a auditoria da mutação confirmada.', error)
    }
  }

  async list(query: TimeEntryListQuery): Promise<TimeEntryPage> {
    const pageSize = Math.max(1, Math.min(Math.trunc(query.pageSize), MAX_HISTORY_PAGE_SIZE))
    const offset = Math.max(0, Number.parseInt(query.cursor ?? '0', 10) || 0)
    const filters = query.filters ?? {}
    const entries = (this.read().data.entriesByCollaborator[query.collaboratorId] ?? [])
      .filter((entry) => entry.entryDate >= query.startDate && entry.entryDate <= query.endDate)
      .filter((entry) => !filters.clientId || entry.clientId === filters.clientId)
      .filter((entry) => !filters.projectCode || entry.projectCode.toLocaleLowerCase().includes(filters.projectCode.toLocaleLowerCase()))
      .filter((entry) => !filters.activityId || entry.activityId === filters.activityId)
      .filter((entry) => !filters.disciplineCode || entry.disciplineCode === filters.disciplineCode)
      .filter((entry) => !filters.status || entry.status === filters.status)
      .sort((left, right) => right.entryDate.localeCompare(left.entryDate) || right.createdAt.localeCompare(left.createdAt))
    const items = entries.slice(offset, offset + pageSize)
    const nextOffset = offset + items.length
    return { items, nextCursor: nextOffset < entries.length ? String(nextOffset) : null, total: entries.length }
  }

  async listByDate(collaboratorId: string, date: string) {
    return (this.read().data.entriesByCollaborator[collaboratorId] ?? [])
      .filter((entry) => entry.entryDate === date)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async listByRange(collaboratorId: string, startDate: string, endDate: string) {
    return (this.read().data.entriesByCollaborator[collaboratorId] ?? [])
      .filter((entry) => entry.entryDate >= startDate && entry.entryDate <= endDate)
      .sort((left, right) => left.entryDate.localeCompare(right.entryDate) || left.createdAt.localeCompare(right.createdAt))
  }

  async getById(collaboratorId: string, id: string) {
    return (this.read().data.entriesByCollaborator[collaboratorId] ?? []).find((entry) => entry.id === id) ?? null
  }

  async create(collaboratorId: string, data: CreateTimeEntryData) {
    const endDate = data.endDate ?? data.entryDate
    const weekdaysOnly = data.weekdaysOnly ?? true
    const normalized = normalizeCreateData(data)
    const dates = expandTimeEntryDates(normalized.entryDate, endDate, weekdaysOnly)
    if (dates.length === 0) {
      throw new Error('O período selecionado não contém dias válidos para lançamento.')
    }
    for (const date of dates) {
      await this.ensureMutable(collaboratorId, date)
      await this.ensureDateAvailable(collaboratorId, date)
    }
    const assignmentSnapshot = this.resolveAssignment(collaboratorId)
    if (!assignmentSnapshot) throw new Error('Não existe squad ativa para vincular o apontamento.')
    const readResult = this.read()
    if (!readResult.canWrite) throw new Error('Não foi possível preparar o armazenamento local para gravação.')
    const timestamp = this.now()
    const createdEntries: TimeEntry[] = dates.map((date) => ({
      id: this.createId(),
      collaboratorId,
      entryDate: date,
      emObra: normalized.emObra ?? false,
      numeroObra: normalized.numeroObra,
      clientId: normalized.clientId,
      projectCode: normalized.projectCode,
      activityId: normalized.activityId,
      disciplineCode: normalized.disciplineCode,
      durationMinutes: normalized.durationMinutes,
      dayType: normalized.dayType ?? (isWeekend(date) ? 'WEEKEND' : 'WEEKDAY'),
      isHoliday: normalized.isHoliday ?? false,
      overtimeMinutes: normalized.overtimeMinutes ?? 0,
      nightMinutes: normalized.nightMinutes ?? 0,
      partialDayOffMinutes: normalized.partialDayOffMinutes ?? 0,
      details: normalized.details,
      funcaoContrato: normalized.funcaoContrato,
      assignmentSnapshot,
      status: 'ACTIVE',
      approvalStatus: 'PENDING',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    const current = readResult.data.entriesByCollaborator[collaboratorId] ?? []
    readResult.data.entriesByCollaborator[collaboratorId] = [...current, ...createdEntries]
    this.writeAndValidate(readResult.data)
    await Promise.all(createdEntries.map((entry) => this.record('TIME_ENTRY_CREATED', collaboratorId, entry, { newValue: entry })))
    return createdEntries[0]
  }

  async update(collaboratorId: string, id: string, expectedVersion: number, data: CreateTimeEntryData, reason: string) {
    const editReason = reason.trim()
    if (!editReason) throw new Error('Informe o motivo da edição.')
    const normalized = normalizeCreateData(data)
    const readResult = this.read()
    if (!readResult.canWrite) throw new Error('Não foi possível preparar o armazenamento local para gravação.')
    const { entries, index, entry } = this.getOwnEntry(readResult.data, collaboratorId, id)
    this.assertVersion(entry, expectedVersion)
    if (entry.status === 'CANCELLED') throw new Error('Um apontamento cancelado não pode ser editado.')
    if (entry.approvalStatus === 'APPROVED') throw new Error('Apontamento já aprovado. Não é possível editar.')
    await this.ensureMutable(collaboratorId, entry.entryDate)
    await this.ensureMutable(collaboratorId, normalized.entryDate)
    await this.ensureDateAvailable(collaboratorId, entry.entryDate)
    if (normalized.entryDate !== entry.entryDate) await this.ensureDateAvailable(collaboratorId, normalized.entryDate)
    const updated: TimeEntry = {
      ...entry,
      ...normalized,
      lastEditReason: editReason,
      approvalStatus: entry.approvalStatus === 'REJECTED' ? 'PENDING' : entry.approvalStatus ?? 'PENDING',
      version: entry.version + 1,
      updatedAt: this.now(),
    }
    entries[index] = updated
    this.writeAndValidate(readResult.data)
    await this.record('TIME_ENTRY_EDITED', collaboratorId, updated, { previousValue: entry, newValue: updated, justification: editReason })
    return updated
  }

  async duplicate(collaborId: string, id: string, expectedVersion: number, overrides: Partial<CreateTimeEntryData>) {
    const readResult = this.read()
    if (!readResult.canWrite) throw new Error('Não foi possível preparar o armazenamento local para gravação.')
    const { entry } = this.getOwnEntry(readResult.data, collaborId, id)
    this.assertVersion(entry, expectedVersion)
    const normalized = normalizeCreateData({
      entryDate: overrides.entryDate ?? entry.entryDate,
      emObra: overrides.emObra ?? entry.emObra,
      numeroObra: overrides.numeroObra ?? entry.numeroObra,
      clientId: overrides.clientId ?? entry.clientId,
      projectCode: overrides.projectCode ?? entry.projectCode,
      activityId: overrides.activityId ?? entry.activityId,
      disciplineCode: overrides.disciplineCode ?? entry.disciplineCode,
      durationMinutes: overrides.durationMinutes ?? entry.durationMinutes,
      dayType: overrides.dayType ?? entry.dayType,
      isHoliday: overrides.isHoliday ?? entry.isHoliday,
      overtimeMinutes: overrides.overtimeMinutes ?? entry.overtimeMinutes,
      nightMinutes: overrides.nightMinutes ?? entry.nightMinutes,
      partialDayOffMinutes: overrides.partialDayOffMinutes ?? entry.partialDayOffMinutes,
      details: overrides.details ?? entry.details,
    })
    await this.ensureMutable(collaborId, normalized.entryDate)
    await this.ensureDateAvailable(collaborId, entry.entryDate)
    if (normalized.entryDate !== entry.entryDate) await this.ensureDateAvailable(collaborId, normalized.entryDate)
    const assignmentSnapshot = this.resolveAssignment(collaborId)
    if (!assignmentSnapshot) throw new Error('Não existe squad ativa para vincular o apontamento.')
    const timestamp = this.now()
    const duplicate: TimeEntry = {
      id: this.createId(),
      collaboratorId: collaborId,
      entryDate: normalized.entryDate,
      emObra: normalized.emObra ?? false,
      numeroObra: normalized.numeroObra,
      clientId: normalized.clientId,
      projectCode: normalized.projectCode,
      activityId: normalized.activityId,
      disciplineCode: normalized.disciplineCode,
      durationMinutes: normalized.durationMinutes,
      dayType: normalized.dayType ?? entry.dayType,
      isHoliday: normalized.isHoliday ?? entry.isHoliday,
      overtimeMinutes: normalized.overtimeMinutes ?? entry.overtimeMinutes,
      nightMinutes: normalized.nightMinutes ?? entry.nightMinutes,
      partialDayOffMinutes: normalized.partialDayOffMinutes ?? entry.partialDayOffMinutes,
      details: normalized.details,
      funcaoContrato: normalized.funcaoContrato,
      assignmentSnapshot,
      status: 'ACTIVE',
      approvalStatus: 'PENDING',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      sourceEntryId: entry.id,
    }
    const current = readResult.data.entriesByCollaborator[collaborId] ?? []
    readResult.data.entriesByCollaborator[collaborId] = [...current, duplicate]
    this.writeAndValidate(readResult.data)
    await this.record('TIME_ENTRY_DUPLICATED', collaborId, duplicate, { relatedEntityId: entry.id, newValue: duplicate })
    return duplicate
  }

  async cancel(collaboratorId: string, id: string, expectedVersion: number, reason: string) {
    const cancelReason = reason.trim()
    if (!cancelReason) throw new Error('Informe o motivo do cancelamento.')
    const readResult = this.read()
    if (!readResult.canWrite) throw new Error('Não foi possível preparar o armazenamento local para gravação.')
    const { entries, index, entry } = this.getOwnEntry(readResult.data, collaboratorId, id)
    this.assertVersion(entry, expectedVersion)
    if (entry.status === 'CANCELLED') throw new Error('O apontamento já está cancelado.')
    await this.ensureMutable(collaboratorId, entry.entryDate)
    await this.ensureDateAvailable(collaboratorId, entry.entryDate)
    const timestamp = this.now()
    const cancelled: TimeEntry = {
      ...entry,
      status: 'CANCELLED',
      cancelReason,
      cancelledAt: timestamp,
      updatedAt: timestamp,
      version: entry.version + 1,
    }
    entries[index] = cancelled
    this.writeAndValidate(readResult.data)
    await this.record('TIME_ENTRY_CANCELLED', collaboratorId, cancelled, { previousValue: entry, newValue: cancelled, justification: cancelReason })
    return cancelled
  }

  async getDailySummary(collaboratorId: string, date: string, workloadVersions: WorkloadVersion[]) {
    return calculateDaySummary({
      collaboratorId,
      date,
      today: date,
      entries: await this.listByDate(collaboratorId, date),
      events: [],
      timeOffRequests: [],
      workloadVersions,
    })
  }

  async clearAll() {
    const keys = [TIME_ENTRY_STORAGE_KEY, LEGACY_V3_TIME_ENTRY_STORAGE_KEY, LEGACY_V2_TIME_ENTRY_STORAGE_KEY, LEGACY_V1_TIME_ENTRY_STORAGE_KEY]
    for (const key of keys) {
      if (this.storage.removeItem) this.storage.removeItem(key)
      else this.storage.setItem(key, JSON.stringify(emptyStorage()))
    }
  }
}

export const timeEntryService = new LocalStorageTimeEntryService({
  storage: createBrowserStorage(),
  resolveAssignment: (collaboratorId) => profileService.resolveAssignment(collaboratorId),
  dateGuard: entryDateAvailabilityService,
  audit: auditService,
})
