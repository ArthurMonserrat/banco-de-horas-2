// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TimeEntryFields } from './TimeEntryFields'
import type { ParsedRDODay } from './rdoParser'
import type { TimeEntryFormValues } from './useTimeEntryForm'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const baseValues = {
  startDate: '2026-06-15', endDate: '2026-06-16', weekdaysOnly: false, emObra: true, numeroObra: '24AM018E', clientId: 'client-arcelormittal', projectCode: '24AM018E', activityId: '', disciplineCode: 'C',
  hours: '8', minutes: '0', startTime: '', endTime: '', isHoliday: false, hasOvertime: false, overtimeHours: '', overtimeMinutes: '', hasNightHours: false, nightHours: '', nightMinutes: '',
  hasPartialDayOff: false, partialDayOffHours: '', partialDayOffMinutes: '', details: '', funcaoContrato: '', numeroContrato: '', rdoHoraManual: false, editReason: '',
} as TimeEntryFormValues

let latestDays: ParsedRDODay[] = []

function Harness() {
  const [values, setValues] = useState(baseValues)
  const [days, setDays] = useState<ParsedRDODay[]>([
    { data: '2026-06-15', horas: 8, minutos: 0, detalhamento: 'a', numeroObra: '24AM018E' },
    { data: '2026-06-16', horas: 6, minutos: 0, detalhamento: 'b', numeroObra: '24AM018E' },
  ])
  latestDays = days
  return <TimeEntryFields values={values} errors={{}} maxDate="2026-12-31" entryMode="rdo" extractedRdoDays={days} onRdoDaysChange={setDays}
    onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))} />
}

function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Importar RDO com hora manual', () => {
  it('pergunta "Colocar hora manual?" e calcula as horas de cada dia pelo início e fim', async () => {
    await act(async () => { root.render(<Harness />) })
    const checkbox = Array.from(container.querySelectorAll('label')).find((label) => label.textContent?.includes('Colocar hora manual?'))!.querySelector('input')!
    await act(async () => { checkbox.click() })
    expect(container.textContent).toContain('descontando 1h de almoço')
    const [start, end] = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="time"]'))
    expect(start.getAttribute('aria-label')).toMatch(/^Hora de início em 15/)
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(4)
    await act(async () => { type(start, '07:00') })
    await act(async () => { type(end, '16:30') })
    expect(latestDays[0]).toMatchObject({ horaInicio: '07:00', horaFim: '16:30', horas: 8, minutos: 30 })
    expect(container.textContent).toContain('8h30 lançadas (1h de almoço descontada)')
    expect(container.textContent).toContain('Preencha início e fim')

    await act(async () => { checkbox.click() })
    expect(latestDays.map((item) => [item.horas, item.horaInicio])).toEqual([[8, undefined], [6, undefined]])
  })
})
