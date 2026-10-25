import type { User } from '@supabase/supabase-js'
import type { DemoRole, DemoSession } from '../session/types'

/** Dados exibidos em "Meu perfil", vindos só do login Microsoft do Ecossistema SM&A. */
export type CorporateIdentityView = {
  firstName: string
  lastName: string
  fullName: string
  initials: string
  email: string
  roleLabel: string
  providerLabel: string
  firstAccessAt: string | null
  lastSignInAt: string | null
}

const ROLE_LABELS: Record<DemoRole, string> = {
  COLLABORATOR: 'Colaborador',
  SUPERVISOR: 'Supervisor',
  DIRECTOR_ADMIN: 'Diretoria',
}

const LOWERCASE_PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

function capitalizeWord(word: string, index: number): string {
  const lower = word.toLocaleLowerCase('pt-BR')
  if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** "fernando.almeida@sma-eng.com.br" -> "Fernando Almeida" */
export function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  return localPart.split(/[._-]+/).filter((word) => /[a-zà-ú]/i.test(word)).map(capitalizeWord).join(' ')
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const words = normalizeSpaces(fullName).split(' ').filter(Boolean)
  if (words.length === 0) return { firstName: '', lastName: '' }
  return { firstName: words[0], lastName: words.slice(1).join(' ') }
}

function readMetadataName(user: User | null | undefined): string | null {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  for (const key of ['full_name', 'name']) {
    const value = metadata[key]
    if (typeof value === 'string' && normalizeSpaces(value)) return normalizeSpaces(value)
  }
  return null
}

const looksLikeHandle = (value: string) => value.includes('@') || !value.includes(' ')

/** Prioridade: nome da sessão (perfil corporativo) -> nome enviado pela Microsoft -> derivado do e-mail. */
export function resolveDisplayName(sessionName: string, email: string, user?: User | null): string {
  const candidates = [sessionName, readMetadataName(user)].filter((value): value is string => typeof value === 'string').map(normalizeSpaces).filter(Boolean)
  return candidates.find((value) => !looksLikeHandle(value)) ?? (nameFromEmail(email) || candidates[0] || email)
}

export function buildCorporateIdentity(session: Pick<DemoSession, 'name' | 'email' | 'role'>, user?: User | null): CorporateIdentityView {
  const email = session.email ?? user?.email ?? ''
  const fullName = resolveDisplayName(session.name, email, user)
  const { firstName, lastName } = splitFullName(fullName)
  const initials = `${firstName.charAt(0)}${lastName.split(' ').pop()?.charAt(0) ?? ''}`.toLocaleUpperCase('pt-BR') || '?'
  return {
    firstName,
    lastName,
    fullName,
    initials,
    email,
    roleLabel: ROLE_LABELS[session.role],
    providerLabel: 'Microsoft (conta corporativa SM&A)',
    firstAccessAt: user?.created_at ?? null,
    lastSignInAt: user?.last_sign_in_at ?? null,
  }
}

export function formatDateTimePtBr(value: string | null): string {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)
}
