import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { BrandMark } from '../components/BrandMark'
import { StatusBadge } from '../components/StatusBadge'
import { ThemeToggle } from '../components/ThemeToggle'
import { BalancePeriodFilter } from '../features/calendar/BalancePeriodFilter'
import { ManagerCalendar } from '../features/calendar/ManagerCalendar'
import { RejectionDialog } from '../features/supervisor/RejectionDialog'
import { SupervisorEntriesTable } from '../features/supervisor/SupervisorEntriesTable'
import { SupervisorRequestsTable } from '../features/supervisor/SupervisorRequestsTable'
import { filterSupervisorHistoryEntries, type HistoryStatusFilter, type SupervisorHistoryFilters } from '../features/supervisor/historyFilters'
import type { SupervisorPendingEntry, SupervisorTimeOffRequest } from '../features/supervisor/types'
import { useSupervisorDashboard } from '../features/supervisor/useSupervisorDashboard'
import { useSession } from '../features/session/useSession'
import { formatMinutes } from '../features/time-entries/domain'
import { getCorporateToday, getTimesheetCycle, isIsoDate } from '../shared/utils/date'
import { getAllColaboradores } from '../data/mockDEP'
import { AvisosPage } from './AvisosPage'
import { NavigationIcon, type NavigationIconName } from '../components/NavigationIcon'
import { timeEntryService } from '../services/timeEntryService'

type ActiveView = 'entries' | 'requests' | 'history' | 'profile' | 'announcements'
type EntryStatusFilter = 'ALL' | SupervisorPendingEntry['status']
type RejectionTarget =
  | { type: 'entry', item: SupervisorPendingEntry }
  | { type: 'time-off', item: SupervisorTimeOffRequest }

type ProjectHoursRow = {
  projeto: string
  horas: number
}

const entryStatusLabel: Record<SupervisorPendingEntry['status'], string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
}

const SUPERVISOR_DISPLAY_NAME = 'Jeen Carlos E. Azevedo'
const SUPERVISOR_PROFILE_STORAGE_KEY = 'sma:supervisor-profile:v1'
type SupervisorProfile = { name: string; email: string; jobTitle: string; squadName: string }

const defaultSupervisorProfile: SupervisorProfile = {
  name: SUPERVISOR_DISPLAY_NAME,
  email: 'jeen.azevedo@sma.local',
  jobTitle: 'Supervisor de Engenharia',
  squadName: 'Engenharia de Automação',
}

const supervisorNavigation: Array<{ id: ActiveView, label: string, icon: NavigationIconName }> = [
  { id: 'entries', label: 'Gestão da Equipe', icon: 'users' },
  { id: 'requests', label: 'Solicitações', icon: 'inbox' },
  { id: 'history', label: 'Histórico', icon: 'history' },
  { id: 'announcements', label: 'Avisos', icon: 'bell' },
  { id: 'profile', label: 'Meu Perfil', icon: 'user' },
]

function readSupervisorProfile(): SupervisorProfile {
  if (typeof window === 'undefined') return defaultSupervisorProfile
  try {
    const raw = window.localStorage.getItem(SUPERVISOR_PROFILE_STORAGE_KEY)
    if (!raw) return defaultSupervisorProfile
    const parsed = JSON.parse(raw) as Partial<SupervisorProfile>
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : defaultSupervisorProfile.name,
      email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email : defaultSupervisorProfile.email,
      jobTitle: typeof parsed.jobTitle === 'string' && parsed.jobTitle.trim() ? parsed.jobTitle : defaultSupervisorProfile.jobTitle,
      squadName: typeof parsed.squadName === 'string' && parsed.squadName.trim() ? parsed.squadName : defaultSupervisorProfile.squadName,
    }
  } catch {
    return defaultSupervisorProfile
  }
}

function saveSupervisorProfile(profile: SupervisorProfile) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SUPERVISOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

function SummaryCard({ label, value, helper }: { label: string, value: number, helper: string }) {
  return (
    <article className="rounded-2xl border ui-border ui-surface p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider ui-text-subtle">{label}</p>
      <p className="mt-3 text-3xl font-extrabold ui-heading">{value}</p>
      <p className="mt-2 text-sm ui-text-muted">{helper}</p>
    </article>
  )
}

