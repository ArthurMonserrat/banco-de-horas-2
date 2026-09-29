import { organogramaDEP, type DEPColaborador, type DEPGerencia, type DEPSquad } from '../data/mockDEP'

export const ORGANOGRAMA_STORAGE_KEY = 'organograma_editavel_sma'

export type ManagerCalendarSupervisor = {
  id: string
  name: string
  squadName: string
}

export type ManagerCalendarCollaborator = {
  id: string
  name: string
  supervisorId: string
  squadName: string
}

export function cloneOrganograma(data: DEPGerencia[]) {
  return data.map((gerencia) => ({
    ...gerencia,
    squads: gerencia.squads.map((squad) => ({
      ...squad,
      colaboradores: squad.colaboradores.map((colaborador) => ({ ...colaborador })),
    })),
  }))
}

export function getSquads(data: DEPGerencia[]) {
  return data.flatMap((gerencia) => gerencia.squads.map((squad) => ({ ...squad, gerente: gerencia.gerente })))
}

export function getSquadNumber(squadName: string) {
  return Number.parseInt(squadName.match(/S(\d+)/)?.[1] || '0', 10)
}

export function getFirstSquadName(data: DEPGerencia[]) {
  return data[0]?.squads[0]?.nome ?? ''
}

export function findSquad(data: DEPGerencia[], squadName: string): DEPSquad | null {
  return getSquads(data).find((squad) => squad.nome === squadName) ?? null
}

export function isOrganograma(value: unknown): value is DEPGerencia[] {
  if (!Array.isArray(value)) return false
  return value.every((gerencia) => {
    if (!gerencia || typeof gerencia !== 'object') return false
    const item = gerencia as Record<string, unknown>
    return typeof item.gerente === 'string' && Array.isArray(item.squads)
  })
}

export function loadEditableOrganograma() {
  if (typeof window === 'undefined') return cloneOrganograma(organogramaDEP)
  try {
    const raw = window.localStorage.getItem(ORGANOGRAMA_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (isOrganograma(parsed)) return cloneOrganograma(parsed)
    }
  } catch {
    // Fallback to the official source below.
  }
  const initial = cloneOrganograma(organogramaDEP)
  window.localStorage.setItem(ORGANOGRAMA_STORAGE_KEY, JSON.stringify(initial))
  return initial
}

export function persistOrganograma(data: DEPGerencia[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ORGANOGRAMA_STORAGE_KEY, JSON.stringify(data))
}

export function createManagerCalendarTeamData(data: DEPGerencia[]) {
  const squads = getSquads(data).toSorted((left, right) => getSquadNumber(left.nome) - getSquadNumber(right.nome))
  return squads.reduce<{
    supervisors: ManagerCalendarSupervisor[]
    collaborators: ManagerCalendarCollaborator[]
  }>((result, squad) => {
    result.supervisors.push({
      id: squad.nome,
      name: squad.supervisor,
      squadName: squad.nome,
    })
    result.collaborators.push(...squad.colaboradores.map((colaborador: DEPColaborador) => ({
      id: colaborador.nome,
      name: colaborador.nome,
      supervisorId: squad.nome,
      squadName: squad.nome,
    })))
    return result
  }, { supervisors: [], collaborators: [] })
}
