import { useEffect, useState, type ReactNode } from 'react'
import { demoSessionService } from '../../services/demoSessionService'
import { demoCollaborator } from '../../mocks/demoData'
import { PROFILE_UPDATED_EVENT, profileService } from '../../services/profileService'
import { backendApi, clearApiSession, getStoredApiSession, saveApiSession, type ApiSession } from '../../services/api'
import { signOutMicrosoft } from '../../services/ecosystemLogin'
import { demoModeEnabled } from '../../config/ecosystemAuth'
import { SessionContext } from './sessionContext'
import { toEcosystemSession } from './ecosystemSession'
import type { DemoRole, DemoSession } from './types'
import type { CollaboratorProfile } from '../profile/types'

type ProviderProps = {
  children: ReactNode
  /** Injetável em testes. Em produção a demonstração fica desligada. */
  allowDemo?: boolean
}

export function DemoSessionProvider({ children, allowDemo = demoModeEnabled }: ProviderProps) {
  const [session, setSession] = useState<DemoSession | null>(null)
  const [profile, setProfile] = useState<CollaboratorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const demoSession = allowDemo ? demoSessionService.restore() : null
      if (demoSession) {
        if (!cancelled) { setSession(demoSession); setIsLoading(false) }
        return
      }
      // Sessão do Banco 2 aberta pelo login Microsoft: revalida no servidor (cargo e acesso atuais).
      const stored = getStoredApiSession()
      if (!stored) {
        if (!cancelled) setIsLoading(false)
        return
      }
      try {
        const { user } = await backendApi.validateSession(stored.token)
        const refreshed: ApiSession = { token: stored.token, user }
        saveApiSession(refreshed)
        if (!cancelled) setSession(toEcosystemSession(refreshed))
      } catch {
        clearApiSession()
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [allowDemo])

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      if (session?.role !== 'COLLABORATOR') {
        setProfile(null)
        return
      }
      if (session.authProvider === 'ecosystem') {
        // Login Microsoft: o perfil profissional é criado a partir da conta corporativa (nunca o de demonstração).
        try {
          const corporate = await profileService.ensureCorporateProfile({ id: session.id, name: session.name, email: session.email ?? '', jobTitle: 'Colaborador' })
          if (!cancelled) setProfile(corporate)
        } catch {
          if (!cancelled) setProfile(null)
        }
        return
      }
      const savedProfile = await profileService.getById(session.id)
      if (!cancelled) setProfile(savedProfile ?? demoCollaborator)
    }
    void loadProfile()
    const handleProfileUpdated = () => { void loadProfile() }
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    return () => {
      cancelled = true
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [session])

  const signIn = (role: DemoRole) => {
    if (!allowDemo) throw new Error('Perfis de demonstração desativados neste ambiente.')
    const created = demoSessionService.signIn(role)
    setSession(created)
    return created
  }

  const signInWithBanco2Session = (apiSession: ApiSession) => {
    const created = toEcosystemSession(apiSession)
    if (!created) throw new Error('Sessão do Banco 2 inválida.')
    saveApiSession(apiSession)
    setSession(created)
    return created
  }

  const signOut = () => {
    demoSessionService.signOut()
    clearApiSession()
    void signOutMicrosoft()
    setSession(null)
    setProfile(null)
  }

  return <SessionContext.Provider value={{ session, profile, isLoading, signIn, signOut, signInWithBanco2Session }}>{children}</SessionContext.Provider>
}
