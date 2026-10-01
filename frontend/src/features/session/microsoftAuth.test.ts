import { describe, expect, it } from 'vitest'
import { LocalDemoSessionService } from '../../services/demoSessionService'
import { mapMicrosoftRoles } from './microsoftAuth'

describe('microsoftAuth', () => {
  it.each([
    [['Admin'], 'DIRECTOR_ADMIN'],
    [['Diretor'], 'DIRECTOR_ADMIN'],
    [['Diretor/Administração'], 'DIRECTOR_ADMIN'],
    [['Supervisor'], 'SUPERVISOR'],
    [['user.read'], 'COLLABORATOR'],
    [undefined, 'COLLABORATOR'],
  ] as const)('mapeia claims %o para %s', (roles, expected) => {
    expect(mapMicrosoftRoles(roles)).toBe(expected)
  })

  it('persiste a identidade Microsoft com nome, email e perfil mapeado', () => {
    const values = new Map<string, string>()
    const service = new LocalDemoSessionService({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
    }, () => '2026-10-01T12:00:00.000Z')

    expect(service.signInWithMicrosoft({ id: 'home-1', name: 'Ana Silva', email: 'ana@sma.com', role: 'SUPERVISOR' })).toMatchObject({
      id: 'home-1',
      name: 'Ana Silva',
      email: 'ana@sma.com',
      role: 'SUPERVISOR',
      authProvider: 'microsoft',
    })
  })
})
