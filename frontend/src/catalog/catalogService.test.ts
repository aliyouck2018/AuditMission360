import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from '../data/database'
import { demoMission } from '../data/demoSeed'
import { buildMissionCatalog, ensureMissionCatalog, recordRiskDecision, suggestProcedureTemplates, suggestRiskCandidates, addEntitySpecificRisk } from './catalogService'
import { STARTER_CATALOG_VERSION, starterProcedures, starterRisks } from './catalogData'

let databaseIndex = 0
const openDatabases: AuditMissionDatabase[] = []

function createTestDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-catalog-test-${databaseIndex++}`)
  openDatabases.push(db)
  return db
}

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((db) => db.delete()))
})

describe('catalogue starter et propositions explicables', () => {
  it('construit quatre cycles et des modèles versionnés aux relations cohérentes', () => {
    const catalog = buildMissionCatalog(demoMission, '2026-09-29T00:00:00.000Z')
    const riskById = new Map(catalog.risks.map((risk) => [risk.id, risk]))
    const assertionById = new Map(catalog.assertions.map((assertion) => [assertion.id, assertion]))
    const cycleById = new Map(catalog.cycles.map((cycle) => [cycle.id, cycle]))

    expect(catalog.cycles).toHaveLength(4)
    expect(catalog.risks).toHaveLength(starterRisks.length)
    expect(catalog.procedureTemplates).toHaveLength(starterProcedures.length)
    expect(catalog.assertions.map(({ category }) => category)).toEqual(expect.arrayContaining(['transaction', 'balance', 'disclosure']))
    expect(catalog.risks.every((risk) => risk.status === 'candidate' && risk.catalogVersion === STARTER_CATALOG_VERSION && risk.justification === null)).toBe(true)
    expect(catalog.risks.every((risk) => risk.reviewStatus === 'reviewed' && risk.source && risk.author && risk.reviewer)).toBe(true)

    for (const cycle of catalog.cycles) {
      expect(catalog.risks.filter((risk) => risk.cycleId === cycle.id)).toHaveLength(3)
      const cycleProcedures = catalog.procedureTemplates.filter((template) => template.cycleId === cycle.id)
      expect(cycleProcedures).toHaveLength(4)
      expect(cycleProcedures.map(({ procedureType }) => procedureType)).toEqual(expect.arrayContaining(['control', 'substantive']))
    }
    for (const link of catalog.riskAssertionLinks) {
      expect(riskById.has(link.riskId)).toBe(true)
      expect(assertionById.has(link.assertionId)).toBe(true)
      expect(link.catalogVersion).toBe(STARTER_CATALOG_VERSION)
      expect(link.rationale.trim()).not.toBe('')
    }
    for (const template of catalog.procedureTemplates) {
      expect(cycleById.get(template.cycleId)?.code).toBe(starterProcedures.find(({ code }) => code === template.code)?.cycleCode)
      expect(template.riskCodes.length).toBeGreaterThan(0)
      expect(template.assertionCodes.length).toBeGreaterThan(0)
      expect(template.riskCodes.every((code) => catalog.risks.some((risk) => risk.code === code && risk.cycleId === template.cycleId))).toBe(true)
      expect(template.assertionCodes.every((code) => catalog.assertions.some((assertion) => assertion.code === code))).toBe(true)
      expect(template.version).toBe(STARTER_CATALOG_VERSION)
      expect(template.status).toBe('reviewed')
      expect(template.steps.length).toBeGreaterThan(0)
    }
  })

  it('filtre de façon reproductible par cycle, contexte mission et statut de candidat', () => {
    const catalog = buildMissionCatalog(demoMission)
    const sales = catalog.cycles.find(({ code }) => code === 'sales-receivables')!
    const first = suggestRiskCandidates(demoMission, sales.id, catalog.risks)
    const second = suggestRiskCandidates(demoMission, sales.id, catalog.risks)
    expect(first).toEqual(second)
    expect(first.map(({ risk }) => risk.code)).toEqual(['SALES-UNSUPPORTED', 'SALES-CUTOFF', 'RECEIVABLE-VALUATION'])
    expect(first[0].reasons.join(' ')).toContain('Motif du modèle :')
    expect(first[0].reasons.join(' ')).toContain('secteur')

    const otherSector = { ...demoMission, sector: 'Éducation' }
    expect(suggestRiskCandidates(otherSector, sales.id, catalog.risks).map(({ risk }) => risk.code)).toEqual(['SALES-CUTOFF', 'RECEIVABLE-VALUATION'])
    expect(suggestRiskCandidates(demoMission, 'autre-cycle', catalog.risks)).toEqual([])
    expect(suggestRiskCandidates(demoMission, sales.id, catalog.risks.map((risk) => ({ ...risk, status: 'confirmed' as const })))).toEqual([])
  })

  it('relie les procédures aux assertions et ne suggère rien pour un risque écarté', () => {
    const catalog = buildMissionCatalog(demoMission)
    const sales = catalog.cycles.find(({ code }) => code === 'sales-receivables')!
    const risk = catalog.risks.find(({ code }) => code === 'SALES-UNSUPPORTED')!
    const links = catalog.riskAssertionLinks.filter((link) => link.riskId === risk.id)
    const linkedCodes = links.map((link) => catalog.assertions.find((assertion) => assertion.id === link.assertionId)!.code)
    expect(suggestProcedureTemplates(risk, 'OCCURRENCE', catalog.procedureTemplates).map(({ code }) => code)).toEqual(['SALES-VOUCHING', 'SALES-APPROVAL-CONTROL'])
    expect(suggestProcedureTemplates(risk, 'VALUATION', catalog.procedureTemplates)).toEqual([])
    expect(linkedCodes).toContain('OCCURRENCE')
    expect(suggestProcedureTemplates({ ...risk, cycleId: 'another-cycle' }, 'OCCURRENCE', catalog.procedureTemplates)).toEqual([])
    expect(suggestProcedureTemplates({ ...risk, cycleId: sales.id, status: 'excluded' }, 'OCCURRENCE', catalog.procedureTemplates)).toEqual([])
  })

  it('instancie le catalogue une seule fois et journalise les décisions humaines justifiées', async () => {
    const db = createTestDatabase()
    const mission = { ...demoMission, id: 'mission-catalog-idempotent' }
    await db.missions.put(mission)
    await ensureMissionCatalog(db, mission)
    await ensureMissionCatalog(db, mission)
    expect(await db.cycles.where('missionId').equals(mission.id).count()).toBe(4)
    expect(await db.risks.where('missionId').equals(mission.id).count()).toBe(starterRisks.length)
    expect(await db.auditEvents.where('missionId').equals(mission.id).count()).toBe(1)

    const candidate = (await db.risks.where('missionId').equals(mission.id).first())!
    await expect(recordRiskDecision(db, candidate, 'confirmed', '  ', 'manager-demo')).rejects.toThrow(/justification humaine/i)
    expect((await db.risks.get(candidate.id))?.status).toBe('candidate')
    const confirmed = await recordRiskDecision(db, candidate, 'confirmed', 'Éléments du contexte discutés en revue.', 'manager-demo')
    expect(confirmed).toMatchObject({ status: 'confirmed', justification: 'Éléments du contexte discutés en revue.' })
    expect(await db.auditEvents.where('entityId').equals(candidate.id).first()).toMatchObject({ actorId: 'manager-demo', action: 'candidate-confirmed' })
  })

  it('ajoute une spécificité d’entité et conserve ses assertions et sa justification', async () => {
    const db = createTestDatabase()
    const mission = { ...demoMission, id: 'mission-entity-specific' }
    await ensureMissionCatalog(db, mission)
    const cycle = (await db.cycles.where('missionId').equals(mission.id).first())!
    const assertion = (await db.assertions.where('missionId').equals(mission.id).first())!
    const risk = await addEntitySpecificRisk(db, {
      missionId: mission.id,
      cycleId: cycle.id,
      title: 'Contrainte particulière du scénario',
      description: 'Un flux propre à cette entité fictive demande une attention documentée.',
      assertionIds: [assertion.id],
      justification: 'Information fournie dans la compréhension de l’entité.',
    }, 'manager-demo')
    expect(risk).toMatchObject({ status: 'confirmed', reviewStatus: 'draft', catalogVersion: STARTER_CATALOG_VERSION })
    expect(await db.riskAssertionLinks.where('riskId').equals(risk.id).toArray()).toHaveLength(1)
    expect(await db.auditEvents.where('entityId').equals(risk.id).first()).toMatchObject({ action: 'entity-specific-risk-added', actorId: 'manager-demo' })
    await expect(addEntitySpecificRisk(db, {
      missionId: mission.id, cycleId: cycle.id, title: '', description: 'Description', assertionIds: [assertion.id], justification: 'Motif',
    }, 'manager-demo')).rejects.toThrow(/requis/i)
  })
})
