import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { isMsalConfigured, loginRequest } from '../config/msalConfig'
import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  offlineQueueService,
  type OfflineQueueItem,
} from '../services/offlineQueueService'
import { useNetworkStatus } from './useNetworkStatus'

function readQueue() {
  return offlineQueueService.list()
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

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing || offlineQueueService.list().length === 0) return
    setIsSyncing(true)
    setSyncError(null)
    try {
      let accessToken: string | undefined
      const activeAccount = instance.getActiveAccount() ?? accounts[0]
      if (isMsalConfigured && activeAccount) {
        if (inProgress !== InteractionStatus.None) return
        try {
          const tokenResponse = await instance.acquireTokenSilent({ ...loginRequest, account: activeAccount })
          if (!tokenResponse.accessToken) throw new Error('A Microsoft não devolveu um token de acesso válido.')
          accessToken = tokenResponse.accessToken
        } catch (error) {
          console.error('Não foi possível renovar a sessão Microsoft antes da sincronização offline.', error)
          setSyncError('A sua sessão expirou. Por favor, faça login novamente para sincronizar os dados.')
          return
        }
      }
      const result = await offlineQueueService.sync(accessToken)
      if (result.remaining > 0) setSyncError('Ainda existem apontamentos aguardando sincronização.')
    } catch {
      setSyncError('Não foi possível sincronizar os apontamentos pendentes.')
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
