import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from './database'
import { DEMO_MISSION_ID } from './demoSeed'
import { resetDemoData, seedDemoData } from './demoService'
import { createRepositories } from './repositories'

let databaseIndex = 0
const openDatabases: AuditMissionDatabase[] = []

function createTestDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-test-${databaseIndex++}`)
  openDatabases.push(db)
  return db
}

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((db) => db.delete()))
})

describe('persistance locale de démonstration', () => {
  it('déclare le schéma Dexie versionné et les index de mission et cycle', async () => {
    const db = createTestDatabase()
    await db.open()

    expect(db.verno).toBe(2)
    expect(db.tables.map(({ name }) => name)).toHaveLength(21)
    expect(db.cycles.schema.indexes.map(({ name }) => name)).toContain('[missionId+code]')
    expect(db.teamMembers.schema.indexes.map(({ name }) => name)).toContain('[missionId+role]')
    expect(db.ledgerEntries.schema.indexes.map(({ name }) => name)).toContain('[importJobId+lineNumber]')
  })

  it('charge le même scénario synthétique sans doublons lors de plusieurs seeds', async () => {
    const db = createTestDatabase()
    await seedDemoData(db)
    await seedDemoData(db)

    expect(await db.missions.count()).toBe(1)
    expect(await db.missions.get(DEMO_MISSION_ID)).toMatchObject({ isFictitious: true, currency: 'XAF' })
    expect(await db.cycles.count()).toBe(4)
    expect(await db.cycles.where('missionId').equals(DEMO_MISSION_ID).count()).toBe(4)
    expect(await db.teamMembers.count()).toBe(5)
    expect(await db.assertions.count()).toBe(12)
    expect(await db.risks.count()).toBe(12)
    expect(await db.riskAssertionLinks.count()).toBeGreaterThan(12)
    expect(await db.procedureTemplates.count()).toBe(16)
    expect(await db.auditEvents.count()).toBe(1)
    expect(await db.teamMembers.where('[missionId+role]').equals([DEMO_MISSION_ID, 'reviewer']).count()).toBe(1)
  })

  it('expose les lectures et écritures via des repositories typés', async () => {
    const db = createTestDatabase()
    await seedDemoData(db)
    const repository = createRepositories(db)
    const cycles = await repository.cycles.listForMission(DEMO_MISSION_ID)

    expect(cycles.sort((left, right) => left.position - right.position).map(({ code }) => code)).toEqual([
      'sales-receivables',
      'purchases-payables',
      'cash-banks',
      'inventory',
    ])
    expect(await repository.missions.get(DEMO_MISSION_ID)).toBeDefined()
  })

  it('réinitialise plusieurs fois les données et restaure exactement le seed', async () => {
    const db = createTestDatabase()
    await seedDemoData(db)
    await db.teamMembers.delete('member-demo-reader')
    await db.cycles.clear()
    await db.risks.put({
      id: 'temporary-risk', missionId: DEMO_MISSION_ID, cycleId: 'cycle-demo-sales', code: 'TEMP',
      title: 'Temporaire', description: '', rationale: '', status: 'candidate', catalogVersion: 'test',
      category: 'operation', applicableMissionTypes: [], applicableSectors: [], keywords: [], source: 'test',
      reviewStatus: 'reviewed', author: 'test', reviewer: 'test', justification: null,
      createdAt: '2026-09-29T00:00:00.000Z', updatedAt: '2026-09-29T00:00:00.000Z',
    })

    await resetDemoData(db)
    await resetDemoData(db)

    expect(await db.missions.count()).toBe(1)
    expect(await db.cycles.count()).toBe(4)
    expect(await db.teamMembers.count()).toBe(5)
    expect(await db.risks.count()).toBe(12)
    expect(await db.auditEvents.count()).toBe(1)
  })
})
