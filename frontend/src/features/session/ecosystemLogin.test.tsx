// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeContext } from '../../app/themeContext'
import { getEcosystemAuthConfig } from '../../config/ecosystemAuth'
import { exchangeForBanco2Session, readCallbackCode } from '../../services/ecosystemLogin'
import { getStoredApiSession, type ApiSession } from '../../services/api'
import { AuthCallbackPage } from '../../pages/AuthCallbackPage'
import { LoginPageContent } from '../../pages/LoginPage'
import { DemoSessionProvider } from './DemoSessionProvider'
import { SessionContext } from './sessionContext'
import { toEcosystemSession } from './ecosystemSession'
import { useSession } from './useSession'

const apiSession = (perfil: ApiSession['user']['perfil'] = 'DIRETOR'): ApiSession => ({
  token: 'banco2-token',
  user: { id: 'prisma-1', nome: 'Fernando Almeida', email: 'fernando.almeida@sma-eng.com.br', perfil, supervisorId: null },
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('configuração do login do Ecossistema', () => {
  it('monta o retorno do OAuth no próprio Banco 2 e exige URL e chave', () => {
    const config = getEcosystemAuthConfig({ VITE_ECOSYSTEM_SUPABASE_URL: 'https://eco.supabase.co', VITE_ECOSYSTEM_SUPABASE_ANON_KEY: 'anon', VITE_ECOSYSTEM_URL: 'https://eco.vercel.app' }, 'https://banco2.vercel.app', '/')
    expect(config).toMatchObject({ enabled: true, redirectTo: 'https://banco2.vercel.app/#/auth/callback', ecosystemUrl: 'https://eco.vercel.app/' })
    expect(getEcosystemAuthConfig({}, 'https://banco2.vercel.app', '/').enabled).toBe(false)
    expect(getEcosystemAuthConfig({ VITE_ECOSYSTEM_URL: 'javascript:alert(1)' }, 'https://b', '/').ecosystemUrl).toBeNull()
  })

  it('lê o código do OAuth antes ou depois do #', () => {
    expect(readCallbackCode('?code=abc', '#/auth/callback')).toBe('abc')
    expect(readCallbackCode('', '#/auth/callback?code=xyz')).toBe('xyz')
    expect(readCallbackCode('', '#/auth/callback')).toBeNull()
  })
})

describe('troca do login Microsoft pela sessão do Banco 2', () => {
  it('guarda a sessão quando o servidor libera o acesso', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(apiSession()), { status: 200 }))
    const result = await exchangeForBanco2Session('supabase-token', fetchMock as unknown as typeof fetch)
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/session', { method: 'POST', headers: { Authorization: 'Bearer supabase-token' } })
    expect(getStoredApiSession()?.token).toBe('banco2-token')
  })

  it('não guarda nada e explica quando não há acesso ao Banco 2', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'Seu usuário não tem acesso ao Banco de Horas 2.', reason: 'no_banco2_access' }), { status: 403 }))
    const result = await exchangeForBanco2Session('t', fetchMock as unknown as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'no_banco2_access', message: 'Seu usuário não tem acesso ao Banco de Horas 2.' })
    expect(getStoredApiSession()).toBeNull()
  })

  it('o cargo vem do servidor', () => {
    expect(toEcosystemSession(apiSession('COLABORADOR'))?.role).toBe('COLLABORATOR')
    expect(toEcosystemSession(apiSession('SUPERVISOR'))?.role).toBe('SUPERVISOR')
    expect(toEcosystemSession(apiSession('DIRETOR'))).toMatchObject({ role: 'DIRECTOR_ADMIN', isDemo: false, authProvider: 'ecosystem', email: 'fernando.almeida@sma-eng.com.br' })
  })
})

function renderCallback(completeLogin: (code: string) => Promise<unknown>, search = '?code=abc') {
  return root.render(
    <DemoSessionProvider allowDemo={false}>
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage completeLogin={completeLogin as never} location={{ search, hash: '#/auth/callback' }} />} />
          <Route path="/administracao" element={<p>Area diretoria</p>} />
          <Route path="/colaborador" element={<ColaboradorProbe />} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </DemoSessionProvider>,
  )
}

function ColaboradorProbe() {
  const { profile } = useSession()
  return <p>Area colaborador {profile ? `${profile.name}|${profile.email}` : 'sem perfil'}</p>
}

describe('retorno do login Microsoft', () => {
  it('diretor entra direto na área da diretoria', async () => {
    await act(async () => renderCallback(async () => ({ ok: true, session: apiSession('DIRETOR') })))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Area diretoria')
  })

  it('colaborador entra com perfil profissional criado a partir da conta corporativa', async () => {
    await act(async () => renderCallback(async () => ({ ok: true, session: apiSession('COLABORADOR') })))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Area colaborador Fernando Almeida|fernando.almeida@sma-eng.com.br')
  })

  it('sem acesso volta para o login com a mensagem do servidor', async () => {
    await act(async () => renderCallback(async () => ({ ok: false, reason: 'no_banco2_access', message: 'Sem acesso ao Banco 2' })))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Tela de login')
  })

  it('sem código volta para o login', async () => {
    const completeLogin = vi.fn()
    await act(async () => renderCallback(completeLogin, ''))
    expect(completeLogin).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Tela de login')
  })
})

describe('restauração da sessão', () => {
  function Probe() {
    const { session, isLoading } = useSession()
    return <output>{isLoading ? 'carregando' : session ? `${session.role}|${session.authProvider}` : 'sem sessão'}</output>
  }

  it('fora do modo demonstração ignora sessão de demonstração salva no navegador', async () => {
    localStorage.setItem('sma:demo-session:v2', JSON.stringify({ id: 'x', name: 'Falso', role: 'DIRECTOR_ADMIN', createdAt: 'a', explicitLoginAt: 'a', isDemo: true, version: 2 }))
    await act(async () => root.render(<DemoSessionProvider allowDemo={false}><Probe /></DemoSessionProvider>))
    expect(container.textContent).toBe('sem sessão')
  })

  it('revalida no servidor a sessão do Banco 2 e usa o cargo atual', async () => {
    localStorage.setItem('sma:api-session:v1', JSON.stringify(apiSession('DIRETOR')))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: apiSession('SUPERVISOR').user }), { status: 200 })))
    await act(async () => root.render(<DemoSessionProvider allowDemo={false}><Probe /></DemoSessionProvider>))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(container.textContent).toBe('SUPERVISOR|ecosystem')
  })

  it('sessão expirada no servidor é apagada', async () => {
    localStorage.setItem('sma:api-session:v1', JSON.stringify(apiSession('DIRETOR')))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), { status: 401 })))
    await act(async () => root.render(<DemoSessionProvider allowDemo={false}><Probe /></DemoSessionProvider>))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(container.textContent).toBe('sem sessão')
    expect(getStoredApiSession()).toBeNull()
  })
})

describe('tela de login em produção', () => {
  it('mostra só o login Microsoft, sem os perfis de demonstração', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
          <SessionContext.Provider value={{ session: null, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
            {LoginPageContent({ from: undefined, signIn: vi.fn(), authError: null, navigate: vi.fn(), showDemo: false, onMicrosoftLogin: vi.fn(), ecosystemUrl: 'https://eco.vercel.app/' })}
          </SessionContext.Provider>
        </ThemeContext.Provider>
      </MemoryRouter>,
    )
    expect(markup).toContain('Entrar com Microsoft')
    expect(markup).toContain('Voltar ao Ecossistema SM&amp;A')
    expect(markup).not.toContain('Entrar como Diretor/Administração')
  })
})
