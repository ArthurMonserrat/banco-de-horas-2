import { createContext } from 'react'
import type { CollaboratorProfile } from '../../shared/types/domain'
import type { DemoRole, DemoSession } from './types'

export type DemoSignIn = (role: DemoRole) => DemoSession

export type SessionContextValue = {
  session: DemoSession | null
  profile: CollaboratorProfile | null
  isLoading: boolean
  signIn: DemoSignIn
  signOut: () => void
}

export const SessionContext = createContext<SessionContextValue | undefined>(undefined)
