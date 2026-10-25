import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { canAccessDemoPath, getDemoHomePath } from '../features/session/routePolicy'
import type { SessionContextValue } from '../features/session/sessionContext'
import type { DemoRole } from '../features/session/types'
import { useSession } from '../features/session/useSession'
import { demoModeEnabled, getEcosystemAuthConfig } from '../config/ecosystemAuth'
import { isEcosystemLoginConfigured, startMicrosoftLogin } from '../services/ecosystemLogin'

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

const appLogo = `${import.meta.env.BASE_URL}logo.png`

type LoginPageContentProps = {
  from: unknown
  signIn: SessionContextValue['signIn']
  authError: string | null
  navigate: NavigateFunction
  /** Mostra os perfis de demonstração (só em teste/desenvolvimento). */
  showDemo?: boolean
  /** Login Microsoft do Ecossistema; ausente = não configurado neste ambiente. */
  onMicrosoftLogin?: () => void
  isStartingMicrosoftLogin?: boolean
  ecosystemUrl?: string | null
}

export function LoginPageContent({ from, signIn, authError, navigate, showDemo = true, onMicrosoftLogin, isStartingMicrosoftLogin = false, ecosystemUrl = null }: LoginPageContentProps) {
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
          <BrandMark variant="full" src={appLogo} transparent className="mb-7" />
          <p className="ui-badge-secondary">Banco de horas 2: Campo e Estudos</p>
          <h1 id="demo-login-title" className="mt-4 text-3xl font-extrabold text-[var(--color-primary)] sm:text-4xl">
            {showDemo ? 'Escolha seu perfil' : 'Entrar no Banco de Horas 2'}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
            {showDemo ? 'Acesse o sistema pelo perfil adequado ao seu fluxo de trabalho.' : 'Use sua conta Microsoft corporativa para continuar.'}
          </p>
        </header>

        <section className="ui-card mx-auto mb-8 flex max-w-xl flex-col items-center rounded-2xl p-6 text-center" aria-labelledby="microsoft-login-title">
          <h2 id="microsoft-login-title" className="text-lg font-extrabold text-[var(--color-text)]">Acesso corporativo</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">Entre com a mesma conta Microsoft da SM&amp;A usada no Ecossistema. Seu cargo e seu acesso ao Banco 2 são definidos pela Administração.</p>
          <button type="button" onClick={onMicrosoftLogin} disabled={!onMicrosoftLogin || isStartingMicrosoftLogin} className="ui-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60">
            {isStartingMicrosoftLogin ? 'Abrindo login Microsoft...' : onMicrosoftLogin ? 'Entrar com Microsoft' : 'Login Microsoft não configurado'}
          </button>
          {ecosystemUrl && <a href={ecosystemUrl} className="mt-3 text-sm font-semibold text-[var(--color-primary)] underline">Voltar ao Ecossistema SM&amp;A</a>}
        </section>

        {showDemo && <div className="grid gap-5 md:grid-cols-3">
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
        </div>}
        {authError && <p role="alert" className="mx-auto mt-6 max-w-2xl text-center text-sm font-semibold text-[var(--color-danger)]">{authError}</p>}
      </section>
    </main>
  )
}

export function LoginPage() {
  const { signIn } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = (location.state as { from?: unknown } | null)?.from
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = isEcosystemLoginConfigured()
  const ecosystemUrl = getEcosystemAuthConfig().ecosystemUrl
  const callbackError = searchParams.get('erro')

  async function loginWithMicrosoft() {
    setError(null)
    setIsStarting(true)
    const result = await startMicrosoftLogin()
    if (result.error) {
      setError(result.error)
      setIsStarting(false)
    }
  }

  // Vindo do Ecossistema (#/login?auto=1): abre o login Microsoft direto, sem clique extra.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!configured || autoStarted.current || searchParams.get('auto') !== '1') return
    autoStarted.current = true
    void loginWithMicrosoft()
  }, [configured, searchParams])

  return (
    <LoginPageContent
      from={from}
      signIn={signIn}
      authError={error ?? callbackError}
      navigate={navigate}
      showDemo={demoModeEnabled}
      onMicrosoftLogin={configured ? () => void loginWithMicrosoft() : undefined}
      isStartingMicrosoftLogin={isStarting}
      ecosystemUrl={ecosystemUrl}
    />
  )
}
