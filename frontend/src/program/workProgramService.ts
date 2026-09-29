import type { AuditMissionDatabase } from '../data/database'
import type { EvidenceReference, ProcedureExecution, ReviewNote } from '../domain/types'
import { suggestProcedureTemplates } from '../catalog/catalogService'

const timestampNow = () => new Date().toISOString()

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function selectDeterministicSample(seed: string, populationSize: number, sampleSize: number): number[] {
  if (!Number.isInteger(populationSize) || populationSize < 1 || populationSize > 100_000) {
    throw new Error('La taille de population doit être un entier entre 1 et 100 000.')
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > Math.min(populationSize, 100)) {
    throw new Error('La taille d’échantillon doit être comprise entre 1 et 100, sans dépasser la population.')
  }
  return Array.from({ length: populationSize }, (_, index) => ({
    lineNumber: index + 1,
    rank: stableHash(`${seed}:${index + 1}`),
  }))
    .sort((left, right) => left.rank - right.rank || left.lineNumber - right.lineNumber)
    .slice(0, sampleSize)
    .map(({ lineNumber }) => lineNumber)
    .sort((left, right) => left - right)
}

function eventId(missionId: string, entityId: string, action: string, timestamp: string) {
  return `event-${missionId}-${entityId}-${action}-${timestamp}`
}

function auditEvent(missionId: string, entityType: string, entityIdValue: string, action: string, summary: string, actorId: string, timestamp: string) {
  return {
    id: eventId(missionId, entityIdValue, action, timestamp),
    missionId,
    actorId,
    entityType,
    entityId: entityIdValue,
    action,
    summary,
    occurredAt: timestamp,
  }
}

export interface AssignProcedureInput {
  missionId: string
  procedureTemplateId: string
  riskId: string
  assertionId: string
  preparerId: string
  reviewerId: string
  dueDate: string | null
  populationName: string
  populationDescription: string
  populationSize: number
  sampleSize: number
  assignedById: string
}

