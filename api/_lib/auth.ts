import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PerfilUsuario, User } from '@prisma/client'
import type { ApiRequest } from './http'
import { getBearerToken } from './http'
import { prisma } from './prisma'

export type AuthenticatedUser = Pick<User, 'id' | 'nome' | 'email' | 'perfil' | 'supervisorId'>

type TokenPayload = {
  sub: string
  perfil: PerfilUsuario
  iat: number
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sessionSecret() {
  return process.env.SESSION_SECRET ?? 'dev-session-secret-change-me'
}

function signPayload(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createSessionToken(user: Pick<User, 'id' | 'perfil'>) {
  const payload: TokenPayload = { sub: user.id, perfil: user.perfil, iat: Math.floor(Date.now() / 1000) }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload)}`
}

export function verifySessionToken(token: string): TokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null
  const expectedSignature = signPayload(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<TokenPayload>
    if (!payload.sub || !payload.perfil || !payload.iat) return null
    return payload as TokenPayload
  } catch {
    return null
  }
}

export async function requireApiUser(request: ApiRequest): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(request)
  if (!token) return null
  const payload = verifySessionToken(token)
  if (!payload) return null
  return prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, nome: true, email: true, perfil: true, supervisorId: true },
  })
}

export function publicUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    supervisorId: user.supervisorId,
  }
}
