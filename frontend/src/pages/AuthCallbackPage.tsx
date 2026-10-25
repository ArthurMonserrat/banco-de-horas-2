import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeMicrosoftLogin, readCallbackCode, type Banco2LoginResult } from '../services/ecosystemLogin'
import { getDemoHomePath } from '../features/session/routePolicy'
import { useSession } from '../features/session/useSession'

type AuthCallbackPageProps = {
  /** Injetável em testes. */
  completeLogin?: (code: string) => Promise<Banco2LoginResult>
  location?: Pick<Location, 'search' | 'hash'>
}

/** Retorno do login Microsoft: valida o acesso ao Banco 2 no servidor e entra na área do cargo. */
export function AuthCallbackPage({ completeLogin = completeMicrosoftLogin, location = window.location }: AuthCallbackPageProps) {
  const navigate = useNavigate()
  const { signInWithBanco2Session } = useSession()
  const [message, setMessage] = useState('Validando seu acesso ao Banco de Horas 2...')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = readCallbackCode(location.search, location.hash)
    if (!code) {
      navigate(`/login?erro=${encodeURIComponent('Retorno do login inválido. Tente novamente.')}`, { replace: true })
      return
    }
    void completeLogin(code).then((result) => {
      if (!result.ok) {
        setMessage(result.message)
        navigate(`/login?erro=${encodeURIComponent(result.message)}`, { replace: true })
        return
      }
      const session = signInWithBanco2Session?.(result.session)
      if (window.history?.replaceState) window.history.replaceState({}, '', `${window.location.pathname}#/`)
      navigate(session ? getDemoHomePath(session.role) : '/login', { replace: true })
    })
  }, [completeLogin, location, navigate, signInWithBanco2Session])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6 text-center text-[var(--color-text)]" aria-busy="true">
      <p role="status" className="font-semibold text-[var(--color-primary)]">{message}</p>
    </main>
  )
}
