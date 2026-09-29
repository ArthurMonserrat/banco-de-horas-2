import type { Prisma } from '@prisma/client'
import { publicUser, requireApiUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, sendError } from './_lib/http'
import { prisma } from './_lib/prisma'

function scopeForUser(user: Awaited<ReturnType<typeof requireApiUser>>): Prisma.UserWhereInput {
  if (!user) return { id: '__unauthorized__' }
  if (user.perfil === 'DIRETOR') return {}
  if (user.perfil === 'SUPERVISOR') return { supervisorId: user.id }
  return { id: user.id }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return methodNotAllowed(response)

  const user = await requireApiUser(request)
  if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')

  const users = await prisma.user.findMany({
    where: scopeForUser(user),
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      supervisorId: true,
      assinaturaBase64: true,
      dataCriacao: true,
    },
    orderBy: [{ perfil: 'desc' }, { nome: 'asc' }],
  })

  response.status(200).json({ users: users.map((item) => ({ ...publicUser(item), assinaturaBase64: item.assinaturaBase64, dataCriacao: item.dataCriacao.toISOString() })) })
}
