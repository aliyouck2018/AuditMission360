import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from '../data/database'
import { demoMission, DEMO_MISSION_ID } from '../data/demoSeed'
import { seedDemoData } from '../data/demoService'
import { buildSignalsCsv } from '../pages/ImportsPage'
import {
  analyzeLedger, documentAnalyticsReview, importLedger, parseCsv, suggestLedgerMapping, validateLedgerCsv,
} from './ledgerService'

let databaseIndex = 0
const databases: AuditMissionDatabase[] = []
function createDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-ledger-test-${databaseIndex++}`)
  databases.push(db)
  return db
}
const validCsv = [
  'date_ecriture;date_saisie;numero_piece;compte;libelle;debit;credit',
  '2025-12-29;2025-12-29;JRN-25-0001;512000;Virement client fictif;1200000;0',
  '2025-12-29;2025-12-29;JRN-25-0002;701000;Vente fictive;0;1200000',
  '2025-12-29;2025-12-30;JRN-25-0003;512000;Virement client fictif;1200000;0',
  '2025-12-29;2025-12-30;JRN-25-0004;701000;Vente fictive;0;1200000',
  '2025-12-31;2026-01-05;JRN-25-0007;471000;Compte transitoire fictif;25000;0',
  '2025-12-31;2026-01-05;JRN-25-0008;758000;Produit divers fictif;0;25000',
].join('\n')

afterEach(async () => { await Promise.all(databases.splice(0).map((db) => db.delete())) })

describe('import CSV et règles analytiques déterministes', () => {
  it('lit les CSV avec champs cités, séparateurs dans le libellé et en-têtes accentués', () => {
    const preview = parseCsv('Date écriture;Date saisie;N° pièce;Compte;Libellé;Débit;Crédit\n2025-01-01;2025-01-01;A-1;401000;"Facture; numéro 1";1 250,50;0\n2025-01-01;2025-01-01;A-2;401000;Règlement fictif;0;1 250,50')
    const mapping = suggestLedgerMapping(preview.headers)
    const result = validateLedgerCsv(preview, mapping)

    expect(mapping).toMatchObject({ entryDate: 'Date écriture', postingDate: 'Date saisie', entryNumber: 'N° pièce', description: 'Libellé' })
    expect(result.errors).toEqual([])
    expect(result.entries[0]).toMatchObject({ lineNumber: 2, description: 'Facture; numéro 1', debit: 1250.5, credit: 0 })
  })

  it('rejette les colonnes absentes, nombres/dates invalides, lignes mal formées et totaux non équilibrés', () => {
    const missing = parseCsv('date_ecriture;debit\n2025-01-01;10')
    expect(validateLedgerCsv(missing, suggestLedgerMapping(missing.headers)).errors.some(({ message }) => message.includes('Colonne requise'))).toBe(true)

    const invalid = parseCsv([
      'date_ecriture;date_saisie;numero_piece;compte;libelle;debit;credit',
      '31/02/2025;bad;X-1;401000;Libellé;x;0',
      '2025-01-01;2025-01-01;X-2;401000;Libellé;10;0',
    ].join('\n'))
    const result = validateLedgerCsv(invalid, suggestLedgerMapping(invalid.headers))
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ lineNumber: 2, message: expect.stringContaining('date comptable invalide') }),
      expect.objectContaining({ lineNumber: 2, message: expect.stringContaining('débit invalide') }),
    ]))
    const unbalanced = parseCsv('date_ecriture;date_saisie;numero_piece;compte;libelle;debit;credit\n2025-01-01;2025-01-01;A-1;401000;Libellé;10;0')
    expect(validateLedgerCsv(unbalanced, suggestLedgerMapping(unbalanced.headers)).errors).toContainEqual(expect.objectContaining({ lineNumber: null, message: expect.stringContaining('totaux') }))
  })

  it('produit de façon reproductible les cinq familles de signaux sans conclure', () => {
    const preview = parseCsv(validCsv)
    const result = validateLedgerCsv(preview, suggestLedgerMapping(preview.headers))
    expect(result.errors).toEqual([])
    expect(result.entries.reduce((sum, entry) => sum + entry.debit, 0)).toBe(result.entries.reduce((sum, entry) => sum + entry.credit, 0))
    const first = analyzeLedger(result.entries, demoMission)
    const second = analyzeLedger(result.entries, demoMission)
    expect(first).toEqual(second)
    expect(new Set(first.map(({ ruleCode }) => ruleCode))).toEqual(new Set(['POSSIBLE_DUPLICATE', 'ROUND_AMOUNT', 'LATE_POSTING', 'UNUSUAL_ACCOUNT', 'SEQUENCE_GAP']))
    expect(first.every(({ description }) => /à examiner|à vérifier|à rapprocher|requis/.test(description))).toBe(true)
    expect(first.find(({ ruleCode }) => ruleCode === 'POSSIBLE_DUPLICATE')?.lineNumber).toBe(4)
    expect(first.find(({ ruleCode }) => ruleCode === 'SEQUENCE_GAP')?.lineNumber).toBe(6)
  })

  it('persiste mapping, fingerprint et lignes sources, puis lie une décision humaine à un test exportable', async () => {
    const db = createDatabase()
    await seedDemoData(db)
    const preview = parseCsv(validCsv)
    const mapping = suggestLedgerMapping(preview.headers)
    const validated = validateLedgerCsv(preview, mapping)
    const timestamp = '2026-09-29T12:00:00.000Z'
    await db.procedureExecutions.add({
      id: 'execution-ledger-review', missionId: DEMO_MISSION_ID, cycleId: 'cycle-demo-cash', procedureTemplateId: 'template-demo', procedureTemplateVersion: '1.0.0',
      riskId: 'risk-demo', assertionIds: [], title: 'Rapprocher les écritures de démonstration', objective: 'Tester les références fictives', steps: [], expectedEvidence: [],
      sampleSeed: 'demo', sampleMethod: 'test', status: 'planned', assignedToId: null, reviewerId: null, dueDate: null, result: null, submittedAt: null,
      reviewedAt: null, reviewConclusion: null, createdAt: timestamp, updatedAt: timestamp,
    })
    const saved = await importLedger(db, {
      mission: demoMission, fileName: 'grand-livre-demo.csv', csvText: validCsv, mapping, entries: validated.entries,
      importedById: 'member-demo-data', id: 'import-ledger-demo', now: timestamp,
    })

    expect(saved.importJob).toMatchObject({ rowCount: 6, debitTotal: 2425000, creditTotal: 2425000, columnMapping: mapping })
    expect(saved.entries[0]).toMatchObject({ id: 'ledger-import-ledger-demo-2', lineNumber: 2, sourceFingerprint: saved.importJob.sourceFingerprint })
    expect(saved.exceptions.every(({ status }) => status === 'to-investigate')).toBe(true)
    const duplicate = saved.exceptions.find(({ ruleCode }) => ruleCode === 'POSSIBLE_DUPLICATE')!
    const reviewed = await documentAnalyticsReview(db, {
      exceptionId: duplicate.id, actorId: 'member-demo-data', linkedExecutionId: 'execution-ledger-review',
      status: 'explained', humanNote: 'Référence rapprochée avec le justificatif synthétique de test.', now: timestamp,
    })
    expect(reviewed).toMatchObject({ status: 'explained', linkedExecutionId: 'execution-ledger-review', humanDecision: 'explained' })
    const event = await db.auditEvents.where('entityId').equals(duplicate.id).first()
    expect(event?.action).toBe('analytics-signal-reviewed')
    const exported = buildSignalsCsv(saved.importJob, [reviewed], saved.entries)
    expect(exported).toContain('grand-livre-demo.csv')
    expect(exported).toContain(saved.importJob.sourceFingerprint)
    expect(exported).toContain(`"${duplicate.lineNumber}"`)
    expect(exported).toContain('Référence rapprochée avec le justificatif synthétique de test.')
    await expect(documentAnalyticsReview(db, {
      exceptionId: duplicate.id, actorId: 'member-demo-data', linkedExecutionId: 'execution-ledger-review', status: 'dismissed', humanNote: 'Autre motif.',
    })).rejects.toThrow(/déjà une décision/i)
  })
})
