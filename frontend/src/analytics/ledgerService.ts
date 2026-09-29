import type { AnalyticsException, AuditEvent, ImportJob, LedgerColumnKey, LedgerEntry, Mission } from '../domain/types'
import type { AuditMissionDatabase } from '../data/database'

export const LEDGER_COLUMNS: { key: LedgerColumnKey; label: string; required: true }[] = [
  { key: 'entryDate', label: 'Date comptable', required: true },
  { key: 'postingDate', label: 'Date de saisie', required: true },
  { key: 'entryNumber', label: 'Numéro de pièce / séquence', required: true },
  { key: 'account', label: 'Compte', required: true },
  { key: 'description', label: 'Libellé', required: true },
  { key: 'debit', label: 'Débit', required: true },
  { key: 'credit', label: 'Crédit', required: true },
]

export type LedgerMapping = Record<LedgerColumnKey, string>
export interface CsvRecord { lineNumber: number; values: string[] }
export interface CsvPreview { headers: string[]; rows: CsvRecord[]; delimiter: string }
export interface LedgerDraft extends Omit<LedgerEntry, 'id' | 'missionId' | 'importJobId' | 'sourceFingerprint' | 'createdAt' | 'updatedAt'> {}
export interface LedgerValidationError { lineNumber: number | null; message: string }
export interface AnalyticsSignal { lineNumber: number; ruleCode: string; description: string }

const aliases: Record<LedgerColumnKey, string[]> = {
  entryDate: ['date', 'dateecriture', 'datecomptable', 'entrydate'],
  postingDate: ['datesaisie', 'datecomptablement', 'dateenregistrement', 'postingdate'],
  entryNumber: ['numero', 'numeropiece', 'npiece', 'piece', 'ecriture', 'entrynumber', 'journalnumber'],
  account: ['compte', 'numerocompte', 'account', 'accountnumber'],
  description: ['libelle', 'description', 'intitule', 'label'],
  debit: ['debit', 'montantdebit'],
  credit: ['credit', 'montantcredit'],
}

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"' && line[index + 1] === '"' && quoted) index += 1
    else if (line[index] === '"') quoted = !quoted
    else if (line[index] === delimiter && !quoted) count += 1
  }
  return count
}

export function parseCsv(text: string): CsvPreview {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const delimiter = countDelimiter(firstLine, ';') >= countDelimiter(firstLine, ',') ? ';' : ','
  const matrix: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"' && quoted && source[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) matrix.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (quoted) throw new Error('Le CSV contient une cellule entre guillemets qui n’est pas refermée.')
  row.push(cell)
  if (row.some((value) => value.trim())) matrix.push(row)
  const headers = (matrix.shift() ?? []).map((header) => header.trim())
  if (headers.length < 2 || headers.some((header) => !header)) throw new Error('La ligne d’en-tête doit contenir au moins deux colonnes nommées.')
  if (new Set(headers.map(normalizeHeader)).size !== headers.length) throw new Error('Les noms de colonnes doivent être uniques.')
  const records = matrix.map((values, index) => ({ lineNumber: index + 2, values }))
  return { headers, rows: records, delimiter }
}

export function suggestLedgerMapping(headers: string[]): LedgerMapping {
  const mapping = {} as LedgerMapping
  for (const { key } of LEDGER_COLUMNS) {
    mapping[key] = headers.find((header) => aliases[key].includes(normalizeHeader(header))) ?? ''
  }
  return mapping
}

function parseDate(value: string): string | null {
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  const french = /^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(trimmed)
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : french ? [Number(french[3]), Number(french[2]), Number(french[1])] : null
  if (!parts) return null
  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null
}

function parseAmount(value: string): number | null {
  let normalized = value.trim().replace(/[\s\u00a0\u202f]/g, '')
  if (!normalized) return null
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')
  } else if (normalized.includes(',')) normalized = normalized.replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