function SupervisorSidebar({ activeView, profile, onChange, onSignOut }: {
  activeView: ActiveView
  profile: SupervisorProfile
  onChange: (view: ActiveView) => void
  onSignOut: () => void
}) {
  return (
    <aside
      data-desktop-sidebar
      className="hidden h-[calc(100vh-5rem)] w-64 min-w-0 flex-col overflow-y-auto bg-[var(--color-sidebar)] text-[var(--color-sidebar-text)] lg:sticky lg:top-20 lg:flex lg:self-start"
      aria-label="Menu lateral do supervisor"
    >
      <section className="border-b border-[var(--color-sidebar-border)] p-4" aria-label="Perfil atual do supervisor">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-surface)] text-sm font-extrabold">JA</span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight">{profile.name}</p>
            <p className="mt-0.5 text-xs leading-tight text-[var(--color-sidebar-text-muted)]">{profile.jobTitle}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-sidebar-surface)] p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sidebar-text-muted)]">Squad ativa</p>
            <p className="text-xs font-bold leading-tight">{profile.squadName}</p>
          </div>
        </div>
      </section>

      <nav className="flex-1 space-y-2 p-4" aria-label="Navegação do supervisor">
        {supervisorNavigation.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)] ${
                isActive ? 'border-[var(--color-primary)] bg-[var(--color-navigation-active)] text-[var(--color-navigation-active-text)]' : 'border-transparent text-[var(--color-sidebar-text-muted)] hover:bg-[var(--color-navigation-hover)] hover:text-[var(--color-sidebar-text)]'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-[var(--color-navigation-active-detail)] text-[var(--color-primary)]' : 'bg-[var(--color-sidebar-surface)]'}`}><NavigationIcon name={item.icon} /></span>
              <span className="flex-1">{item.label}</span>
              {isActive && <span className="text-[10px] font-extrabold uppercase" aria-label="Página atual">Atual</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[var(--color-sidebar-border)] p-4">
        <button type="button" onClick={onSignOut} className="w-full rounded-xl border border-[var(--color-sidebar-border)] px-4 py-3 text-left text-sm font-bold text-[var(--color-sidebar-text)] hover:bg-[var(--color-navigation-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)]">
          Sair do sistema
        </button>
        <p className="mt-3 px-1 text-xs text-[var(--color-sidebar-text-muted)]">Dados sincronizados via localStorage.</p>
      </div>
    </aside>
  )
}

