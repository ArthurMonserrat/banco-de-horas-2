import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { getCorporateToday, isIsoDate, isWeekend } from '../../shared/utils/date'
import { FieldError, fieldClassName, TimeEntryFields } from './TimeEntryFields'
import { formatMinutes, hoursAndMinutesToMinutes, NORMAL_WORKDAY_MINUTES } from './domain'
import { useTimeEntryForm } from './useTimeEntryForm'
import { CreateRdoButton } from '../rdo/CreateRdoButton'
import { useSession } from '../session/useSession'

function hourMinuteFields({
  idPrefix,
  label,
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  error,
}: {
  idPrefix: string
  label: string
  hours: string
  minutes: string
  onHoursChange: (value: string) => void
  onMinutesChange: (value: string) => void
  error?: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold ui-text-muted">{label}</p>
      <div className="mt-2 grid max-w-sm grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-hours`} className="text-xs font-semibold ui-text-muted">Horas</label>
          <input id={`${idPrefix}-hours`} type="number" min="0" max="24" step="1" inputMode="numeric" value={hours} onChange={(event) => onHoursChange(event.target.value)} className={fieldClassName} aria-invalid={Boolean(error)} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-minutes`} className="text-xs font-semibold ui-text-muted">Minutos</label>
          <input id={`${idPrefix}-minutes`} type="number" min="0" max="59" step="1" inputMode="numeric" value={minutes} onChange={(event) => onMinutesChange(event.target.value)} className={fieldClassName} aria-invalid={Boolean(error)} />
        </div>
      </div>
    </div>
  )
}

export function TimeEntryForm({ entryId }: { entryId?: string }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const formRef = useRef<HTMLFormElement>(null)
  const [entryMode, setEntryMode] = useState<'manual' | 'rdo'>('manual')
  const { session, profile } = useSession()
  const navigationState = location.state as { initialDate?: string; selectedDate?: string } | null
  const routedInitialDate = searchParams.get('date') ?? navigationState?.initialDate ?? navigationState?.selectedDate
  const controller = useTimeEntryForm({
    initialDate: routedInitialDate && isIsoDate(routedInitialDate) ? routedInitialDate : getCorporateToday(),
    entryId,
    duplicateId: entryId ? undefined : searchParams.get('duplicate') ?? undefined,
  })

  useEffect(() => {
    if (Object.keys(controller.errors).length === 0 && !controller.editReasonError) return
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }, [controller.editReasonError, controller.errors])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await controller.submit()
  }

  const handleEntryModeChange = (mode: 'manual' | 'rdo') => {
    setEntryMode(mode)
    controller.setField('emObra', mode === 'rdo')
    controller.setField('activityId', '')
    // Na importação de RDO o horário vem de cada dia (hora manual), não dos campos gerais.
    controller.setField('startTime', '')
    controller.setField('endTime', '')
    controller.setField('rdoHoraManual', false)
    if (mode === 'manual') {
      controller.setField('numeroObra', '')
      controller.setExtractedRdoDays([])
    }
  }

  if (controller.isLoading) return <p aria-live="polite" className="text-sm font-semibold ui-text-muted">Carregando apontamento…</p>

  const submitLabel = controller.mode === 'EDIT' ? 'Salvar alterações' : controller.mode === 'DUPLICATE' ? 'Salvar duplicação' : 'Salvar apontamento'
  const hasExtractedRdoDays = controller.extractedRdoDays.length > 0
  const isSpecialDay = controller.values.isHoliday || isWeekend(controller.values.startDate)
  const overtimeMinutes = controller.values.hasOvertime ? hoursAndMinutesToMinutes(Number(controller.values.overtimeHours || 0), Number(controller.values.overtimeMinutes || 0)) : 0
  const partialDayOffMinutes = controller.values.hasPartialDayOff ? hoursAndMinutesToMinutes(Number(controller.values.partialDayOffHours || 0), Number(controller.values.partialDayOffMinutes || 0)) : 0
  const calculatedWorkdayMinutes = Math.max(NORMAL_WORKDAY_MINUTES + overtimeMinutes - partialDayOffMinutes, 0)

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
      {controller.successMessage && (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-bold">{controller.successMessage}</p>
          <Link className="mt-2 inline-block font-bold underline" to={`/colaborador?date=${controller.values.startDate}`}>Ver resumo atualizado do período</Link>
        </div>
      )}
      {controller.submitError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{controller.submitError}</p>}

      {controller.mode === 'CREATE' && (
        <fieldset className="rounded-2xl border ui-border ui-surface-subtle p-4">
          <legend className="px-1 text-sm font-bold ui-text">Como deseja preencher?</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => handleEntryModeChange('rdo')} className={`rounded-xl border px-4 py-3 text-left transition ${entryMode === 'rdo' ? 'border-[var(--color-primary)] bg-[var(--color-navigation-active)] text-[var(--color-navigation-active-text)]' : 'ui-border bg-[var(--color-surface)] ui-text-muted hover:border-[var(--color-primary)]'}`}>
              <span className="block text-sm font-extrabold">Importar RDO</span>
              <span className="mt-1 block text-xs">Leia um PDF localmente e preencha os dados automaticamente.</span>
            </button>
            <button type="button" onClick={() => handleEntryModeChange('manual')} className={`rounded-xl border px-4 py-3 text-left transition ${entryMode === 'manual' ? 'border-[var(--color-primary)] bg-[var(--color-navigation-active)] text-[var(--color-navigation-active-text)]' : 'ui-border bg-[var(--color-surface)] ui-text-muted hover:border-[var(--color-primary)]'}`}>
              <span className="block text-sm font-extrabold">Preencher manualmente</span>
              <span className="mt-1 block text-xs">Informe os dados e, se necessário, prepare uma estrutura de RDO.</span>
            </button>
          </div>
        </fieldset>
      )}

      <TimeEntryFields
        values={controller.values}
        errors={controller.errors}
        maxDate={getCorporateToday()}
        allowBatchMode={controller.mode === 'CREATE'}
        entryMode={entryMode}
        extractedRdoDays={controller.extractedRdoDays}
        onRdoDaysChange={controller.setExtractedRdoDays}
        collaboratorName={profile?.name ?? session?.name}
        onChange={controller.setField}
      />

      <fieldset className="rounded-2xl border ui-border ui-surface-subtle p-4">
        <legend className="px-1 text-sm font-bold ui-text">Detalhamento de horas</legend>
        <p className="mt-1 text-xs ui-text-subtle">O horário de almoço já deve estar deduzido nos totais do RDO ou nos valores calculados.</p>

        {hasExtractedRdoDays ? (
          <p className="mt-3 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold ui-text">
            As durações serão salvas a partir de cada dia importado do RDO.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold ui-text">
              <input type="checkbox" checked={controller.values.isHoliday} onChange={(event) => controller.setField('isHoliday', event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
              É feriado?
            </label>

            {isSpecialDay ? (
              <>
                {hourMinuteFields({
                  idPrefix: 'duration',
                  label: controller.values.isHoliday ? 'Quantidade de horas totais no feriado' : 'Quantidade de horas totais no fim de semana',
                  hours: controller.values.hours,
                  minutes: controller.values.minutes,
                  onHoursChange: (value) => controller.setField('hours', value),
                  onMinutesChange: (value) => controller.setField('minutes', value),
                  error: controller.errors.durationMinutes,
                })}
                <label className="inline-flex items-center gap-2 text-sm font-semibold ui-text">
                  <input type="checkbox" checked={controller.values.hasNightHours} onChange={(event) => controller.setField('hasNightHours', event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
                  Teve hora noturna (22h às 05h)?
                </label>
                {controller.values.hasNightHours && hourMinuteFields({
                  idPrefix: 'night',
                  label: 'Quantidade de horas noturnas',
                  hours: controller.values.nightHours,
                  minutes: controller.values.nightMinutes,
                  onHoursChange: (value) => controller.setField('nightHours', value),
                  onMinutesChange: (value) => controller.setField('nightMinutes', value),
                  error: controller.errors.nightMinutes,
                })}
              </>
            ) : (
              <>
                <div className="rounded-xl border ui-border bg-[var(--color-surface)] px-3 py-2 text-sm ui-text">
                  <p className="font-bold">Carga normal travada</p>
                  <p className="mt-1 ui-text-muted">{formatMinutes(NORMAL_WORKDAY_MINUTES)} para dia útil sem hora extra.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold ui-text">
                  <input type="checkbox" checked={controller.values.hasOvertime} onChange={(event) => controller.setField('hasOvertime', event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
                  Teve hora extra?
                </label>
                {controller.values.hasOvertime && hourMinuteFields({
                  idPrefix: 'overtime',
                  label: 'Quantidade de horas extras',
                  hours: controller.values.overtimeHours,
                  minutes: controller.values.overtimeMinutes,
                  onHoursChange: (value) => controller.setField('overtimeHours', value),
                  onMinutesChange: (value) => controller.setField('overtimeMinutes', value),
                  error: controller.errors.overtimeMinutes,
                })}
                <label className="inline-flex items-center gap-2 text-sm font-semibold ui-text">
                  <input type="checkbox" checked={controller.values.hasNightHours} onChange={(event) => controller.setField('hasNightHours', event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
                  Teve hora noturna (22h às 05h)?
                </label>
                {controller.values.hasNightHours && hourMinuteFields({
                  idPrefix: 'night',
                  label: 'Quantidade de horas noturnas',
                  hours: controller.values.nightHours,
                  minutes: controller.values.nightMinutes,
                  onHoursChange: (value) => controller.setField('nightHours', value),
                  onMinutesChange: (value) => controller.setField('nightMinutes', value),
                  error: controller.errors.nightMinutes,
                })}
                <label className="inline-flex items-center gap-2 text-sm font-semibold ui-text">
                  <input type="checkbox" checked={controller.values.hasPartialDayOff} onChange={(event) => controller.setField('hasPartialDayOff', event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
                  Teve folga parcial no dia?
                </label>
                {controller.values.hasPartialDayOff && hourMinuteFields({
                  idPrefix: 'partial-day-off',
                  label: 'Quantidade de horas de folga',
                  hours: controller.values.partialDayOffHours,
                  minutes: controller.values.partialDayOffMinutes,
                  onHoursChange: (value) => controller.setField('partialDayOffHours', value),
                  onMinutesChange: (value) => controller.setField('partialDayOffMinutes', value),
                  error: controller.errors.partialDayOffMinutes,
                })}
                <p className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold ui-text">
                  Total calculado para lançamento: {formatMinutes(calculatedWorkdayMinutes)}
                </p>
              </>
            )}
          </div>
        )}
        <FieldError id="duration-error" message={controller.errors.durationMinutes} />
        <FieldError id="overtime-error" message={controller.errors.overtimeMinutes} />
        <FieldError id="night-error" message={controller.errors.nightMinutes} />
        <FieldError id="partial-day-off-error" message={controller.errors.partialDayOffMinutes} />
      </fieldset>

      {entryMode !== 'rdo' && <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start-time" className="text-sm font-bold ui-text">Hora de início</label>
          <input id="start-time" name="startTime" type="time" value={controller.values.startTime} onChange={(event) => controller.setField('startTime', event.target.value)} className={fieldClassName} aria-describedby="time-help" />
        </div>
        <div>
          <label htmlFor="end-time" className="text-sm font-bold ui-text">Hora de fim</label>
          <input id="end-time" name="endTime" type="time" value={controller.values.endTime} onChange={(event) => controller.setField('endTime', event.target.value)} className={fieldClassName} aria-describedby="time-help" />
        </div>
        <p id="time-help" className="text-xs ui-text-subtle sm:col-span-2">Esses horários são usados na geração do RDO e são opcionais no apontamento.</p>
      </div>}

      <div>
        <label htmlFor="details" className="text-sm font-bold ui-text">Detalhamento das atividades</label>
        <textarea id="details" name="details" rows={5} value={controller.values.details} onChange={(event) => controller.setField('details', event.target.value)} className={fieldClassName} placeholder="Descreva objetivamente o trabalho realizado" aria-invalid={Boolean(controller.errors.details)} aria-describedby={controller.errors.details ? 'details-error' : 'details-help'} />
        <p id="details-help" className="mt-1.5 text-xs ui-text-subtle">Obrigatório. Não inclua senhas, dados pessoais ou informações sensíveis.</p>
        <FieldError id="details-error" message={controller.errors.details} />
      </div>

      <div>
        <label htmlFor="funcao-contrato" className="text-sm font-bold ui-text">Função do profissional de acordo com o contrato do cliente final</label>
        <input id="funcao-contrato" name="funcaoContrato" type="text" value={controller.values.funcaoContrato} onChange={(event) => controller.setField('funcaoContrato', event.target.value)} className={fieldClassName} placeholder="Informe a função conforme o contrato" aria-describedby="funcao-contrato-help" />
        <p id="funcao-contrato-help" className="mt-1.5 text-xs ui-text-subtle">Preencher a categoria conforme EAP do plano de trabalho do cliente final ou instrução do gestor.</p>
      </div>

      {controller.mode === 'EDIT' && (
        <div>
          <label htmlFor="edit-reason" className="text-sm font-bold ui-text">Motivo da edição</label>
          <textarea id="edit-reason" name="editReason" rows={3} value={controller.values.editReason} onChange={(event) => controller.setField('editReason', event.target.value)} className={fieldClassName} aria-invalid={Boolean(controller.editReasonError)} aria-describedby={controller.editReasonError ? 'edit-reason-error' : undefined} />
          <FieldError id="edit-reason-error" message={controller.editReasonError} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t ui-border pt-5 sm:flex-row sm:justify-end">
        <Link to="/colaborador/historico" className="rounded-xl border ui-border px-5 py-3 text-center text-sm font-bold ui-text hover:bg-[var(--color-surface-subtle)]">Voltar ao histórico</Link>
        <button type="submit" disabled={controller.isSubmitting} className="rounded-xl ui-button-primary px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60">
          {controller.isSubmitting ? 'Salvando…' : submitLabel}
        </button>
      </div>
      <CreateRdoButton values={controller.values} />
    </form>
  )
}
