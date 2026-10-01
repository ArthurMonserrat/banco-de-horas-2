import { describe, expect, it } from 'vitest'
import { getMsalConfigurationError } from './msalConfig'

describe('msalConfig', () => {
  it('identifica credenciais ausentes antes do login', () => {
    expect(getMsalConfigurationError('', '')).toContain('VITE_MSAL_CLIENT_ID')
    expect(getMsalConfigurationError('client-id', '')).toContain('VITE_MSAL_TENANT_ID')
    expect(getMsalConfigurationError('client-id', 'tenant-id')).toBeNull()
  })
})
