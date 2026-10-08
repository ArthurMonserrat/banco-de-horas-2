import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { demoAssignmentSnapshot, demoCollaborator, demoSquads, demoWorkloadVersions } from '../../mocks/demoData'
import { ProfileSummary } from './ProfileSummary'
import { SquadSelector } from './SquadSelector'
import { WorkloadHistory } from '../workloads/WorkloadHistory'
import { WorkloadRequestForm } from '../workloads/WorkloadRequestForm'
import { PerfilPage } from '../../pages/PerfilPage'

const { useProfileMock } = vi.hoisted(() => ({ useProfileMock: vi.fn() }))

vi.mock('../collaborator/useProfile', () => ({ useProfile: useProfileMock }))

describe('interface de perfil profissional', () => {
  it('exibe status, squad, supervisor e carga vigente sem o campo de localização', () => {
    const markup = renderToStaticMarkup(<ProfileSummary profile={demoCollaborator} assignment={demoAssignmentSnapshot} currentWorkload={demoWorkloadVersions[0]} />)
    for (const text of ['Ativo', 'Engenharia de Automação', 'Jeen Carlos E. Azevedo', '08:00']) expect(markup).toContain(text)
    expect(markup).not.toContain('Localização')
    expect(markup).toContain('Use &quot;Editar Perfil&quot;')
    expect(markup).toContain('O status segue controlado pela empresa')
    expect(markup.match(/Dados profissionais/g)).toBeNull()
  })

  it('permite escolher somente squad e informa que o supervisor é automático', () => {
    const markup = renderToStaticMarkup(<SquadSelector squads={demoSquads} activeSquadId="squad-automation" isSaving={false} onChange={vi.fn()} />)
    expect(markup).toContain('for="active-squad"')
    expect(markup).toContain('supervisor será definido automaticamente')
    expect(markup).not.toContain('Selecione o supervisor')
  })

  it('oferece solicitação de carga sem controles de aprovação', () => {
    const markup = renderToStaticMarkup(<WorkloadRequestForm hours="" minutes="" effectiveFrom="" justification="" minDate="2026-07-20" isSubmitting={false} onFieldChange={vi.fn()} onSubmit={vi.fn()} />)
    expect(markup).toContain('Nova carga diária')
    expect(markup).toContain('for="workload-justification"')
    expect(markup).not.toContain('Aprovar solicitação')
  })

  it('mantém histórico de versões separado de solicitações', () => {
    const markup = renderToStaticMarkup(<WorkloadHistory versions={demoWorkloadVersions} requests={[]} />)
    expect(markup).toContain('Histórico de cargas')
    expect(markup).toContain('Solicitações de alteração')
  })

  it('renderiza a captura de assinatura para um perfil legado sem assinatura', () => {
    useProfileMock.mockReturnValue({
      data: {
        profile: demoCollaborator,
        assignment: demoAssignmentSnapshot,
        squads: demoSquads,
        workloadVersions: demoWorkloadVersions,
        workloadRequests: [],
        currentWorkload: demoWorkloadVersions[0],
      },
      isLoading: false,
      error: null,
      isSaving: false,
      reload: vi.fn(),
      updateProfile: vi.fn(),
      changeSquad: vi.fn(),
      createInitialWorkload: vi.fn(),
      requestWorkloadChange: vi.fn(),
      saveSignature: vi.fn(),
    })

    const markup = renderToStaticMarkup(<PerfilPage />)

    expect(markup).toContain('Padrão de Assinatura')
    expect(markup).toContain('Limpar')
    expect(markup).toContain('Salvar Assinatura')
    expect(markup).toContain('<canvas')
    expect(markup).toContain(demoCollaborator.name)
  })
})
