import { useState, type ChangeEvent } from 'react'
import { demoClients } from '../../mocks/demoData'
import { formatDatePtBr } from '../../shared/utils/date'
import { allTimeEntryActivities, requiresWorkSiteNumber } from './domain'
import { parseRDO } from './rdoParser'
import type { ParsedRDODay } from './rdoParser'
import type { TimeEntryValidationErrors } from './types'
import type { TimeEntryFormValues } from './useTimeEntryForm'

const VALE_CLIENT_ID = 'client-vale'

export const fieldClassName = 'mt-2 w-full ui-field rounded-xl px-3 py-2.5 text-sm ui-text shadow-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)]'

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null
  return <p id={id} className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-300">{message}</p>
}

function formatRdoDayDuration(day: ParsedRDODay) {
  return `${day.horas}h${String(day.minutos).padStart(2, '0')}`
}

function formatRdoDetailsForReview(days: ParsedRDODay[]) {
  return days
    .map((day) => `--- Dia ${formatDatePtBr(day.data)} ---\n${day.detalhamento}`)
    .join('\n\n')
}

type TimeEntryFieldsProps = {
  values: TimeEntryFormValues
  errors: TimeEntryValidationErrors
  maxDate: string
  allowBatchMode?: boolean
  entryMode?: 'manual' | 'rdo'
  extractedRdoDays: ParsedRDODay[]
  onRdoDaysChange: (days: ParsedRDODay[]) => void
  onChange: <Key extends keyof TimeEntryFormValues>(field: Key, value: TimeEntryFormValues[Key]) => void
}

