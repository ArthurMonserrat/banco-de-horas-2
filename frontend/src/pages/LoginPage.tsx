import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../config/msalConfig'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { canAccessDemoPath, getDemoHomePath } from '../features/session/routePolicy'
import type { SessionContextValue } from '../features/session/sessionContext'
import type { DemoRole } from '../features/session/types'
import { useSession } from '../features/session/useSession'

type DemoProfileCard = {
  role: DemoRole
  name: string
  description: string
  actionLabel: string
}

const DEMO_PROFILE_CARDS: readonly DemoProfileCard[] = [
  {
    role: 'COLLABORATOR',
    name: 'Colaborador',
    description: 'Apontamentos, saldos, histórico, ausências e perfil.',
    actionLabel: 'Entrar como Colaborador',
  },
  {
    role: 'SUPERVISOR',
    name: 'Supervisor',
    description: 'Equipes, aprovações e solicitações.',
    actionLabel: 'Entrar como Supervisor',
  },
  {
    role: 'DIRECTOR_ADMIN',
    name: 'Diretor/Administração',
    description: 'Visão administrativa e gerencial.',
    actionLabel: 'Entrar como Diretor/Administração',
  },
]

type LoginPageContentProps = {
  from: unknown
  signIn: SessionContextValue['signIn']
  handleLogin: () => Promise<void>
  authError: string | null
  navigate: NavigateFunction
}

export function LoginPageContent({ from, signIn, handleLogin, authError, navigate }: LoginPageContentProps) {
  const enterDemo = (role: DemoRole) => {
    const destination = typeof from === 'string' && canAccessDemoPath(role, from)
      ? from
      : getDemoHomePath(role)
    signIn(role)
    navigate(destination, { replace: true })
  }

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
          <button type="button" onClick={() => void handleLogin()} className="ui-button-secondary mt-6">
            Entrar com Microsoft
          </button>
          {authError && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-danger)]">{authError}</p>}
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {DEMO_PROFILE_CARDS.map((profile) => (
            <article key={profile.role} className="profile-card ui-card flex min-h-64 flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-secondary)]">
                Perfil de acesso
              </p>
              <h2 className="mt-3 text-xl font-extrabold text-[var(--color-text)]">{profile.name}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-[var(--color-text-muted)]">{profile.description}</p>
              <button type="button" onClick={() => enterDemo(profile.role)} className="ui-button-primary mt-6 w-full">
                {profile.actionLabel}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export function LoginPage() {
  const { signIn } = useSession()
  const { instance } = useMsal()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const [authError, setAuthError] = useState<string | null>(null)

  async function handleLogin() {
    setAuthError(null)
    try {
      const response = await instance.loginPopup(loginRequest)
      const account = response.account
      if (account) {
        window.localStorage.setItem('sma:microsoft-user:v1', JSON.stringify({
          name: account.name ?? account.username,
          email: account.username,
          homeAccountId: account.homeAccountId,
        }))
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível autenticar com a Microsoft.')
    }
  }

  return <LoginPageContent from={from} signIn={signIn} handleLogin={handleLogin} authError={authError} navigate={navigate} />
}
