// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext } from '../session/sessionContext'
import type { DemoSession } from '../session/types'
import { buildCorporateIdentity, nameFromEmail, splitFullName } from './corporateIdentity'
import { SwitchSystemButton } from '../../components/SwitchSystemButton'
import { DiretorPerfilPage } from '../../pages/DiretorPerfilPage'
import { directorNavigation } from '../../mocks/navigation'

vi.mock('../../services/ecosystemLogin', () => ({
  getEcosystemAuthUser: vi.fn(async () => ({
    id: 'auth-1', app_metadata: { provider: 'azure' }, user_metadata: {},
    created_at: '2026-10-20T14:30:00Z', last_sign_in_at: '2026-10-25T18:00:00Z',
  })),
}))

function session(overrides: Partial<DemoSession> = {}): DemoSession {
  return {
    id: 'prisma-1', name: 'Fernando Almeida', email: 'fernando.almeida@sma-eng.com.br', role: 'DIRECTOR_ADMIN',
    createdAt: '', explicitLoginAt: '', isDemo: false, version: 2, authProvider: 'ecosystem', ...overrides,
  }
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(value: DemoSession | null, element: React.ReactNode) {
  await act(async () => {
    root.render(
      <SessionContext.Provider value={{ session: value, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
        <MemoryRouter>{element}</MemoryRouter>
      </SessionContext.Provider>,
    )
  })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

describe('preenchimento automático do perfil (Banco 2)', () => {
  it('separa nome e sobrenome e deriva do e-mail quando não há nome real', () => {
    expect(splitFullName('Ana Maria Souza')).toEqual({ firstName: 'Ana', lastName: 'Maria Souza' })
    expect(nameFromEmail('joao.da.silva@sma-eng.com.br')).toBe('Joao da Silva')
    expect(buildCorporateIdentity({ name: 'pedro.xavier', email: 'pedro.xavier@sma-eng.com.br', role: 'COLLABORATOR' })).toMatchObject({
      firstName: 'Pedro', lastName: 'Xavier', initials: 'PX', roleLabel: 'Colaborador',
    })
  })

  it('Meu perfil da diretoria mostra os dados do login Microsoft', async () => {
    await render(session(), <DiretorPerfilPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('NomeFernando')
    expect(text).toContain('SobrenomeAlmeida')
    expect(text).toContain('fernando.almeida@sma-eng.com.br')
    expect(text).toContain('Diretoria')
    expect(text).toContain('Último acesso25/10/2026, 15:00')
  })

  it('a diretoria tem a aba Meu perfil abaixo de Avisos', () => {
    expect(directorNavigation.slice(-2).map((item) => item.label)).toEqual(['Avisos', 'Meu perfil'])
    expect(directorNavigation.at(-1)?.path).toBe('/administracao/perfil')
  })
})

describe('Trocar de sistema (Banco 2)', () => {
  it('volta para o Ecossistema para quem entrou pela Microsoft', async () => {
    await render(session(), <SwitchSystemButton ecosystemUrl="https://sma-apontamento-horas-murex.vercel.app/" />)
    const link = container.querySelector('a')
    expect(link?.textContent).toContain('Trocar de sistema')
    expect(link?.getAttribute('href')).toBe('https://sma-apontamento-horas-murex.vercel.app/')
  })

  it('não aparece em sessão de demonstração nem sem endereço do Ecossistema', async () => {
    await render(session({ authProvider: 'demo', isDemo: true }), <SwitchSystemButton ecosystemUrl="https://eco.vercel.app/" />)
    expect(container.querySelector('a')).toBeNull()
    await render(session(), <SwitchSystemButton ecosystemUrl={null} />)
    expect(container.querySelector('a')).toBeNull()
  })
})
