import { usePwaInstallPrompt } from '../pwa/usePwaInstallPrompt'

export function InstallAppButton() {
  const { canInstall, promptInstall } = usePwaInstallPrompt()

  if (!canInstall) return null

  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="mb-3 w-full rounded-xl border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-surface)] px-4 py-3 text-left text-sm font-bold text-[var(--color-sidebar-text)] hover:bg-[var(--color-navigation-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)]"
    >
      Instalar Aplicativo
    </button>
  )
}
