import { useCallback, useEffect, useState } from 'react'
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
  const queue = useOfflineQueue()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing || offlineQueueService.list().length === 0) return
    setIsSyncing(true)
    setSyncError(null)
    try {
      const result = await offlineQueueService.sync()
      if (result.remaining > 0) setSyncError('Ainda existem apontamentos aguardando sincronização.')
    } catch {
      setSyncError('Não foi possível sincronizar os apontamentos pendentes.')
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing])

  useEffect(() => {
    if (!isOnline || queue.length === 0) return
    void syncNow()
  }, [isOnline, queue.length, syncNow])

  return { queue, isOnline, isSyncing, syncError, syncNow }
}
