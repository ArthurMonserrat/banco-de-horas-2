import type { ReportRow } from '../../services/reportService'

export type DirectorHistoryStatusFilter = 'ALL' | ReportRow['status']

export type DirectorHistoryFilters = {
  supervisor: string
  collaborator: string
  project: string
  startDate: string
  endDate: string
  status: DirectorHistoryStatusFilter
}

export function filterDirectorHistoryRows(rows: ReportRow[], filters: DirectorHistoryFilters) {
  const collaborator = filters.collaborator.trim().toLocaleLowerCase('pt-BR')

  return rows.filter((row) => {
    const matchesSupervisor = filters.supervisor === 'Todos' || !filters.supervisor || row.supervisor === filters.supervisor
    const matchesCollaborator = !collaborator || row.collaborator.toLocaleLowerCase('pt-BR').includes(collaborator)
    const matchesProject = filters.project === 'Todos' || !filters.project || row.project === filters.project
    const matchesStartDate = !filters.startDate || row.date >= filters.startDate
    const matchesEndDate = !filters.endDate || row.date <= filters.endDate
    const matchesStatus = filters.status === 'ALL' || row.status === filters.status
    return matchesSupervisor && matchesCollaborator && matchesProject && matchesStartDate && matchesEndDate && matchesStatus
  })
}
