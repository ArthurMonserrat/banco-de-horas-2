import { useEffect } from 'react'

export const DEFAULT_ECOSYSTEM_URL = 'https://arthurmonserrat.github.io/sma-apontamento-horas/'

function getEcosystemUrl() {
  return import.meta.env.VITE_ECOSYSTEM_URL?.trim() || DEFAULT_ECOSYSTEM_URL
}

export function EcosystemRedirectPage() {
  const ecosystemUrl = getEcosystemUrl()

  useEffect(() => {
    window.location.replace(ecosystemUrl)
  }, [ecosystemUrl])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6 text-center text-[var(--color-text)]">
      <section className="ui-card max-w-md rounded-2xl p-8">
        <p className="text-sm text-[var(--color-text-muted)]">Redirecionando para o Ecossistema SM&amp;A</p>
        <a className="ui-button-primary mt-5 inline-flex" href={ecosystemUrl}>
          Acessar o Ecossistema SM&amp;A
        </a>
      </section>
    </main>
  )
}
