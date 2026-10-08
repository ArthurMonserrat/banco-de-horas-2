import type { SupervisorPendingEntry } from './types'

export type HistoryStatusFilter = 'ALL' | SupervisorPendingEntry['status']

export type SupervisorHistoryFilters = {
  technician: string
  project: string
  startDate: string
  endDate: string
  status: HistoryStatusFilter
}

export function filterSupervisorHistoryEntries(
  entries: SupervisorPendingEntry[],
  filters: SupervisorHistoryFilters,
) {
  const technician = filters.technician.trim().toLocaleLowerCase('pt-BR')

  return entries.filter((entry) => {
    const matchesTechnician = !technician || entry.collaboratorName.toLocaleLowerCase('pt-BR').includes(technician)
    const matchesProject = filters.project === 'Todos' || !filters.project || entry.projectCode === filters.project
    const matchesStartDate = !filters.startDate || entry.entryDate >= filters.startDate
    const matchesEndDate = !filters.endDate || entry.entryDate <= filters.endDate
    const matchesStatus = filters.status === 'ALL' || entry.status === filters.status

    return matchesTechnician && matchesProject && matchesStartDate && matchesEndDate && matchesStatus
  })
}
