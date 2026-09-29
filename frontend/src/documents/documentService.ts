import type { AuditMissionDatabase } from '../data/database'
import type {
  Assertion,
  AuditEvent,
  Cycle,
  DocumentTemplate,
  EvidenceReference,
  Finding,
  GeneratedDocument,
  GeneratedDocumentSourceReference,
  Mission,
  Population,
  ProcedureExecution,
  ReviewNote,
  Risk,
  RiskAssertionLink,
  SampleItem,
  TeamMember,
} from '../domain/types'

export interface DocumentField {
  id: string
  label: string
  value: string
  required: boolean
}

export interface DocumentDraft {
  fields: DocumentField[]
  body: string
  sourceReferences: GeneratedDocumentSourceReference[]
}

export interface DocumentContext {
  mission: Mission
  actor: TeamMember
  members: TeamMember[]
  cycles: Cycle[]
  risks: Risk[]
  assertions: Assertion[]
  riskAssertionLinks: RiskAssertionLink[]
  executions: ProcedureExecution[]
  samples: SampleItem[]
  populations: Population[]
  evidence: EvidenceReference[]
  notes: ReviewNote[]
  findings: Finding[]
  events: AuditEvent[]
}

export interface DocumentTemplateDefinition {
  id: string
  code: string
  title: string
  version: string
  category: string
  description: string
  createDraft: (context: DocumentContext) => DocumentDraft
}

const VERSION = '1.0.0'
const blankField = (id: string, label: string, required = true): DocumentField => ({ id, label, value: '', required })

function source(entityType: string, entityId: string, label: string): GeneratedDocumentSourceReference {
  return { entityType, entityId, label }
}

function missionSource(context: DocumentContext) {
  return [source('mission', context.mission.id, `Mission : ${context.mission.name}`)]
}

function listSection(title: string, items: string[]) {
  return [`${title}`, ...(items.length ? items.map((item) => `• ${item}`) : ['Aucun élément enregistré dans la démonstration.'])].join('\n')
}

function executionSummary(context: DocumentContext) {
  return context.executions.map((execution) => {
    const cycle = context.cycles.find(({ id }) => id === execution.cycleId)?.name ?? 'Cycle non précisé'
    const outcome = execution.result ?? 'Résultat à documenter'
    return `${cycle} — ${execution.title} (${execution.status})\nObjectif : ${execution.objective}\nRésultat : ${outcome}\nÉtapes : ${execution.steps.join(' ; ')}`
  })
}

function riskSummary(context: DocumentContext) {
  return context.risks.map((risk) => {
    const cycle = context.cycles.find(({ id }) => id === risk.cycleId)?.name ?? 'Cycle non précisé'
    const assertions = context.riskAssertionLinks
      .filter(({ riskId }) => riskId === risk.id)
      .map(({ assertionId }) => context.assertions.find(({ id }) => id === assertionId)?.name)
      .filter((name): name is string => Boolean(name))
    return `${cycle} — ${risk.title} [${risk.status}]${assertions.length ? ` · Assertions liées : ${assertions.join(', ')}` : ''}\n${risk.description}`
  })
}

