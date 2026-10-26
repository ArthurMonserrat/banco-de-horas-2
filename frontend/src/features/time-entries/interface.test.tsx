import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { HistoryFilters } from '../history/HistoryFilters'
import { SessionContext } from '../session/sessionContext'
import { CreateRdoButton } from '../rdo/CreateRdoButton'
import { demoCollaborator } from '../../mocks/demoData'
import type { HistoryFiltersValue } from '../history/useTimeEntryHistory'
import { TimeEntryFields } from './TimeEntryFields'
import { TimeEntryForm } from './TimeEntryForm'
import type { TimeEntryFormValues } from './useTimeEntryForm'

const values: TimeEntryFormValues = {
  startDate: '2026-07-20', endDate: '2026-07-20', weekdaysOnly: true, emObra: false, numeroObra: '', clientId: '', projectCode: '', activityId: '', disciplineCode: 'C',
  hours: '', minutes: '', startTime: '', endTime: '', isHoliday: false, hasOvertime: false, overtimeHours: '', overtimeMinutes: '', hasNightHours: false, nightHours: '', nightMinutes: '', hasPartialDayOff: false, partialDayOffHours: '', partialDayOffMinutes: '', details: '', funcaoContrato: '', numeroContrato: '', editReason: '',
}

const filters: HistoryFiltersValue = {
  mode: 'MONTH', day: '2026-07-20', month: '2026-07', startDate: '2026-07-01', endDate: '2026-07-20',
  clientId: '', projectCode: '', activityId: '', disciplineCode: '', status: 'ACTIVE',
}

describe('markup acessível de apontamentos e histórico', () => {
  it('associa labels aos campos obrigatórios e limita a data ao dia corporativo', () => {
    const markup = renderToStaticMarkup(<TimeEntryFields values={values} errors={{}} maxDate="2026-07-20" extractedRdoDays={[]} onRdoDaysChange={vi.fn()} onChange={vi.fn()} />)
    expect(markup).toContain('for="entry-start-date"')
    expect(markup).toContain('for="entry-end-date"')
    expect(markup).toContain('max="2026-07-20"')
    expect(markup).toContain('for="client"')
    expect(markup).toContain('for="project-code"')
    expect(markup).toContain('for="discipline"')
    expect(markup).toContain('C – Campo')
    expect(markup).not.toContain('Tipo de documento')
  })

  it('preserva o texto do número do projeto e exibe atividades corporativas no modo manual', () => {
    const markup = renderToStaticMarkup(<TimeEntryFields values={values} errors={{}} maxDate="2026-07-20" extractedRdoDays={[]} onRdoDaysChange={vi.fn()} onChange={vi.fn()} />)
    expect(markup).toContain('Número do projeto / obra')
    expect(markup).toContain('Férias ou não prestação de serviço')
    expect(markup).toContain('ASO, Treinamento interno ou evento coorporativo')
    expect(markup).toContain('Se a data final for diferente')
    expect(markup).not.toContain('Avanço')
    expect(markup).not.toContain('Documento (LD)')
  })

  it('renderiza a função contratual conforme a EAP logo após o detalhamento', () => {
    const markup = renderToStaticMarkup(
      <SessionContext.Provider value={{ session: null, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
        <MemoryRouter>
          <TimeEntryForm />
        </MemoryRouter>
      </SessionContext.Provider>,
    )
    expect(markup).toContain('Função do profissional de acordo com o contrato do cliente final')
    expect(markup).toContain('Preencher a categoria conforme EAP do plano de trabalho do cliente final ou instrução do gestor.')
    expect(markup.indexOf('Detalhamento das atividades')).toBeLessThan(markup.indexOf('Função do profissional de acordo com o contrato do cliente final'))
  })

  it('usa o mesmo campo para número do projeto e da obra no modo RDO', () => {
    const markup = renderToStaticMarkup(<TimeEntryFields values={{ ...values, emObra: true }} errors={{}} maxDate="2026-07-20" entryMode="rdo" extractedRdoDays={[]} onRdoDaysChange={vi.fn()} onChange={vi.fn()} />)
    expect(markup).toContain('for="project-code"')
    expect(markup).toContain('Número do projeto / obra')
    expect(markup).toContain('Serviços em campo')
    expect(markup).not.toContain('for="work-site-number"')
  })

  it('oferece filtros de período e dados individuais com labels', () => {
    const markup = renderToStaticMarkup(<HistoryFilters value={filters} onChange={vi.fn()} onApply={vi.fn()} />)
    expect(markup).toContain('aria-label="Filtros do histórico"')
    expect(markup).toContain('for="history-mode"')
    expect(markup).toContain('for="history-client"')
    expect(markup).toContain('for="history-project"')
    expect(markup).not.toContain('for="history-document-type"')
    expect(markup).toContain('Situação do apontamento')
    expect(markup).toContain('Somente ativos')
    expect(markup).toContain('Somente cancelados')
    expect(markup).not.toContain('Exibição paginada')
  })

  it('nomeia a confirmação de cancelamento sem usar alert do navegador', () => {
    const markup = renderToStaticMarkup(<ConfirmDialog open title="Cancelar apontamento?" description="Confirme a operação" confirmLabel="Confirmar" onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Cancelar apontamento?')
  })

  it('oferece exportação separada do RDO em PDF e Word', () => {
    const markup = renderToStaticMarkup(
      <SessionContext.Provider value={{ session: null, profile: demoCollaborator, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
        <CreateRdoButton values={values} />
      </SessionContext.Provider>,
    )
    expect(markup).toContain('Gerar RDO (PDF)')
    expect(markup).toContain('Gerar RDO (Word)')
  })
})
