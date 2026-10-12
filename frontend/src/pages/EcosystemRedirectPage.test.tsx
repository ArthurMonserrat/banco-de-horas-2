import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ECOSYSTEM_URL, EcosystemRedirectPage } from './EcosystemRedirectPage'
import appRoutesSource from '../app/AppRoutes.tsx?raw'

describe('EcosystemRedirectPage', () => {
  it('apresenta um fallback acessível para o Ecossistema SM&A', () => {
    const markup = renderToStaticMarkup(<EcosystemRedirectPage />)

    expect(markup).toContain('Redirecionando para o Ecossistema SM&amp;A')
    expect(markup).toContain(`href="${DEFAULT_ECOSYSTEM_URL}"`)
    expect(markup).toContain('Acessar o Ecossistema SM&amp;A')
  })

  it('é a entrada raiz da aplicação', () => {
    expect(appRoutesSource.replace(/\s+/g, ' ')).toContain(
      '<Route path="/" element={<EcosystemRedirectPage />} />',
    )
  })
})
