import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { isMsalConfigured, loginRequest, msalConfigurationError } from '../config/msalConfig'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { canAccessDemoPath, getDemoHomePath } from '../features/session/routePolicy'
import { mapMicrosoftRoles } from '../features/session/microsoftAuth'
import { useSession } from '../features/session/useSession'

type LoginPageContentProps = {
  handleLogin: () => Promise<void>
  authError: string | null
  isAuthenticating?: boolean
}

export function LoginPageContent({ handleLogin, authError, isAuthenticating = false }: LoginPageContentProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 py-20 text-[var(--color-text)] sm:px-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <section className="w-full max-w-6xl" aria-labelledby="demo-login-title">
        <header className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
          <BrandMark variant="full" className="mb-7" />
          <p className="ui-badge-secondary">Banco de horas 2: Campo e Estudos</p>
          <h1 id="demo-login-title" className="mt-4 text-3xl font-extrabold text-[var(--color-primary)] sm:text-4xl">
            Escolha seu perfil
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
            Acesse o sistema pelo perfil adequado ao seu fluxo de trabalho. A autenticação corporativa pode ser usada quando configurada.
          </p>
          <button type="button" onClick={() => void handleLogin()} disabled={isAuthenticating} className="ui-button-secondary mt-6 disabled:cursor-wait disabled:opacity-60">
            {isAuthenticating ? 'Processando autenticação...' : 'Entrar com Microsoft'}
          </button>
          {authError && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-danger)]">{authError}</p>}
        </header>

      </section>
    </main>
  )
}

export function LoginPage() {
  const { signInMicrosoft } = useSession()
  const { instance, inProgress } = useMsal()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [authError, setAuthError] = useState<string | null>(null)

  async function handleLogin() {
    if (inProgress !== 'none') return
    setAuthError(null)
    if (!isMsalConfigured) {
      setAuthError(msalConfigurationError ?? 'Configure as credenciais da Microsoft antes de entrar.')
      return
    }
    try {
      const response = await instance.loginPopup(loginRequest)
      const account = response.account
      if (!account) throw new Error('A Microsoft não retornou uma conta válida.')
      if (!signInMicrosoft) throw new Error('O contexto de sessão Microsoft não está disponível.')
      instance.setActiveAccount(account)
      const role = mapMicrosoftRoles(account.idTokenClaims?.roles)
      signInMicrosoft({
        id: account.homeAccountId,
        name: account.name?.trim() || account.username,
        email: account.username,
        role,
      })
      const destination = typeof from === 'string' && canAccessDemoPath(role, from) ? from : getDemoHomePath(role)
      navigate(destination, { replace: true })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível autenticar com a Microsoft.')
    }
  }

  return <LoginPageContent handleLogin={handleLogin} authError={authError} isAuthenticating={inProgress !== 'none'} />
}
