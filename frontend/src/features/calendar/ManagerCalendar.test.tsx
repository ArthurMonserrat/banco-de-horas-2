// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManagerCalendar } from './ManagerCalendar'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function selectByLabel(label: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
  expect(element).toBeDefined()
  return element!
}

function optionLabels(select: HTMLSelectElement) {
  return [...select.options].map((option) => option.textContent)
}

describe('ManagerCalendar cascade filters', () => {
  it('reseta o colaborador e filtra técnicos pela supervisão selecionada', () => {
    act(() => {
      root.render(
        <ManagerCalendar
          entries={[]}
          role="DIRECTOR_ADMIN"
          supervisors={[
            { id: 'squad-campo', name: 'Supervisora Campo' },
            { id: 'squad-estudos', name: 'Supervisor Estudos' },
          ]}
          collaborators={[
            { id: 'ana', name: 'Técnica Ana', supervisorId: 'squad-campo' },
            { id: 'bruno', name: 'Técnico Bruno', supervisorId: 'squad-campo' },
            { id: 'carla', name: 'Técnica Carla', supervisorId: 'squad-estudos' },
          ]}
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />,
      )
    })

    const collaboratorSelect = selectByLabel('Colaborador')
    expect(optionLabels(collaboratorSelect)).toEqual(['Todos da equipe', 'Técnica Ana', 'Técnico Bruno', 'Técnica Carla'])

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(collaboratorSelect, 'ana')
      collaboratorSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(collaboratorSelect.value).toBe('ana')

    const supervisorSelect = selectByLabel('Selecione a Supervisão')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(supervisorSelect, 'squad-estudos')
      supervisorSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const updatedCollaboratorSelect = selectByLabel('Colaborador')
    expect(updatedCollaboratorSelect.value).toBe('Todos')
    expect(optionLabels(updatedCollaboratorSelect)).toEqual(['Todos da equipe', 'Técnica Carla'])
  })
})