export async function assignProcedure(db: AuditMissionDatabase, input: AssignProcedureInput): Promise<ProcedureExecution> {
  const [mission, template, risk, assertion, preparer, reviewer, manager, riskAssertionLinkCount] = await Promise.all([
    db.missions.get(input.missionId),
    db.procedureTemplates.get(input.procedureTemplateId),
    db.risks.get(input.riskId),
    db.assertions.get(input.assertionId),
    db.teamMembers.get(input.preparerId),
    db.teamMembers.get(input.reviewerId),
    db.teamMembers.get(input.assignedById),
    db.riskAssertionLinks.where('[riskId+assertionId]').equals([input.riskId, input.assertionId]).count(),
  ])
  if (!mission || !template || !risk || !assertion || !preparer || !reviewer || !manager) throw new Error('La mission, le modèle, le risque, l’assertion ou les profils de démonstration sont introuvables.')
  if (mission.id !== input.missionId || template.missionId !== mission.id || risk.missionId !== mission.id || assertion.missionId !== mission.id) throw new Error('Tous les éléments affectés doivent appartenir à la même mission.')
  if (manager.missionId !== mission.id || manager.role !== 'engagement-manager') throw new Error('Seul le profil fictif Responsable de mission de cette mission peut affecter un travail.')
  if (risk.status !== 'confirmed' && risk.status !== 'adapted') throw new Error('Le risque doit être confirmé ou adapté explicitement par une personne avant l’affectation.')
  if (riskAssertionLinkCount === 0) throw new Error('Une assertion explicitement reliée au risque doit être choisie pour l’affectation.')
  if (template.cycleId !== risk.cycleId) throw new Error('Le modèle de procédure doit appartenir au cycle du risque retenu.')
  if (!suggestProcedureTemplates(risk, assertion.code, [template]).length) throw new Error('Aucune relation de catalogue ne relie cette procédure, ce risque et cette assertion.')
  if (preparer.missionId !== mission.id || reviewer.missionId !== mission.id || preparer.role !== 'preparer' || reviewer.role !== 'reviewer') {
    throw new Error('Désignez un profil fictif Préparateur et un profil fictif Réviseur de cette mission.')
  }
  if (preparer.id === reviewer.id) throw new Error('Le préparateur et le réviseur doivent être deux profils différents.')
  const populationName = input.populationName.trim()
  if (!populationName) throw new Error('La population de démonstration doit avoir un nom.')
  const populationSize = Number(input.populationSize)
  const sampleSize = Number(input.sampleSize)
  if (input.dueDate && Number.isNaN(Date.parse(input.dueDate))) throw new Error('La date d’échéance est invalide.')
  const seed = `${mission.id}|${template.id}|${risk.id}|${assertion.id}|${populationSize}`
  const selectedLines = selectDeterministicSample(seed, populationSize, sampleSize)
  const timestamp = timestampNow()
  const id = globalThis.crypto.randomUUID()
  const execution: ProcedureExecution = {
    id,
    missionId: mission.id,
    cycleId: risk.cycleId,
    procedureTemplateId: template.id,
    procedureTemplateVersion: template.version,
    riskId: risk.id,
    assertionIds: [assertion.id],
    title: template.title,
    objective: template.objective,
    steps: [...template.steps],
    expectedEvidence: [...template.expectedEvidence],
    sampleSeed: seed,
    sampleMethod: 'Sélection de démonstration déterministe : rang des numéros de ligne par empreinte stable de la graine de mission, du risque, de l’assertion, du modèle et de la taille de population.',
    status: 'planned',
    assignedToId: preparer.id,
    reviewerId: reviewer.id,
    dueDate: input.dueDate || null,
    result: null,
    submittedAt: null,
    reviewedAt: null,
    reviewConclusion: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const populationId = `${id}-population`
  const population = {
    id: populationId,
    missionId: mission.id,
    executionId: id,
    name: populationName,
    description: input.populationDescription.trim() || 'Population entièrement synthétique créée pour le parcours de démonstration.',
    itemCount: populationSize,
    sourceLabel: `Population fictive — ${populationName}`,
    isFictitious: true as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const samples = selectedLines.map((lineNumber) => {
    const amountRank = stableHash(`${seed}:amount:${lineNumber}`)
    return {
      id: `${id}-sample-${lineNumber}`,
      missionId: mission.id,
      populationId,
      executionId: id,
      lineNumber,
      reference: `SYNTH-${String(lineNumber).padStart(5, '0')}`,
      description: `Élément fictif ${lineNumber} de la population « ${populationName} »`,
      amount: Math.round((amountRank % 999_900) + 100) / 100,
      currency: mission.currency,
      result: 'pending' as const,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
  await db.transaction('rw', db.procedureExecutions, db.populations, db.sampleItems, db.auditEvents, async () => {
    await db.procedureExecutions.add(execution)
    await db.populations.add(population)
    await db.sampleItems.bulkAdd(samples)
    await db.auditEvents.add(auditEvent(mission.id, 'procedure-execution', id, 'procedure-assigned', `Procédure « ${template.title} » v${template.version} affectée à ${preparer.displayName}; réviseur : ${reviewer.displayName}.`, manager.id, timestamp))
  })
  return execution
}

export async function recordSampleOutcome(
  db: AuditMissionDatabase,
  sampleId: string,
  actorId: string,
  result: 'consistent' | 'exception',
  notes: string,
) {
  const sample = await db.sampleItems.get(sampleId)
  if (!sample) throw new Error('Élément d’échantillon introuvable.')
  const execution = await db.procedureExecutions.get(sample.executionId)
  if (!execution || execution.missionId !== sample.missionId) throw new Error('Le travail associé à cet élément est introuvable.')
  if (execution.status !== 'in-progress' || execution.assignedToId !== actorId) throw new Error('Seul le préparateur affecté peut consigner un résultat pendant l’exécution.')
  const explanation = notes.trim()
  if (result === 'exception' && !explanation) throw new Error('Ajoutez une observation descriptive pour documenter cet écart à examiner.')
  const timestamp = timestampNow()
  const updated = { ...sample, result, notes: explanation, updatedAt: timestamp }
  await db.transaction('rw', db.sampleItems, db.auditEvents, async () => {
    await db.sampleItems.put(updated)
    await db.auditEvents.add(auditEvent(execution.missionId, 'sample-item', sample.id, 'sample-result-recorded', `Résultat descriptif « ${result === 'consistent' ? 'éléments rapprochés' : 'écart à examiner'} » consigné pour la référence ${sample.reference}.`, actorId, timestamp))
  })
  return updated
}

export async function addEvidenceReference(
  db: AuditMissionDatabase,
  input: { executionId: string; actorId: string; label: string; reference: string; evidenceType: EvidenceReference['evidenceType']; notes: string },
): Promise<EvidenceReference> {
  const execution = await db.procedureExecutions.get(input.executionId)
  if (!execution) throw new Error('Travail introuvable.')
  if (execution.status !== 'in-progress' || execution.assignedToId !== input.actorId) throw new Error('Seul le préparateur affecté peut ajouter une référence pendant l’exécution.')
  const label = input.label.trim()
  const reference = input.reference.trim()
  if (!label || !reference) throw new Error('Le libellé et la référence de la pièce synthétique sont obligatoires.')
  const timestamp = timestampNow()
  const evidence: EvidenceReference = {
    id: globalThis.crypto.randomUUID(),
    missionId: execution.missionId,
    executionId: execution.id,
    label,
    reference,
    evidenceType: input.evidenceType,
    notes: input.notes.trim(),
    actorId: input.actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.transaction('rw', db.evidenceReferences, db.auditEvents, async () => {
    await db.evidenceReferences.add(evidence)
    await db.auditEvents.add(auditEvent(execution.missionId, 'evidence-reference', evidence.id, 'evidence-linked', `Référence de démonstration « ${label} » liée au travail ${execution.title}.`, input.actorId, timestamp))
  })
  return evidence
}

export async function transitionExecution(
  db: AuditMissionDatabase,
  executionId: string,
  actorId: string,
  nextStatus: ProcedureExecution['status'],
  reviewConclusion?: string,
): Promise<ProcedureExecution> {
  const execution = await db.procedureExecutions.get(executionId)
  if (!execution) throw new Error('Travail introuvable.')
  const timestamp = timestampNow()
  const updated = { ...execution, updatedAt: timestamp }

  if (nextStatus === 'in-progress') {
    if (execution.status !== 'planned' || execution.assignedToId !== actorId) throw new Error('Seul le préparateur affecté peut démarrer un travail planifié.')
  } else if (nextStatus === 'submitted') {
    if (execution.status !== 'in-progress' || execution.assignedToId !== actorId) throw new Error('Seul le préparateur affecté peut soumettre son travail en cours.')
    const [samples, evidence] = await Promise.all([
      db.sampleItems.where('executionId').equals(execution.id).toArray(),
      db.evidenceReferences.where('executionId').equals(execution.id).toArray(),
    ])
    if (samples.length === 0 || samples.some((sample) => sample.result === 'pending')) throw new Error('Consignez un résultat pour chaque élément de l’échantillon avant la soumission.')
    if (!execution.result?.trim()) throw new Error('Consignez le résultat descriptif du travail avant la soumission.')
    if (evidence.length === 0) throw new Error('Liez au moins une référence de pièce fictive avant la soumission.')
  } else if (nextStatus === 'reviewed') {
    if (execution.status !== 'submitted' || !execution.reviewerId || execution.reviewerId !== actorId || actorId === execution.assignedToId) {
      throw new Error('Seul le réviseur désigné, distinct du préparateur, peut terminer la revue d’un travail soumis.')
    }
    const openNotes = await db.reviewNotes.where('executionId').equals(execution.id).filter((note) => note.status !== 'resolved').count()
    if (openNotes > 0) throw new Error('Résolvez toutes les notes de revue avec leur réponse avant de terminer la revue.')
    if (!reviewConclusion?.trim()) throw new Error('Consignez la conclusion de revue humaine avant de terminer la revue.')
    updated.reviewedAt = timestamp
    updated.reviewConclusion = reviewConclusion.trim()
  } else {
    throw new Error('Transition de statut non prise en charge.')
  }

  updated.status = nextStatus
  if (nextStatus === 'submitted') updated.submittedAt = timestamp
  const summary = nextStatus === 'in-progress'
    ? `Travail « ${execution.title} » démarré par le préparateur affecté.`
    : nextStatus === 'submitted'
      ? `Travail « ${execution.title} » soumis à la revue par son préparateur.`
      : `Revue humaine terminée pour « ${execution.title} ». ${updated.reviewConclusion}`
  await db.transaction('rw', db.procedureExecutions, db.auditEvents, async () => {
    await db.procedureExecutions.put(updated)
    await db.auditEvents.add(auditEvent(execution.missionId, 'procedure-execution', execution.id, `procedure-${nextStatus}`, summary, actorId, timestamp))
  })
  return updated
}

export async function createReviewNote(
  db: AuditMissionDatabase,
  input: { executionId: string; actorId: string; question: string },
): Promise<ReviewNote> {
  const execution = await db.procedureExecutions.get(input.executionId)
  if (!execution) throw new Error('Travail introuvable.')
  if (execution.status !== 'submitted' || execution.reviewerId !== input.actorId || execution.assignedToId === input.actorId) {
    throw new Error('Seul le réviseur désigné, distinct du préparateur, peut demander un complément après soumission.')
  }
  const question = input.question.trim()
  if (!question) throw new Error('La demande de revue doit être renseignée.')
  const timestamp = timestampNow()
  const note: ReviewNote = {
    id: globalThis.crypto.randomUUID(),
    missionId: execution.missionId,
    executionId: execution.id,
    authorId: input.actorId,
    assignedToId: execution.assignedToId!,
    question,
    response: null,
    status: 'open',
    resolvedById: null,
    resolvedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.transaction('rw', db.reviewNotes, db.auditEvents, async () => {
    await db.reviewNotes.add(note)
    await db.auditEvents.add(auditEvent(execution.missionId, 'review-note', note.id, 'review-note-opened', `Demande de revue ouverte pour « ${execution.title} » et affectée à son préparateur.`, input.actorId, timestamp))
  })
  return note
}

export async function answerReviewNote(db: AuditMissionDatabase, noteId: string, actorId: string, response: string): Promise<ReviewNote> {
  const note = await db.reviewNotes.get(noteId)
  if (!note) throw new Error('Note de revue introuvable.')
  const execution = await db.procedureExecutions.get(note.executionId)
  if (!execution) throw new Error('Travail associé à la note introuvable.')
  if (note.status !== 'open' || note.assignedToId !== actorId || execution.assignedToId !== actorId || execution.reviewerId === actorId) {
    throw new Error('Seul le préparateur désigné, distinct du réviseur, peut répondre à une note ouverte.')
  }
  const text = response.trim()
  if (!text) throw new Error('La réponse du préparateur ne peut pas être vide.')
  const timestamp = timestampNow()
  const updated = { ...note, response: text, status: 'answered' as const, updatedAt: timestamp }
  await db.transaction('rw', db.reviewNotes, db.auditEvents, async () => {
    await db.reviewNotes.put(updated)
    await db.auditEvents.add(auditEvent(note.missionId, 'review-note', note.id, 'review-note-answered', 'Réponse du préparateur conservée pour revue.', actorId, timestamp))
  })
  return updated
}

export async function resolveReviewNote(db: AuditMissionDatabase, noteId: string, actorId: string): Promise<ReviewNote> {
  const note = await db.reviewNotes.get(noteId)
  if (!note) throw new Error('Note de revue introuvable.')
  const execution = await db.procedureExecutions.get(note.executionId)
  if (!execution) throw new Error('Travail associé à la note introuvable.')
  if (note.status !== 'answered' || execution.reviewerId !== actorId || actorId === execution.assignedToId || note.assignedToId === actorId) {
    throw new Error('Seul le réviseur désigné, distinct du préparateur, peut résoudre une note ayant reçu une réponse.')
  }
  const timestamp = timestampNow()
  const updated = { ...note, status: 'resolved' as const, resolvedById: actorId, resolvedAt: timestamp, updatedAt: timestamp }
  await db.transaction('rw', db.reviewNotes, db.auditEvents, async () => {
    await db.reviewNotes.put(updated)
    await db.auditEvents.add(auditEvent(note.missionId, 'review-note', note.id, 'review-note-resolved', `Note résolue par le réviseur; réponse conservée : ${note.response}`, actorId, timestamp))
  })
  return updated
}

export async function updateExecutionResult(db: AuditMissionDatabase, executionId: string, actorId: string, result: string): Promise<ProcedureExecution> {
  const execution = await db.procedureExecutions.get(executionId)
  if (!execution) throw new Error('Travail introuvable.')
  if (execution.status !== 'in-progress' || execution.assignedToId !== actorId) throw new Error('Seul le préparateur affecté peut consigner le résultat du travail en cours.')
  const text = result.trim()
  if (!text) throw new Error('Le résultat descriptif ne peut pas être vide.')
  const timestamp = timestampNow()
  const updated = { ...execution, result: text, updatedAt: timestamp }
  await db.transaction('rw', db.procedureExecutions, db.auditEvents, async () => {
    await db.procedureExecutions.put(updated)
    await db.auditEvents.add(auditEvent(execution.missionId, 'procedure-execution', execution.id, 'procedure-result-recorded', 'Résultat de démonstration consigné par le préparateur.', actorId, timestamp))
  })
  return updated
}
