import { useMemo, useState } from 'react'
import type { DemoRole } from '../session/types'
import { eachIsoDate, getCorporateToday, getMonthKey, getMonthRange, isWeekend } from '../../shared/utils/date'
import { getBaseExpectedMinutes } from '../workloads/domain'
import { formatMinutes } from '../time-entries/domain'
import type { SupervisorPendingEntry } from '../supervisor/types'
import { MonthlyCalendar, type CalendarDayPreview } from './MonthlyCalendar'
import type { CalendarVisualState, DailySummary } from './types'
import { formatStatus } from '../status/presentation'

type Collaborator = { id: string; name: string; supervisorId?: string }
type Supervisor = { id: string; name: string }

type ManagerCalendarProps = {
  entries: SupervisorPendingEntry[]
  collaborators: Collaborator[]
  supervisors?: Supervisor[]
  role?: Extract<DemoRole, 'SUPERVISOR' | 'DIRECTOR_ADMIN'>
  onApprove: (entry: SupervisorPendingEntry) => void
  onReject: (entry: SupervisorPendingEntry, reason: string) => void
}

function visualState(expectedMinutes: number, workedMinutes: number, date: string, today: string): CalendarVisualState {
  if (date > today) return 'NO_SCHEDULE'
  if (workedMinutes === 0) return 'NO_ENTRY'
  if (workedMinutes < expectedMinutes) return 'INCOMPLETE'
  if (workedMinutes === expectedMinutes) return 'COMPLETE'
  return 'EXCEEDED'
}

function createSummary(date: string, entries: SupervisorPendingEntry[], collaboratorId: string, today: string): DailySummary {
  const selectedEntries = entries.filter((entry) => (collaboratorId === 'Todos' || entry.collaboratorId === collaboratorId) && entry.entryDate === date)
  const isFieldDay = selectedEntries.some((entry) => entry.emObra)
  const expectedMinutes = isWeekend(date) ? 0 : isFieldDay ? getBaseExpectedMinutes(date, [], selectedEntries) : 480
  const workedMinutes = selectedEntries.reduce((total, entry) => total + entry.durationMinutes, 0)
  const isFuture = date > today
  const effectiveWorkedMinutes = isFuture ? 0 : workedMinutes
  return {
    date,
    baseExpectedMinutes: expectedMinutes,
    expectedMinutes,
    justifiedMinutes: 0,
    workedMinutes: effectiveWorkedMinutes,
    regularMinutes: Math.min(effectiveWorkedMinutes, expectedMinutes),
    extraMinutes: Math.max(effectiveWorkedMinutes - expectedMinutes, 0),
    missingMinutes: Math.max(expectedMinutes - effectiveWorkedMinutes, 0),
    balanceMinutes: effectiveWorkedMinutes - expectedMinutes,
    isFuture,
    hasIntegralEventConflict: false,
    visualState: visualState(expectedMinutes, effectiveWorkedMinutes, date, today),
  }
}

