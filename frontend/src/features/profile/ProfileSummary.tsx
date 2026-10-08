import { formatMinutes } from '../time-entries/domain'
import type { CollaboratorProfile } from './types'
import type { AssignmentSnapshot } from '../squads/types'
import type { WorkloadVersion } from '../workloads/types'

type ProfileSummaryProps = {
  profile: CollaboratorProfile
  assignment: AssignmentSnapshot | null
  currentWorkload: WorkloadVersion | null
}

export function ProfileSummary({ profile, assignment, currentWorkload }: ProfileSummaryProps) {
  const items = [
    ['Nome', profile.name],
    ['E-mail', profile.email],
    ['Cargo', profile.jobTitle],
    ['Status', profile.active ? 'Ativo' : 'Inativo'],
    ['Squad atual', assignment?.squadName ?? 'Não definida'],
    ['Supervisor responsável', assignment?.supervisorName ?? 'Não definido'],
    ['Carga diária vigente', currentWorkload ? formatMinutes(currentWorkload.dailyMinutes) : 'Não cadastrada'],
  ]

  return (
    <section className="space-y-4" aria-label="Resumo dos dados profissionais">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl ui-surface-subtle p-4">
            <dt className="text-xs font-bold uppercase tracking-wider ui-text-subtle">{label}</dt>
            <dd className="mt-2 break-words font-bold ui-heading">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-xl border ui-callout-secondary p-4 text-sm ui-text">
        Use "Editar Perfil" para atualizar nome, e-mail, cargo e squad. O status segue controlado pela empresa.
      </p>
    </section>
  )
}
