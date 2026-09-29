import { createSessionToken, publicUser, requireApiUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, parseString, sendError } from './_lib/http'
import { prisma } from './_lib/prisma'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method === 'GET') {
    const user = await requireApiUser(request)
    if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')
    return response.status(200).json({ user: publicUser(user) })
  }

  if (request.method !== 'POST') return methodNotAllowed(response)

  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
  const email = normalizeEmail(parseString(body.email))
  const senha = parseString(body.senha ?? body.password)

  if (!email || !senha) return sendError(response, 400, 'Informe email e senha.')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.senha !== senha) return sendError(response, 401, 'Credenciais inválidas.')

  const authenticatedUser = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    supervisorId: user.supervisorId,
  }

  return response.status(200).json({
    token: createSessionToken(user),
    user: publicUser(authenticatedUser),
  })
}
