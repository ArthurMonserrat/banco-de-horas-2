import { useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../components/PageContainer'
import { filterDirectorHistoryRows, type DirectorHistoryFilters, type DirectorHistoryStatusFilter } from '../features/director/directorHistoryFilters'
import { supervisorService } from '../services/supervisorService'
import { buildReportRows, type ReportRow } from '../services/reportService'
import { timeEntryService } from '../services/timeEntryService'

const statusLabel: Record<ReportRow['status'], string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Pendente',
  REJECTED: 'Rejeitado',
}

const initialFilters: DirectorHistoryFilters = {
  supervisor: 'Todos',
  collaborator: '',
  project: 'Todos',
  startDate: '',
  endDate: '',
  status: 'ALL',
}

function formatHours(hours: number) {
  return `${hours.toFixed(2).replace('.', ',')}h`
}

export function DiretoriaHistoricoPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [draftFilters, setDraftFilters] = useState<DirectorHistoryFilters>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<DirectorHistoryFilters>(initialFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      supervisorService.listEntries(),
      supervisorService.listCollaborators(),
      supervisorService.listSupervisors(),
    ])
      .then(([entries, collaborators, supervisors]) => {
        if (!active) return
        setRows(buildReportRows(entries, collaborators, supervisors, '', '9999-12-31'))
      })
      .catch((requestError: unknown) => {
        if (!active) return
        console.error('Não foi possível carregar o histórico global da Diretoria.', requestError)
        setError('Não foi possível carregar o histórico global. Tente novamente.')
        setRows([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const filteredRows = useMemo(() => filterDirectorHistoryRows(rows, appliedFilters), [appliedFilters, rows])
  const supervisorOptions = useMemo(() => ['Todos', ...Array.from(new Set(rows.map((row) => row.supervisor))).sort()], [rows])
  const projectOptions = useMemo(() => ['Todos', ...Array.from(new Set(rows.map((row) => row.project))).sort()], [rows])

  function updateDraftFilter<Key extends keyof DirectorHistoryFilters>(field: Key, value: DirectorHistoryFilters[Key]) {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  function applyFilters() {
    setAppliedFilters(draftFilters)
  }

  function clearFilters() {
    setDraftFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  async function clearHistory() {
    if (!window.confirm('ALERTA CRÍTICO: Tem certeza que deseja apagar TODO o histórico de apontamentos? Esta ação não pode ser desfeita e afetará os dados do sistema.')) return
    setIsClearing(true)
    try {
      await timeEntryService.clearAll()
      setRows([])
      setError(null)
    } catch (clearError) {
      console.error('Não foi possível limpar o histórico global.', clearError)
      setError('Não foi possível limpar o histórico. Tente novamente.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <PageContainer title="Histórico" description="Visão global dos apontamentos da SM&A, com filtros por equipe, colaborador, projeto, período e status." contained={false}>
      <div className="space-y-6">
        <section className="ui-card rounded-2xl p-5" aria-label="Filtros globais do histórico da diretoria">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Consulta global</p>
              <h2 className="mt-1 text-xl font-extrabold ui-text">Filtrar apontamentos</h2>
            </div>
            <button type="button" onClick={() => void clearHistory()} disabled={isClearing} className="self-start rounded-xl border border-red-400 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/70 dark:text-red-300 dark:hover:bg-red-950/40 sm:self-auto">{isClearing ? 'Limpando...' : 'Limpar Histórico'}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_auto_auto]">
            <label className="text-sm font-bold ui-text">
              Equipe / Supervisão
              <select value={draftFilters.supervisor} onChange={(event) => updateDraftFilter('supervisor', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text">
                {supervisorOptions.map((supervisor) => <option key={supervisor} value={supervisor}>{supervisor === 'Todos' ? 'Todas as equipes' : supervisor}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold ui-text">
              Colaborador / Técnico
              <input type="search" value={draftFilters.collaborator} onChange={(event) => updateDraftFilter('collaborator', event.target.value)} placeholder="Buscar por nome" className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text outline-none focus:ring-2" />
            </label>
            <label className="text-sm font-bold ui-text">
              Projeto / Obra
              <select value={draftFilters.project} onChange={(event) => updateDraftFilter('project', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text">
                {projectOptions.map((project) => <option key={project} value={project}>{project === 'Todos' ? 'Todos os projetos' : project}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold ui-text">
              Data Inicial
              <input type="date" value={draftFilters.startDate} onChange={(event) => updateDraftFilter('startDate', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text" />
            </label>
            <label className="text-sm font-bold ui-text">
              Data Final
              <input type="date" min={draftFilters.startDate || undefined} value={draftFilters.endDate} onChange={(event) => updateDraftFilter('endDate', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text" />
            </label>
            <label className="text-sm font-bold ui-text">
              Status
              <select value={draftFilters.status} onChange={(event) => updateDraftFilter('status', event.target.value as DirectorHistoryStatusFilter)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text">
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="APPROVED">Aprovados</option>
                <option value="REJECTED">Rejeitados</option>
              </select>
            </label>
            <button type="button" onClick={applyFilters} className="self-end rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110">Aplicar Filtros</button>
            <button type="button" onClick={clearFilters} className="self-end rounded-xl border ui-border px-4 py-2.5 text-sm font-bold ui-text transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">Limpar Filtros</button>
          </div>
        </section>

        <section className="ui-card rounded-2xl p-5" aria-labelledby="director-history-title">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Base consolidada</p>
              <h2 id="director-history-title" className="mt-1 text-xl font-extrabold ui-text">Apontamentos da empresa</h2>
            </div>
            <p className="text-sm ui-text-muted">{filteredRows.length} registro(s) encontrado(s)</p>
          </div>

          {isLoading && <p className="rounded-xl border ui-border p-8 text-center font-semibold ui-text-muted" aria-live="polite">Carregando histórico global…</p>}
          {!isLoading && error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
          {!isLoading && !error && filteredRows.length === 0 && <div className="rounded-xl border border-dashed ui-border p-10 text-center"><p className="font-bold ui-text">Nenhum apontamento encontrado com os filtros atuais</p><p className="mt-2 text-sm ui-text-muted">Ajuste os filtros ou aguarde novos lançamentos.</p></div>}
          {!isLoading && !error && filteredRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b ui-border text-xs uppercase tracking-wider ui-text-subtle">
                  <tr>{['Equipe / Supervisão', 'Colaborador', 'Data', 'Projeto / Obra', 'Atividade', 'Horas', 'Status'].map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-[var(--color-surface-subtle)]">
                      <td className="px-3 py-3 font-semibold ui-text">{row.supervisor}</td>
                      <td className="px-3 py-3 ui-text">{row.collaborator}</td>
                      <td className="px-3 py-3 ui-text-muted">{row.date}</td>
                      <td className="px-3 py-3 ui-text-muted">{row.project}</td>
                      <td className="px-3 py-3 ui-text-muted">{row.activity}</td>
                      <td className="px-3 py-3 font-semibold ui-text">{formatHours(row.hours)}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : row.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'}`}>{statusLabel[row.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  )
}
