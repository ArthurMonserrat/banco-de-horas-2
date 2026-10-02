import { useEffect, useState, type ReactNode } from 'react'
import { demoSessionService } from '../../services/demoSessionService'
import { demoCollaborator } from '../../mocks/demoData'
import { PROFILE_UPDATED_EVENT, profileService } from '../../services/profileService'
import { SessionContext } from './sessionContext'
import type { DemoRole, DemoSession } from './types'
import type { CollaboratorProfile } from '../profile/types'

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null)
  const [profile, setProfile] = useState<CollaboratorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSession(demoSessionService.restore())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      if (session?.role !== 'COLLABORATOR') {
        setProfile(null)
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
    const created = demoSessionService.signIn(role)
    setSession(created)
    return created
  }
  const signOut = () => {
    demoSessionService.signOut()
    setSession(null)
    setProfile(null)
  }

  return <SessionContext.Provider value={{ session, profile, isLoading, signIn, signOut }}>{children}</SessionContext.Provider>
}
