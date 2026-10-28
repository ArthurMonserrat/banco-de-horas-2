import type { ParsedRDODay } from './rdoParser'

/** Intervalo de almoço descontado quando o colaborador informa início e fim do dia. */
export const RDO_LUNCH_BREAK_MINUTES = 60

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(value?: string) {
  const match = value?.match(TIME_PATTERN)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Minutos trabalhados = fim − início − 1h de almoço. Null quando os horários não fecham. */
export function manualRdoDurationMinutes(start?: string, end?: string) {
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null
  const worked = endMinutes - startMinutes - RDO_LUNCH_BREAK_MINUTES
  return worked > 0 ? worked : null
}

/** Guarda as horas lidas do RDO para poder voltar a elas ao desmarcar a hora manual. */
function withOriginal(day: ParsedRDODay): ParsedRDODay {
  return day.horasRdo === undefined ? { ...day, horasRdo: day.horas, minutosRdo: day.minutos } : day
}

/** Atualiza início/fim de um dia e recalcula as horas (sem horário válido, fica 0h até corrigir). */
export function setManualRdoTime(day: ParsedRDODay, field: 'horaInicio' | 'horaFim', value: string): ParsedRDODay {
  const next = { ...withOriginal(day), [field]: value }
  const worked = manualRdoDurationMinutes(next.horaInicio, next.horaFim) ?? 0
  return { ...next, horas: Math.floor(worked / 60), minutos: worked % 60 }
}

/** Liga a hora manual: começa sem horários, para a pessoa preencher dia a dia. */
export function startManualRdoHours(days: ParsedRDODay[]): ParsedRDODay[] {
  return days.map((day) => ({ ...withOriginal(day), horaInicio: day.horaInicio ?? '', horaFim: day.horaFim ?? '', horas: 0, minutos: 0 }))
}

/** Desliga a hora manual: volta às horas lidas do RDO e apaga início/fim. */
export function restoreRdoHours(days: ParsedRDODay[]) {
  return days.map(({ horaInicio: _start, horaFim: _end, horasRdo, minutosRdo, ...day }) => ({
    ...day,
    horas: horasRdo ?? day.horas,
    minutos: minutosRdo ?? day.minutos,
  }))
}

/** Mensagem do primeiro dia com horário faltando ou inválido; null quando todos estão certos. */
export function validateManualRdoDays(days: ParsedRDODay[], formatDate: (date: string) => string) {
  for (const day of days) {
    if (!day.horaInicio || !day.horaFim) return `Informe a hora de início e de fim do dia ${formatDate(day.data)}.`
    if (manualRdoDurationMinutes(day.horaInicio, day.horaFim) === null) {
      return `No dia ${formatDate(day.data)} o fim deve ser depois do início e o período maior que 1h de almoço.`
    }
  }
  return null
}
