import { useEffect, useState } from 'react'

function readOnlineStatus() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(readOnlineStatus)

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(readOnlineStatus())
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    updateOnlineStatus()
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  return { isOnline }
}
