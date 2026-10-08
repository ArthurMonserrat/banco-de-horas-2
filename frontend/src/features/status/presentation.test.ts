import { describe, expect, it } from 'vitest'
import {
  approvalStatusPresentation,
  formatStatus,
  revisionStatusPresentation,
  timeEntryStatusPresentation,
  timeOffStatusPresentation,
  workloadRequestStatusPresentation,
} from './presentation'

describe('catálogo de apresentação dos status', () => {
  it('diferencia aprovação, pendência, correção e ausência de envio', () => {
    expect(approvalStatusPresentation).toEqual({
      IN_PROGRESS: { label: 'Em andamento', tone: 'info' },
      AVAILABLE_FOR_APPROVAL: { label: 'Disponível para aprovação', tone: 'pending' },
      CORRECTION_REQUESTED: { label: 'Correção solicitada', tone: 'warning' },
      APPROVED: { label: 'Aprovado', tone: 'success' },
      REOPENED: { label: 'Reaberto', tone: 'info' },
      NO_SUBMISSION: { label: 'Sem apontamento enviado', tone: 'neutral' },
    })
  })

  it('mantém rejeição e cancelamento visualmente distintos nas solicitações', () => {
    const expected = {
      PENDING: { label: 'Pendente', tone: 'pending' },
      APPROVED: { label: 'Aprovada', tone: 'success' },
      REJECTED: { label: 'Rejeitada', tone: 'danger' },
      CANCELLED: { label: 'Cancelada', tone: 'cancelled' },
    } as const

    expect(workloadRequestStatusPresentation).toEqual(expected)
    expect(timeOffStatusPresentation).toEqual({
      ...expected,
      PENDING: { label: 'Pendente de aprovação', tone: 'pending' },
    })
  })

  it('classifica cancelamento e edição sem criar estados de domínio', () => {
    expect(timeEntryStatusPresentation).toEqual({
      ACTIVE: { label: 'Ativo', tone: 'neutral' },
      CANCELLED: { label: 'Cancelado', tone: 'cancelled' },
    })
    expect(revisionStatusPresentation).toEqual({ label: 'Editado', tone: 'info' })
  })

  it('traduz os estados técnicos de apontamento para português', () => {
    expect(formatStatus('PENDING')).toBe('Pendente')
    expect(formatStatus('APPROVED')).toBe('Aprovado')
    expect(formatStatus('REJECTED')).toBe('Rejeitado')
  })

  it('preserva um status desconhecido para facilitar diagnóstico', () => {
    expect(formatStatus('STATUS_NOVO')).toBe('STATUS_NOVO')
  })
})
