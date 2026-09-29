import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { DailyEntryList } from '../features/collaborator/DailyEntryList'
import { BalanceSummaryCards } from '../features/collaborator/BalanceSummaryCards'
import { useCollaboratorDashboard } from '../features/collaborator/useCollaboratorDashboard'
import { MonthlyCalendar } from '../features/calendar/MonthlyCalendar'
import { DayDetails } from '../features/calendar/DayDetails'
import { BalancePeriodFilter } from '../features/calendar/BalancePeriodFilter'
import { useSession } from '../features/session/useSession'
import { formatMinutes } from '../features/time-entries/domain'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { getCorporateToday, getMonthKey, getTimesheetCycle, isIsoDate } from '../shared/utils/date'

export function ColaboradorPage() {
  const { profile } = useSession()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDate = searchParams.get('date') ?? getCorporateToday()
  const monthKey = getMonthKey(selectedDate)
  const customStart = searchParams.get('start') ?? undefined
  const customEnd = searchParams.get('end') ?? undefined
  const hasCustomRange = Boolean(customStart && customEnd && isIsoDate(customStart) && isIsoDate(customEnd) && customStart <= customEnd)
  const cycleRange = useMemo(() => getTimesheetCycle(), [])
  const [range, setRange] = useState({ startDate: customStart ?? cycleRange.startDate, endDate: customEnd ?? cycleRange.endDate })
  const [rangeError, setRangeError] = useState<string | null>(null)
  const dashboard = useCollaboratorDashboard(selectedDate, monthKey, hasCustomRange ? customStart : cycleRange.startDate, hasCustomRange ? customEnd : cycleRange.endDate)
  const offlineQueue = useOfflineQueue()

  useEffect(() => {
    if (!customStart || !customEnd) setRange(cycleRange)
  }, [customEnd, customStart, cycleRange])

  function applyRange() {
    if (!isIsoDate(range.startDate) || !isIsoDate(range.endDate) || range.startDate > range.endDate) {
      setRangeError('Informe um intervalo válido, com a data inicial anterior à data final.')
      return
    }
    setRangeError(null)
    setSearchParams({ date: selectedDate, start: range.startDate, end: range.endDate })
  }

  function useCalendarMonth() {
    setRangeError(null)
    setRange(cycleRange)
    setSearchParams({ date: selectedDate })
  }

  function openCalendarDate(date: string, hasEntries: boolean) {
    const navigationState = { selectedDate: date, fromCalendar: true }
    if (hasEntries) {
      navigate(`/colaborador/historico?date=${date}`, { state: { ...navigationState, historyDate: date } })
      return
    }
    navigate(`/colaborador/apontamentos/novo?date=${date}`, { state: { ...navigationState, initialDate: date } })
  }

  if (!profile) return null
  const contextDescription = dashboard.data
    ? `${profile.jobTitle} · ${dashboard.data.assignment?.squadName ?? 'Squad não definida'} · Supervisão: ${dashboard.data.assignment?.supervisorName ?? 'não definida'}. Carga vigente ${dashboard.data.currentWorkload ? formatMinutes(dashboard.data.currentWorkload.dailyMinutes) : 'não cadastrada'}.`
    : `${profile.jobTitle} · Carregando contexto profissional.`
  const pendingEntriesOfDay = offlineQueue.filter((item) => item.collaboratorId === profile.id && item.entry.entryDate === selectedDate)

  return (
    <PageContainer
      title={`Olá, ${profile.name}`}
      description={contextDescription}
      contained={false}
    >
      <div className="space-y-6">
        {dashboard.isLoading && <p className="rounded-2xl ui-surface p-8 text-center font-semibold ui-text-muted" aria-live="polite">Carregando visão geral…</p>}
        {dashboard.error && <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p>{dashboard.error}</p><button type="button" onClick={() => void dashboard.reload()} className="mt-3 font-bold underline">Tentar novamente</button></div>}
        {rangeError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{rangeError}</p>}
        {dashboard.data && !dashboard.isLoading && (
          <>
            <BalancePeriodFilter startDate={range.startDate} endDate={range.endDate} isCustomRange={hasCustomRange} onChange={(field, value) => setRange((current) => ({ ...current, [field]: value }))} onApply={applyRange} onClear={useCalendarMonth} defaultPeriodLabel="Usar ciclo 16–15" />
            <BalanceSummaryCards
              todaySummary={dashboard.data.todaySummary}
              filteredSummary={dashboard.data.filteredSummary}
              totalSummary={dashboard.data.totalSummary}
              periodLabel={hasCustomRange ? 'Saldo do intervalo' : 'Saldo do ciclo 16–15'}
            />

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Pendências e ações">
              <article className="rounded-2xl border border-l-4 ui-border ui-surface p-4 [border-left-color:#C99393]"><p className="text-sm font-bold ui-text-muted">Dias pendentes</p><p className="mt-2 text-2xl font-extrabold ui-text">{dashboard.data.attention.pendingDays}</p></article>
              <article className="rounded-2xl border border-l-4 ui-border ui-surface p-4 [border-left-color:#8AB7C7]"><p className="text-sm font-bold ui-text-muted">Disponíveis para aprovação</p><p className="mt-2 text-2xl font-extrabold ui-text">{dashboard.data.attention.availableForApprovalDays}</p></article>
              <article className="rounded-2xl border border-l-4 ui-border ui-surface p-4 [border-left-color:#C9A66B]"><p className="text-sm font-bold ui-text-muted">Correções solicitadas</p><p className="mt-2 text-2xl font-extrabold ui-text">{dashboard.data.attention.correctionRequestedDays}</p></article>
              <article className="rounded-2xl border border-l-4 ui-border ui-surface p-4 [border-left-color:#A89BC8]"><p className="text-sm font-bold ui-text-muted">Ausências pendentes</p><p className="mt-2 text-2xl font-extrabold ui-text">{dashboard.data.pendingTimeOffRequests}</p></article>
              <article className="rounded-2xl border border-l-4 ui-border ui-surface p-4 [border-left-color:#77C2A4]"><p className="text-sm font-bold ui-text-muted">Cargas pendentes</p><p className="mt-2 text-2xl font-extrabold ui-text">{dashboard.data.pendingWorkloadRequests}</p></article>
            </section>

            {dashboard.data.approvals.some((approval) => approval.status === 'CORRECTION_REQUESTED') && (
              <section className="rounded-2xl border border-l-4 ui-border ui-surface p-5 [border-left-color:#C9A66B]" aria-labelledby="corrections-title">
                <h2 id="corrections-title" className="font-extrabold ui-text">Correções que exigem sua atenção</h2>
                <ul className="mt-3 space-y-2 text-sm ui-text-muted">
                  {dashboard.data.approvals.filter((approval) => approval.status === 'CORRECTION_REQUESTED').map((approval) => (
                    <li key={approval.id}><strong>{approval.entryDate}:</strong> {approval.correctionReason ?? 'Consulte os detalhes do dia.'}</li>
                  ))}
                </ul>
              </section>
            )}

            <MonthlyCalendar
              monthKey={monthKey}
              selectedDate={selectedDate}
              days={dashboard.data.calendarDays}
              onMonthChange={(nextMonth) => setSearchParams({ date: `${nextMonth}-01` })}
              onSelectDate={(date) => setSearchParams(hasCustomRange ? { date, start: customStart!, end: customEnd! } : { date })}
              onOpenDate={openCalendarDate}
            />
            <DayDetails summary={dashboard.data.selectedSummary} events={dashboard.data.selectedEvents} timeOffRequests={dashboard.data.selectedTimeOffRequests} approval={dashboard.data.selectedApproval} />
            <DailyEntryList entries={dashboard.data.selectedEntries} pendingEntries={pendingEntriesOfDay} />
          </>
        )}
      </div>
    </PageContainer>
  )
}
