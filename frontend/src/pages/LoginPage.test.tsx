import { isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeContext } from '../app/themeContext'
import { msalConfig } from '../config/msalConfig'
import { SessionContext, type SessionContextValue } from '../features/session/sessionContext'
import { LoginPage, LoginPageContent } from './LoginPage'

function renderLogin() {
  const msalInstance = new PublicClientApplication(msalConfig)
  const value: SessionContextValue = {
    session: null,
    profile: null,
    isLoading: false,
    signIn: vi.fn() as SessionContextValue['signIn'],
    signOut: vi.fn(),
  }

  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/login']}>
      <MsalProvider instance={msalInstance}>
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
          <SessionContext.Provider value={value}>
            <LoginPage />
          </SessionContext.Provider>
        </ThemeContext.Provider>
      </MsalProvider>
    </MemoryRouter>,
  )
}

function findButtons(node: ReactNode): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[] {
  if (Array.isArray(node)) return node.flatMap(findButtons)
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  const current = node.type === 'button'
    ? [node as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>]
    : []
  return [...current, ...findButtons(node.props.children)]
}

describe('LoginPage', () => {
  it('explica o acesso corporativo e exibe apenas o login Microsoft', () => {
    const markup = renderLogin()

    expect(markup).toContain('Banco de horas 2: Campo e Estudos')
    expect(markup).toContain('Acesse o sistema pelo perfil adequado ao seu fluxo de trabalho.')
    expect(markup).toContain('alt="SM&amp;A — Sistemas Elétricos e Automação"')
    expect(markup).toMatch(/Entrar com Microsoft|Processando autenticação\.\.\./)
    expect(markup).not.toContain('Entrar como Colaborador')
    expect(markup).not.toContain('Entrar como Supervisor')
    expect(markup).not.toContain('Entrar como Diretor/Administração')
    expect(markup.match(/<img/g) ?? []).toHaveLength(1)
    expect(markup).not.toMatch(/type="password"|Microsoft Login/i)
  })

  it('dispara o login corporativo ao clicar no botão Microsoft', () => {
    const handleLogin = vi.fn()
    const content = LoginPageContent({ handleLogin, authError: null })
    const button = findButtons(content).find((item) => String(item.props.children) === 'Entrar com Microsoft')

    expect(button).toBeDefined()
    button?.props.onClick?.({} as never)
    expect(handleLogin).toHaveBeenCalledOnce()
  })
})
