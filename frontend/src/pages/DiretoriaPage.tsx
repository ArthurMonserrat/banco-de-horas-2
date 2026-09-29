import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { useSession } from '../features/session/useSession'
import { TIME_OFF_STORAGE_KEY } from '../services/timeOffService'
import { TIME_ENTRY_STORAGE_KEY } from '../services/timeEntryService'
import { getTimesheetCycle } from '../shared/utils/date'
import { ManagerCalendar } from '../features/calendar/ManagerCalendar'
import type { SupervisorPendingEntry } from '../features/supervisor/types'
import { supervisorService } from '../services/supervisorService'
import { directorNavigation } from '../mocks/navigation'
import { NavigationIcon } from '../components/NavigationIcon'

type DiretoriaEntry = {
  id: string
  collaboratorId: string
  entryDate: string
  projectCode: string
  durationMinutes: number
  status: string
}

type DiretoriaAbsence = {
  id: string
  status: string
}

type ProjectHoursRow = {
  projeto: string
  horas: number
}

const fallbackProjectHours: ProjectHoursRow[] = [
  { projeto: 'SM&A-ENG-142', horas: 128 },
  { projeto: 'SM&A-AUT-087', horas: 96 },
  { projeto: 'SM&A-ELE-211', horas: 74 },
]

function readJsonArray(key: string): unknown[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object' && key === TIME_ENTRY_STORAGE_KEY) {
      const entriesByCollaborator = (parsed as { entriesByCollaborator?: unknown }).entriesByCollaborator
      if (!entriesByCollaborator || typeof entriesByCollaborator !== 'object') return []
      return Object.values(entriesByCollaborator).flatMap((entries) => Array.isArray(entries) ? entries : [])
    }
    if (parsed && typeof parsed === 'object' && key === TIME_OFF_STORAGE_KEY) {
      const requests = (parsed as { requests?: unknown }).requests
      return Array.isArray(requests) ? requests : []
    }
    return []
  } catch {
    return []
  }
}

function normalizeEntry(value: unknown): DiretoriaEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string'
    || typeof entry.collaboratorId !== 'string'
    || typeof entry.entryDate !== 'string'
    || typeof entry.projectCode !== 'string'
    || !Number.isFinite(Number(entry.durationMinutes))) return null
  return {
    id: entry.id,
    collaboratorId: entry.collaboratorId,
    entryDate: entry.entryDate,
    projectCode: entry.projectCode,
    durationMinutes: Number(entry.durationMinutes),
    status: typeof entry.status === 'string' ? entry.status : 'ACTIVE',
  }
}

function normalizeAbsence(value: unknown): DiretoriaAbsence | null {
  if (!value || typeof value !== 'object') return null
  const absence = value as Record<string, unknown>
  if (typeof absence.id !== 'string') return null
  return {
    id: absence.id,
    status: typeof absence.status === 'string' ? absence.status : 'Pendente',
  }
}

function SummaryCard({ label, value, helper }: { label: string, value: string | number, helper: string }) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-extrabold text-[var(--color-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{helper}</p>
    </article>
  )
}

