import { useCallback, useEffect, useState } from 'react'
import { demoActivities, demoClients } from '../../mocks/demoData'
import { entryDateAvailabilityService } from '../../services/entryDateAvailabilityService'
import { timeEntryService } from '../../services/timeEntryService'
import { backendApi } from '../../services/api'
import { buildApiApontamentoPayload, offlineQueueService } from '../../services/offlineQueueService'
import type { ParsedRDODay } from './rdoParser'
import type { CreateTimeEntryData, TimeEntry, TimeEntryValidationErrors } from './types'
import { expandTimeEntryDates, NORMAL_WORKDAY_MINUTES, requiresWorkSiteNumber } from './domain'
import { getCorporateToday, isIsoDate, isWeekend } from '../../shared/utils/date'
import { useSession } from '../session/useSession'
import { areValidDurationParts, hoursAndMinutesToMinutes, validateTimeEntry } from './domain'

export type TimeEntryFormValues = {
  startDate: string
  endDate: string
  weekdaysOnly: boolean
  emObra: boolean
  numeroObra: string
  clientId: string
  projectCode: string
  activityId: string
  disciplineCode: CreateTimeEntryData['disciplineCode'] | ''
  hours: string
  minutes: string
  startTime: string
  endTime: string
  isHoliday: boolean
  hasOvertime: boolean
  overtimeHours: string
  overtimeMinutes: string
  hasNightHours: boolean
  nightHours: string
  nightMinutes: string
  hasPartialDayOff: boolean
  partialDayOffHours: string
  partialDayOffMinutes: string
  details: string
  funcaoContrato: string
  editReason: string
}

const emptyValues = (entryDate: string): TimeEntryFormValues => ({
  startDate: entryDate,
  endDate: entryDate,
  weekdaysOnly: true,
  emObra: false,
  numeroObra: '',
  clientId: '',
  projectCode: '',
  activityId: '',
  disciplineCode: 'C',
  hours: '',
  minutes: '',
  startTime: '',
  endTime: '',
  isHoliday: false,
  hasOvertime: false,
  overtimeHours: '',
  overtimeMinutes: '',
  hasNightHours: false,
  nightHours: '',
  nightMinutes: '',
  hasPartialDayOff: false,
  partialDayOffHours: '',
  partialDayOffMinutes: '',
  details: '',
  funcaoContrato: '',
  editReason: '',
})

function valuesFromEntry(entry: TimeEntry): TimeEntryFormValues {
  return {
    startDate: entry.entryDate,
    endDate: entry.entryDate,
    weekdaysOnly: true,
    emObra: entry.emObra,
    numeroObra: entry.numeroObra ?? '',
    clientId: entry.clientId,
    projectCode: entry.projectCode,
    activityId: entry.activityId,
    disciplineCode: 'C',
    hours: String(Math.floor(entry.durationMinutes / 60)),
    minutes: String(entry.durationMinutes % 60),
    startTime: '',
    endTime: '',
    isHoliday: entry.isHoliday,
    hasOvertime: entry.overtimeMinutes > 0,
    overtimeHours: entry.overtimeMinutes > 0 ? String(Math.floor(entry.overtimeMinutes / 60)) : '',
    overtimeMinutes: entry.overtimeMinutes > 0 ? String(entry.overtimeMinutes % 60) : '',
    hasNightHours: entry.nightMinutes > 0,
    nightHours: entry.nightMinutes > 0 ? String(Math.floor(entry.nightMinutes / 60)) : '',
    nightMinutes: entry.nightMinutes > 0 ? String(entry.nightMinutes % 60) : '',
    hasPartialDayOff: entry.partialDayOffMinutes > 0,
    partialDayOffHours: entry.partialDayOffMinutes > 0 ? String(Math.floor(entry.partialDayOffMinutes / 60)) : '',
    partialDayOffMinutes: entry.partialDayOffMinutes > 0 ? String(entry.partialDayOffMinutes % 60) : '',
    details: entry.details,
    funcaoContrato: entry.funcaoContrato ?? '',
    editReason: '',
  }
}

