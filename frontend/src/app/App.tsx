import { HashRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { OnboardingTour } from '../components/OnboardingTour'
import { useOfflineAutoSync } from '../hooks/useOfflineQueue'

export function App() {
  useOfflineAutoSync()

  return (
    <HashRouter>
      <OnboardingTour />
      <AppRoutes />
    </HashRouter>
  )
}
