import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from '../data/database'
import { DEMO_MISSION_ID } from '../data/demoSeed'
import { demoMission } from '../data/demoSeed'
import { seedDemoData } from '../data/demoService'
import { recordRiskDecision } from '../catalog/catalogService'
import {
  addEvidenceReference,
  answerReviewNote,
  assignProcedure,
  createReviewNote,
  recordSampleOutcome,
  resolveReviewNote,
  selectDeterministicSample,
  transitionExecution,
  updateExecutionResult,
} from './workProgramService'

let databaseIndex = 0
const openDatabases: AuditMissionDatabase[] = []

function createTestDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-program-test-${databaseIndex++}`)
  openDatabases.push(db)
  return db
}

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((db) => db.delete()))
})

async function createAssignment(db: AuditMissionDatabase) {
  await seedDemoData(db)
  const risk = await db.risks.where('code').equals('SALES-UNSUPPORTED').first()
  const template = await db.procedureTemplates.where('code').equals('SALES-VOUCHING').first()
  const assertion = await db.assertions.where('code').equals('OCCURRENCE').first()
  const managerId = 'member-demo-manager'
  await expect(assignProcedure(db, {
    missionId: DEMO_MISSION_ID,
    procedureTemplateId: template!.id,
    riskId: risk!.id,
    assertionId: assertion!.id,
    preparerId: 'member-demo-preparer',
    reviewerId: 'member-demo-reviewer',
    dueDate: '2026-12-15',
    populationName: 'Ventes synthétiques',
    populationDescription: 'Factures fictives de la période.',
    populationSize: 20,
    sampleSize: 3,
    assignedById: managerId,
  })).rejects.toThrow(/confirmé ou adapté/i)
  await recordRiskDecision(db, risk!, 'confirmed', 'Contexte de démonstration examiné par une personne.', managerId)
  const execution = await assignProcedure(db, {
    missionId: DEMO_MISSION_ID,
    procedureTemplateId: template!.id,
    riskId: risk!.id,
    assertionId: assertion!.id,
    preparerId: 'member-demo-preparer',
    reviewerId: 'member-demo-reviewer',
    dueDate: '2026-12-15',
    populationName: 'Ventes synthétiques',
    populationDescription: 'Factures fictives de la période.',
    populationSize: 20,
    sampleSize: 3,
    assignedById: managerId,
  })
  return { execution, risk: (await db.risks.get(risk!.id))!, assertion: assertion! }
}

describe('programme, exécution, preuves et revue', () => {
  it('sélectionne le même échantillon ordonné pour une même graine', () => {
    const first = selectDeterministicSample('mission|cycle|risk|assertion|20', 20, 5)
    expect(selectDeterministicSample('mission|cycle|risk|assertion|20', 20, 5)).toEqual(first)
    expect(first).toHaveLength(5)
    expect(new Set(first).size).toBe(5)
    expect(first).toEqual([...first].sort((left, right) => left - right))
    expect(selectDeterministicSample('other-seed', 20, 5)).not.toEqual(first)
    expect(() => selectDeterministicSample('seed', 2, 3)).toThrow(/sans dépasser la population/i)
    expect(() => selectDeterministicSample('seed', 0, 0)).toThrow(/taille de population/i)
  })

  it('fige les liens du modèle et crée une population et un échantillon sans doublons', async () => {
    const db = createTestDatabase()
    const { execution } = await createAssignment(db)
    const samples = await db.sampleItems.where('executionId').equals(execution.id).toArray()
    const population = await db.populations.where('executionId').equals(execution.id).first()
    expect(execution).toMatchObject({
      status: 'planned', riskId: 'risk-mission-demo-cemac-2025-sales-unsupported',
      assertionIds: ['assertion-mission-demo-cemac-2025-occurrence'], procedureTemplateVersion: 'starter-1.0.0',
      assignedToId: 'member-demo-preparer', reviewerId: 'member-demo-reviewer', submittedAt: null, reviewedAt: null,
    })
    expect(execution.steps.length).toBeGreaterThan(0)
    expect(execution.sampleMethod).toContain('déterministe')
    expect(population).toMatchObject({ name: 'Ventes synthétiques', itemCount: 20, isFictitious: true })
    expect(samples).toHaveLength(3)
    expect(new Set(samples.map(({ lineNumber }) => lineNumber)).size).toBe(3)
    expect(samples.every((sample) => sample.result === 'pending' && sample.currency === demoMission.currency)).toBe(true)
    expect(await db.auditEvents.where('entityId').equals(execution.id).first()).toMatchObject({ action: 'procedure-assigned', actorId: 'member-demo-manager' })
    await expect(assignProcedure(db, {
      missionId: DEMO_MISSION_ID,
      procedureTemplateId: execution.procedureTemplateId,
      riskId: execution.riskId,
      assertionId: execution.assertionIds[0],
      preparerId: 'member-demo-reviewer',
      reviewerId: 'member-demo-reviewer',
      dueDate: null,
      populationName: 'Population', populationDescription: '', populationSize: 2, sampleSize: 1,
      assignedById: 'member-demo-manager',
    })).rejects.toThrow(/Préparateur et réviseur|préparateur et un profil fictif Réviseur/i)
  })

  it('applique les transitions dans l’ordre et exige les résultats et références avant soumission', async () => {
    const db = createTestDatabase()
    const { execution } = await createAssignment(db)
    await expect(transitionExecution(db, execution.id, 'member-demo-reviewer', 'in-progress')).rejects.toThrow(/préparateur affecté/i)
    await expect(transitionExecution(db, execution.id, 'member-demo-manager', 'submitted')).rejects.toThrow(/préparateur affecté|en cours/i)
    const started = await transitionExecution(db, execution.id, 'member-demo-preparer', 'in-progress')
    expect(started.status).toBe('in-progress')
    const samples = await db.sampleItems.where('executionId').equals(execution.id).toArray()
    await expect(recordSampleOutcome(db, samples[0].id, 'member-demo-reviewer', 'consistent', '')).rejects.toThrow(/préparateur affecté/i)
    await expect(recordSampleOutcome(db, samples[0].id, 'member-demo-preparer', 'exception', '  ')).rejects.toThrow(/observation descriptive/i)
    await recordSampleOutcome(db, samples[0].id, 'member-demo-preparer', 'exception', 'Référence à rapprocher manuellement.')
    await expect(transitionExecution(db, execution.id, 'member-demo-preparer', 'submitted')).rejects.toThrow(/chaque élément/i)
    for (const sample of samples.slice(1)) await recordSampleOutcome(db, sample.id, 'member-demo-preparer', 'consistent', 'Référence synthétique rapprochée.')
    await updateExecutionResult(db, execution.id, 'member-demo-preparer', 'Travaux fictifs réalisés; un écart descriptif reste à examiner.')
    await expect(transitionExecution(db, execution.id, 'member-demo-preparer', 'submitted')).rejects.toThrow(/référence de pièce fictive/i)
    await addEvidenceReference(db, {
      executionId: execution.id, actorId: 'member-demo-preparer', label: 'Liste de vente', reference: 'DEMO-SALES-001',
      evidenceType: 'fictional-document', notes: 'Pièce synthétique du scénario.',
    })
    const submitted = await transitionExecution(db, execution.id, 'member-demo-preparer', 'submitted')
    expect(submitted).toMatchObject({ status: 'submitted', submittedAt: expect.any(String), reviewedAt: null })
    await expect(transitionExecution(db, execution.id, 'member-demo-preparer', 'in-progress')).rejects.toThrow(/préparateur affecté/i)
  })

  it('sépare les rôles et garde la réponse d’une note résolue dans la revue traçable', async () => {
    const db = createTestDatabase()
    const { execution } = await createAssignment(db)
    await transitionExecution(db, execution.id, 'member-demo-preparer', 'in-progress')
    const samples = await db.sampleItems.where('executionId').equals(execution.id).toArray()
    for (const sample of samples) await recordSampleOutcome(db, sample.id, 'member-demo-preparer', 'consistent', 'Rapprochement synthétique documenté.')
    await updateExecutionResult(db, execution.id, 'member-demo-preparer', 'Résultats fictifs documentés pour la revue.')
    await addEvidenceReference(db, {
      executionId: execution.id, actorId: 'member-demo-preparer', label: 'Pièce fictive', reference: 'DEMO-REVIEW-001',
      evidenceType: 'fictional-document', notes: 'Référence liée au test.',
    })
    await transitionExecution(db, execution.id, 'member-demo-preparer', 'submitted')

    await expect(createReviewNote(db, { executionId: execution.id, actorId: 'member-demo-preparer', question: 'Clarifier la référence.' })).rejects.toThrow(/réviseur désigné/i)
    const note = await createReviewNote(db, { executionId: execution.id, actorId: 'member-demo-reviewer', question: 'Préciser le rapprochement de la pièce synthétique.' })
    await expect(transitionExecution(db, execution.id, 'member-demo-reviewer', 'reviewed', 'Revue terminée.')).rejects.toThrow(/Résolvez toutes les notes/i)
    await expect(answerReviewNote(db, note.id, 'member-demo-reviewer', 'Réponse incorrecte du réviseur.')).rejects.toThrow(/préparateur désigné/i)
    const answered = await answerReviewNote(db, note.id, 'member-demo-preparer', 'Le rapprochement est présenté dans la référence fictive DEMO-REVIEW-001.')
    expect(answered).toMatchObject({ status: 'answered', response: expect.stringContaining('DEMO-REVIEW-001') })
    await expect(resolveReviewNote(db, note.id, 'member-demo-preparer')).rejects.toThrow(/réviseur désigné/i)
    const resolved = await resolveReviewNote(db, note.id, 'member-demo-reviewer')
    expect(resolved).toMatchObject({
      status: 'resolved', response: answered.response, resolvedById: 'member-demo-reviewer', resolvedAt: expect.any(String),
    })
    const reviewed = await transitionExecution(db, execution.id, 'member-demo-reviewer', 'reviewed', 'Réponse consultée et note résolue par le réviseur fictif.')
    expect(reviewed).toMatchObject({ status: 'reviewed', reviewConclusion: expect.stringContaining('note résolue'), reviewedAt: expect.any(String) })
    expect(await db.reviewNotes.get(note.id)).toMatchObject({ status: 'resolved', response: answered.response })
    expect(await db.auditEvents.where('entityId').equals(note.id).count()).toBe(3)
    expect((await db.auditEvents.where('entityId').equals(execution.id).toArray()).map(({ action }) => action)).toEqual(expect.arrayContaining(['procedure-assigned', 'procedure-in-progress', 'procedure-submitted', 'procedure-reviewed']))
  })
})
