import type { Prisma, StatusApontamento } from '@prisma/client'
import { requireApiUser } from './_lib/auth'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { methodNotAllowed, parseString, sendError } from './_lib/http'
import { prisma } from './_lib/prisma'

function statusFromInput(value: unknown): StatusApontamento | null {
  if (value === 'PENDENTE' || value === 'PENDING') return 'PENDENTE'
  if (value === 'APROVADO' || value === 'APPROVED') return 'APROVADO'
  if (value === 'REJEITADO' || value === 'REJECTED') return 'REJEITADO'
  return null
}

function scopeForUser(user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>): Prisma.ApontamentoWhereInput {
  if (user.perfil === 'DIRETOR') return {}
  if (user.perfil === 'SUPERVISOR') return { user: { supervisorId: user.id } }
  return { userId: user.id }
}

function serializeApontamento(apontamento: Prisma.ApontamentoGetPayload<{ include: { user: { select: { id: true, nome: true, supervisorId: true } }, rdos: true } }>) {
  return {
    id: apontamento.id,
    userId: apontamento.userId,
    userName: apontamento.user.nome,
    supervisorId: apontamento.user.supervisorId,
    data: apontamento.data.toISOString().slice(0, 10),
    horaInicio: apontamento.horaInicio,
    horaFim: apontamento.horaFim,
    horasTotal: Number(apontamento.horasTotal),
    projeto: apontamento.projeto,
    atividade: apontamento.atividade,
    detalhamento: apontamento.detalhamento,
    status: apontamento.status,
    justificativa: apontamento.justificativa,
    versao: apontamento.versao,
    dataCriacao: apontamento.dataCriacao.toISOString(),
    rdos: apontamento.rdos.map((rdo) => ({ id: rdo.id, arquivoUrl: rdo.arquivoUrl, geradoEm: rdo.geradoEm.toISOString() })),
  }
}

async function listApontamentos(request: ApiRequest, response: ApiResponse, user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>) {
  const queryUserId = Array.isArray(request.query?.userId) ? request.query?.userId[0] : request.query?.userId
  const where: Prisma.ApontamentoWhereInput = {
    AND: [scopeForUser(user), queryUserId ? { userId: queryUserId } : {}],
  }
  const apontamentos = await prisma.apontamento.findMany({
    where,
    include: { user: { select: { id: true, nome: true, supervisorId: true } }, rdos: true },
    orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
  })
  response.status(200).json({ apontamentos: apontamentos.map(serializeApontamento) })
}

async function createApontamento(request: ApiRequest, response: ApiResponse, user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>) {
  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
  const targetUserId = user.perfil === 'COLABORADOR' ? user.id : parseString(body.userId) || user.id
  const data = parseString(body.data)
  const horaInicio = parseString(body.horaInicio)
  const horaFim = parseString(body.horaFim)
  const horasTotal = Number(body.horasTotal)
  const projeto = parseString(body.projeto)
  const atividade = parseString(body.atividade)
  const detalhamento = parseString(body.detalhamento)

  if (!data || !horaInicio || !horaFim || !Number.isFinite(horasTotal) || !projeto || !atividade || !detalhamento) {
    return sendError(response, 400, 'Dados obrigatórios do apontamento incompletos.')
  }

  const apontamento = await prisma.apontamento.create({
    data: {
      userId: targetUserId,
      data: new Date(`${data}T00:00:00.000Z`),
      horaInicio,
      horaFim,
      horasTotal,
      projeto,
      atividade,
      detalhamento,
      status: statusFromInput(body.status) ?? 'PENDENTE',
      justificativa: parseString(body.justificativa) || null,
    },
    include: { user: { select: { id: true, nome: true, supervisorId: true } }, rdos: true },
  })

  response.status(201).json({ apontamento: serializeApontamento(apontamento) })
}

async function updateApontamento(request: ApiRequest, response: ApiResponse, user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>) {
  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
  const id = parseString(body.id ?? request.query?.id)
  if (!id) return sendError(response, 400, 'Informe o apontamento.')

  const existing = await prisma.apontamento.findFirst({ where: { AND: [{ id }, scopeForUser(user)] } })
  if (!existing) return sendError(response, 404, 'Apontamento não encontrado.')

  const status = statusFromInput(body.status)
  const data: Prisma.ApontamentoUpdateInput = {
    versao: { increment: 1 },
  }
  if (status) data.status = status
  if (typeof body.justificativa !== 'undefined') data.justificativa = parseString(body.justificativa) || null
  if (typeof body.projeto !== 'undefined') data.projeto = parseString(body.projeto)
  if (typeof body.atividade !== 'undefined') data.atividade = parseString(body.atividade)
  if (typeof body.detalhamento !== 'undefined') data.detalhamento = parseString(body.detalhamento)

  const apontamento = await prisma.apontamento.update({
    where: { id },
    data,
    include: { user: { select: { id: true, nome: true, supervisorId: true } }, rdos: true },
  })

  response.status(200).json({ apontamento: serializeApontamento(apontamento) })
}

async function deleteApontamento(request: ApiRequest, response: ApiResponse, user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>) {
  const id = parseString(request.query?.id)
  if (!id) return sendError(response, 400, 'Informe o apontamento.')
  const existing = await prisma.apontamento.findFirst({ where: { AND: [{ id }, scopeForUser(user)] } })
  if (!existing) return sendError(response, 404, 'Apontamento não encontrado.')
  await prisma.apontamento.delete({ where: { id } })
  response.status(200).json({ ok: true })
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const user = await requireApiUser(request)
  if (!user) return sendError(response, 401, 'Sessão inválida ou expirada.')

  if (request.method === 'GET') return listApontamentos(request, response, user)
  if (request.method === 'POST') return createApontamento(request, response, user)
  if (request.method === 'PATCH' || request.method === 'PUT') return updateApontamento(request, response, user)
  if (request.method === 'DELETE') return deleteApontamento(request, response, user)
  return methodNotAllowed(response)
}
