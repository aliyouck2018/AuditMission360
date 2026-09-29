import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from '../data/database'
import { demoMission, DEMO_MISSION_ID } from '../data/demoSeed'
import { resetDemoData } from '../data/demoService'
import type { ClosingContext } from './closingService'
import {
  buildDossierHtml, calculateClosingMetrics, collectDossierSources, completeFindingAction, createFinding,
  exportClosingDossier, filterFindings, getClosingBlockers, resolveFinding, sourceAnchor,
} from './closingService'

let databaseIndex = 0
const databases: AuditMissionDatabase[] = []
function createDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-closing-test-${databaseIndex++}`)
  databases.push(db)
  return db
}
afterEach(async () => { await Promise.all(databases.splice(0).map((db) => db.delete())) })

function context(overrides: Partial<ClosingContext> = {}): ClosingContext {
  return {
    mission: demoMission, actorId: 'member-demo-manager', cycles: [], executions: [], samples: [], evidence: [], notes: [], findings: [],
    actionPlans: [], imports: [], exceptions: [], ledgerEntries: [], events: [], ...overrides,
  }
}

describe('constats, cockpit et dossier simulé', () => {
  it('calcule les KPI avec dénominateur visible, taux absent et blocages par état', () => {
    const current = context({
      executions: [
        { id: 'done', status: 'reviewed' } as ClosingContext['executions'][number],
        { id: 'open', status: 'in-progress' } as ClosingContext['executions'][number],
      ],
      evidence: [{ executionId: 'done' } as ClosingContext['evidence'][number]],
      notes: [{ status: 'open' } as ClosingContext['notes'][number], { status: 'resolved' } as ClosingContext['notes'][number]],
      exceptions: [{ status: 'to-investigate' } as ClosingContext['exceptions'][number], { status: 'explained' } as ClosingContext['exceptions'][number]],
      findings: [{ status: 'open' } as ClosingContext['findings'][number], { status: 'resolved' } as ClosingContext['findings'][number]],
      actionPlans: [{ status: 'in-progress' } as ClosingContext['actionPlans'][number]],
    })
    expect(calculateClosingMetrics(current)).toMatchObject({
      reviewedProcedures: 1, procedureDenominator: 2, reviewedRate: 50, executionsWithEvidence: 1,
      openReviewNotes: 1, signalsToInvestigate: 1, openFindings: 1, openActionPlans: 1,
    })
    const blockers = getClosingBlockers(current)
    expect(blockers).toHaveLength(5)
    expect(blockers.join(' ')).toMatch(/procédure.*statut.*revu/)
    expect(blockers.join(' ')).toMatch(/signal.*à investiguer/)
    expect(calculateClosingMetrics(context()).reviewedRate).toBeNull()
    expect(getClosingBlockers(context())).toContain('Aucune procédure n’a été affectée à la mission de démonstration.')
    expect(getClosingBlockers(context({ executions: [{ status: 'reviewed' } as ClosingContext['executions'][number]] }))).toEqual([])
  })

  it('filtre les constats ouverts et résolus sans fusionner les statuts', () => {
    const findings = [
      { id: 'draft', status: 'draft' }, { id: 'open', status: 'open' },
      { id: 'resolved', status: 'resolved' }, { id: 'closed', status: 'closed' },
    ] as ClosingContext['findings']
    expect(filterFindings(findings, 'open').map(({ id }) => id)).toEqual(['draft', 'open'])
    expect(filterFindings(findings, 'resolved').map(({ id }) => id)).toEqual(['resolved', 'closed'])
    expect(filterFindings(findings, 'all')).toHaveLength(4)
  })

  it('crée un constat et son suivi atomiquement, bloque la résolution puis conserve le passage humain', async () => {
    const db = createDatabase()
    await resetDemoData(db)
    const sourceReferences = [{ entityType: 'analyticsException', entityId: 'signal-source-4', label: 'Doublon possible — ligne CSV 4' }]
    const created = await createFinding(db, {
      missionId: DEMO_MISSION_ID, cycleId: `cycle-${DEMO_MISSION_ID}-cash-banks`, title: 'Écriture à rapprocher', facts: 'Deux lignes présentent un libellé proche.',
      criteria: 'Référence de pièce à confirmer par le réviseur.', cause: 'Cause à documenter après entretien.',
      indicativeImpact: 'Montant indicatif, sans conclusion de significativité.', recommendation: 'Rapprocher les pièces et renforcer la revue.',
      owner: 'Responsable fictif', dueDate: '2026-10-15', sourceReferences, actorId: 'member-demo-manager', id: 'finding-test-01', now: '2026-09-29T12:00:00.000Z',
    })
    expect(created.finding).toMatchObject({ status: 'open', owner: 'Responsable fictif', dueDate: '2026-10-15', sourceReferences })
    expect(created.actionPlan).toMatchObject({ findingId: created.finding.id, status: 'open', owner: 'Responsable fictif', dueDate: '2026-10-15' })
    await expect(resolveFinding(db, created.finding.id, 'member-demo-manager')).rejects.toThrow(/suivi humain/i)

    await completeFindingAction(db, created.actionPlan.id, 'member-demo-manager', '2026-09-29T12:01:00.000Z')
    const resolved = await resolveFinding(db, created.finding.id, 'member-demo-manager', '2026-09-29T12:02:00.000Z')
    expect(resolved.status).toBe('resolved')
    expect(await db.auditEvents.where('entityId').equals(created.finding.id).count()).toBe(2)
    expect(await db.findings.get(created.finding.id)).toEqual(resolved)
    expect((await db.actionPlans.get(created.actionPlan.id))?.status).toBe('completed')
  })

  it('construit un HTML marqué, versionné, échappé et lié à un index complet puis journalise l’export', async () => {
    const db = createDatabase()
    await resetDemoData(db)
    const finding = await createFinding(db, {
      missionId: DEMO_MISSION_ID, cycleId: `cycle-${DEMO_MISSION_ID}-cash-banks`, title: '<script>alert(1)</script>', facts: 'Fait fictif', criteria: 'Critère à confirmer',
      cause: 'Cause ouverte', indicativeImpact: 'Impact indicatif seulement', recommendation: 'Rapprocher les pièces', owner: 'Personne fictive',
      dueDate: '2026-10-15', sourceReferences: [{ entityType: 'procedureExecution', entityId: 'procedure-source', label: 'Test synthétique' }], actorId: 'member-demo-manager', id: 'finding-html',
    })
    const dossierContext = context({
      mission: demoMission, cycles: await db.cycles.where('missionId').equals(DEMO_MISSION_ID).toArray(), findings: [finding.finding], actionPlans: [finding.actionPlan],
      executions: [{ id: 'procedure-source', missionId: DEMO_MISSION_ID, title: 'Test synthétique', status: 'reviewed' } as ClosingContext['executions'][number]],
      imports: [{ id: 'import-source', missionId: DEMO_MISSION_ID, fileName: 'demo.csv', sourceFingerprint: 'am360-1-2-3' } as ClosingContext['imports'][number]],
      exceptions: [{ id: 'signal-source', missionId: DEMO_MISSION_ID, importJobId: 'import-source', sourceEntryId: 'ledger-source', lineNumber: 4, ruleCode: 'POSSIBLE_DUPLICATE', status: 'to-investigate' } as ClosingContext['exceptions'][number]],
      ledgerEntries: [{ id: 'ledger-source', missionId: DEMO_MISSION_ID, importJobId: 'import-source', lineNumber: 4, entryNumber: 'JRN-4', account: '471000' } as ClosingContext['ledgerEntries'][number]],
    })
    const html = buildDossierHtml(dossierContext, '2026-09-29T12:00:00.000Z')
    const sources = collectDossierSources(dossierContext)
    const procedureRef = sources.find(({ entityId }) => entityId === 'procedure-source')!
    expect(html).toContain('DONNÉES SYNTHÉTIQUES · DOCUMENT SIMULÉ')
    expect(html).toContain('Dossier de clôture · v1.0.0')
    expect(html).toContain(demoMission.id)
    expect(html).toContain(`href="#${sourceAnchor(procedureRef)}"`)
    expect(html).toContain(`id="${sourceAnchor(procedureRef)}"`)
    expect(html).toContain('href="#index-importJob-import-source"')
    expect(html).toContain('href="#index-ledgerEntry-ledger-source"')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('AUCUNE OPINION GÉNÉRÉE')

    const saved = await exportClosingDossier(db, dossierContext, '2026-09-29T12:00:00.000Z')
    expect(saved).toMatchObject({ templateVersion: '1.0.0', isFictitious: true, sourceReferences: sources })
    expect(await db.generatedDocuments.get(saved.id)).toEqual(saved)
    expect(await db.auditEvents.where('entityId').equals(saved.id).first()).toMatchObject({ action: 'document-exported', actorId: 'member-demo-manager' })
  })
})