export function ManagerCalendar({ entries, collaborators, supervisors = [], role = 'SUPERVISOR', onApprove, onReject }: ManagerCalendarProps) {
  const today = getCorporateToday()
  const isDirector = role === 'DIRECTOR_ADMIN'
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('Todos')
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('Todos')
  const [monthKey, setMonthKey] = useState(getMonthKey(today))
  const [selectedDate, setSelectedDate] = useState(today)
  const [openedPreview, setOpenedPreview] = useState<CalendarDayPreview | null>(null)
  const monthRange = getMonthRange(monthKey)
  const scopedCollaborators = useMemo(() => {
    if (!isDirector || selectedSupervisorId === 'Todos') return collaborators
    return collaborators.filter((collaborator) => collaborator.supervisorId === selectedSupervisorId)
  }, [collaborators, isDirector, selectedSupervisorId])
  const scopedCollaboratorIds = useMemo(() => new Set(scopedCollaborators.map((collaborator) => collaborator.id)), [scopedCollaborators])
  const visibleEntries = entries.filter((entry) => {
    if (isDirector && selectedSupervisorId !== 'Todos' && !scopedCollaboratorIds.has(entry.collaboratorId)) return false
    return selectedCollaboratorId === 'Todos' || entry.collaboratorId === selectedCollaboratorId
  })
  const days = useMemo(() => eachIsoDate(monthRange.startDate, monthRange.endDate).map((date) => createSummary(date, visibleEntries, selectedCollaboratorId, today)), [monthRange.endDate, monthRange.startDate, selectedCollaboratorId, today, visibleEntries])
  const previews = useMemo(() => visibleEntries.reduce<Record<string, CalendarDayPreview>>((result, entry) => {
    if (!result[entry.entryDate]) result[entry.entryDate] = {
      entryId: entry.id,
      projectCode: entry.projectCode,
      activityName: entry.activityName ?? '',
      status: entry.status,
      collaboratorName: entry.collaboratorName,
      durationMinutes: entry.durationMinutes,
      details: entry.details,
    }
    return result
  }, {}), [visibleEntries])

  function handleCollaboratorChange(collaboratorId: string) {
    setSelectedCollaboratorId(collaboratorId)
    setOpenedPreview(null)
  }

  function handleSupervisorChange(supervisorId: string) {
    setSelectedSupervisorId(supervisorId)
    setSelectedCollaboratorId('Todos')
    setOpenedPreview(null)
  }

  return (
    <section className="space-y-4" aria-label="Calendário gerencial">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Gestão</p>
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">Calendário da equipe</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {isDirector && (
            <label className="text-sm font-bold text-[var(--color-text)]">
              Selecione a Supervisão
              <select aria-label="Selecione a Supervisão" value={selectedSupervisorId} onChange={(event) => handleSupervisorChange(event.target.value)} className="mt-1 block min-w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-normal text-[var(--color-text)]">
                <option value="Todos">Todas as supervisões</option>
                {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm font-bold text-[var(--color-text)]">
          Colaborador
          <select aria-label="Colaborador" value={selectedCollaboratorId} onChange={(event) => handleCollaboratorChange(event.target.value)} className="mt-1 block min-w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-normal text-[var(--color-text)]">
            <option value="Todos">Todos da equipe</option>
            {scopedCollaborators.map((collaborator) => <option key={collaborator.id} value={collaborator.id}>{collaborator.name}</option>)}
          </select>
        </label>
        </div>
      </div>
      <MonthlyCalendar
        monthKey={monthKey}
        selectedDate={selectedDate}
        days={days}
        onMonthChange={(nextMonth) => setMonthKey(nextMonth)}
        onSelectDate={setSelectedDate}
        dayPreviews={previews}
        onManagerDayOpen={setOpenedPreview}
      />
      {openedPreview && (
        <div role="dialog" aria-modal="true" aria-labelledby="manager-calendar-detail-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpenedPreview(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Detalhes do apontamento</p>
                <h3 id="manager-calendar-detail-title" className="mt-1 text-xl font-extrabold text-[var(--color-text)]">{openedPreview.collaboratorName}</h3>
              </div>
              <button type="button" onClick={() => setOpenedPreview(null)} className="rounded-lg px-2 py-1 text-xl text-[var(--color-text-muted)]" aria-label="Fechar detalhes">×</button>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-bold text-[var(--color-text-muted)]">Projeto / atividade</dt><dd className="mt-1 font-semibold text-[var(--color-text)]">{openedPreview.projectCode || openedPreview.activityName}</dd></div>
              <div><dt className="font-bold text-[var(--color-text-muted)]">Horas</dt><dd className="mt-1 font-semibold text-[var(--color-text)]">{formatMinutes(openedPreview.durationMinutes)}</dd></div>
              <div><dt className="font-bold text-[var(--color-text-muted)]">Status</dt><dd className="mt-1 font-semibold text-[var(--color-text)]">{formatStatus(openedPreview.status)}</dd></div>
            </dl>
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm leading-6 text-[var(--color-text)]">
              <p className="font-bold text-[var(--color-text-muted)]">Detalhamento</p>
              <p className="mt-1 whitespace-pre-wrap">{openedPreview.details || 'Sem detalhamento informado.'}</p>
            </div>
            {openedPreview.status === 'PENDING' && (
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { const reason = window.prompt('Motivo da rejeição:'); if (reason?.trim()) { const entry = entries.find((item) => item.id === openedPreview.entryId); if (entry) onReject(entry, reason) } }} className="rounded-xl border border-[var(--color-danger)] px-4 py-2.5 text-sm font-bold text-[var(--color-danger)]">Reprovar</button>
                <button type="button" onClick={() => { const entry = entries.find((item) => item.id === openedPreview.entryId); if (entry) onApprove(entry); setOpenedPreview(null) }} className="ui-button-primary">Aprovar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
