import type { DemoRole } from './types'

const DIRECTOR_ROLES = new Set(['admin', 'administrator', 'diretor', 'diretoria', 'diretor_administracao', 'administracao', 'director', 'director_admin'])
const SUPERVISOR_ROLES = new Set(['supervisor', 'supervisao', 'supervision'])

function normalizeRole(role: string) {
  return role.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[/\s-]+/g, '_')
}

export function mapMicrosoftRoles(roles: unknown): DemoRole {
  const values = Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : []
  const normalizedRoles = values.map(normalizeRole)
  if (normalizedRoles.some((role) => DIRECTOR_ROLES.has(role))) return 'DIRECTOR_ADMIN'
  if (normalizedRoles.some((role) => SUPERVISOR_ROLES.has(role))) return 'SUPERVISOR'
  return 'COLLABORATOR'
}
