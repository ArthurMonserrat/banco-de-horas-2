import type { AssignmentSnapshot } from '../features/squads/types'
import type { CreateTimeEntryData, TimeEntry } from '../features/time-entries/types'
import type { TimeEntryService, TimeEntryListQuery, TimeEntryPage } from './timeEntryService'
import { backendApi, getStoredApiSession } from './api'

function requireSession() {
  const session = getStoredApiSession()
  if (!session) throw new Error('Sessão corporativa ausente ou expirada.')
  return session
}

function fromApi(entry: Awaited<ReturnType<typeof backendApi.listApontamentos>>['apontamentos'][number], assignmentSnapshot: AssignmentSnapshot | null = null): TimeEntry {
  const apiStatus = String(entry.status)
  return {
    id: entry.id,
    collaboratorId: entry.userId,
    entryDate: entry.data,
    emObra: Boolean(entry.emObra),
    numeroObra: entry.numeroObra,
    clientId: entry.clientId ?? '',
    projectCode: entry.projeto,
    activityId: entry.atividade,
    disciplineCode: (entry.disciplineCode as TimeEntry['disciplineCode']) ?? 'C',
    durationMinutes: Math.round(entry.horasTotal * 60),
    dayType: 'WEEKDAY',
    isHoliday: false,
    overtimeMinutes: 0,
    nightMinutes: 0,
    partialDayOffMinutes: 0,
    details: entry.detalhamento,
    funcaoContrato: entry.funcaoContrato,
    assignmentSnapshot,
    status: apiStatus === 'CANCELADO' ? 'CANCELLED' : 'ACTIVE',
    approvalStatus: apiStatus === 'APROVADO' ? 'APPROVED' : apiStatus === 'REJEITADO' ? 'REJECTED' : 'PENDING',
    rejectionReason: entry.justificativa ?? undefined,
    version: entry.versao,
    createdAt: entry.dataCriacao,
    updatedAt: entry.dataCriacao,
  }
}

export class SupabaseTimeEntryService implements TimeEntryService {
  async list(query: TimeEntryListQuery): Promise<TimeEntryPage> {
    const session = requireSession()
    const response = await backendApi.listApontamentos()
    const filtered = response.apontamentos
      .filter((entry) => entry.data >= query.startDate && entry.data <= query.endDate)
      .filter((entry) => !query.filters?.clientId || entry.clientId === query.filters.clientId)
      .filter((entry) => !query.filters?.projectCode || entry.projeto.toLowerCase().includes(query.filters.projectCode.toLowerCase()))
      .filter((entry) => !query.filters?.activityId || entry.atividade === query.filters.activityId)
      .filter((entry) => !query.filters?.status || (query.filters.status === 'ACTIVE' ? String(entry.status) !== 'CANCELADO' : String(entry.status) === 'CANCELADO'))
      .filter((entry) => entry.userId === session.user.id || session.user.perfil !== 'COLABORADOR')
    const pageSize = Math.max(1, query.pageSize)
    const offset = Math.max(0, Number.parseInt(query.cursor ?? '0', 10) || 0)
    const items = filtered.slice(offset, offset + pageSize).map((entry) => fromApi(entry))
    const next = offset + items.length < filtered.length ? String(offset + items.length) : null
    return { items, nextCursor: next, total: filtered.length }
  }

  async listByDate(collaboratorId: string, date: string) {
    const result = await this.list({ collaboratorId, startDate: date, endDate: date, pageSize: 500 })
    return result.items
  }

  async listByRange(collaboratorId: string, startDate: string, endDate: string) {
    return (await this.list({ collaboratorId, startDate, endDate, pageSize: 500 })).items
  }

  async getById(collaboratorId: string, id: string) {
    return (await this.listByRange(collaboratorId, '0000-01-01', '9999-12-31')).find((entry) => entry.id === id) ?? null
  }

  async create(collaboratorId: string, data: CreateTimeEntryData) {
    const session = requireSession()
    if (session.user.id !== collaboratorId) throw new Error('O apontamento deve pertencer ao usuário autenticado.')
    const result = await backendApi.createApontamento({
      data: data.entryDate,
      horaInicio: '',
      horaFim: '',
      horasTotal: data.durationMinutes / 60,
      projeto: data.projectCode,
      atividade: data.activityId,
      detalhamento: data.details,
      clientId: data.clientId,
      disciplineCode: data.disciplineCode,
      emObra: data.emObra,
      numeroObra: data.numeroObra,
      funcaoContrato: data.funcaoContrato,
    })
    return fromApi(result.apontamento)
  }

  async update(collaboratorId: string, id: string, expectedVersion: number, data: CreateTimeEntryData, reason: string) {
    const session = requireSession()
    if (session.user.id !== collaboratorId) throw new Error('O apontamento deve pertencer ao usuário autenticado.')
    const result = await backendApi.updateApontamento(id, {
      data: data.entryDate,
      horasTotal: data.durationMinutes / 60,
      projeto: data.projectCode,
      atividade: data.activityId,
      detalhamento: data.details,
      clientId: data.clientId,
      disciplineCode: data.disciplineCode,
      emObra: data.emObra,
      numeroObra: data.numeroObra,
      funcaoContrato: data.funcaoContrato,
    }, expectedVersion, reason)
    return fromApi(result.apontamento)
  }

  async duplicate(_collaboratorId: string, _id: string, _expectedVersion: number, _overrides: Partial<CreateTimeEntryData>): Promise<TimeEntry> { throw new Error('Duplicação estará disponível após a operação transacional do Banco 2.') }
  async cancel(_collaboratorId: string, _id: string, _expectedVersion: number, _reason: string): Promise<TimeEntry> { throw new Error('Cancelamento estará disponível após a operação transacional do Banco 2.') }
  async clearAll() { throw new Error('Não é permitido limpar apontamentos corporativos pelo navegador.') }

  async getDailySummary(collaboratorId: string, date: string, workloadVersions: Parameters<TimeEntryService['getDailySummary']>[2]) {
    const entries = await this.listByDate(collaboratorId, date)
    return (await import('../features/calendar/domain')).calculateDaySummary({ collaboratorId, date, today: date, entries, events: [], timeOffRequests: [], workloadVersions })
  }
}
