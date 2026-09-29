import type { AuditMissionDatabase } from './database'
import { buildMissionCatalog } from '../catalog/catalogService'
import { DEMO_MISSION_ID, DEMO_SEED_DATE, demoMission, demoTeamMembers } from './demoSeed'

function catalogTables(db: AuditMissionDatabase) {
  return [db.cycles, db.risks, db.assertions, db.riskAssertionLinks, db.procedureTemplates]
}

async function writeDemoSeed(db: AuditMissionDatabase): Promise<void> {
  const catalog = buildMissionCatalog(demoMission, DEMO_SEED_DATE)
  await Promise.all([
    db.missions.put(demoMission),
    db.teamMembers.bulkPut(demoTeamMembers),
    db.cycles.bulkPut(catalog.cycles),
    db.assertions.bulkPut(catalog.assertions),
    db.risks.bulkPut(catalog.risks),
    db.riskAssertionLinks.bulkPut(catalog.riskAssertionLinks),
    db.procedureTemplates.bulkPut(catalog.procedureTemplates),
    db.auditEvents.put({
      id: 'event-demo-seeded',
      missionId: DEMO_MISSION_ID,
      actorId: 'member-demo-manager',
      entityType: 'mission',
      entityId: DEMO_MISSION_ID,
      action: 'demo-seeded',
      summary: 'Jeu de démonstration synthétique initialisé.',
      occurredAt: DEMO_SEED_DATE,
    }),
  ])
}

export async function seedDemoData(db: AuditMissionDatabase): Promise<void> {
  await db.transaction('rw', [db.missions, db.teamMembers, ...catalogTables(db), db.auditEvents], () => writeDemoSeed(db))
}

export async function resetDemoData(db: AuditMissionDatabase): Promise<void> {
  const tables = [
    db.missions,
    db.teamMembers,
    ...catalogTables(db),
    db.procedureExecutions,
    db.populations,
    db.sampleItems,
    db.evidenceReferences,
    db.reviewNotes,
    db.findings,
    db.actionPlans,
    db.methodologyReferences,
    db.documentTemplates,
    db.generatedDocuments,
    db.auditEvents,
    db.importJobs,
    db.analyticsExceptions,
    db.ledgerEntries,
  ]

  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
    await writeDemoSeed(db)
  })
}