function DiretoriaSidebar({ onSignOut }: { onSignOut: () => void }) {
  const linkClass = ({ isActive }: { isActive: boolean }) => `flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-left text-sm font-semibold transition ${
    isActive
      ? 'border-[var(--color-primary)] bg-[var(--color-navigation-active)] text-[var(--color-navigation-active-text)]'
      : 'border-transparent text-[var(--color-sidebar-text-muted)] hover:bg-[var(--color-navigation-hover)] hover:text-[var(--color-sidebar-text)]'
  }`

  return (
    <aside className="hidden h-[calc(100vh-5rem)] w-64 flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-text)] lg:sticky lg:top-20 lg:flex lg:self-start">
      <section className="border-b border-[var(--color-sidebar-border)] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-surface)] text-sm font-extrabold">DI</span>
          <div>
            <p className="text-sm font-extrabold leading-tight">Diretoria SM&A</p>
            <p className="mt-0.5 text-xs leading-tight text-[var(--color-sidebar-text-muted)]">Visão macro</p>
          </div>
        </div>
      </section>
      <nav className="flex-1 space-y-2 p-4" aria-label="Menu lateral da diretoria">
        {directorNavigation.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/administracao'} className={linkClass}>
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-[var(--color-navigation-active-detail)] text-[var(--color-primary)]' : 'bg-[var(--color-sidebar-surface)]'}`}><NavigationIcon name={item.icon} /></span>
                <span className="flex-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[var(--color-sidebar-border)] p-4">
        <button type="button" onClick={onSignOut} className="w-full rounded-xl border border-[var(--color-sidebar-border)] px-4 py-3 text-left text-sm font-bold text-[var(--color-sidebar-text)] hover:bg-[var(--color-navigation-hover)]">
          Sair do sistema
        </button>
      </div>
    </aside>
  )
}

export function DiretoriaPage() {
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<DiretoriaEntry[]>([])
  const [absences, setAbsences] = useState<DiretoriaAbsence[]>([])
  const [managerEntries, setManagerEntries] = useState<SupervisorPendingEntry[]>([])
  const [managerCollaborators, setManagerCollaborators] = useState<Array<{ id: string; name: string; supervisorId?: string }>>([])
  const [managerSupervisors, setManagerSupervisors] = useState<Array<{ id: string; name: string }>>([])
  const timesheetCycle = getTimesheetCycle()

  useEffect(() => {
    const storedEntries = readJsonArray(TIME_ENTRY_STORAGE_KEY).flatMap((entry) => {
      const normalized = normalizeEntry(entry)
      return normalized ? [normalized] : []
    })
    const storedAbsences = readJsonArray(TIME_OFF_STORAGE_KEY).flatMap((absence) => {
      const normalized = normalizeAbsence(absence)
      return normalized ? [normalized] : []
    })
    setEntries(storedEntries)
    setAbsences(storedAbsences)
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([supervisorService.listEntries(), supervisorService.listCollaborators(), supervisorService.listSupervisors()]).then(([loadedEntries, loadedCollaborators, loadedSupervisors]) => {
      if (!active) return
      setManagerEntries(loadedEntries)
      setManagerCollaborators(loadedCollaborators)
      setManagerSupervisors(loadedSupervisors)
    })
    return () => { active = false }
  }, [])

  const projectHours = useMemo(() => {
    const activeEntries = entries.filter((entry) => entry.status !== 'CANCELLED')
    if (activeEntries.length === 0) return fallbackProjectHours
    const grouped = activeEntries.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.projectCode] = (totals[entry.projectCode] ?? 0) + entry.durationMinutes / 60
      return totals
    }, {})
    return Object.entries(grouped)
      .map(([projeto, horas]) => ({ projeto, horas: Number(horas.toFixed(1)) }))
      .sort((left, right) => right.horas - left.horas)
      .slice(0, 6)
  }, [entries])

  const cycleEntries = entries.filter((entry) => entry.entryDate >= timesheetCycle.startDate && entry.entryDate <= timesheetCycle.endDate && entry.status !== 'CANCELLED')
  const totalCycleHours = cycleEntries.reduce((total, entry) => total + entry.durationMinutes / 60, 0)
  const activeProjects = new Set(entries.filter((entry) => entry.status !== 'CANCELLED').map((entry) => entry.projectCode)).size
  const pendingAbsences = absences.filter((absence) => absence.status === 'PENDING' || absence.status === 'Pendente').length

  function exitDemo() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="sticky top-0 z-40 flex h-20 w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-header)] px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <BrandMark variant="compact" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary)]">SM&A - Painel da Diretoria</p>
            <p className="text-sm text-[var(--color-text-muted)]">Visão macro e alocação de tempo por projetos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-right text-xs font-semibold text-[var(--color-text-muted)] sm:block">{session?.name}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        <DiretoriaSidebar onSignOut={exitDemo} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <section>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Visão Macro</p>
              <h1 className="mt-2 text-3xl font-extrabold text-[var(--color-text)]">SM&A - Painel da Diretoria</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Visão macro e alocação de tempo por projetos.</p>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores da diretoria">
              <SummaryCard label="Total de Horas Apontadas (Ciclo 16–15)" value={totalCycleHours > 0 ? totalCycleHours.toFixed(1) : '298'} helper={`Horas consolidadas de ${timesheetCycle.startDate} a ${timesheetCycle.endDate}`} />
              <SummaryCard label="Projetos Ativos" value={activeProjects || 3} helper="Projetos com apontamentos registrados" />
              <SummaryCard label="Apontamentos Registrados" value={entries.length} helper="Base persistida em localStorage" />
              <SummaryCard label="Pendências Gerais" value={pendingAbsences} helper="Ausências aguardando decisão" />
            </section>

            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm" aria-labelledby="project-allocation-title">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Dashboard</p>
                  <h2 id="project-allocation-title" className="mt-1 text-xl font-extrabold text-[var(--color-text)]">Alocação de Tempo por Projeto</h2>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">{entries.length > 0 ? 'Dados reais do localStorage' : 'Dados corporativos para aprovação visual'}</p>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectHours} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <XAxis dataKey="projeto" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(119, 194, 164, 0.08)' }}
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, color: 'var(--color-text)' }}
                      labelStyle={{ color: 'var(--color-text)' }}
                    />
                    <Bar dataKey="horas" name="Horas" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <ManagerCalendar
              entries={managerEntries}
              collaborators={managerCollaborators}
              supervisors={managerSupervisors}
              role="DIRECTOR_ADMIN"
              onApprove={(entry) => {
                void supervisorService.approve(entry.id, session?.id ?? 'director').then((updated) => {
                  setManagerEntries((current) => current.map((item) => item.id === updated.id ? updated : item))
                })
              }}
              onReject={(entry, reason) => {
                void supervisorService.reject(entry.id, session?.id ?? 'director', reason).then((updated) => {
                  setManagerEntries((current) => current.map((item) => item.id === updated.id ? updated : item))
                })
              }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
