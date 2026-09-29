import type { Configuration, PopupRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID?.trim() ?? ''
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID?.trim() ?? ''

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
