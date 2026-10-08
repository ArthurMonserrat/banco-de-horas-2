import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeContext } from '../app/themeContext'
import { demoCollaborator } from '../mocks/demoData'
import { SessionContext } from '../features/session/sessionContext'
import { ProtectedRoute } from '../features/session/ProtectedRoute'
import { PublicOnlyRoute } from '../features/session/PublicOnlyRoute'
import type { DemoSession } from '../features/session/types'
import { AppLayout } from './AppLayout'
import { Header } from './Header'
import { closeDrawerAfterNavigation, focusDrawerInitialElement, restoreDrawerTriggerFocus, scheduleDrawerTriggerFocus, shouldCloseDrawerForKey } from './drawer'
import { PageContainer } from './PageContainer'
import { collaboratorNavigation, directorNavigation } from '../mocks/navigation'
import supervisorSource from '../pages/SupervisorPage.tsx?raw'
import diretoriaSource from '../pages/DiretoriaPage.tsx?raw'
import equipesSource from '../pages/EquipesPage.tsx?raw'

const collaboratorSession: DemoSession = {
  id: demoCollaborator.id,
  name: demoCollaborator.name,
  role: 'COLLABORATOR',
  createdAt: '2026-07-21T15:30:00.000Z',
  explicitLoginAt: '2026-07-21T15:30:00.000Z',
  isDemo: true,
  version: 2,
}

const supervisorSession: DemoSession = {
  ...collaboratorSession,
  id: 'demo-supervisor-001',
  name: 'Supervisor',
  role: 'SUPERVISOR',
}

const directorSession: DemoSession = {
  ...collaboratorSession,
  id: 'demo-director-001',
  name: 'Diretoria',
  role: 'DIRECTOR_ADMIN',
}

function renderLayout() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/colaborador']}>
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <SessionContext.Provider value={{ session: collaboratorSession, profile: demoCollaborator, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
          <AppLayout />
        </SessionContext.Provider>
      </ThemeContext.Provider>
    </MemoryRouter>,
  )
}

function renderLayoutForSession(session: DemoSession) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/avisos']}>
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <SessionContext.Provider value={{ session, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
          <AppLayout />
        </SessionContext.Provider>
      </ThemeContext.Provider>
    </MemoryRouter>,
  )
}

function renderGuard(
  route: React.ReactNode,
  { session, profile = null }: { session: DemoSession | null; profile?: typeof demoCollaborator | null },
) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/supervisor?periodo=atual#equipe']}>
        <SessionContext.Provider value={{ session, profile, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
          {route}
        </SessionContext.Provider>
      </MemoryRouter>,
    )
  } finally {
    warn.mockRestore()
  }
}