export function TimeEntryFields({ values, errors, maxDate, allowBatchMode = true, entryMode = 'manual', extractedRdoDays, onRdoDaysChange, onChange }: TimeEntryFieldsProps) {
  const [rdoStatus, setRdoStatus] = useState<'idle' | 'reading' | 'success' | 'error'>('idle')
  const [rdoMessage, setRdoMessage] = useState<string | null>(null)
  const [mostrarTodosDias, setMostrarTodosDias] = useState(false)
  const activityOptions = allTimeEntryActivities
  const activityRequiresWorkSiteNumber = entryMode === 'rdo' || requiresWorkSiteNumber(values.activityId)
  const hasExtractedRdoDays = extractedRdoDays.length > 0
  const rdoSummary = extractedRdoDays
    .slice(0, 4)
    .map((day) => `${formatDatePtBr(day.data)} (${formatRdoDayDuration(day)})`)
    .join(', ')

  async function handleRDOImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRdoStatus('reading')
    setRdoMessage('Lendo PDF localmente...')
    try {
      const parsed = await parseRDO(file)
      let appliedFields = 0
      setMostrarTodosDias(false)
      onChange('emObra', true)
      onChange('activityId', '')
      onChange('clientId', VALE_CLIENT_ID)
      appliedFields += 1
      if (parsed.numeroObra) {
        onChange('numeroObra', parsed.numeroObra)
        onChange('projectCode', parsed.numeroObra)
        appliedFields += 1
      }
      if (parsed.dias.length > 0) {
        const orderedDays = [...parsed.dias].sort((left, right) => left.data.localeCompare(right.data))
        onRdoDaysChange(orderedDays)
        const firstDay = orderedDays[0]
        const lastDay = orderedDays.at(-1) ?? firstDay
        onChange('startDate', firstDay.data)
        onChange('endDate', lastDay.data)
        onChange('hours', String(firstDay.horas))
        onChange('minutes', String(firstDay.minutos))
        onChange('details', formatRdoDetailsForReview(orderedDays))
        appliedFields += 1
      } else {
        onRdoDaysChange([])
      }
      setRdoStatus(appliedFields > 0 ? 'success' : 'error')
      setRdoMessage(appliedFields > 0
        ? 'RDO lido com sucesso. Revise os campos antes de salvar.'
        : 'Não foi possível identificar dados compatíveis nesse RDO.')
    } catch (error) {
      setRdoStatus('error')
      setRdoMessage(error instanceof Error ? error.message : 'Não foi possível ler o PDF informado.')
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="entry-start-date" className="text-sm font-bold ui-text">Data Inicial</label>
            <input id="entry-start-date" name="startDate" type="date" max={maxDate} value={values.startDate} onChange={(event) => onChange('startDate', event.target.value)} className={fieldClassName} disabled={hasExtractedRdoDays} aria-invalid={Boolean(errors.entryDate)} aria-describedby={errors.entryDate ? 'entry-start-date-error' : undefined} />
            <FieldError id="entry-start-date-error" message={errors.entryDate} />
          </div>
          <div>
            <label htmlFor="entry-end-date" className="text-sm font-bold ui-text">Data Final</label>
            <input id="entry-end-date" name="endDate" type="date" min={values.startDate} value={values.endDate} onChange={(event) => onChange('endDate', event.target.value)} className={fieldClassName} disabled={!allowBatchMode || hasExtractedRdoDays} aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? 'entry-end-date-error' : undefined} />
            <FieldError id="entry-end-date-error" message={errors.endDate} />
          </div>
        </div>
        <p className="mt-2 text-xs ui-text-subtle">
          Se a data final for diferente, o sistema criará automaticamente lançamentos individuais para cada dia do período.
        </p>
        <label className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold ui-text ${allowBatchMode ? '' : 'opacity-60'}`}>
          <input type="checkbox" checked={values.weekdaysOnly} onChange={(event) => onChange('weekdaysOnly', event.target.checked)} disabled={!allowBatchMode || hasExtractedRdoDays} className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-[var(--color-primary)]" />
          Somente dias úteis
        </label>
        {hasExtractedRdoDays && (
          <div className="mt-3 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-navigation-active)] px-3 py-2 text-xs font-semibold text-[var(--color-navigation-active-text)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p>
                {extractedRdoDays.length} dia(s) lido(s): {mostrarTodosDias ? 'as datas e durações abaixo serão salvas individualmente pelo RDO.' : `${rdoSummary}${extractedRdoDays.length > 4 ? '...' : ''}.`}
              </p>
              <button type="button" onClick={() => setMostrarTodosDias((current) => !current)} className="text-left text-xs font-extrabold underline decoration-[var(--color-primary)] underline-offset-4 sm:text-right">
                {mostrarTodosDias ? 'Ocultar' : 'Ver todos'}
              </button>
            </div>
            {mostrarTodosDias && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {extractedRdoDays.map((day) => (
                  <li key={day.data} className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-surface)]/70 px-3 py-2">
                    <span className="block font-extrabold">{formatDatePtBr(day.data)}</span>
                    <span className="mt-1 block ui-text-muted">{formatRdoDayDuration(day)} lançadas</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {entryMode === 'rdo' && (
        <>
          <div className="md:col-span-2 rounded-2xl border ui-border ui-surface-subtle p-4">
            <label htmlFor="rdo-upload" className="text-sm font-bold ui-text">Importar arquivo RDO para preenchimento automático</label>
            <input id="rdo-upload" name="rdoUpload" type="file" accept=".pdf,application/pdf" onChange={(event) => void handleRDOImport(event)} disabled={rdoStatus === 'reading'} className={`${fieldClassName} file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#06241f] disabled:opacity-60`} />
            <p className="mt-2 text-xs ui-text-subtle">O PDF é lido apenas no navegador para preencher os campos. O arquivo não é salvo nem enviado.</p>
            {rdoMessage && (
              <p className={`mt-2 text-sm font-semibold ${rdoStatus === 'error' ? 'text-red-700 dark:text-red-300' : 'text-[var(--color-primary)]'}`} role={rdoStatus === 'error' ? 'alert' : 'status'}>
                {rdoMessage}
              </p>
            )}
          </div>
        </>
      )}

      <div>
        <label htmlFor="client" className="text-sm font-bold ui-text">Cliente</label>
        <select id="client" name="clientId" value={values.clientId} onChange={(event) => onChange('clientId', event.target.value)} className={fieldClassName} aria-invalid={Boolean(errors.clientId)} aria-describedby={errors.clientId ? 'client-error' : undefined}>
          <option value="">Selecione um cliente</option>
          {demoClients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <FieldError id="client-error" message={errors.clientId} />
      </div>

      <div>
        <label htmlFor="project-code" className="text-sm font-bold ui-text">Número do projeto / obra{activityRequiresWorkSiteNumber ? ' *' : ''}</label>
        <input id="project-code" name="projectCode" type="text" value={values.projectCode} onChange={(event) => { onChange('projectCode', event.target.value); onChange('numeroObra', event.target.value) }} className={fieldClassName} placeholder="Digite o número do projeto ou da obra" aria-invalid={Boolean(errors.projectCode || errors.numeroObra)} aria-describedby={errors.projectCode ? 'project-code-help project-code-error' : 'project-code-help'} />
        <p id="project-code-help" className="mt-1.5 text-xs ui-text-subtle">
          Informe livremente o projeto ou a obra vinculada ao apontamento.
        </p>
        <FieldError id="project-code-error" message={errors.projectCode} />
        <FieldError id="work-site-number-error" message={errors.numeroObra} />
      </div>

      <div>
        <label htmlFor="activity" className="text-sm font-bold ui-text">Atividade realizada</label>
        <select id="activity" name="activityId" value={values.activityId} onChange={(event) => onChange('activityId', event.target.value)} className={fieldClassName} aria-invalid={Boolean(errors.activityId)} aria-describedby={errors.activityId ? 'activity-error' : undefined}>
          <option value="">Selecione uma atividade</option>
          {activityOptions.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
        </select>
        <FieldError id="activity-error" message={errors.activityId} />
      </div>

      <div>
        <label htmlFor="discipline" className="text-sm font-bold ui-text">Disciplina</label>
        <input id="discipline" name="disciplineCode" type="text" value="C – Campo" readOnly className={`${fieldClassName} font-semibold`} aria-invalid={Boolean(errors.disciplineCode)} aria-describedby={errors.disciplineCode ? 'discipline-error' : 'discipline-help'} />
        <p id="discipline-help" className="mt-1.5 text-xs ui-text-subtle">Valor fixo para apontamentos do Banco de Horas 2.</p>
        <FieldError id="discipline-error" message={errors.disciplineCode} />
      </div>
    </div>
  )
}
