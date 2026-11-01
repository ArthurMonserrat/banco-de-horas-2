import { describe, expect, it } from 'vitest'
import { clearBanco2LocalBusinessData } from './banco2Storage'
import type { StorageLike } from './storage'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('limpeza dos dados locais do Banco 2', () => {
  it('remove dados de negócio conhecidos sem apagar sessão, tema ou onboarding', () => {
    const storage = new MemoryStorage()
    storage.setItem('apontamentos_sma', 'entries')
    storage.setItem('@sma_offline_queue', 'queue')
    storage.setItem('sma:api-session:v1', 'session')
    storage.setItem('sma:theme', 'dark')
    storage.setItem('@sma-banco2:hasSeenTour', 'true')

    clearBanco2LocalBusinessData(storage)

    expect(storage.getItem('apontamentos_sma')).toBeNull()
    expect(storage.getItem('@sma_offline_queue')).toBeNull()
    expect(storage.getItem('sma:api-session:v1')).toBe('session')
    expect(storage.getItem('sma:theme')).toBe('dark')
    expect(storage.getItem('@sma-banco2:hasSeenTour')).toBe('true')
  })
})
