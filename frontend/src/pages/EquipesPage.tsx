import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { useSession } from '../features/session/useSession'
import { organogramaDEP, type DEPColaborador, type DEPGerencia } from '../data/mockDEP'
import { exportGeneralHoursReport, exportSquadHoursReport } from '../services/excelExportService'
import { directorNavigation } from '../mocks/navigation'
import { NavigationIcon } from '../components/NavigationIcon'
import {
  findSquad,
  getFirstSquadName,
  getSquadNumber,
  getSquads,
  loadEditableOrganograma,
  persistOrganograma,
} from '../services/organogramaService'

const cargoOptions = ['Engenheiro', 'Projetista', 'Desenhista', 'Estagiário', 'Estagiário 4h']
const monthOptions = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

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

function EditableCollaboratorCard({ colaborador, squadName, squadOptions, onSave }: {
  colaborador: DEPColaborador
  squadName: string
  squadOptions: string[]
  onSave: (originalName: string, updated: DEPColaborador, targetSquadName: string) => void
}) {
  const [isEditing, setEditing] = useState(false)
  const [form, setForm] = useState({ nome: colaborador.nome, cargo: colaborador.cargo, squad: squadName })

  useEffect(() => {
    setForm({ nome: colaborador.nome, cargo: colaborador.cargo, squad: squadName })
    setEditing(false)
  }, [colaborador.cargo, colaborador.nome, squadName])

  function cancelEdit() {
    setForm({ nome: colaborador.nome, cargo: colaborador.cargo, squad: squadName })
    setEditing(false)
  }

  function saveEdit() {
    const updated = { nome: form.nome.trim(), cargo: form.cargo.trim() }
    if (!updated.nome || !updated.cargo) return
    onSave(colaborador.nome, updated, form.squad)
    setEditing(false)
  }

  if (isEditing) {
    return (
      <article className="rounded-2xl border border-[var(--color-primary)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="grid gap-3">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            Nome
            <input type="text" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20" />
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            Cargo
            <select value={form.cargo} onChange={(event) => setForm((current) => ({ ...current, cargo: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20">
              {cargoOptions.map((cargo) => <option key={cargo} value={cargo}>{cargo}</option>)}
              {!cargoOptions.includes(form.cargo) && <option value={form.cargo}>{form.cargo}</option>}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            Mudar de Equipe
            <select value={form.squad} onChange={(event) => setForm((current) => ({ ...current, squad: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20">
              {squadOptions.map((squad) => <option key={squad} value={squad}>{squad}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={cancelEdit} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]">Cancelar</button>
          <button type="button" onClick={saveEdit} className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-[#06241f] hover:opacity-90">Salvar</button>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--color-text)]">{colaborador.nome}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{colaborador.cargo}</p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-subtle)]">
          Editar
        </button>
      </div>
    </article>
  )
}

export function EquipesPage() {
  const { session, signOut } = useSession()
  const navigate = useNavigate()
  const [dadosOrganograma, setDadosOrganograma] = useState<DEPGerencia[]>([])
  const [squadSelecionada, setSquadSelecionada] = useState(getFirstSquadName(organogramaDEP))
  const now = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(now.getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(now.getFullYear())
  const [squadMesSelecionado, setSquadMesSelecionado] = useState(now.getMonth() + 1)
  const [squadAnoSelecionado, setSquadAnoSelecionado] = useState(now.getFullYear())
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const yearOptions = useMemo(() => {
    const startYear = 2024
    const endYear = new Date().getFullYear()
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
  }, [])

  useEffect(() => {
    const storedOrganograma = loadEditableOrganograma()
    setDadosOrganograma(storedOrganograma)
    setSquadSelecionada((current) => current || getFirstSquadName(storedOrganograma))
  }, [])

  const squadOptions = useMemo(() => getSquads(dadosOrganograma).map((squad) => squad.nome), [dadosOrganograma])
  const selectedSquad = useMemo(() => findSquad(dadosOrganograma, squadSelecionada), [dadosOrganograma, squadSelecionada])
  const organogramaAtual = dadosOrganograma.length > 0 ? dadosOrganograma : organogramaDEP

  function resetSquadPeriod() {
    const current = new Date()
    setSquadMesSelecionado(current.getMonth() + 1)
    setSquadAnoSelecionado(current.getFullYear())
  }

  function handleSquadSelection(squadName: string) {
    setSquadSelecionada(squadName)
    resetSquadPeriod()
  }

  function handleSaveCollaborator(sourceSquadName: string, originalName: string, updated: DEPColaborador, targetSquadName: string) {
    setDadosOrganograma((current) => {
      const next = current.map((gerencia) => ({
        ...gerencia,
        squads: gerencia.squads.map((squad) => {
          if (squad.nome === sourceSquadName) {
            const remainingCollaborators = squad.colaboradores.filter((colaborador) => colaborador.nome !== originalName)
            if (sourceSquadName === targetSquadName) {
              return {
                ...squad,
                colaboradores: [...remainingCollaborators.map((colaborador) => ({ ...colaborador })), updated]
                  .sort((left, right) => left.nome.localeCompare(right.nome)),
              }
            }
            return {
              ...squad,
              colaboradores: remainingCollaborators.map((colaborador) => ({ ...colaborador })),
            }
          }
          if (squad.nome === targetSquadName) {
            return {
              ...squad,
              colaboradores: [...squad.colaboradores.map((colaborador) => ({ ...colaborador })), updated]
                .sort((left, right) => left.nome.localeCompare(right.nome)),
            }
          }
          return {
            ...squad,
            colaboradores: squad.colaboradores.map((colaborador) => ({ ...colaborador })),
          }
        }),
      }))
      persistOrganograma(next)
      if (targetSquadName !== sourceSquadName) {
        setSquadSelecionada(targetSquadName)
        resetSquadPeriod()
      }
      return next
    })
  }

  function exitDemo() {
    signOut()
    navigate('/login', { replace: true })
  }

  async function handleExportAllHours() {
    setIsExporting(true)
    setExportError(null)
    try {
      await exportGeneralHoursReport({ organograma: organogramaAtual, mesSelecionado, anoSelecionado })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o relatório geral.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportSelectedSquadHours() {
    if (!selectedSquad) return
    setIsExporting(true)
    setExportError(null)
    try {
      await exportSquadHoursReport({
        organograma: organogramaAtual,
        squadName: selectedSquad.nome,
        mesSelecionado: squadMesSelecionado,
        anoSelecionado: squadAnoSelecionado,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o relatório da equipe.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="sticky top-0 z-40 flex h-20 w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-header)] px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <BrandMark variant="compact" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-secondary)]">SM&A - Gerenciamento de Equipes</p>
            <p className="text-sm text-[var(--color-text-muted)]">Organograma editável e movimentação de colaboradores</p>
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">Estrutura DEP</p>
                  <h1 className="mt-2 text-3xl font-extrabold text-[var(--color-text)]">SM&A - Gerenciamento de Equipes</h1>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">Gerencie colaboradores, cargos e transferências entre squads.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Mês
                    <select
                      value={mesSelecionado}
                      onChange={(event) => setMesSelecionado(Number(event.target.value))}
                      className="mt-1 w-full min-w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    >
                      {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Ano
                    <select
                      value={anoSelecionado}
                      onChange={(event) => setAnoSelecionado(Number(event.target.value))}
                      className="mt-1 w-full min-w-28 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    >
                      {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleExportAllHours}
                    disabled={isExporting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-[#06241f] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-[10px] font-black text-[#06241f]">XL</span>
                    Exportar Horas (Geral)
                  </button>
                </div>
              </div>
            </section>

            {exportError && (
              <div role="alert" className="rounded-2xl border border-[var(--color-danger)] bg-[var(--color-surface)] p-4 text-sm font-semibold text-[var(--color-danger)]">
                {exportError}
              </div>
            )}

            <section className="space-y-5" aria-labelledby="dep-org-title">
              <div>
                <h2 id="dep-org-title" className="text-xl font-extrabold text-[var(--color-text)]">Organograma de Equipes (DEP)</h2>
              </div>
              <div className="flex flex-col gap-6 md:flex-row">
                <aside className="md:w-72 md:shrink-0" aria-label="Squads do DEP">
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Squads</p>
                    <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                      {getSquads(dadosOrganograma).toSorted((a, b) => getSquadNumber(a.nome) - getSquadNumber(b.nome)).map((squad) => {
                        const isActive = squadSelecionada === squad.nome
                        return (
                          <button
                            key={`${squad.gerente}-${squad.nome}`}
                            type="button"
                            onClick={() => handleSquadSelection(squad.nome)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              isActive
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                                : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
                            }`}
                          >
                            <span className={`block text-sm font-extrabold ${isActive ? 'text-white' : ''}`}>{squad.nome}</span>
                            <span className={`mt-1 block text-xs ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}>{squad.supervisor}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </aside>

                <section className="min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                    {selectedSquad ? (
                      <>
                        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Equipe selecionada</p>
                            <h3 className="mt-1 text-2xl font-extrabold text-[var(--color-text)]">{selectedSquad.nome}</h3>
                            <p className="mt-1 text-sm font-bold text-[var(--color-primary)]">Supervisor: {selectedSquad.supervisor}</p>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Mês
                              <select
                                value={squadMesSelecionado}
                                onChange={(event) => setSquadMesSelecionado(Number(event.target.value))}
                                className="mt-1 w-full min-w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              >
                                {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                              </select>
                            </label>
                            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Ano
                              <select
                                value={squadAnoSelecionado}
                                onChange={(event) => setSquadAnoSelecionado(Number(event.target.value))}
                                className="mt-1 w-full min-w-28 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              >
                                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                              </select>
                            </label>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              <p className="text-sm text-[var(--color-text-muted)]">{selectedSquad.colaboradores.length} colaborador(es)</p>
                              <button
                                type="button"
                                onClick={handleExportSelectedSquadHours}
                                disabled={isExporting}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-bold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-navigation-active-detail)] text-[10px] font-black text-[var(--color-primary)]">XL</span>
                                Exportar Horas da Equipe
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {selectedSquad.colaboradores.map((colaborador) => (
                          <EditableCollaboratorCard
                            key={`${selectedSquad.nome}-${colaborador.nome}`}
                            colaborador={colaborador}
                            squadName={selectedSquad.nome}
                            squadOptions={squadOptions}
                            onSave={(originalName, updated, targetSquadName) => handleSaveCollaborator(selectedSquad.nome, originalName, updated, targetSquadName)}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">
                      Nenhuma squad encontrada no organograma.
                    </div>
                  )}
                </section>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
