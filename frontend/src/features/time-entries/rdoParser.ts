import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { isMedicaoRdo, parseMedicaoRdoPages, type RdoPage } from './rdoMedicaoParser'

export type ParsedRDODay = {
  data: string
  horas: number
  minutos: number
  detalhamento: string
  numeroObra: string
}

export type ParsedRDO = {
  /** padrao = RDO por "Total de Horas"; medicao = planilha por profissional (ex.: ArcelorMittal). */
  modelo?: 'padrao' | 'medicao'
  numeroObra?: string
  numeroContrato?: string
  cliente?: string
  aviso?: string
  dias: ParsedRDODay[]
}

export type ParseRDOOptions = {
  /** Nome do usuário logado: no modelo por profissional, só as horas dele são lidas. */
  collaboratorName?: string
}

type TextContentItem = {
  str?: string
  transform?: unknown
}

function toIsoDate(date: string) {
  const [day, month, year] = date.split('/')
  if (!day || !month || !year) return undefined
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function extractDates(text: string) {
  const datePattern = /\b(?:Data\s*OS|Data)\b[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/gi
  let dateMatches = Array.from(text.matchAll(datePattern)).map((match) => match[1])
  if (dateMatches.length === 0) {
    dateMatches = Array.from(text.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)).map((match) => match[1])
  }

  return Array.from(new Set(dateMatches.flatMap((date) => {
    const isoDate = toIsoDate(date)
    return isoDate ? [isoDate] : []
  }))).sort()
}

function parseDecimalHours(value: string) {
  const normalized = Number(value.replace(',', '.'))
  if (!Number.isFinite(normalized) || normalized < 0) return undefined
  const totalMinutes = Math.round(normalized * 60)
  return {
    horas: Math.floor(totalMinutes / 60),
    minutos: totalMinutes % 60,
  }
}

function extractTotalHours(text: string) {
  const totalHoursMatch = text.match(
    /\bTotal\s+(?:de\s+)?Horas\b[\s\S]{0,80}?([0-9]{1,2}(?:[.,][0-9]{1,2})?)\b/i,
  )
  return totalHoursMatch?.[1]
}

function parseActivitySection(section: string) {
  const cleanSection = section
    ?.replace(/\bHORA\s+DE\s+IN[IÍ]CIO\b/gi, ' ')
    .replace(/\bHORA\s+DE\s+T[ÉE]RMINO\b/gi, ' ')
    .replace(/\bDESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+E\s+DO\s+LOCAL\b/gi, ' ')
  if (!cleanSection) return []

  const timeRowPattern = /^\s*(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*(.*)$/i
  const stopPattern = /\b(?:Total\s+(?:de\s+)?Horas|Assinatura|Respons[aá]vel|Fotos|Anexos)\b/i
  const activityRows: Array<{ startTime: string; endTime: string; descriptionParts: string[] }> = []

  for (const rawLine of cleanSection.split('\n')) {
    const line = rawLine
      .replace(/\b(?:HORA\s+DE\s+IN[IÍ]CIO|HORA\s+DE\s+T[ÉE]RMINO|DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+E\s+DO\s+LOCAL)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!line) continue
    if (stopPattern.test(line)) break

    const rowMatch = line.match(timeRowPattern)
    if (rowMatch) {
      activityRows.push({
        startTime: rowMatch[1].padStart(5, '0'),
        endTime: rowMatch[2].padStart(5, '0'),
        descriptionParts: rowMatch[3]?.trim() ? [rowMatch[3].trim()] : [],
      })
      continue
    }

    const currentRow = activityRows.at(-1)
    if (currentRow) currentRow.descriptionParts.push(line)
  }

  const rows = activityRows
    .map((row) => {
      const description = row.descriptionParts.join(' ').replace(/\s+/g, ' ').trim()
      return description ? `[${row.startTime} - ${row.endTime}] ${description}` : ''
    })
    .filter(Boolean)

  if (rows.length > 0) return rows

  const inlineRowPattern = /(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+([\s\S]*?)(?=\s+\d{1,2}:\d{2}\s+\d{1,2}:\d{2}\s+|\s+Total\s+(?:de\s+)?Horas\b|$)/gi
  return Array.from(cleanSection.matchAll(inlineRowPattern)).flatMap((match) => {
    const description = match[3].replace(/\s+/g, ' ').trim()
    return description ? [`[${match[1].padStart(5, '0')} - ${match[2].padStart(5, '0')}] ${description}`] : []
  })
}

function extractActivityDetails(text: string) {
  const sectionPattern = /(?:HORA\s+DE\s+IN[IÍ]CIO[\s\S]{0,160}?HORA\s+DE\s+T[ÉE]RMINO[\s\S]{0,220}?)?DESCRI[ÇC][ÃA]O\s+DA\s+ATIVIDADE\s+E\s+DO\s+LOCAL\s*([\s\S]*?)(?=\n?\s*(?:Total\s+(?:de\s+)?Horas|Assinatura|Respons[aá]vel|Fotos|Anexos|(?:Data\s*OS|Data)\b)\b|$)/gi
  const sections = Array.from(text.matchAll(sectionPattern)).map((match) => match[1])
  const rows = sections.flatMap((section) => parseActivitySection(section))

  if (rows.length === 0) {
    const inlineRowPattern = /(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+([\s\S]*?)(?=\s+\d{1,2}:\d{2}\s+\d{1,2}:\d{2}\s+|\s+Total\s+(?:de\s+)?Horas\b|$)/gi
    const inlineRows = Array.from(text.matchAll(inlineRowPattern)).flatMap((match) => {
      const description = match[3].replace(/\s+/g, ' ').trim()
      return description ? [`[${match[1].padStart(5, '0')} - ${match[2].padStart(5, '0')}] ${description}`] : []
    })
    if (inlineRows.length > 0) return inlineRows.join('\n\n')
  }

  if (rows.length > 0) return rows.join('\n\n')
  return sections.join(' ').replace(/\s+/g, ' ').trim() || undefined
}

type DateAnchor = {
  isoDate: string
  index: number
}

function collectDateAnchors(text: string): DateAnchor[] {
  const anchorPatterns = [
    /\b(?:Data\s*OS|Data)\b\s*[:-]?\s*(\d{2}\/\d{2}\/\d{4})/gi,
    /\b(?:Data\s*OS|Data)\b[\s:.-]{0,60}?(\d{2}\/\d{2}\/\d{4})/gi,
  ]
  const anchors = new Map<string, DateAnchor>()

  for (const pattern of anchorPatterns) {
    for (const match of text.matchAll(pattern)) {
      const isoDate = toIsoDate(match[1])
      const index = match.index ?? 0
      if (isoDate) anchors.set(`${index}:${isoDate}`, { isoDate, index })
    }
  }

  return Array.from(anchors.values()).sort((left, right) => left.index - right.index)
}

function splitByPageMarkers(text: string) {
  const markerPattern = /(?:^|\n)--- Página \d+ ---\n?/g
  const markers = Array.from(text.matchAll(markerPattern))
  if (markers.length === 0) return [text]

  return markers
    .map((marker, index) => {
      const start = marker.index ?? 0
      const end = markers[index + 1]?.index ?? text.length
      return text.slice(start, end).trim()
    })
    .filter(Boolean)
}

function buildChunksFromAnchors(text: string, anchors: DateAnchor[]) {
  return anchors.map((anchor, index) => ({
    isoDate: anchor.isoDate,
    chunk: text.slice(anchor.index, anchors[index + 1]?.index ?? text.length),
  }))
}

function extractDateChunks(text: string) {
  const anchoredChunks = buildChunksFromAnchors(text, collectDateAnchors(text))
  if (anchoredChunks.length > 1) return anchoredChunks

  const pageChunks = splitByPageMarkers(text)
    .map((chunk) => ({ isoDate: extractDates(chunk)[0], chunk }))
    .filter((chunk): chunk is { isoDate: string; chunk: string } => Boolean(chunk.isoDate))
  if (pageChunks.length > 1) return pageChunks
  if (anchoredChunks.length === 1) return anchoredChunks
  return [{ isoDate: undefined, chunk: text }]
}

function extractRdoDays(text: string, numeroObra = ''): ParsedRDODay[] {
  const chunks = extractDateChunks(text)
  const parsedDays = chunks.flatMap(({ isoDate, chunk }) => {
    const date = isoDate ?? extractDates(chunk)[0]
    if (!date) return []
    const decimalHours = extractTotalHours(chunk)
    const duration = parseDecimalHours(decimalHours ?? '')
    if (!duration) return []
    const details = extractActivityDetails(chunk)
    return [{
      data: date,
      horas: duration.horas,
      minutos: duration.minutos,
      detalhamento: details ?? 'Atividades importadas do RDO.',
      numeroObra,
    }]
  })

  if (parsedDays.length > 0) return parsedDays

  const dates = extractDates(text)
  const duration = parseDecimalHours(extractTotalHours(text) ?? '')
  if (!duration) return []
  const details = extractActivityDetails(text)
  return dates.map((date) => ({
    data: date,
    horas: duration.horas,
    minutos: duration.minutos,
    detalhamento: details ?? 'Atividades importadas do RDO.',
    numeroObra,
  }))
}

function getTextItemPosition(item: TextContentItem) {
  const transform = Array.isArray(item.transform) ? item.transform : []
  const x = typeof transform[4] === 'number' ? transform[4] : 0
  const y = typeof transform[5] === 'number' ? transform[5] : 0
  return { x, y }
}

function textItemsToRows(items: TextContentItem[]) {
  const rows = new Map<number, Array<{ x: number; text: string }>>()
  items.forEach((item) => {
    const text = item.str?.trim()
    if (!text) return
    const { x, y } = getTextItemPosition(item)
    const rowKey = Math.round(y)
    rows.set(rowKey, [...(rows.get(rowKey) ?? []), { x, text }])
  })

  return Array.from(rows.entries())
    .sort(([leftY], [rightY]) => rightY - leftY)
    .map(([, row]) => row
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(' '))
    .join('\n')
}

export function parseRDOText(text: string): ParsedRDO {
  const normalizedText = text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')

  const obraMatch = normalizedText.match(/(?:N[º°]?\s*do\s*QQP|Obra)[\s\S]{0,120}?Obra\s+([A-Z0-9-]+)/i)
    ?? normalizedText.match(/\bObra\s+([A-Z0-9-]+)\b/i)
  const numeroObra = obraMatch?.[1]?.trim()

  return {
    numeroObra,
    dias: extractRdoDays(normalizedText, numeroObra),
  }
}

export function parseRDOPages(pages: RdoPage[], options: ParseRDOOptions = {}): ParsedRDO {
  if (isMedicaoRdo(pages)) {
    const parsed = parseMedicaoRdoPages(pages, options)
    return {
      modelo: 'medicao',
      numeroObra: parsed.numeroObra,
      numeroContrato: parsed.numeroContrato,
      cliente: parsed.cliente,
      aviso: parsed.aviso,
      dias: parsed.dias.map(({ data, horas, minutos, detalhamento, numeroObra }) => ({ data, horas, minutos, detalhamento, numeroObra })),
    }
  }
  const text = pages
    .map((page, index) => `\n--- Página ${index + 1} ---\n${textItemsToRows(page.map((item) => ({ str: item.text, transform: [1, 0, 0, 1, item.x, item.y] })))}\n`)
    .join('\n')
  return { modelo: 'padrao', ...parseRDOText(text) }
}

export async function parseRDO(file: File, options: ParseRDOOptions = {}): Promise<ParsedRDO> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  try {
    const pageNumbers = Array.from({ length: pdf.numPages }, (_, index) => index + 1)
    const pages = await Promise.all(pageNumbers.map(async (pageNumber): Promise<RdoPage> => {
      const page = await pdf.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        return (content.items as TextContentItem[]).flatMap((item) => {
          const text = item.str?.trim()
          if (!text) return []
          const { x, y } = getTextItemPosition(item)
          return [{ text, x, y }]
        })
      } finally {
        page.cleanup()
      }
    }))

    return parseRDOPages(pages, options)
  } finally {
    await pdf.cleanup()
  }
}
