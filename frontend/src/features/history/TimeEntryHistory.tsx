import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { isIsoDate } from '../../shared/utils/date'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { demoActivities, demoClients } from '../../mocks/demoData'
import { formatDatePtBr } from '../../shared/utils/date'
import { activityOptionsByWorkContext, formatMinutes } from '../time-entries/domain'
import type { HistoryRow } from './useTimeEntryHistory'
import { useTimeEntryHistory } from './useTimeEntryHistory'
import { HistoryFilters } from './HistoryFilters'
import { fieldClassName } from '../time-entries/TimeEntryFields'
import { formatSignedMinutes } from '../time-entries/domain'
import { getCalendarVisualState } from '../calendar/domain'
import { HistoryPeriodSummary } from './HistoryPeriodSummary'
import { getHistoryEntryActions } from './entryActions'
import { EntryRevisionBadge, EntryRevisionDetails } from '../time-entries/EntryRevisionBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { approvalStatusPresentation, nonApplicableApprovalPresentation, timeEntryStatusPresentation } from '../status/presentation'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { useSession } from '../session/useSession'

const activityOptions = [
  ...activityOptionsByWorkContext.field,
  ...activityOptionsByWorkContext.corporate,
  ...demoActivities,
]

export function TimeEntryHistory() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigationState = location.state as { historyDate?: string; selectedDate?: string } | null
  const routedDate = searchParams.get('date') ?? navigationState?.historyDate ?? navigationState?.selectedDate
  const history = useTimeEntryHistory(routedDate && isIsoDate(routedDate) ? routedDate : undefined)
  const [cancelTarget, setCancelTarget] = useState<HistoryRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const { profile } = useSession()
  const pendingQueue = useOfflineQueue().filter((item) => item.collaboratorId === profile?.id)

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return
    setIsCancelling(true)
    try {
      await history.cancel(cancelTarget, cancelReason)
      setCancelTarget(null)
      setCancelReason('')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="space-y-5">
      <HistoryFilters value={history.draftFilters} onChange={history.setDraftFilters} onApply={history.applyFilters} />
      {history.feedback && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{history.feedback}</p>}
      {history.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><p>{history.error}</p><button type="button" onClick={() => void history.reload()} className="mt-2 font-bold underline">Tentar novamente</button></div>}
      {history.isLoading && <p aria-live="polite" className="rounded-2xl ui-surface p-8 text-center font-semibold ui-text-muted">Carregando histórico…</p>}
      {!history.isLoading && history.periodSummary && <HistoryPeriodSummary summary={history.periodSummary} events={history.periodEvents} timeOffRequests={history.periodTimeOffRequests} />}
      {pendingQueue.length > 0 && (
        <section className="rounded-2xl border border-amber-300/60 bg-amber-950/20 p-5 text-amber-50" aria-labelledby="offline-pending-title">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Modo Offline</p>
              <h2 id="offline-pending-title" className="mt-1 text-lg font-extrabold">A aguardar sincronização</h2>
            </div>
            <span className="rounded-full border border-amber-300/50 px-3 py-1 text-xs font-bold">{pendingQueue.length} pendente(s)</span>
          </div>
          <div className="mt-4 grid gap-3">
            {pendingQueue.map((item) => {
              const client = demoClients.find((clientOption) => clientOption.id === item.entry.clientId)?.name ?? 'Cliente não disponível'
              const activity = activityOptions.find((activityOption) => activityOption.id === item.entry.activityId)?.name ?? 'Atividade não disponível'
              return (
                <article key={item.id} className="rounded-xl border border-amber-300/30 ui-surface-subtle p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">{formatDatePtBr(item.entry.entryDate)} · Projeto {item.entry.projectCode}</p>
                      <p className="mt-1 text-sm text-amber-100/80">{client} · {activity} · {formatMinutes(item.entry.durationMinutes)}</p>
                      <p className="mt-2 text-sm text-amber-50/90">{item.entry.details}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-amber-300 px-3 py-2 text-xs font-extrabold text-amber-950">⏳ A aguardar sincronização</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
      {!history.isLoading && !history.error && history.rows.length === 0 && <div className="rounded-2xl border border-dashed ui-border ui-surface p-10 text-center"><p className="font-bold ui-heading">Nenhum apontamento encontrado.</p><p className="mt-2 text-sm ui-text-subtle">Ajuste os filtros ou registre um novo apontamento.</p></div>}
      {!history.isLoading && history.rows.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm ui-text-muted">{history.total} registro(s) encontrado(s). Exibição paginada de até 10 itens.</p>
          {history.rows.map((row) => {
            const { entry, approval } = row
            const approvalPresentation = approval ? approvalStatusPresentation[approval.status] : nonApplicableApprovalPresentation
            const client = demoClients.find((item) => item.id === entry.clientId)?.name ?? 'Cliente não disponível'
            const activity = activityOptions.find((item) => item.id === entry.activityId)?.name ?? 'Atividade não disponível'
            const actions = getHistoryEntryActions({
              entryStatus: entry.status,
              approvalStatus: approval?.status ?? null,
              canMutate: row.canMutate,
              hasIntegralEventConflict: row.summary.hasIntegralEventConflict,
            })
            return (
              <article key={entry.id} className="rounded-2xl border ui-border ui-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold ui-heading">{formatDatePtBr(entry.entryDate)} · Projeto {entry.projectCode}</h2>
                      {entry.status === 'CANCELLED' && <StatusBadge tone={timeEntryStatusPresentation.CANCELLED.tone}>{timeEntryStatusPresentation.CANCELLED.label}</StatusBadge>}
                      <StatusBadge tone={approvalPresentation.tone}>{approvalPresentation.label}</StatusBadge>
                      <EntryRevisionBadge version={entry.version} />
                    </div>
                    <p className="mt-2 text-sm ui-text-subtle">{client} · {activity} · {formatMinutes(entry.durationMinutes)}</p>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="font-bold ui-text-subtle">Disciplina</dt><dd>{entry.disciplineCode === 'C' ? 'C – Campo' : entry.disciplineCode}</dd></div>
                      {entry.numeroObra && <div><dt className="font-bold ui-text-subtle">Número da obra</dt><dd>{entry.numeroObra}</dd></div>}
                      <div><dt className="font-bold ui-text-subtle">Squad registrada</dt><dd>{entry.assignmentSnapshot?.squadName ?? 'Não disponível (legado)'}</dd></div>
                      <div><dt className="font-bold ui-text-subtle">Supervisor registrado</dt><dd>{entry.assignmentSnapshot?.supervisorName ?? 'Não disponível (legado)'}</dd></div>
                      <div><dt className="font-bold ui-text-subtle">Situação da jornada</dt><dd>{getCalendarVisualState(row.summary).label}</dd></div>
                      <div><dt className="font-bold ui-text-subtle">Saldo do dia</dt><dd>{formatSignedMinutes(row.summary.balanceMinutes)}</dd></div>
                    </dl>
                    {(row.events.length > 0 || row.timeOffRequests.length > 0) && <p className="mt-3 text-sm ui-text-muted"><strong>Eventos do dia:</strong> {[...row.events.map((event) => event.title), ...row.timeOffRequests.map((request) => `Folga ${request.status.toLocaleLowerCase('pt-BR')}`)].join(' · ')}</p>}
                    <p className="mt-4 text-sm leading-6 ui-text">{entry.details}</p>
                    {approval?.correctionReason && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Motivo da correção:</strong> {approval.correctionReason}</p>}
                    {approval?.deficitJustification && <p className="mt-3 text-sm ui-text-muted"><strong>Justificativa de aprovação com déficit:</strong> {approval.deficitJustification}</p>}
                    {entry.cancelReason && <p className="mt-3 text-sm ui-text-subtle"><strong>Motivo do cancelamento:</strong> {entry.cancelReason}</p>}
                    {row.summary.hasIntegralEventConflict && <p role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Conflito com evento integral:</strong> registro preservado para auditoria e fora do saldo.</p>}
                    <EntryRevisionDetails version={entry.version} updatedAt={entry.updatedAt} wasResubmitted={entry.version > 1 && Boolean(entry.rejectionReason)} />
                  </div>
                  <div className="flex min-w-44 flex-col gap-2">
                    {actions.edit && <Link to={`/colaborador/apontamentos/${entry.id}/editar`} className="rounded-xl border ui-border-primary px-3 py-2 text-center text-sm font-bold ui-heading">Editar</Link>}
                    {actions.duplicate && <Link to={`/colaborador/apontamentos/novo?duplicate=${entry.id}`} className="rounded-xl border ui-border px-3 py-2 text-center text-sm font-bold ui-text">Duplicar</Link>}
                    {actions.cancel && <button type="button" onClick={() => setCancelTarget(row)} className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-700 dark:border-red-800 dark:text-red-300">Cancelar</button>}
                    {actions.completeCorrection && <button type="button" onClick={() => void history.completeCorrection(row)} className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-amber-950">Concluir correção</button>}
                    {actions.readOnly && approval?.status === 'APPROVED' && <button type="button" disabled title="Apontamento já aprovado. Não é possível editar." className="cursor-not-allowed rounded-xl ui-surface-subtle px-3 py-2 text-center text-sm font-semibold ui-text-muted">Editar bloqueado</button>}
                    {actions.readOnly && approval?.status !== 'APPROVED' && <span className="rounded-xl ui-surface-subtle px-3 py-2 text-center text-sm font-semibold ui-text-muted">Somente leitura</span>}
                  </div>
                </div>
              </article>
            )
          })}
          <div className="flex items-center justify-between">
            <button type="button" disabled={!history.hasPreviousPage} onClick={history.previousPage} className="rounded-xl border ui-border px-4 py-2 text-sm font-bold disabled:opacity-40">Anterior</button>
            <button type="button" disabled={!history.nextCursor} onClick={history.nextPage} className="rounded-xl border ui-border px-4 py-2 text-sm font-bold disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={Boolean(cancelTarget)} title="Cancelar apontamento?" description="O registro será preservado no histórico e deixará de participar dos saldos." confirmLabel="Confirmar cancelamento" isBusy={isCancelling} onCancel={() => { setCancelTarget(null); setCancelReason('') }} onConfirm={() => void confirmCancel()}>
        <label htmlFor="cancel-reason" className="text-sm font-bold ui-text">Motivo do cancelamento</label>
        <textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} className={fieldClassName} />
      </ConfirmDialog>
    </div>
  )
}