describe('layout responsivo do colaborador', () => {
  it('mantém a mesma ordem e os ícones semânticos do Banco 1 no menu do colaborador', () => {
    expect(collaboratorNavigation.map((item) => [item.label, item.icon])).toEqual([
      ['Visão geral', 'dashboard'],
      ['Novo apontamento', 'file-plus'],
      ['Histórico', 'history'],
      ['Ausências', 'calendar-off'],
      ['Avisos', 'bell'],
      ['Meu perfil', 'user'],
    ])
  })

  it('mantém a mesma ordem e os ícones semânticos do Banco 1 no menu da diretoria', () => {
    expect(directorNavigation.map((item) => [item.label, item.icon])).toEqual([
      ['Painel Diretor', 'dashboard'],
      ['Equipes', 'users'],
      ['Relatórios', 'bar-chart'],
      ['Avisos', 'bell'],
    ])
  })

  it.each([
    ['painel da diretoria', diretoriaSource],
    ['gerenciamento de equipes', equipesSource],
  ])('usa o mesmo fundo claro do ícone ativo nas sidebars da direção: %s', (_page, source) => {
    expect(source).toContain("isActive ? 'bg-[var(--color-navigation-active-detail)] text-[var(--color-primary)]' : 'bg-[var(--color-sidebar-surface)]'")
  })

  it('mantém Avisos antes de Meu Perfil e com ícone semântico no menu do supervisor', () => {
    const navigationStart = supervisorSource.indexOf('const supervisorNavigation')
    const navigationEnd = supervisorSource.indexOf(']\n\nfunction readSupervisorProfile', navigationStart)
    const navigation = supervisorSource.slice(navigationStart, navigationEnd)

    expect(navigation).toContain("{ id: 'announcements', label: 'Avisos', icon: 'bell' }")
    expect(navigation).toContain("{ id: 'profile', label: 'Meu Perfil', icon: 'user' }")
    expect(navigation.indexOf("id: 'announcements'")).toBeLessThan(navigation.indexOf("id: 'profile'"))
  })

  it('renderiza apenas o menu da diretoria para o Diretor', () => {
    const markup = renderLayoutForSession(directorSession)
    const sidebarStart = markup.indexOf('data-desktop-sidebar="true"')
    const sidebarMarkup = markup.slice(sidebarStart, markup.indexOf('</aside>', sidebarStart))

    expect(sidebarMarkup).toContain('Painel Diretor')
    expect(sidebarMarkup).toContain('Equipes')
    expect(sidebarMarkup).toContain('Avisos')
    expect(sidebarMarkup).toContain('Relatórios')
    expect(sidebarMarkup).not.toContain('Visão geral')
    expect(sidebarMarkup).not.toContain('Novo apontamento')
    expect(sidebarMarkup).not.toContain('Ausências')
  })

  it('mantém o cabeçalho de perfil da Diretoria mesmo sem perfil de colaborador', () => {
    const markup = renderLayoutForSession(directorSession)

    expect(markup).toContain('Perfil atual da diretoria')
    expect(markup).toContain('Iniciais de Diretoria SM&amp;A')
    expect(markup).toContain('Diretoria SM&amp;A')
    expect(markup).toContain('Visão macro')
  })

  it('não exibe o cartão de squad na sidebar da Diretoria', () => {
    const markup = renderLayoutForSession(directorSession)
    const sidebarStart = markup.indexOf('data-desktop-sidebar="true"')
    const sidebarMarkup = markup.slice(sidebarStart, markup.indexOf('</aside>', sidebarStart))

    expect(sidebarMarkup).not.toContain('Squad ativa')
  })

  it.each([
    ['COLLABORATOR', collaboratorSession, 'ÁREA DO COLABORADOR'],
    ['SUPERVISOR', supervisorSession, 'ÁREA DA SUPERVISÃO'],
    ['DIRECTOR_ADMIN', directorSession, 'ÁREA DA DIRETORIA'],
  ] as const)('exibe o título do header conforme a role %s', (_role, session, expectedTitle) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
          <SessionContext.Provider value={{ session, profile: null, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }}>
            <Header isMenuOpen={false} onMenuToggle={vi.fn()} />
          </SessionContext.Provider>
        </ThemeContext.Provider>
      </MemoryRouter>,
    )

    expect(markup).toContain(expectedTitle)
  })

  it('mantém sidebar desktop e drawer mobile como regiões independentes do shell', () => {
    const markup = renderLayout()
    const desktopStart = markup.indexOf('data-desktop-sidebar="true"')
    const desktopMarkup = markup.slice(desktopStart, markup.indexOf('</aside>', desktopStart))

    expect(markup).toContain('data-desktop-sidebar="true"')
    expect(markup).toContain('data-mobile-drawer="true"')
    expect(desktopStart).toBeLessThan(markup.indexOf('id="main-content"'))
    expect(markup.indexOf('id="main-content"')).toBeLessThan(markup.indexOf('data-mobile-drawer="true"'))
    expect(desktopMarkup).toContain('w-64')
    expect(desktopMarkup).toContain('lg:flex')
    expect(desktopMarkup).not.toContain('invisible')
    expect(desktopMarkup).not.toContain('translate-x')
  })

  it('posiciona o header global antes da navegação lateral e do conteúdo', () => {
    const markup = renderLayout()
    expect(markup.indexOf('data-layout-region="global-header"')).toBeLessThan(markup.indexOf('data-desktop-sidebar="true"'))
    expect(markup.indexOf('data-desktop-sidebar="true"')).toBeLessThan(markup.indexOf('id="main-content"'))
  })

  it('exibe uma única logo oficial no header e não repete marca no cartão da squad', () => {
    const markup = renderLayout()
    const headerStart = markup.indexOf('data-layout-region="global-header"')
    const headerMarkup = markup.slice(headerStart, markup.indexOf('</header>', headerStart))
    const squadStart = markup.indexOf('Squad ativa')
    const squadMarkup = markup.slice(Math.max(0, squadStart - 300), squadStart + 300)

    expect(markup.match(/<img/g) ?? []).toHaveLength(1)
    expect(headerMarkup).toContain('sma-logo.jpg')
    expect(squadMarkup).not.toContain('sma-logo.jpg')
    expect(squadMarkup).not.toContain('SM&amp;A')
  })

  it('expõe estado e alvo do menu mobile para tecnologias assistivas', () => {
    const markup = renderLayout()
    expect(markup).toContain('aria-controls="collaborator-mobile-navigation"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('Fechar navegação lateral')
  })

  it('mantém o drawer abaixo do header sem reservar largura quando fechado', () => {
    const markup = renderLayout()
    const drawerStart = markup.indexOf('data-mobile-drawer="true"')
    const drawerMarkup = markup.slice(drawerStart, markup.indexOf('</aside>', drawerStart))

    expect(markup).toContain('top-20')
    expect(drawerMarkup).toContain('-translate-x-full')
    expect(drawerMarkup).toContain('lg:hidden')
    expect(drawerMarkup).not.toContain('lg:translate-x-0')
    expect(markup).toContain('lg:grid-cols-[16rem_minmax(0,1fr)]')
    expect(markup).toContain('overflow-x-clip')
  })

  it('exibe o resumo profissional e todos os links principais na sidebar', () => {
    const markup = renderLayout()

    expect(markup).toContain('Colaborador')
    expect(markup).toContain('Projetista')
    expect(markup).toContain('Engenharia de Automação')
    for (const label of ['Visão geral', 'Novo apontamento', 'Histórico', 'Ausências', 'Meu perfil']) {
      expect(markup).toContain(label)
    }
  })

  it('fecha o drawer somente com a tecla Escape', () => {
    expect(shouldCloseDrawerForKey('Escape')).toBe(true)
    expect(shouldCloseDrawerForKey('Enter')).toBe(false)
    expect(shouldCloseDrawerForKey('Tab')).toBe(false)
  })

  it('move o foco para o primeiro controle do drawer ao abrir', () => {
    const focus = vi.fn()
    const root = { querySelector: vi.fn(() => ({ focus })) } as unknown as ParentNode

    expect(focusDrawerInitialElement(root)).toBe(true)
    expect(root.querySelector).toHaveBeenCalledWith('[data-drawer-initial-focus]')
    expect(focus).toHaveBeenCalledOnce()
  })

  it('restaura o foco no acionador ao fechar explicitamente o drawer', () => {
    const focus = vi.fn()
    const trigger = { focus } as unknown as HTMLButtonElement

    expect(restoreDrawerTriggerFocus(trigger)).toBe(true)
    expect(focus).toHaveBeenCalledOnce()
    expect(restoreDrawerTriggerFocus(null)).toBe(false)
  })

  it('agenda o retorno do foco para depois da remoção do backdrop', () => {
    const focus = vi.fn()
    const trigger = { focus } as unknown as HTMLButtonElement
    const schedule = vi.fn<(callback: () => void) => void>()

    expect(scheduleDrawerTriggerFocus(trigger, schedule)).toBe(true)
    expect(focus).not.toHaveBeenCalled()
    schedule.mock.calls[0]?.[0]()
    expect(focus).toHaveBeenCalledOnce()
    expect(scheduleDrawerTriggerFocus(null, schedule)).toBe(false)
  })

  it('solicita retorno de foco ao fechar o drawer por navegação', () => {
    const close = vi.fn()

    closeDrawerAfterNavigation(close)

    expect(close).toHaveBeenCalledWith(true)
  })

  it('centraliza a página sem aplicar offset lateral manual', () => {
    const markup = renderToStaticMarkup(<PageContainer title="Página" description="Descrição" />)

    expect(markup).toContain('mx-auto')
    expect(markup).toContain('max-w-7xl')
    expect(markup).not.toContain('lg:ml-')
  })
})

