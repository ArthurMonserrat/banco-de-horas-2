import type { Configuration, PopupRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID?.trim() ?? ''
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID?.trim() ?? ''

export function getMsalConfigurationError(configuredClientId: string, configuredTenantId: string) {
  const missing = [
    !configuredClientId && 'VITE_MSAL_CLIENT_ID',
    !configuredTenantId && 'VITE_MSAL_TENANT_ID',
  ].filter(Boolean)
  return missing.length > 0
    ? `Configuração Microsoft incompleta. Preencha: ${missing.join(', ')}.`
    : null
}

export const msalConfigurationError = getMsalConfigurationError(clientId, tenantId)
export const isMsalConfigured = msalConfigurationError === null

if (msalConfigurationError) {
  console.error(`[MSAL] ${msalConfigurationError}`)
}

function resolveRedirectUri() {
  if (typeof window === 'undefined') return '/'

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  if (isLocalhost) return '/'

  return new URL(import.meta.env.BASE_URL || '/banco-de-horas-2/', window.location.origin).toString()
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: resolveRedirectUri(),
  },
  cache: {
    cacheLocation: 'localStorage',
  },
}

export const loginRequest: PopupRequest = {
  scopes: ['User.Read'],
}
