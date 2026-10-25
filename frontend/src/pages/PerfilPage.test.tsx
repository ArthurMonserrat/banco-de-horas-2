// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { demoAssignmentSnapshot, demoCollaborator, demoSquads, demoWorkloadVersions } from '../mocks/demoData'
import type { useProfile } from '../features/collaborator/useProfile'
import { PerfilPage } from './PerfilPage'

const { useProfileMock } = vi.hoisted(() => ({ useProfileMock: vi.fn() }))
vi.mock('../features/profile/useCorporateIdentity', () => ({ useCorporateIdentity: () => null }))
vi.mock('../features/collaborator/useProfile', () => ({ useProfile: useProfileMock }))

const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
let container: HTMLDivElement
let root: Root
let state: ReturnType<typeof useProfile>
const clearRect = vi.fn()
const setTransform = vi.fn()

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect, fillRect: vi.fn(), scale: vi.fn(), beginPath: vi.fn(),
    arc: vi.fn(), moveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    setTransform,
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(signature)
  state = {
    data: {
      profile: { ...demoCollaborator }, assignment: demoAssignmentSnapshot,
      squads: demoSquads, workloadVersions: demoWorkloadVersions,
      workloadRequests: [], currentWorkload: demoWorkloadVersions[0],
    },
    isLoading: false, isSaving: false, error: null,
    reload: vi.fn(), updateProfile: vi.fn(), saveSignature: vi.fn(),
    changeSquad: vi.fn(), createInitialWorkload: vi.fn(), requestWorkloadChange: vi.fn(),
  }
  useProfileMock.mockImplementation(() => state)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<PerfilPage />))
  clearRect.mockClear()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function clickButton(label: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === label)
  expect(button).toBeDefined()
  await act(async () => button!.click())
}

function profileFields() {
  return [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[aria-labelledby="profile-edit-title"] input, [aria-labelledby="profile-edit-title"] select')]
}

function drawSignature() {
  const canvas = container.querySelector('canvas')!
  act(() => {
    for (const type of ['mousedown', 'mouseup']) {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 20, clientY: 20 })
      Object.defineProperty(event, 'which', { value: 1 })
      const target = type === 'mousedown' ? canvas : document
      target.dispatchEvent(event)
    }
  })
}

describe('PerfilPage signature regressions', () => {
  it('preserves all unsaved profile fields through a signature save and reload', async () => {
    await clickButton('Editar Perfil')
    const draft = ['Draft Name', 'draft@example.com', 'Draft Job', demoSquads.find((squad) => squad.id !== demoCollaborator.activeSquadId)!.id]
    act(() => {
      profileFields().forEach((field, index) => {
        const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, draft[index])
        field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
      })
    })
    expect(profileFields().map((field) => field.value)).toEqual(draft)
    drawSignature()
    let finishSave!: () => void
    vi.mocked(state.saveSignature).mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve }))
    await clickButton('Salvar Assinatura')
    expect(state.saveSignature).toHaveBeenCalledWith(signature)
    expect(state.updateProfile).not.toHaveBeenCalled()
    act(() => {
      state = { ...state, isLoading: true, isSaving: true }
      root.render(<PerfilPage />)
    })
    await act(async () => {
      state = { ...state, isLoading: false, isSaving: false, data: { ...state.data!, profile: { ...state.data!.profile, signatureBase64: signature } } }
      root.render(<PerfilPage />)
      finishSave()
    })
    expect(profileFields().map((field) => field.value)).toEqual(draft)
    expect(container.querySelector('img[alt="Assinatura atual"]')?.getAttribute('src')).toBe(signature)
    await clickButton('Salvar')
    expect(state.updateProfile).toHaveBeenCalledWith({ name: draft[0], email: draft[1], jobTitle: draft[2], activeSquadId: draft[3] })
  })

  it('keeps stable backing dimensions and remaps drawing coordinates after a responsive resize', async () => {
    const canvas = container.querySelector('canvas')!
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      width: 384, height: 96, top: 0, right: 384, bottom: 96, left: 0, x: 0, y: 0,
      toJSON: () => ({}),
    })
    drawSignature()
    setTransform.mockClear()
    act(() => window.dispatchEvent(new Event('resize')))
    expect(canvas.width).toBe(768)
    expect(canvas.height).toBe(192)
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(clearRect).not.toHaveBeenCalled()
    await clickButton('Salvar Assinatura')
    expect(state.saveSignature).toHaveBeenCalledWith(signature)
    await clickButton('Limpar')
    expect(clearRect).toHaveBeenCalled()
    await clickButton('Salvar Assinatura')
    expect(state.saveSignature).toHaveBeenCalledTimes(1)
  })
})