export const documentTemplates: DocumentTemplateDefinition[] = [
  {
    id: 'template-demo-engagement-letter', code: 'LETTRE-MISSION-DEMO', title: 'Lettre de mission — brouillon', version: VERSION, category: 'Acceptation',
    description: 'Trame fictive d’échange des termes de mission, à relire et compléter.',
    createDraft: (context) => ({ fields: [blankField('destinataire', 'Destinataire fictif'), { id: 'entite', label: 'Entité fictive', value: context.mission.entityName, required: true }, { id: 'exercice', label: 'Période', value: `${context.mission.periodStart} — ${context.mission.periodEnd}`, required: true }], body: `BROUILLON DE DÉMONSTRATION — NON SIGNÉ / NON ENVOYÉ\n\nCette trame illustre uniquement une lettre de mission. Le périmètre, les responsabilités, le référentiel, le calendrier et les honoraires ne sont pas convenus par ce document.\n\nAucun signataire ni engagement professionnel réel n’est désigné. Tout contenu doit faire l’objet d’une validation humaine avant tout usage.`, sourceReferences: missionSource(context) }),
  },
  {
    id: 'template-demo-planning-memo', code: 'MEMO-PLANIFICATION', title: 'Mémo de planification', version: VERSION, category: 'Planification',
    description: 'Contexte et cycles repris de la mission ; décisions de planification à documenter.',
    createDraft: (context) => ({ fields: [blankField('responsable', 'Responsable de la décision de planification'), blankField('materialite', 'Matérialité définie par une personne')], body: `${context.mission.name}\nPériode : ${context.mission.periodStart} — ${context.mission.periodEnd}\nRéférentiel pédagogique : ${context.mission.framework} (${context.mission.frameworkVersion}) — ${context.mission.frameworkStatus}\n\n${listSection('Cycles enregistrés', context.cycles.map(({ name, status }) => `${name} — ${status}`))}\n\nStratégie, calendrier, ressources et seuils restent à apprécier et à documenter par une personne.`, sourceReferences: [...missionSource(context), ...context.cycles.map((item) => source('cycle', item.id, item.name))] }),
  },
  {
    id: 'template-demo-risk-matrix', code: 'MATRICE-RISQUES', title: 'Matrice de risques et assertions', version: VERSION, category: 'Planification',
    description: 'Photographie des risques candidats et décisions enregistrées, sans évaluation automatique.',
    createDraft: (context) => ({ fields: [blankField('perimetre', 'Périmètre examiné et justification')], body: `${context.mission.name}\n${listSection('Risques et assertions liés', riskSummary(context))}\n\nLes statuts sont ceux consignés dans la démonstration. Aucune probabilité, signification ou conclusion n’est calculée automatiquement.`, sourceReferences: [...missionSource(context), ...context.risks.map((item) => source('risk', item.id, item.title)), ...context.riskAssertionLinks.map((item) => source('riskAssertionLink', item.id, 'Lien risque–assertion'))] }),
  },
  {
    id: 'template-demo-working-paper', code: 'FEUILLE-TRAVAIL', title: 'Feuille de travail', version: VERSION, category: 'Exécution',
    description: 'Travaux, résultats, éléments fictifs et échantillons du programme de mission.',
    createDraft: (context) => ({ fields: [blankField('objectif', 'Objectif et étendue revus'), blankField('preuve', 'Référence de preuve examinée')], body: `${context.mission.name}\n${listSection('Procédures et résultats', executionSummary(context))}\n\n${listSection('Éléments de l’échantillon', context.samples.map((sample) => `${sample.reference} — ${sample.description} — ${sample.result} — ${sample.notes || 'observation à compléter'}`))}\n\n${listSection('Références de preuves fictives', context.evidence.map((item) => `${item.label} — ${item.reference} — ${item.notes}`))}\n\nLes résultats sont descriptifs et soumis à revue humaine ; les pièces et montants sont fictifs.`, sourceReferences: [...missionSource(context), ...context.executions.map((item) => source('procedureExecution', item.id, item.title)), ...context.samples.map((item) => source('sampleItem', item.id, item.reference)), ...context.evidence.map((item) => source('evidenceReference', item.id, item.reference))] }),
  },
  {
    id: 'template-demo-review-note', code: 'NOTE-REVUE', title: 'Note de revue', version: VERSION, category: 'Revue',
    description: 'Questions, réponses et état issus du parcours de revue fictif.',
    createDraft: (context) => ({ fields: [blankField('objet', 'Point à revoir ou référence de travail')], body: `${context.mission.name}\n${listSection('Notes de revue enregistrées', context.notes.map((note) => `${note.question}\nRéponse : ${note.response ?? 'en attente'}\nÉtat : ${note.status}`))}\n\n${context.notes.length ? 'Question et réponse conservées selon le parcours de démonstration.' : 'Aucune note de revue n’est enregistrée ; cet espace est à compléter.'}`, sourceReferences: [...missionSource(context), ...context.notes.map((item) => source('reviewNote', item.id, 'Note de revue')), ...context.executions.map((item) => source('procedureExecution', item.id, item.title))] }),
  },
  {
    id: 'template-demo-anomalies', code: 'TABLEAU-ANOMALIES', title: 'Tableau des anomalies', version: VERSION, category: 'Évaluation',
    description: 'Liste les constats saisis par une personne ; ne qualifie pas automatiquement leur caractère significatif.',
    createDraft: (context) => ({ fields: [blankField('critere', 'Critère et source à confirmer'), blankField('evaluation', 'Évaluation documentée par une personne')], body: `${context.mission.name}\n${listSection('Constats / anomalies documentés', context.findings.map((finding) => `${finding.title} — ${finding.status}\nFaits : ${finding.facts}\nCritère saisi : ${finding.criteria}\nCause : ${finding.cause}\nImpact indicatif : ${finding.indicativeImpact}\nAction proposée : ${finding.recommendation}`))}\n\n${context.findings.length ? 'Les éléments affichés reprennent les constats saisis ; leur évaluation reste humaine.' : 'Aucun constat n’est enregistré. Absence de donnée ne vaut pas absence d’anomalie.'}`, sourceReferences: [...missionSource(context), ...context.findings.map((item) => source('finding', item.id, item.title))] }),
  },
  {
    id: 'template-demo-closing-memo', code: 'MEMO-CLOTURE', title: 'Mémo de clôture', version: VERSION, category: 'Clôture',
    description: 'État de synthèse à compléter après revue du dossier et des points ouverts.',
    createDraft: (context) => ({ fields: [blankField('points_ouverts', 'Traitement des points ouverts'), blankField('revue_finale', 'Revue finale réalisée par une personne')], body: `${context.mission.name}\nPériode : ${context.mission.periodStart} — ${context.mission.periodEnd}\n\n${listSection('Travaux', context.executions.map((item) => `${item.title} — ${item.status}`))}\n\n${listSection('Notes de revue non résolues', context.notes.filter(({ status }) => status !== 'resolved').map((item) => item.question))}\n\n${listSection('Constats encore ouverts', context.findings.filter(({ status }) => status === 'open' || status === 'draft').map((item) => item.title))}\n\nCette synthèse ne constitue ni une clôture de mission réelle ni une opinion.`, sourceReferences: [...missionSource(context), ...context.executions.map((item) => source('procedureExecution', item.id, item.title)), ...context.notes.map((item) => source('reviewNote', item.id, 'Note de revue')), ...context.findings.map((item) => source('finding', item.id, item.title))] }),
  },
  {
    id: 'template-demo-report', code: 'RAPPORT-SIMULE', title: 'Projet de rapport simulé', version: VERSION, category: 'Communication',
    description: 'Structure de démonstration sans opinion, signature ni émission réelle.',
    createDraft: (context) => ({ fields: [blankField('destinataire', 'Destinataire fictif du projet'), blankField('revue', 'Référence de validation humaine')], body: `PROJET SIMULÉ — SANS OPINION / NON ÉMIS\n\nEntité fictive : ${context.mission.entityName}\nPériode : ${context.mission.periodStart} — ${context.mission.periodEnd}\nContexte comptable pédagogique : ${context.mission.framework} (${context.mission.frameworkVersion})\n\n${listSection('Éléments disponibles à examiner par une personne', executionSummary(context))}\n\nAucune opinion d’audit n’est générée par cette application. Le présent projet est un gabarit de portfolio, ni validé, ni signé, ni adressé.`, sourceReferences: [...missionSource(context), ...context.executions.map((item) => source('procedureExecution', item.id, item.title)), ...context.findings.map((item) => source('finding', item.id, item.title))] }),
  },
]

