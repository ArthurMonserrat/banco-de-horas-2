import { describe, expect, it } from 'vitest'
import { manualRdoDurationMinutes, restoreRdoHours, setManualRdoTime, startManualRdoHours, validateManualRdoDays } from './rdoManualHours'
import type { ParsedRDODay } from './rdoParser'

const day = (data: string, horas: number, minutos = 0): ParsedRDODay => ({ data, horas, minutos, detalhamento: 'x', numeroObra: '24AM018E' })
const br = (iso: string) => iso.split('-').reverse().join('/')

describe('hora manual na importação de RDO', () => {
  it('calcula fim − início − 1h de almoço', () => {
    expect(manualRdoDurationMinutes('08:00', '17:00')).toBe(480)
    expect(manualRdoDurationMinutes('07:30', '18:15')).toBe(585)
    expect(manualRdoDurationMinutes('08:00', '09:00')).toBeNull()
    expect(manualRdoDurationMinutes('17:00', '08:00')).toBeNull()
    expect(manualRdoDurationMinutes('', '17:00')).toBeNull()
  })

  it('liga a hora manual zerando as horas, recalcula por dia e volta às horas do RDO ao desligar', () => {
    let days = startManualRdoHours([day('2026-06-15', 8), day('2026-06-29', 4, 40)])
    expect(days.map((item) => [item.horas, item.minutos, item.horaInicio, item.horasRdo])).toEqual([[0, 0, '', 8], [0, 0, '', 4]])
    days = [setManualRdoTime(setManualRdoTime(days[0], 'horaInicio', '07:00'), 'horaFim', '17:30'), days[1]]
    expect(days[0]).toMatchObject({ horaInicio: '07:00', horaFim: '17:30', horas: 9, minutos: 30 })
    const restored = restoreRdoHours(days)
    expect(restored).toEqual([day('2026-06-15', 8), day('2026-06-29', 4, 40)])
  })

  it('aponta o primeiro dia sem horário ou com horário inválido', () => {
    const filled = setManualRdoTime(setManualRdoTime(startManualRdoHours([day('2026-06-15', 8)])[0], 'horaInicio', '08:00'), 'horaFim', '17:00')
    expect(validateManualRdoDays([filled], br)).toBeNull()
    expect(validateManualRdoDays([filled, { ...day('2026-06-16', 8), horaInicio: '08:00' }], br)).toBe('Informe a hora de início e de fim do dia 16/06/2026.')
    expect(validateManualRdoDays([{ ...day('2026-06-17', 8), horaInicio: '10:00', horaFim: '09:00' }], br)).toContain('17/06/2026')
  })
})
