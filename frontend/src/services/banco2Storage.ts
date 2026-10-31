import { createBrowserStorage, type StorageLike } from './storage'

/**
 * Chaves de negócio que pertencem ao modo local legado do Banco 2.
 * A sessão autenticada, preferências visuais e onboarding ficam preservados.
 */
export const BANCO2_LOCAL_BUSINESS_STORAGE_KEYS = [
  'apontamentos_sma',
  'sma:time-entries:v1',
  'sma:time-entries:v2',
  'sma:time-entries:v3',
  '@sma_offline_queue',
] as const

export function clearBanco2LocalBusinessData(storage: StorageLike = createBrowserStorage()) {
  if (!storage.removeItem) return
  for (const key of BANCO2_LOCAL_BUSINESS_STORAGE_KEYS) storage.removeItem(key)
}