export function findMissingRequiredFields(fields: DocumentField[]): DocumentField[] {
  return fields.filter(({ required, value }) => required && !value.trim())
}

export function serializeDocumentDraft(draft: DocumentDraft): string {
  return JSON.stringify({ fields: draft.fields, body: draft.body, sourceReferences: draft.sourceReferences })
}

export function parseDocumentDraft(content: string): DocumentDraft | null {
  try {
    const draft = JSON.parse(content) as DocumentDraft
    if (!Array.isArray(draft.fields) || typeof draft.body !== 'string' || !Array.isArray(draft.sourceReferences)) return null
    return draft
  } catch {
    return null
  }
}

export async function exportDocument(
  db: AuditMissionDatabase,
  args: { missionId: string; templateId: string; templateVersion: string; title: string; content: string; actorId: string; id?: string; createdAt?: string },
): Promise<GeneratedDocument> {
  const mission = await db.missions.get(args.missionId)
  if (!mission) throw new Error('La mission source du document n’existe plus.')
  const draft = parseDocumentDraft(args.content)
  if (!draft) throw new Error('Le brouillon n’a pas un format de document valide.')
  if (draft.sourceReferences.some((reference) => !reference.entityId || !reference.entityType || !reference.label)) {
    throw new Error('Une référence source du document est incomplète.')
  }

  const occurredAt = args.createdAt ?? new Date().toISOString()
  const id = args.id ?? `document-${globalThis.crypto.randomUUID()}`
  const generated: GeneratedDocument = {
    id,
    missionId: mission.id,
    templateId: args.templateId,
    templateVersion: args.templateVersion,
    title: args.title,
    content: args.content,
    generatedById: args.actorId,
    isFictitious: true,
    sourceReferences: draft.sourceReferences,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  }
  const event: AuditEvent = {
    id: `event-${id}`,
    missionId: mission.id,
    actorId: args.actorId,
    entityType: 'generatedDocument',
    entityId: id,
    action: 'document-exported',
    summary: `Export navigateur demandé — modèle ${args.templateId} v${args.templateVersion}. Document de démonstration, brouillon non signé.`,
    occurredAt,
  }

  await db.transaction('rw', db.generatedDocuments, db.auditEvents, async () => {
    await db.generatedDocuments.add(generated)
    await db.auditEvents.add(event)
  })
  return generated
}

export function createDocumentTemplateRecord(template: DocumentTemplateDefinition, now = new Date().toISOString()): DocumentTemplate {
  return { id: template.id, code: template.code, title: template.title, version: template.version, category: template.category, status: 'published', createdAt: now, updatedAt: now }
}
