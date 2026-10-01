export type DemoRole = 'COLLABORATOR' | 'SUPERVISOR' | 'DIRECTOR_ADMIN'

export type DemoSession = {
  id: string
  name: string
  email?: string
  role: DemoRole
  createdAt: string
  explicitLoginAt: string
  isDemo: true
  authProvider?: 'demo' | 'microsoft'
  version: 2
}
