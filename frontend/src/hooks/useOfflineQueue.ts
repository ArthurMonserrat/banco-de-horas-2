import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { isMsalConfigured, loginRequest } from '../config/msalConfig'
import { ApiRequestError, backendApi, getApiSessionToken } from '../services/api'
import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  offlineQueueService,
  type OfflineQueueItem,
} from '../services/offlineQueueService'
import { useNetworkStatus } from './useNetworkStatus'

function readQueue() {
  return offlineQueueService.list()
}

const SESSION_EXPIRED_MESSAGE = 'A sua sessão expirou. Por favor, faça login novamente para sincronizar os dados.'
const REAUTH_MESSAGE = 'A sua sessão expirou. Confirme o seu login na janela da Microsoft para enviar os apontamentos.'

export type OfflineSyncOptions = {
  interactive?: boolean
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiRequestError && error.status === 401
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineQueueItem[]>(readQueue)

  useEffect(() => {
    const updateQueue = () => setQueue(readQueue())
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, updateQueue)
    window.addEventListener('storage', updateQueue)
    updateQueue()
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, updateQueue)
      window.removeEventListener('storage', updateQueue)
    }
  }, [])

  return queue
}

export function useOfflineAutoSync() {
  const { isOnline } = useNetworkStatus()
  const { instance, accounts, inProgress } = useMsal()
  const queue = useOfflineQueue()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const syncNow = useCallback(async ({ interactive = false }: OfflineSyncOptions = {}) => {
    if (!isOnline || isSyncing || offlineQueueService.list().length === 0) return
    setIsSyncing(true)
    setSyncError(null)
    let hasRetriedAfterLogin = false
    try {
      while (true) {
        let msalAuthenticationFailed = false
        try {
          let accessToken = getApiSessionToken() ?? ''
          const activeAccount = instance.getActiveAccount() ?? accounts[0]
          if (isMsalConfigured && activeAccount) {
            if (inProgress !== InteractionStatus.None) {
              setSyncError('A autenticação ainda está em andamento. Tente sincronizar novamente em instantes.')
              return
            }
            try {
              const tokenResponse = await instance.acquireTokenSilent({ ...loginRequest, account: activeAccount })
              if (!tokenResponse.accessToken) throw new Error('A Microsoft não devolveu um token de acesso válido.')
              accessToken = tokenResponse.accessToken
            } catch (error) {
              msalAuthenticationFailed = true
              throw error
            }
          }
          if (!accessToken.trim()) throw new Error('Token ausente. Sincronização interrompida.')
          await backendApi.validateSession(accessToken)
          const result = await offlineQueueService.sync(accessToken)
          if (result.remaining > 0) setSyncError('Ainda existem apontamentos aguardando sincronização.')
          return
        } catch (error) {
          const authenticationFailed = msalAuthenticationFailed || isUnauthorized(error)
          if (interactive && authenticationFailed && !hasRetriedAfterLogin && isMsalConfigured) {
            hasRetriedAfterLogin = true
            setSyncError(REAUTH_MESSAGE)
            try {
              const response = await instance.loginPopup(loginRequest)
              if (!response.account) throw new Error('O login Microsoft não devolveu uma conta válida.')
              instance.setActiveAccount(response.account)
              setSyncError(null)
              continue
            } catch (loginError) {
              console.error('Não foi possível concluir a reautenticação interativa para sincronizar a fila offline.', loginError)
            }
          }
          console.error('Sincronização manual interrompida antes de novos envios.', error)
          setSyncError(authenticationFailed ? SESSION_EXPIRED_MESSAGE : 'Não foi possível sincronizar os apontamentos pendentes.')
          return
        }
      }
    } finally {
      setIsSyncing(false)
    }
  }, [accounts, inProgress, instance, isOnline, isSyncing])

  useEffect(() => {
    if (!isOnline || queue.length === 0) return
    void syncNow()
  }, [isOnline, queue.length, syncNow])

  return { queue, isOnline, isSyncing, syncError, syncNow }
}
