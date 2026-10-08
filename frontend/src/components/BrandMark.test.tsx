import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('usa a logo oficial por padrão com texto alternativo e proporção preservada', () => {
    const markup = renderToStaticMarkup(<BrandMark variant="full" />)

    expect(markup).toContain('<img')
    expect(markup).toContain('sma-logo.jpg')
    expect(markup).toContain('alt="SM&amp;A — Sistemas Elétricos e Automação"')
    expect(markup).toContain('object-contain')
  })

  it('usa fallback textual quando a origem está vazia', () => {
    const markup = renderToStaticMarkup(<BrandMark src="" />)

    expect(markup).not.toContain('<img')
    expect(markup).toContain('SM&amp;A')
  })

  it('permite renderizar a logo do PWA sem a moldura branca', () => {
    const markup = renderToStaticMarkup(<BrandMark src="/logo.png" variant="full" transparent />)

    expect(markup).toContain('src="/logo.png"')
    expect(markup).toContain('brand-mark--transparent')
  })
})