export function validateLedgerCsv(preview: CsvPreview, mapping: LedgerMapping) {
  const errors: LedgerValidationError[] = []
  const missing = LEDGER_COLUMNS.filter(({ key }) => !mapping[key] || !preview.headers.includes(mapping[key]))
  for (const column of missing) errors.push({ lineNumber: null, message: `Colonne requise non mappée : ${column.label}.` })
  const indexes = Object.fromEntries(LEDGER_COLUMNS.map(({ key }) => [key, preview.headers.indexOf(mapping[key])])) as Record<LedgerColumnKey, number>
  const entries: LedgerDraft[] = []
  if (missing.length) return { entries, errors }

  for (const record of preview.rows) {
    if (record.values.length !== preview.headers.length) {
      errors.push({ lineNumber: record.lineNumber, message: 'Le nombre de cellules ne correspond pas aux colonnes du CSV.' })
      continue
    }
    const value = (key: LedgerColumnKey) => record.values[indexes[key]] ?? ''
    const entryDate = parseDate(value('entryDate'))
    const postingDate = parseDate(value('postingDate'))
    const debit = parseAmount(value('debit'))
    const credit = parseAmount(value('credit'))
    const rowErrors: string[] = []
    if (!entryDate) rowErrors.push('date comptable invalide')
    if (!postingDate) rowErrors.push('date de saisie invalide')
    if (debit === null) rowErrors.push('débit invalide')
    if (credit === null) rowErrors.push('crédit invalide')
    if (debit !== null && debit < 0) rowErrors.push('débit négatif')
    if (credit !== null && credit < 0) rowErrors.push('crédit négatif')
    if (debit !== null && credit !== null && debit === 0 && credit === 0) rowErrors.push('débit et crédit sont tous deux nuls')
    if (debit !== null && credit !== null && debit > 0 && credit > 0) rowErrors.push('débit et crédit sont simultanément renseignés')
    for (const key of ['entryNumber', 'account', 'description'] as const) if (!value(key).trim()) rowErrors.push(`${LEDGER_COLUMNS.find((column) => column.key === key)!.label} manquant`)
    if (rowErrors.length) errors.push({ lineNumber: record.lineNumber, message: rowErrors.join(' ; ') })
    else entries.push({
      lineNumber: record.lineNumber, entryDate: entryDate!, postingDate: postingDate!, entryNumber: value('entryNumber').trim(),
      account: value('account').trim(), description: value('description').trim(), debit: debit!, credit: credit!,
    })
  }
  if (!preview.rows.length) errors.push({ lineNumber: null, message: 'Le fichier ne contient aucune ligne de données.' })
  if (!errors.length && entries.reduce((sum, entry) => sum + entry.debit, 0) !== entries.reduce((sum, entry) => sum + entry.credit, 0)) {
    errors.push({ lineNumber: null, message: 'Contrôle débit/crédit : les totaux de la population ne sont pas équilibrés.' })
  }
  return { entries, errors }
}

function logicalFingerprint(text: string) {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ (code + index), 0x85ebca6b)
  }
  return `am360-${(first >>> 0).toString(16).padStart(8, '0')}-${(second >>> 0).toString(16).padStart(8, '0')}-${text.length.toString(16)}`
}

function sequenceParts(entryNumber: string): { group: string; number: number } | null {
  const match = /^(.*?)(\d+)$/.exec(entryNumber.trim())
  return match ? { group: match[1], number: Number(match[2]) } : null
}

export function analyzeLedger(entries: LedgerDraft[], mission: Pick<Mission, 'periodEnd'>): AnalyticsSignal[] {
  const signals: AnalyticsSignal[] = []
  const seen = new Map<string, number>()
  const sequences = new Map<string, { number: number; lineNumber: number }[]>()
  for (const entry of entries) {
    const duplicateKey = [entry.entryDate, entry.account, entry.description.trim().toLocaleLowerCase('fr'), entry.debit.toFixed(2), entry.credit.toFixed(2)].join('|')
    const previousLine = seen.get(duplicateKey)
    if (previousLine !== undefined) signals.push({ lineNumber: entry.lineNumber, ruleCode: 'POSSIBLE_DUPLICATE', description: `Écriture proche de la ligne source ${previousLine} (date, compte, libellé et montant identiques) ; rapprochement humain requis.` })
    else seen.set(duplicateKey, entry.lineNumber)

    if (Math.max(entry.debit, entry.credit) >= 100_000 && Math.max(entry.debit, entry.credit) % 100_000 === 0) {
      signals.push({ lineNumber: entry.lineNumber, ruleCode: 'ROUND_AMOUNT', description: 'Montant égal à un multiple exact de 100 000 ; seuil de démonstration à examiner.' })
    }
    if (entry.postingDate > mission.periodEnd) {
      signals.push({ lineNumber: entry.lineNumber, ruleCode: 'LATE_POSTING', description: `Saisie le ${entry.postingDate}, après la fin de période (${mission.periodEnd}) ; date et contexte à vérifier.` })
    }
    if (['471000', '658000', '758000'].includes(entry.account)) {
      signals.push({ lineNumber: entry.lineNumber, ruleCode: 'UNUSUAL_ACCOUNT', description: `Compte ${entry.account} figurant dans la liste pédagogique des comptes inhabituels ; justification à examiner.` })
    }
    const sequence = sequenceParts(entry.entryNumber)
    if (sequence) {
      const group = sequences.get(sequence.group) ?? []
      group.push({ ...sequence, lineNumber: entry.lineNumber })
      sequences.set(sequence.group, group)
    }
  }
  for (const group of sequences.values()) {
    const ordered = [...group].sort((left, right) => left.number - right.number || left.lineNumber - right.lineNumber)
    const observed = new Set(ordered.map(({ number }) => number))
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      const current = ordered[index]
      if (current.number - previous.number > 1) {
        const missing = Array.from({ length: Math.min(current.number - previous.number - 1, 20) }, (_, offset) => previous.number + offset + 1).filter((number) => !observed.has(number))
        signals.push({ lineNumber: current.lineNumber, ruleCode: 'SEQUENCE_GAP', description: `Rupture apparente de séquence avant la ligne source ${current.lineNumber} (numéro(s) manquant(s) : ${missing.join(', ')}${current.number - previous.number > 21 ? '…' : ''}) ; séquence à rapprocher.` })
      }
    }
  }
  return signals.sort((left, right) => left.lineNumber - right.lineNumber || left.ruleCode.localeCompare(right.ruleCode))
}

