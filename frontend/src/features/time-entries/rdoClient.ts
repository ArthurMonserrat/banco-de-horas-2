import { demoClients } from '../../mocks/demoData'

function normalizeClientName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/** Cliente do RDO -> cliente cadastrado (ex.: "ARCELORMITTAL" -> ArcelorMittal). */
export function findClientIdByRdoName(name?: string) {
  if (!name) return undefined
  const wanted = normalizeClientName(name)
  if (!wanted) return undefined
  return demoClients.find((client) => {
    const candidate = normalizeClientName(client.name)
    return client.active && (candidate === wanted || wanted.includes(candidate) || candidate.includes(wanted))
  })?.id
}
