import type { AssignmentSnapshot } from '../squads/types'

export type TimeEntryStatus = 'ACTIVE' | 'CANCELLED'
export type TimeEntryApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type DisciplineCode = 'C'
export type TimeEntryDayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY'

export interface TimeEntry {
  id: string
  collaboratorId: string
  entryDate: string
  emObra: boolean
  numeroObra?: string
  /** Número do contrato / pedido de compra do cliente (ex.: lido do RDO). */
  numeroContrato?: string
  clientId: string
  projectCode: string
  activityId: string
  disciplineCode: DisciplineCode
  durationMinutes: number
  dayType: TimeEntryDayType
  isHoliday: boolean
  overtimeMinutes: number
  nightMinutes: number
  partialDayOffMinutes: number
  details: string
  funcaoContrato?: string
  assignmentSnapshot: AssignmentSnapshot | null
  status: TimeEntryStatus
  approvalStatus?: TimeEntryApprovalStatus
  rejectionReason?: string
  version: number
  createdAt: string
  updatedAt: string
  lastEditReason?: string
  sourceEntryId?: string
  cancelledAt?: string
  cancelReason?: string
}

export type CreateTimeEntryData = Pick<
  TimeEntry,
  | 'entryDate'
  | 'clientId'
  | 'projectCode'
  | 'activityId'
  | 'disciplineCode'
  | 'durationMinutes'
  | 'details'
  | 'funcaoContrato'
> & {
  emObra?: boolean
  numeroObra?: string
  numeroContrato?: string
  /** Horário do dia (HH:MM), usado na importação de RDO com hora manual. */
  startTime?: string
  endTime?: string
  endDate?: string
  weekdaysOnly?: boolean
  dayType?: TimeEntryDayType
  isHoliday?: boolean
  overtimeMinutes?: number
  nightMinutes?: number
  partialDayOffMinutes?: number
}

export type TimeEntryValidationErrors = Partial<Record<keyof CreateTimeEntryData, string>>