function HistoryView({ entries, onClearHistory }: { entries: SupervisorPendingEntry[], onClearHistory: () => Promise<void> }) {
  const [filters, setFilters] = useState<SupervisorHistoryFilters>({
    technician: '',
    project: 'Todos',
    startDate: '',
    endDate: '',
    status: 'ALL',
  })
  const [isClearing, setIsClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const filteredEntries = useMemo(() => filterSupervisorHistoryEntries(entries, filters), [entries, filters])
  const projectOptions = useMemo(() => ['Todos', ...Array.from(new Set(entries.map((entry) => entry.projectCode))).sort()], [entries])

  function updateFilter<Key extends keyof SupervisorHistoryFilters>(field: Key, value: SupervisorHistoryFilters[Key]) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearFilters() {
    setFilters({ technician: '', project: 'Todos', startDate: '', endDate: '', status: 'ALL' })
  }

  async function clearHistory() {
    if (!window.confirm('ALERTA CRÍTICO: Tem certeza que deseja apagar TODO o histórico de apontamentos? Esta ação não pode ser desfeita e afetará os dados do sistema.')) return
    setIsClearing(true)
    setClearError(null)
    try {
      await onClearHistory()
    } catch (error) {
      console.error('Não foi possível limpar o histórico da equipe.', error)
      setClearError('Não foi possível limpar o histórico. Tente novamente.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="ui-card rounded-2xl p-5" aria-label="Filtros do histórico do supervisor">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Busca rápida</p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--color-text)]">Filtrar histórico</h2>
          </div>
          <button type="button" onClick={() => void clearHistory()} disabled={isClearing} className="self-start rounded-xl border border-red-400 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/70 dark:text-red-300 dark:hover:bg-red-950/40 sm:self-auto">{isClearing ? 'Limpando...' : 'Limpar Histórico'}</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]">
          <label className="text-sm font-bold ui-text">
            Técnico
            <input type="search" value={filters.technician} onChange={(event) => updateFilter('technician', event.target.value)} placeholder="Buscar por nome" className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text outline-none focus:ring-2" />
          </label>
          <label className="text-sm font-bold ui-text">
            Projeto / Obra
            <select value={filters.project} onChange={(event) => updateFilter('project', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text">
              {projectOptions.map((project) => <option key={project} value={project}>{project === 'Todos' ? 'Todos os projetos' : project}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold ui-text">
            Data Inicial
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text" />
          </label>
          <label className="text-sm font-bold ui-text">
            Data Final
            <input type="date" min={filters.startDate || undefined} value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text" />
          </label>
          <label className="text-sm font-bold ui-text">
            Status
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value as HistoryStatusFilter)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 font-normal ui-text">
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="APPROVED">Aprovados</option>
              <option value="REJECTED">Rejeitados</option>
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="self-end rounded-xl border ui-border px-4 py-2.5 text-sm font-bold ui-text transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">Limpar Filtros</button>
        </div>
      </section>

      {clearError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{clearError}</p>}

      <section className="ui-card rounded-2xl p-5" aria-labelledby="supervisor-history-title">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Consolidado</p>
          <h2 id="supervisor-history-title" className="mt-1 text-xl font-extrabold text-[var(--color-text)]">Histórico de validações</h2>
          <p className="mt-1 text-sm ui-text-muted">{filteredEntries.length} registro(s) encontrado(s).</p>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed ui-border p-8 text-center text-sm font-semibold ui-text-muted">
            Nenhum apontamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="max-h-[600px] space-y-3 overflow-y-auto">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-extrabold text-[var(--color-text)]">{entry.collaboratorName}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{entry.entryDate} · {entry.projectCode} · {entry.activityName}</p>
                    {entry.rejectionReason && <p className="mt-2 text-sm text-[var(--color-text-muted)]">Motivo: {entry.rejectionReason}</p>}
                  </div>
                  <StatusBadge tone={entry.status === 'APPROVED' ? 'success' : entry.status === 'REJECTED' ? 'danger' : 'pending'}>{entryStatusLabel[entry.status]}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SupervisorProfileView({ profile, onSave }: { profile: SupervisorProfile, onSave: (profile: SupervisorProfile) => void }) {
  const [isEditing, setEditing] = useState(false)
  const [form, setForm] = useState(profile)

  useEffect(() => {
    setForm(profile)
  }, [profile])

  const updateField = (field: keyof SupervisorProfile, value: string) => setForm((current) => ({ ...current, [field]: value }))

  function cancelEdit() {
    setForm(profile)
    setEditing(false)
  }

  function saveProfile() {
    const updated = {
      name: form.name.trim(),
      email: form.email.trim(),
      jobTitle: form.jobTitle.trim(),
      squadName: form.squadName.trim(),
    }
    if (!updated.name || !updated.email || !updated.jobTitle || !updated.squadName) return
    onSave(updated)
    setEditing(false)
  }

  return (
    <section className="ui-card rounded-2xl p-6" aria-labelledby="supervisor-profile-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Meu Perfil</p>
          <h2 id="supervisor-profile-title" className="mt-1 text-2xl font-extrabold text-[var(--color-primary)]">{profile.name}</h2>
        </div>
        {!isEditing && <button type="button" onClick={() => setEditing(true)} className="ui-button-secondary">Editar Perfil</button>}
      </div>
      {isEditing ? (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold ui-text">Nome<input type="text" value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 ui-text outline-none focus:ring-2" /></label>
            <label className="text-sm font-bold ui-text">E-mail<input type="text" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 ui-text outline-none focus:ring-2" /></label>
            <label className="text-sm font-bold ui-text">Cargo<input type="text" value={form.jobTitle} onChange={(event) => updateField('jobTitle', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 ui-text outline-none focus:ring-2" /></label>
            <label className="text-sm font-bold ui-text">Squad<select value={form.squadName} onChange={(event) => updateField('squadName', event.target.value)} className="mt-2 w-full ui-field rounded-xl px-3 py-2.5 ui-text outline-none focus:ring-2">
              <option value="Engenharia de Automação">Engenharia de Automação</option>
              <option value="Engenharia Elétrica">Engenharia Elétrica</option>
            </select></label>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancelEdit} className="ui-button-secondary">Cancelar</button>
            <button type="button" onClick={saveProfile} className="ui-button-primary">Salvar</button>
          </div>
        </div>
      ) : (
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Cargo</dt>
            <dd className="mt-1 font-bold text-[var(--color-text)]">{profile.jobTitle}</dd>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">E-mail</dt>
            <dd className="mt-1 font-bold text-[var(--color-text)]">{profile.email}</dd>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Squad</dt>
            <dd className="mt-1 font-bold text-[var(--color-text)]">{profile.squadName}</dd>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Permissões</dt>
            <dd className="mt-1 font-bold text-[var(--color-text)]">Aprovar apontamentos e ausências</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

export function SupervisorPage() {
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const dashboard = useSupervisorDashboard(session?.id)
  const today = getCorporateToday()
  const cycleRange = useMemo(() => getTimesheetCycle(today), [today])
  const [activeView, setActiveView] = useState<ActiveView>('entries')
  const [range, setRange] = useState(cycleRange)
  const [appliedRange, setAppliedRange] = useState(cycleRange)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [supervisorProfile, setSupervisorProfile] = useState<SupervisorProfile>(() => readSupervisorProfile())
  const [collaboratorFilter, setCollaboratorFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState<EntryStatusFilter>('ALL')
  const [filtroProjeto, setFiltroProjeto] = useState('Todos')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [rejectionTarget, setRejectionTarget] = useState<RejectionTarget | null>(null)
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const collaboratorOptions = useMemo(() => ['Todos', ...getAllColaboradores()], [])

  useEffect(() => {
    setRange(cycleRange)
    setAppliedRange(cycleRange)
  }, [cycleRange])

  const hasCustomRange = appliedRange.startDate !== cycleRange.startDate || appliedRange.endDate !== cycleRange.endDate

  const filteredEntries = useMemo(() => dashboard.entries.filter((entry) => {
    const matchesCollaborator = collaboratorFilter === 'ALL' || collaboratorFilter === 'Todos' || entry.collaboratorName === collaboratorFilter || entry.collaboratorId === collaboratorFilter
    const matchesStatus = statusFilter === 'ALL' || entry.status === statusFilter
    const matchesProject = filtroProjeto === 'Todos' || entry.projectCode === filtroProjeto
    const matchesDate = entry.entryDate >= appliedRange.startDate && entry.entryDate <= appliedRange.endDate
    return matchesCollaborator && matchesStatus && matchesProject && matchesDate
  }), [appliedRange.endDate, appliedRange.startDate, collaboratorFilter, dashboard.entries, filtroProjeto, statusFilter])

  const projectOptions = useMemo(() => (
    ['Todos', ...Array.from(new Set(dashboard.entries.map((entry) => entry.projectCode))).sort()]
  ), [dashboard.entries])

  const rangedEntries = useMemo(() => dashboard.entries.filter((entry) => (
    entry.entryDate >= appliedRange.startDate && entry.entryDate <= appliedRange.endDate
  )), [appliedRange.endDate, appliedRange.startDate, dashboard.entries])

  const rangedSummary = useMemo(() => rangedEntries.reduce(
    (summary, entry) => ({
      pending: summary.pending + (entry.status === 'PENDING' ? 1 : 0),
      approved: summary.approved + (entry.status === 'APPROVED' ? 1 : 0),
      rejected: summary.rejected + (entry.status === 'REJECTED' ? 1 : 0),
    }),
    { pending: 0, approved: 0, rejected: 0 },
  ), [rangedEntries])

  const projectHoursData = useMemo<ProjectHoursRow[]>(() => {
    const hoursByProject = new Map<string, number>()
    for (const entry of filteredEntries) {
      const hoursAsText = formatMinutes(entry.durationMinutes)
      const [hours = '0', minutes = '0'] = hoursAsText.split(':')
      const decimalHours = Number(hours) + Number(minutes) / 60
      hoursByProject.set(entry.projectCode, (hoursByProject.get(entry.projectCode) ?? 0) + decimalHours)
    }
    return Array.from(hoursByProject.entries())
      .map(([projeto, horas]) => ({ projeto, horas: Number(horas.toFixed(2)) }))
      .sort((left, right) => right.horas - left.horas)
  }, [filteredEntries])

  const selectedEntries = useMemo(() => {
    const selected = new Set(selectedIds)
    return filteredEntries.filter((entry) => selected.has(entry.id))
  }, [filteredEntries, selectedIds])

  useEffect(() => {
    const visibleIds = new Set(filteredEntries.map((entry) => entry.id))
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)))
  }, [filteredEntries])

  function applyRange() {
    if (!isIsoDate(range.startDate) || !isIsoDate(range.endDate) || range.startDate > range.endDate) {
      setRangeError('Informe um intervalo válido, com a data inicial anterior à data final.')
      return
    }
    setRangeError(null)
    setAppliedRange(range)
  }

  function useCalendarMonth() {
    setRangeError(null)
    setRange(cycleRange)
    setAppliedRange(cycleRange)
  }

  function updateSupervisorProfile(profile: SupervisorProfile) {
    saveSupervisorProfile(profile)
    setSupervisorProfile(profile)
  }

  async function clearSupervisorHistory() {
    await timeEntryService.clearAll()
    setSelectedIds([])
    await dashboard.reload()
  }

  async function handleExportToExcel() {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SM&A Apontamento de Horas'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Apontamentos')
    worksheet.columns = [
      { header: 'Colaborador', key: 'colaborador', width: 30 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Projeto', key: 'projeto', width: 35 },
      { header: 'Horas', key: 'horas', width: 15 },
      { header: 'Status', key: 'status', width: 20 },
    ]

    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A52' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1F3A52' } },
        left: { style: 'thin', color: { argb: 'FF1F3A52' } },
        bottom: { style: 'thin', color: { argb: 'FF1F3A52' } },
        right: { style: 'thin', color: { argb: 'FF1F3A52' } },
      }
    })
    worksheet.getRow(1).height = 24

    filteredEntries.forEach((entry) => {
      const row = worksheet.addRow({
        colaborador: entry.collaboratorName,
        data: entry.entryDate,
        projeto: entry.projectCode,
        horas: formatMinutes(entry.durationMinutes),
        status: entryStatusLabel[entry.status],
      })
      const statusCell = row.getCell('status')
      const statusStyles: Record<SupervisorPendingEntry['status'], { fill: string, font: string }> = {
        APPROVED: { fill: 'FFE2F0D9', font: 'FF166534' },
        REJECTED: { fill: 'FFFCE4D6', font: 'FF991B1B' },
        PENDING: { fill: 'FFFFF2CC', font: 'FF92400E' },
      }
      const style = statusStyles[entry.status]
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
      statusCell.font = { bold: true, color: { argb: style.font } }
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.height = 22
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 4 ? 'center' : 'left' }
      })
    })
    worksheet.autoFilter = 'A1:E1'
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), 'Relatorio_Horas_SMA.xlsx')
  }

  function toggleAllVisibleEntries(checked: boolean) {
    const visibleIds = filteredEntries.map((entry) => entry.id)
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => !visibleIds.includes(id))
      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

  function toggleSelectedEntry(entryId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return current.includes(entryId) ? current : [...current, entryId]
      return current.filter((id) => id !== entryId)
    })
  }

  async function handleBulkApprove() {
    for (const entry of selectedEntries) await dashboard.approve(entry)
    setSelectedIds([])
  }

  async function handleBulkReject() {
    for (const entry of selectedEntries) await dashboard.reject(entry, 'Rejeitado em lote pela supervisão.')
    setSelectedIds([])
  }

  const exitDemo = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  const rejectTarget = async (reason: string) => {
    if (!rejectionTarget) return
    setRejectionError(null)
    try {
      if (rejectionTarget.type === 'entry') {
        await dashboard.reject(rejectionTarget.item, reason)
      } else {
        await dashboard.rejectTimeOff(rejectionTarget.item, reason)
      }
      setRejectionTarget(null)
    } catch (requestError) {
      setRejectionError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar a rejeição.')
    }
  }

  const rejectionDescription = rejectionTarget
    ? `Informe o motivo para ${rejectionTarget.item.collaboratorName}. Esse texto fica registrado no localStorage e aparecerá no histórico correspondente.`
    : undefined

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header data-layout-region="global-header" className="sticky top-0 z-40 flex h-20 w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-header)] px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark variant="compact" />
          <div className="hidden min-w-0 sm:block">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary)]">Área do supervisor</p>
            <p className="truncate text-sm text-[var(--color-text-muted)]">Validação de apontamentos e solicitações da equipe</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs font-semibold text-[var(--color-text-muted)] md:block">{supervisorProfile.name}</span>
          <ThemeToggle />
        </div>
      </header>

      <section data-layout-body className="relative grid min-h-[calc(100vh-5rem)] min-w-0 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <SupervisorSidebar activeView={activeView} profile={supervisorProfile} onChange={setActiveView} onSignOut={exitDemo} />

        <div className="mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary)]">SM&A</p>
            <h1 className="text-2xl font-extrabold text-[var(--color-primary)] sm:text-3xl">{supervisorNavigation.find((item) => item.id === activeView)?.label}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">
              Consulte dados sincronizados do localStorage, valide pendências e acompanhe o histórico da equipe.
            </p>
          </div>

          <div className="space-y-6">
            {dashboard.error && (
              <div role="alert" className="rounded-2xl border border-[var(--color-danger)] bg-[var(--color-surface)] p-4 text-sm font-semibold text-[var(--color-danger)]">
                {dashboard.error}
              </div>
            )}
            {rangeError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{rangeError}</p>}

            {activeView === 'entries' && (
              <>
                <ManagerCalendar
                  entries={dashboard.entries}
                  collaborators={dashboard.collaborators}
                  role="SUPERVISOR"
                  onApprove={(entry) => void dashboard.approve(entry)}
                  onReject={(entry, reason) => void dashboard.reject(entry, reason)}
                />
                <BalancePeriodFilter
                  startDate={range.startDate}
                  endDate={range.endDate}
                  isCustomRange={hasCustomRange}
                  onChange={(field, value) => setRange((current) => ({ ...current, [field]: value }))}
                  onApply={applyRange}
                  onClear={useCalendarMonth}
                  defaultPeriodLabel="Usar ciclo 16–15"
                />

                <section className="grid gap-4 md:grid-cols-3" aria-label="Resumo dos apontamentos">
                  <SummaryCard label="Pendentes" value={rangedSummary.pending} helper="Apontamentos aguardando validação no período." />
                  <SummaryCard label="Aprovados" value={rangedSummary.approved} helper="Registros já aprovados pela supervisão." />
                  <SummaryCard label="Rejeitados" value={rangedSummary.rejected} helper="Registros devolvidos com motivo informado." />
                </section>

                <section className="rounded-2xl border ui-border ui-surface p-5 shadow-sm" aria-labelledby="project-hours-chart-title">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider ui-text-subtle">Dashboard</p>
                    <h2 id="project-hours-chart-title" className="mt-1 text-lg font-extrabold ui-heading">Horas por Projeto</h2>
                    <p className="mt-1 text-sm ui-text-muted">Total de horas dos apontamentos visíveis na tabela.</p>
                  </div>
                  {projectHoursData.length === 0 ? (
                    <p className="rounded-xl border ui-border p-8 text-center text-sm font-semibold ui-text-muted">Nenhum apontamento filtrado para gerar o gráfico.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={projectHoursData} margin={{ top: 8, right: 12, left: 0, bottom: 44 }}>
                        <XAxis dataKey="projeto" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} angle={-25} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
                        <Tooltip
                          cursor={{ fill: 'rgb(255 255 255 / 0.06)' }}
                          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', color: 'var(--color-text)' }}
                          labelStyle={{ color: 'var(--color-text)' }}
                          formatter={(value) => [`${Number(value).toFixed(2)} h`, 'Horas']}
                        />
                        <Bar dataKey="horas" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </section>

                <section className="grid gap-3 rounded-2xl border ui-border ui-surface p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]" aria-label="Filtros de apontamentos">
                  <label className="text-sm font-bold ui-text">
                    Colaborador
                    <select value={collaboratorFilter} onChange={(event) => setCollaboratorFilter(event.target.value)} className="mt-1 block w-full ui-field rounded-xl px-3 py-2 font-normal ui-text">
                      {collaboratorOptions.map((collaborator) => (
                        <option key={collaborator} value={collaborator}>{collaborator === 'Todos' ? 'Todos da Equipe' : collaborator}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-bold ui-text">
                    Status
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EntryStatusFilter)} className="mt-1 block w-full ui-field rounded-xl px-3 py-2 font-normal ui-text">
                      <option value="ALL">Todos</option>
                      <option value="PENDING">Pendentes</option>
                      <option value="APPROVED">Aprovados</option>
                      <option value="REJECTED">Rejeitados</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold ui-text">
                    Projeto
                    <select value={filtroProjeto} onChange={(event) => setFiltroProjeto(event.target.value)} className="mt-1 block w-full ui-field rounded-xl px-3 py-2 font-normal ui-text">
                      {projectOptions.map((project) => (
                        <option key={project} value={project}>{project === 'Todos' ? 'Todos os Projetos' : project}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={handleExportToExcel} disabled={filteredEntries.length === 0} className="self-end rounded-xl border ui-border px-4 py-2.5 text-sm font-bold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40">
                    Exportar Excel
                  </button>
                </section>

                {selectedIds.length > 0 && (
                  <section className="flex flex-col gap-3 rounded-2xl border ui-border ui-surface p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Ações em lote">
                    <p className="text-sm font-bold ui-text">{selectedIds.length} apontamento(s) selecionado(s)</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => void handleBulkReject()} disabled={dashboard.isMutating} className="rounded-xl border border-[var(--color-danger)] px-4 py-2.5 text-sm font-bold text-[var(--color-danger)] transition hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50">
                        Rejeitar Selecionados
                      </button>
                      <button type="button" onClick={() => void handleBulkApprove()} disabled={dashboard.isMutating} className="ui-button-primary">
                        Aprovar Selecionados
                      </button>
                    </div>
                  </section>
                )}

                {dashboard.isLoading ? (
                  <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center font-semibold text-[var(--color-text-muted)]" aria-live="polite">
                    Carregando apontamentos da equipe...
                  </p>
                ) : (
                  <SupervisorEntriesTable
                    entries={filteredEntries}
                    isMutating={dashboard.isMutating}
                    selectedIds={selectedIds}
                    onToggleAll={toggleAllVisibleEntries}
                    onToggleEntry={toggleSelectedEntry}
                    onApprove={(entry) => void dashboard.approve(entry)}
                    onReject={(entry) => {
                      setRejectionError(null)
                      setRejectionTarget({ type: 'entry', item: entry })
                    }}
                  />
                )}
              </>
            )}

            {activeView === 'requests' && (
              <>
                <section className="grid gap-4 md:grid-cols-3" aria-label="Resumo das solicitações">
                  <SummaryCard label="Ausências pendentes" value={dashboard.requestSummary.pending} helper="Solicitações aguardando decisão." />
                  <SummaryCard label="Ausências aprovadas" value={dashboard.requestSummary.approved} helper="Ausências liberadas pela supervisão." />
                  <SummaryCard label="Ausências rejeitadas" value={dashboard.requestSummary.rejected} helper="Solicitações recusadas com justificativa." />
                </section>
                {dashboard.isLoading ? (
                  <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center font-semibold text-[var(--color-text-muted)]" aria-live="polite">
                    Carregando solicitações da equipe...
                  </p>
                ) : (
                  <SupervisorRequestsTable
                    requests={dashboard.requests}
                    isMutating={dashboard.isMutating}
                    onApprove={(request) => void dashboard.approveTimeOff(request)}
                    onReject={(request) => {
                      setRejectionError(null)
                      setRejectionTarget({ type: 'time-off', item: request })
                    }}
                  />
                )}
              </>
            )}

            {activeView === 'history' && <HistoryView entries={dashboard.entries} onClearHistory={clearSupervisorHistory} />}
            {activeView === 'profile' && <SupervisorProfileView profile={supervisorProfile} onSave={updateSupervisorProfile} />}
            {activeView === 'announcements' && <AvisosPage />}
          </div>
        </div>
      </section>

      <RejectionDialog
        entry={rejectionTarget?.item ?? null}
        error={rejectionError}
        isSubmitting={dashboard.isMutating}
        title={rejectionTarget?.type === 'time-off' ? 'Rejeitar solicitação de ausência' : 'Rejeitar apontamento'}
        description={rejectionDescription}
        onClose={() => setRejectionTarget(null)}
        onConfirm={(reason) => void rejectTarget(reason)}
      />
    </main>
  )
}
