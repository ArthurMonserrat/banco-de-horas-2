import { demoActivities, demoClients } from '../../mocks/demoData'
import type { TimeEntry } from '../../shared/types/domain'
import type { OfflineQueueItem } from '../../services/offlineQueueService'
import { formatMinutes } from '../time-entries/domain'
import { EntryRevisionBadge } from '../time-entries/EntryRevisionBadge'

export function DailyEntryList({ entries, pendingEntries = [] }: { entries: TimeEntry[]; pendingEntries?: OfflineQueueItem[] }) {
  const activeEntries = entries.filter((entry) => entry.status === 'ACTIVE')
  const matchesPendingEntry = (entry: TimeEntry, pending: OfflineQueueItem) => (
    pending.entry.entryDate === entry.entryDate
    && pending.entry.projectCode === entry.projectCode
    && pending.entry.activityId === entry.activityId
    && pending.entry.durationMinutes === entry.durationMinutes
    && pending.entry.details === entry.details
  )
  const pendingWithoutLocalEntry = pendingEntries.filter((pending) => !activeEntries.some((entry) => matchesPendingEntry(entry, pending)))

  return (
    <section className="rounded-2xl border ui-border ui-surface shadow-sm" aria-labelledby="daily-entries-title">
      <div className="border-b ui-border p-5">
        <div>
          <h2 id="daily-entries-title" className="text-lg font-extrabold ui-heading">Apontamentos do dia</h2>
          <p className="mt-1 text-sm ui-text-subtle">Somente seus registros ativos para a data selecionada.</p>
        </div>
      </div>

      {activeEntries.length === 0 && pendingWithoutLocalEntry.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-bold ui-text">Nenhum apontamento registrado neste dia.</p>
          <p className="mt-2 text-sm ui-text-subtle">Registre a primeira atividade para atualizar o resumo.</p>
        </div>
      ) : (
        <ul className="divide-y ui-divide">
          {pendingWithoutLocalEntry.map((item) => {
            const client = demoClients.find((clientOption) => clientOption.id === item.entry.clientId)
            const activity = demoActivities.find((activityOption) => activityOption.id === item.entry.activityId)
            return (
              <li key={item.id} className="border-l-4 border-amber-400 bg-amber-950/20 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold ui-heading">Número do projeto: {item.entry.projectCode}</p>
                      <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-extrabold text-amber-950">⏳ A aguardar sincronização</span>
                    </div>
                    <p className="mt-1 text-sm ui-text-subtle">{client?.name} · {activity?.name}</p>
                    <p className="mt-3 text-sm leading-6 ui-text">{item.entry.details}</p>
                  </div>
                  <span className="shrink-0 rounded-lg ui-surface-subtle px-3 py-2 text-sm font-extrabold ui-heading">{formatMinutes(item.entry.durationMinutes)}</span>
                </div>
              </li>
            )
          })}
          {activeEntries.map((entry) => {
            const client = demoClients.find((item) => item.id === entry.clientId)
            const activity = demoActivities.find((item) => item.id === entry.activityId)
            const isPendingSync = pendingEntries.some((pending) => matchesPendingEntry(entry, pending))
            return (
              <li key={entry.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold ui-heading">Número do projeto: {entry.projectCode}</p>
                      <EntryRevisionBadge version={entry.version} />
                      {isPendingSync && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-extrabold text-amber-950">⏳ A aguardar sincronização</span>}
                    </div>
                    <p className="mt-1 text-sm ui-text-subtle">{client?.name} · {activity?.name}</p>
                    <p className="mt-3 text-sm leading-6 ui-text">{entry.details}</p>
                  </div>
                  <span className="shrink-0 rounded-lg ui-surface-subtle px-3 py-2 text-sm font-extrabold ui-heading">{formatMinutes(entry.durationMinutes)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