describe('guardas da sessão corporativa', () => {
  it('autoriza a área pelo papel da sessão mesmo quando não existe perfil de colaborador', () => {
    const markup = renderGuard(
      <ProtectedRoute allowedRoles={['SUPERVISOR']}><p>Área da supervisão</p></ProtectedRoute>,
      { session: supervisorSession },
    )

    expect(markup).toContain('Área da supervisão')
  })

  it('não autoriza outra área apenas porque existe perfil de colaborador', () => {
    const markup = renderGuard(
      <ProtectedRoute allowedRoles={['SUPERVISOR']}><p>Área da supervisão</p></ProtectedRoute>,
      { session: collaboratorSession, profile: demoCollaborator },
    )

    expect(markup).not.toContain('Área da supervisão')
  })

  it('trata qualquer sessão válida como autenticada em rota pública', () => {
    const markup = renderGuard(
      <PublicOnlyRoute><p>Seleção de perfil</p></PublicOnlyRoute>,
      { session: supervisorSession },
    )

    expect(markup).not.toContain('Seleção de perfil')
  })

  it('mantém a seleção de perfil acessível sem sessão', () => {
    const markup = renderGuard(
      <PublicOnlyRoute><p>Seleção de perfil</p></PublicOnlyRoute>,
      { session: null },
    )

    expect(markup).toContain('Seleção de perfil')
  })
})
