import type { AuditMissionDatabase } from '../data/database'
import { demoCycles } from '../data/demoSeed'
import type { Assertion, Cycle, Mission, ProcedureTemplate, Risk, RiskAssertionLink } from '../domain/types'
import {
  STARTER_CATALOG_AUTHOR,
  STARTER_CATALOG_REVIEWER,
  STARTER_CATALOG_SOURCE,
  STARTER_CATALOG_VERSION,
  starterAssertions,
  starterProcedures,
  starterRisks,
} from './catalogData'

const now = () => new Date().toISOString()
const entityId = (missionId: string, kind: string, code: string) => `${kind}-${missionId}-${code.toLowerCase()}`

export function buildMissionCatalog(mission: Mission, timestamp = now()) {
  const cycles: Cycle[] = demoCycles.map((cycle) => ({
    ...cycle,
    id: entityId(mission.id, 'cycle', cycle.code),
    missionId: mission.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const cycleIds = new Map(cycles.map((cycle) => [cycle.code, cycle.id]))
  const assertions: Assertion[] = starterAssertions.map((assertion) => ({
    ...assertion,
    id: entityId(mission.id, 'assertion', assertion.code),
    missionId: mission.id,
    catalogVersion: STARTER_CATALOG_VERSION,
    source: STARTER_CATALOG_SOURCE,
    reviewStatus: 'reviewed',
    author: STARTER_CATALOG_AUTHOR,
    reviewer: STARTER_CATALOG_REVIEWER,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const assertionIds = new Map(assertions.map((assertion) => [assertion.code, assertion.id]))
  const risks: Risk[] = starterRisks.map((risk) => ({
    id: entityId(mission.id, 'risk', risk.code),
    missionId: mission.id,
    cycleId: cycleIds.get(risk.cycleCode)!,
    code: risk.code,
    title: risk.title,
    description: risk.description,
    rationale: risk.rationale,
    status: 'candidate',
    catalogVersion: STARTER_CATALOG_VERSION,
    category: risk.category,
    applicableMissionTypes: risk.applicableMissionTypes ?? [],
    applicableSectors: risk.applicableSectors ?? [],
    keywords: risk.keywords,
    source: STARTER_CATALOG_SOURCE,
    reviewStatus: 'reviewed',
    author: STARTER_CATALOG_AUTHOR,
    reviewer: STARTER_CATALOG_REVIEWER,
    justification: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const riskIds = new Map(risks.map((risk) => [risk.code, risk.id]))
  const riskAssertionLinks: RiskAssertionLink[] = starterRisks.flatMap((risk) =>
    Object.entries(risk.assertionRationales).map(([assertionCode, rationale]) => ({
      id: entityId(mission.id, 'risk-assertion', `${risk.code}-${assertionCode}`),
      missionId: mission.id,
      riskId: riskIds.get(risk.code)!,
      assertionId: assertionIds.get(assertionCode)!,
      rationale,
      catalogVersion: STARTER_CATALOG_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
  const procedureTemplates: ProcedureTemplate[] = starterProcedures.map((procedure) => ({
    id: entityId(mission.id, 'procedure', procedure.code),
    missionId: mission.id,
    cycleId: cycleIds.get(procedure.cycleCode)!,
    code: procedure.code,
    title: procedure.title,
    objective: procedure.objective,
    procedureType: procedure.procedureType,
    steps: procedure.steps,
    expectedEvidence: procedure.expectedEvidence,
    prerequisites: procedure.prerequisites,
    populationDescription: procedure.populationDescription,
    expectedResult: procedure.expectedResult,
    riskCodes: procedure.riskCodes,
    assertionCodes: procedure.assertionCodes,
    standardReferences: procedure.standardReferences,
    version: STARTER_CATALOG_VERSION,
    status: 'reviewed',
    source: STARTER_CATALOG_SOURCE,
    author: STARTER_CATALOG_AUTHOR,
    reviewer: STARTER_CATALOG_REVIEWER,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))

  return { cycles, assertions, risks, riskAssertionLinks, procedureTemplates }
}

export async function ensureMissionCatalog(db: AuditMissionDatabase, mission: Mission): Promise<void> {
  const existingRisks = await db.risks.where('missionId').equals(mission.id).count()
  const existingCycles = await db.cycles.where('missionId').equals(mission.id).count()
  if (existingRisks > 0 && existingCycles > 0) return

  const records = buildMissionCatalog(mission)
  await db.transaction(
    'rw',
    [db.cycles, db.assertions, db.risks, db.riskAssertionLinks, db.procedureTemplates, db.auditEvents],
    async () => {
      if (existingCycles === 0) await db.cycles.bulkPut(records.cycles)
      if (existingRisks === 0) {
        await Promise.all([
          db.assertions.bulkPut(records.assertions),
          db.risks.bulkPut(records.risks),
          db.riskAssertionLinks.bulkPut(records.riskAssertionLinks),
          db.procedureTemplates.bulkPut(records.procedureTemplates),
          db.auditEvents.put({
            id: entityId(mission.id, 'event', `catalog-${STARTER_CATALOG_VERSION}`),
            missionId: mission.id,
            actorId: 'system-demo',
            entityType: 'catalog',
            entityId: STARTER_CATALOG_VERSION,
            action: 'catalog-initialized',
            summary: `Catalogue ${STARTER_CATALOG_VERSION} instancié pour la mission de démonstration.`,
            occurredAt: now(),
          }),
        ])
      }
    },
  )
}

export interface RiskSuggestion {
  risk: Risk
  reasons: string[]
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
}

export function suggestRiskCandidates(mission: Mission, cycleId: string, risks: Risk[]): RiskSuggestion[] {
  return risks
    .filter((risk) => risk.cycleId === cycleId && risk.status === 'candidate' && ['reviewed', 'approved'].includes(risk.reviewStatus))
    .filter((risk) => risk.applicableMissionTypes.length === 0 || risk.applicableMissionTypes.includes(mission.missionType))
    .filter((risk) => risk.applicableSectors.length === 0 || risk.applicableSectors.some((sector) => normalize(mission.sector).includes(normalize(sector))))
    .map((risk) => ({
      risk,
      reasons: [
        'Le cycle de la mission correspond au cycle du modèle.',
        ...(risk.applicableMissionTypes.length > 0 ? ['Le type de mission figure dans les contextes prévus par le modèle.'] : []),
        ...(risk.applicableSectors.length > 0 ? [`Le secteur « ${mission.sector} » correspond aux contextes indicatifs du modèle.`] : []),
        `Motif du modèle : ${risk.rationale}`,
      ],
    }))
}

export function suggestProcedureTemplates(
  risk: Risk,
  assertionCode: string,
  templates: ProcedureTemplate[],
): ProcedureTemplate[] {
  if (risk.status === 'excluded') return []
  return templates.filter((template) =>
    template.cycleId === risk.cycleId
    && template.status === 'reviewed'
    && (template.riskCodes.includes(risk.code) || risk.code.startsWith('ENTITY-'))
    && template.assertionCodes.includes(assertionCode),
  )
}

export async function recordRiskDecision(
  db: AuditMissionDatabase,
  risk: Risk,
  decision: 'confirmed' | 'adapted' | 'excluded',
  justification: string,
  actorId: string,
  adapted?: { title: string; description: string },
): Promise<Risk> {
  const reason = justification.trim()
  if (!reason) throw new Error('Une justification humaine est requise pour enregistrer cette décision.')
  if (risk.status !== 'candidate') throw new Error('Seul un candidat sans décision peut être traité ici.')
  if (decision === 'adapted' && (!adapted?.title.trim() || !adapted.description.trim())) {
    throw new Error('Un intitulé et une description sont requis pour adapter le candidat.')
  }

  const timestamp = now()
  const updated: Risk = {
    ...risk,
    status: decision,
    title: decision === 'adapted' ? adapted!.title.trim() : risk.title,
    description: decision === 'adapted' ? adapted!.description.trim() : risk.description,
    justification: reason,
    updatedAt: timestamp,
  }
  await db.transaction('rw', db.risks, db.auditEvents, async () => {
    await db.risks.put(updated)
    await db.auditEvents.put({
      id: entityId(risk.missionId, 'event', `risk-${risk.id}-${timestamp}`),
      missionId: risk.missionId,
      actorId,
      entityType: 'risk',
      entityId: risk.id,
      action: `candidate-${decision}`,
      summary: `Candidat « ${updated.title} » ${decision === 'confirmed' ? 'confirmé' : decision === 'adapted' ? 'adapté' : 'écarté'} par une personne. Motif : ${reason}`,
      occurredAt: timestamp,
    })
  })
  return updated
}

export async function addEntitySpecificRisk(
  db: AuditMissionDatabase,
  input: { missionId: string; cycleId: string; title: string; description: string; assertionIds: string[]; justification: string },
  actorId: string,
): Promise<Risk> {
  const title = input.title.trim()
  const description = input.description.trim()
  const justification = input.justification.trim()
  if (!title || !description || !justification || input.assertionIds.length === 0) {
    throw new Error('Intitulé, description, assertion et justification sont requis pour une spécificité d’entité.')
  }
  const timestamp = now()
  const id = globalThis.crypto.randomUUID()
  const risk: Risk = {
    id,
    missionId: input.missionId,
    cycleId: input.cycleId,
    code: `ENTITY-${id}`,
    title,
    description,
    rationale: 'Élément créé et décrit par une personne pour le contexte de cette entité.',
    status: 'confirmed',
    catalogVersion: STARTER_CATALOG_VERSION,
    category: 'operation',
    applicableMissionTypes: [],
    applicableSectors: [],
    keywords: [],
    source: 'Spécificité de l’entité — saisie par une personne.',
    reviewStatus: 'draft',
    author: actorId,
    reviewer: 'À désigner — revue humaine requise',
    justification,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const assertions = await db.assertions.where('missionId').equals(input.missionId).toArray()
  const selected = new Set(input.assertionIds)
  const links = assertions.filter((assertion) => selected.has(assertion.id)).map((assertion) => ({
    id: entityId(input.missionId, 'risk-assertion', `${risk.code}-${assertion.code}`),
    missionId: input.missionId,
    riskId: id,
    assertionId: assertion.id,
    rationale: `Assertion choisie par une personne. Justification : ${justification}`,
    catalogVersion: STARTER_CATALOG_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  if (links.length !== selected.size) throw new Error('Une assertion sélectionnée ne fait pas partie de cette mission.')
  await db.transaction('rw', db.risks, db.riskAssertionLinks, db.auditEvents, async () => {
    await db.risks.add(risk)
    await db.riskAssertionLinks.bulkPut(links)
    await db.auditEvents.put({
      id: entityId(input.missionId, 'event', `risk-${id}-${timestamp}`),
      missionId: input.missionId,
      actorId,
      entityType: 'risk',
      entityId: id,
      action: 'entity-specific-risk-added',
      summary: `Spécificité d’entité « ${title} » saisie par une personne. Motif : ${justification}`,
      occurredAt: timestamp,
    })
  })
  return risk
}
