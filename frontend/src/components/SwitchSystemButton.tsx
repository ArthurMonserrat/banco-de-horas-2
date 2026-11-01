import { useSession } from '../features/session/useSession'
import { getEcosystemAuthConfig } from '../config/ecosystemAuth'

type SwitchSystemButtonProps = {
  /** Injetável em testes; em produção vem de VITE_ECOSYSTEM_URL. */
  ecosystemUrl?: string | null
  className?: string
}

/**
 * Volta para a tela do Ecossistema SM&A (escolha de banco) sem sair da conta Microsoft.
 * Aparece só para quem entrou pelo login do Ecossistema.
 */
export function SwitchSystemButton({ ecosystemUrl = getEcosystemAuthConfig().ecosystemUrl, className = '' }: SwitchSystemButtonProps) {
  const { session } = useSession()
  if (session?.authProvider !== 'ecosystem' || !ecosystemUrl) return null

  return (
    <a
      href={ecosystemUrl}
      className={`mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--color-sidebar-border)] px-4 py-3 text-left text-sm font-bold text-[var(--color-sidebar-text)] hover:bg-[var(--color-navigation-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sidebar-text)] ${className}`}
    >
      <span aria-hidden="true">⇄</span>
      Trocar de sistema
    </a>
  )
}
