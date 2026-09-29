export type InstallPromptVisibilityInput = {
  hasPrompt: boolean
  isStandalone: boolean
}

export function shouldShowInstallPrompt({ hasPrompt, isStandalone }: InstallPromptVisibilityInput) {
  return hasPrompt && !isStandalone
}

export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}
