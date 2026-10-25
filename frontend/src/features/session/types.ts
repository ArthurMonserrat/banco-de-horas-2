export type DemoRole = 'COLLABORATOR' | 'SUPERVISOR' | 'DIRECTOR_ADMIN'

/** demo = perfis de demonstração (só em teste/desenvolvimento); ecosystem = login Microsoft do Ecossistema SM&A. */
export type SessionAuthProvider = 'demo' | 'ecosystem'

export type DemoSession = {
  id: string
  name: string
  role: DemoRole
  createdAt: string
  explicitLoginAt: string
  isDemo: boolean
  version: 2
  email?: string
  authProvider?: SessionAuthProvider
}