type FormMode = 'CREATE' | 'EDIT' | 'DUPLICATE'

export function useTimeEntryForm({ initialDate, entryId, duplicateId }: { initialDate: string; entryId?: string; duplicateId?: string }) {
  const { profile } = useSession()
  const mode: FormMode = entryId ? 'EDIT' : duplicateId ? 'DUPLICATE' : 'CREATE'
  const sourceId = entryId ?? duplicateId
  const [source, setSource] = useState<TimeEntry | null>(null)
  const [values, setValues] = useState<TimeEntryFormValues>(() => emptyValues(initialDate))
  const [errors, setErrors] = useState<TimeEntryValidationErrors>({})
  const [editReasonError, setEditReasonError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(sourceId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [extractedRdoDays, setExtractedRdoDays] = useState<ParsedRDODay[]>([])

  const calculateClassifiedDuration = useCallback((entryDate: string) => {
    const overtimeMinutes = values.hasOvertime
      ? hoursAndMinutesToMinutes(Number(values.overtimeHours || 0), Number(values.overtimeMinutes || 0))
      : 0
    const nightMinutes = values.hasNightHours
      ? hoursAndMinutesToMinutes(Number(values.nightHours || 0), Number(values.nightMinutes || 0))
      : 0
    const partialDayOffMinutes = values.hasPartialDayOff
      ? hoursAndMinutesToMinutes(Number(values.partialDayOffHours || 0), Number(values.partialDayOffMinutes || 0))
      : 0
    const isSpecialDay = values.isHoliday || isWeekend(entryDate)
    const durationMinutes = isSpecialDay
      ? hoursAndMinutesToMinutes(Number(values.hours || 0), Number(values.minutes || 0))
      : Math.max(NORMAL_WORKDAY_MINUTES + overtimeMinutes - partialDayOffMinutes, 0)

    return {
      durationMinutes,
      overtimeMinutes: isSpecialDay ? 0 : overtimeMinutes,
      nightMinutes,
      partialDayOffMinutes: isSpecialDay ? 0 : partialDayOffMinutes,
      dayType: values.isHoliday ? 'HOLIDAY' as const : isWeekend(entryDate) ? 'WEEKEND' as const : 'WEEKDAY' as const,
    }
  }, [values.hasNightHours, values.hasOvertime, values.hasPartialDayOff, values.isHoliday, values.nightHours, values.nightMinutes, values.hours, values.minutes, values.overtimeHours, values.overtimeMinutes, values.partialDayOffHours, values.partialDayOffMinutes])

  useEffect(() => {
    if (!profile || !sourceId) return
    let active = true
    setIsLoading(true)
    timeEntryService.getById(profile.id, sourceId)
      .then((entry) => {
        if (!active) return
        if (!entry) {
          setSubmitError('O apontamento solicitado não foi encontrado.')
          return
        }
        setSource(entry)
        setValues(valuesFromEntry(entry))
      })
      .catch(() => active && setSubmitError('Não foi possível carregar o apontamento.'))
      .finally(() => active && setIsLoading(false))
    return () => { active = false }
  }, [profile, sourceId])

  const setField = useCallback(<Key extends keyof TimeEntryFormValues>(field: Key, value: TimeEntryFormValues[Key]) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'editReason') setEditReasonError(null)
    else setErrors((current) => ({ ...current, [field]: undefined }))
  }, [])

  const submit = async () => {
    if (!profile || isSubmitting) return false
    setSubmitError(null)
    setSuccessMessage(null)
    const durationHours = Number(values.hours || 0)
    const durationRemainderMinutes = Number(values.minutes || 0)
    const hasExtractedRdoDays = mode === 'CREATE' && extractedRdoDays.length > 0
    const firstExtractedDay = extractedRdoDays[0]
    const effectiveStartDate = hasExtractedRdoDays ? firstExtractedDay.data : values.startDate
    const effectiveEndDate = hasExtractedRdoDays ? firstExtractedDay.data : mode === 'CREATE' ? values.endDate : values.startDate
    const effectiveWeekdaysOnly = hasExtractedRdoDays ? false : mode === 'CREATE' ? values.weekdaysOnly : true
    const periodDates = mode === 'CREATE' && !hasExtractedRdoDays
      ? expandTimeEntryDates(values.startDate, effectiveEndDate, effectiveWeekdaysOnly)
      : [values.startDate]
    const classifiedHours = calculateClassifiedDuration(effectiveStartDate)
    const activityRequiresWorkSiteNumber = values.emObra || requiresWorkSiteNumber(values.activityId)
    const data: CreateTimeEntryData = {
      entryDate: effectiveStartDate,
      endDate: effectiveEndDate,
      weekdaysOnly: effectiveWeekdaysOnly,
      emObra: values.emObra,
      numeroObra: activityRequiresWorkSiteNumber ? values.numeroObra : undefined,
      clientId: values.clientId,
      projectCode: activityRequiresWorkSiteNumber ? values.numeroObra : values.projectCode,
      activityId: values.activityId,
      disciplineCode: 'C',
      durationMinutes: hasExtractedRdoDays
        ? hoursAndMinutesToMinutes(firstExtractedDay.horas, firstExtractedDay.minutos)
        : classifiedHours.durationMinutes,
      dayType: hasExtractedRdoDays ? (isWeekend(firstExtractedDay.data) ? 'WEEKEND' : 'WEEKDAY') : classifiedHours.dayType,
      isHoliday: hasExtractedRdoDays ? false : values.isHoliday,
      overtimeMinutes: hasExtractedRdoDays ? 0 : classifiedHours.overtimeMinutes,
      nightMinutes: hasExtractedRdoDays ? 0 : classifiedHours.nightMinutes,
      partialDayOffMinutes: hasExtractedRdoDays ? 0 : classifiedHours.partialDayOffMinutes,
      details: hasExtractedRdoDays ? firstExtractedDay.detalhamento : values.details,
      funcaoContrato: values.funcaoContrato,
    }
    let dateBlock = { blocked: false } as Awaited<ReturnType<typeof entryDateAvailabilityService.getBlock>>
    if (isIsoDate(data.entryDate)) {
      try {
        dateBlock = await entryDateAvailabilityService.getBlock(profile.id, data.entryDate)
      } catch {
        setSubmitError('Não foi possível verificar os eventos desta data. Tente novamente.')
        return false
      }
    }
    const validationErrors = validateTimeEntry(data, demoClients, demoActivities, { today: getCorporateToday() })
    if (dateBlock.blocked) validationErrors.entryDate = dateBlock.message
    if (!hasExtractedRdoDays && (values.isHoliday || isWeekend(effectiveStartDate)) && !areValidDurationParts(durationHours, durationRemainderMinutes)) {
      validationErrors.durationMinutes = 'Informe horas inteiras entre 0 e 24 e minutos inteiros entre 0 e 59, com total máximo de 24 horas.'
    }
    if (!hasExtractedRdoDays) {
      if (values.hasOvertime && !areValidDurationParts(Number(values.overtimeHours || 0), Number(values.overtimeMinutes || 0))) validationErrors.overtimeMinutes = 'Informe horas extras válidas.'
      if (values.hasNightHours && !areValidDurationParts(Number(values.nightHours || 0), Number(values.nightMinutes || 0))) validationErrors.nightMinutes = 'Informe horas noturnas válidas.'
      if (values.hasPartialDayOff && !areValidDurationParts(Number(values.partialDayOffHours || 0), Number(values.partialDayOffMinutes || 0))) validationErrors.partialDayOffMinutes = 'Informe horas de folga válidas.'
    }
    if (mode === 'CREATE') {
      if (hasExtractedRdoDays) {
        const invalidExtractedDay = extractedRdoDays.find((day) => !isIsoDate(day.data) || !day.detalhamento.trim() || !areValidDurationParts(day.horas, day.minutos))
        if (invalidExtractedDay) {
          setSubmitError('O RDO possui um ou mais dias com data, duração ou detalhamento inválido.')
          return false
        }
      } else if (!isIsoDate(values.endDate)) {
        validationErrors.endDate = 'Informe uma data final válida.'
      } else if (values.endDate < values.startDate) {
        validationErrors.endDate = 'A data final deve ser igual ou posterior à data inicial.'
      } else if (values.startDate !== values.endDate && periodDates.length === 0) {
        setSubmitError('O período selecionado não contém dias úteis para lançamento.')
        return false
      }
    }
    const reasonError = mode === 'EDIT' && !values.editReason.trim() ? 'Informe o motivo da edição.' : null
    setErrors(validationErrors)
    setEditReasonError(reasonError)
    if (Object.keys(validationErrors).length > 0 || reasonError) return false
    if ((mode === 'EDIT' || mode === 'DUPLICATE') && !source) {
      setSubmitError('O apontamento de origem não está disponível.')
      return false
    }

    const syncOrQueueApontamentos = async (entries: CreateTimeEntryData[]) => {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine
      for (const entry of entries) {
        const payload = buildApiApontamentoPayload(profile.id, entry, {
          startTime: values.startTime,
          endTime: values.endTime,
        })
        if (!isOnline) {
          offlineQueueService.enqueueApontamento(profile.id, entry, {
            startTime: values.startTime,
            endTime: values.endTime,
          })
          continue
        }
        try {
          await backendApi.createApontamento(payload)
        } catch {
          offlineQueueService.enqueueApontamento(profile.id, entry, {
            startTime: values.startTime,
            endTime: values.endTime,
          })
        }
      }
    }

    setIsSubmitting(true)
    try {
      if (mode === 'EDIT' && source) {
        const updated = await timeEntryService.update(profile.id, source.id, source.version, data, values.editReason)
        setSource(updated)
        setValues(valuesFromEntry(updated))
        setSuccessMessage('Apontamento atualizado com sucesso.')
      } else if (mode === 'DUPLICATE' && source) {
        await timeEntryService.duplicate(profile.id, source.id, source.version, data)
        await syncOrQueueApontamentos([data])
        setSuccessMessage('Apontamento duplicado com sucesso.')
      } else {
        if (hasExtractedRdoDays) {
          const extractedEntries: CreateTimeEntryData[] = extractedRdoDays.map((day) => ({
            ...data,
            entryDate: day.data,
            endDate: day.data,
            weekdaysOnly: false,
            numeroObra: values.projectCode || values.numeroObra || day.numeroObra,
            projectCode: values.projectCode || values.numeroObra || day.numeroObra,
            durationMinutes: hoursAndMinutesToMinutes(day.horas, day.minutos),
            dayType: isWeekend(day.data) ? 'WEEKEND' : 'WEEKDAY',
            isHoliday: false,
            overtimeMinutes: 0,
            nightMinutes: 0,
            partialDayOffMinutes: 0,
            details: day.detalhamento,
          }))
          await Promise.all(extractedEntries.map((entry) => timeEntryService.create(profile.id, entry)))
          await syncOrQueueApontamentos(extractedEntries)
          setSuccessMessage(`${extractedRdoDays.length} lançamentos do RDO salvos individualmente com sucesso.`)
        } else {
          await timeEntryService.create(profile.id, data)
          const entriesToSync = periodDates.map((date) => ({
            ...data,
            entryDate: date,
            endDate: date,
            weekdaysOnly: false,
          }))
          await syncOrQueueApontamentos(entriesToSync)
          setSuccessMessage(periodDates.length > 1
            ? `${periodDates.length} lançamentos salvos com sucesso para o período selecionado.`
            : 'Apontamento salvo com sucesso.')
        }
      }
      setErrors({})
      setEditReasonError(null)
      if (mode !== 'EDIT') {
        setValues(emptyValues(data.entryDate))
        setExtractedRdoDays([])
      }
      return true
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o apontamento localmente.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    mode,
    values,
    errors,
    editReasonError,
    isLoading,
    isSubmitting,
    submitError,
    successMessage,
    extractedRdoDays,
    setField,
    setExtractedRdoDays,
    submit,
  }
}
