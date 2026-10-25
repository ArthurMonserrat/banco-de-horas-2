import { createHmac, timingSafeEqual } from 'node:crypto'

/** Perfil do Banco 2 gravado no token (mesmos valores do enum PerfilUsuario do Prisma). */
export type SessionPerfil = 'COLABORADOR' | 'SUPERVISOR' | 'DIRETOR'

export type TokenPayload = {
  sub: string
  perfil: SessionPerfil
  iat: number
}

export type TokenValidation = {
  payload: TokenPayload | null
  reason: string | null
}

/** Sessão do Banco 2 vale 12 horas; depois disso o usuário entra de novo pela Microsoft. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60
const CLOCK_SKEW_SECONDS = 5 * 60
const DEV_SESSION_SECRET = 'dev-session-secret-change-me'

type Env = Record<string, string | undefined>

function isProductionLike(env: Env) {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL_ENV)
}

/**
 * Chave HMAC das sessões. Em produção (ou em qualquer deploy da Vercel) a variável
 * SESSION_SECRET é obrigatória: sem ela, nenhum token é emitido nem aceito.
 */
export function sessionSecret(env: Env = process.env) {
  const configured = env.SESSION_SECRET?.trim()
  if (configured) return configured
  if (isProductionLike(env)) throw new Error('SESSION_SECRET não configurado no ambiente do Banco 2.')
  return DEV_SESSION_SECRET
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function signPayload(payload: string, env: Env) {
  return createHmac('sha256', sessionSecret(env)).update(payload).digest('base64url')
}

export function createSessionToken(user: { id: string; perfil: SessionPerfil }, env: Env = process.env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload: TokenPayload = { sub: user.id, perfil: user.perfil, iat: nowSeconds }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload, env)}`
}

export function validateSessionToken(token: string, env: Env = process.env, nowSeconds = Math.floor(Date.now() / 1000)): TokenValidation {
  const [encodedPayload, signature, extra] = token.split('.')
  if (!encodedPayload || !signature || extra !== undefined) return { payload: null, reason: 'formato do token inválido' }
  const expectedSignature = signPayload(encodedPayload, env)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { payload: null, reason: 'assinatura HMAC inválida' }
  }
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<TokenPayload>
    if (!payload.sub || !payload.perfil || typeof payload.iat !== 'number') return { payload: null, reason: 'payload incompleto' }
    if (payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) return { payload: null, reason: 'token emitido no futuro' }
    if (nowSeconds - payload.iat > SESSION_TTL_SECONDS) return { payload: null, reason: 'sessão expirada' }
    return { payload: payload as TokenPayload, reason: null }
  } catch {
    return { payload: null, reason: 'payload não é JSON válido' }
  }
}

export function verifySessionToken(token: string): TokenPayload | null {
  return validateSessionToken(token).payload
}
