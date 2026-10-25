// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ThemeContext } from '../app/themeContext'
import { SessionContext } from '../features/session/sessionContext'
import type { DemoSession } from '../features/session/types'
import { SupervisorPage } from './SupervisorPage'

vi.mock('../services/ecosystemLogin', () => ({ getEcosystemAuthUser: vi.fn(async () => null) }))

it('Meu Perfil do supervisor vem do login Microsoft, sem dados de demonstração', async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const session: DemoSession = {
    id: 'prisma-sup', name: 'maria.souza', email: 'maria.souza@sma-eng.com.br', role: 'SUPERVISOR',
    createdAt: '', explicitLoginAt: '', isDemo: false, version: 2, authProvider: 'ecosystem',
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <SessionContext.Provider value={{ session, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
          <MemoryRouter><SupervisorPage /></MemoryRouter>
        </SessionContext.Provider>
      </ThemeContext.Provider>,
    )
  })
  const profileButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Meu Perfil'))
  await act(async () => profileButton?.click())

  const panel = container.querySelector('[data-testid="corporate-identity-panel"]')
  expect(panel?.textContent).toContain('NomeMaria')
  expect(panel?.textContent).toContain('SobrenomeSouza')
  expect(panel?.textContent).toContain('maria.souza@sma-eng.com.br')
  expect(container.textContent).not.toContain('Jeen Carlos')
  act(() => root.unmount())
  vi.unstubAllGlobals()
})