export async function importLedger(
  db: AuditMissionDatabase,
  args: { mission: Mission; fileName: string; csvText: string; mapping: LedgerMapping; entries: LedgerDraft[]; importedById: string; now?: string; id?: string },
) {
  const { mission, entries } = args
  const timestamp = args.now ?? new Date().toISOString()
  const importId = args.id ?? `import-${globalThis.crypto.randomUUID()}`
  const fingerprint = logicalFingerprint(args.csvText)
  const signals = analyzeLedger(entries, mission)
  const importJob: ImportJob = {
    id: importId, missionId: mission.id, fileName: args.fileName, status: 'completed', rowCount: entries.length,
    importedById: args.importedById, sourceFingerprint: fingerprint, columnMapping: args.mapping,
    debitTotal: entries.reduce((sum, entry) => sum + entry.debit, 0), creditTotal: entries.reduce((sum, entry) => sum + entry.credit, 0),
    createdAt: timestamp, updatedAt: timestamp,
  }
  const ledgerEntries: LedgerEntry[] = entries.map((entry) => ({
    ...entry, id: `ledger-${importId}-${entry.lineNumber}`, missionId: mission.id, importJobId: importId,
    sourceFingerprint: fingerprint, createdAt: timestamp, updatedAt: timestamp,
  }))
  const analyticsExceptions: AnalyticsException[] = signals.map((signal, index) => ({
    id: `signal-${importId}-${signal.lineNumber}-${signal.ruleCode}-${index}`, missionId: mission.id, importJobId: importId,
    lineNumber: signal.lineNumber, sourceEntryId: `ledger-${importId}-${signal.lineNumber}`, ruleCode: signal.ruleCode,
    description: signal.description, status: 'to-investigate', linkedExecutionId: null, humanDecision: null, humanNote: null,
    createdAt: timestamp, updatedAt: timestamp,
  }))
  const event: AuditEvent = {
    id: `event-${importId}`, missionId: mission.id, actorId: args.importedById, entityType: 'importJob', entityId: importId,
    action: 'ledger-imported', summary: `Import synthétique ${args.fileName} — ${entries.length} lignes, empreinte logique ${fingerprint}.`, occurredAt: timestamp,
  }
  await db.transaction('rw', db.importJobs, db.ledgerEntries, db.analyticsExceptions, db.auditEvents, async () => {
    await db.importJobs.add(importJob)
    await db.ledgerEntries.bulkAdd(ledgerEntries)
    if (analyticsExceptions.length) await db.analyticsExceptions.bulkAdd(analyticsExceptions)
    await db.auditEvents.add(event)
  })
  return { importJob, entries: ledgerEntries, exceptions: analyticsExceptions, signals }
}

export async function documentAnalyticsReview(
  db: AuditMissionDatabase,
  args: { exceptionId: string; actorId: string; linkedExecutionId: string; status: 'explained' | 'dismissed'; humanNote: string; now?: string },
) {
  const exception = await db.analyticsExceptions.get(args.exceptionId)
  if (!exception) throw new Error('Le signal source est introuvable.')
  if (exception.status !== 'to-investigate') throw new Error('Ce signal a déjà une décision humaine documentée.')
  const note = args.humanNote.trim()
  if (!note) throw new Error('Documentez la décision humaine avant de la sauvegarder.')
  const execution = await db.procedureExecutions.get(args.linkedExecutionId)
  if (!execution || execution.missionId !== exception.missionId) throw new Error('Choisissez un test de la même mission.')
  const timestamp = args.now ?? new Date().toISOString()
  const updated: AnalyticsException = { ...exception, status: args.status, linkedExecutionId: execution.id, humanDecision: args.status, humanNote: note, updatedAt: timestamp }
  const event: AuditEvent = {
    id: `event-${exception.id}-decision`, missionId: exception.missionId, actorId: args.actorId,
    entityType: 'analyticsException', entityId: exception.id, action: 'analytics-signal-reviewed',
    summary: `Signal ${exception.ruleCode} ligne ${exception.lineNumber} — décision humaine : ${args.status} ; test lié : ${execution.title}.`, occurredAt: timestamp,
  }
  await db.transaction('rw', db.analyticsExceptions, db.auditEvents, async () => {
    await db.analyticsExceptions.put(updated)
    await db.auditEvents.add(event)
  })
  return updated
}
