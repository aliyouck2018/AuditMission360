import type { AuditMissionDatabase } from '../data/database'
import type {
  ActionPlan, AnalyticsException, AuditEvent, Cycle, EvidenceReference, Finding, GeneratedDocumentSourceReference,
  ImportJob, LedgerEntry, Mission, ProcedureExecution, ReviewNote, SampleItem,
} from '../domain/types'
import { exportDocument, serializeDocumentDraft, type DocumentDraft } from '../documents/documentService'

export const CLOSING_DOSSIER_VERSION = '1.0.0'
export const CLOSING_MEMO_TEMPLATE_ID = 'template-demo-closing-memo'

export interface ClosingContext {
  mission: Mission
  actorId: string
  cycles: Cycle[]
  executions: ProcedureExecution[]
  samples: SampleItem[]
  evidence: EvidenceReference[]
  notes: ReviewNote[]
  findings: Finding[]
  actionPlans: ActionPlan[]
  imports: ImportJob[]
  exceptions: AnalyticsException[]
  ledgerEntries: LedgerEntry[]
  events: AuditEvent[]
}

export interface ClosingMetrics {
  reviewedProcedures: number
  procedureDenominator: number
  reviewedRate: number | null
  executionsWithEvidence: number
  openReviewNotes: number
  signalsToInvestigate: number
  openFindings: number
  openActionPlans: number
}

export interface FindingInput {
  missionId: string
  cycleId: string
  title: string
  facts: string
  criteria: string
  cause: string
  indicativeImpact: string
  recommendation: string
  owner: string
  dueDate: string
  sourceReferences: GeneratedDocumentSourceReference[]
  actorId: string
  id?: string
  now?: string
}

function makeSource(entityType: string, entityId: string, label: string): GeneratedDocumentSourceReference {
  return { entityType, entityId, label }
}

export function calculateClosingMetrics(context: Pick<ClosingContext, 'executions' | 'evidence' | 'notes' | 'exceptions' | 'findings' | 'actionPlans'>): ClosingMetrics {
  const procedureDenominator = context.executions.length
  const reviewedProcedures = context.executions.filter(({ status }) => status === 'reviewed').length
  const executionsWithEvidence = new Set(context.evidence.map(({ executionId }) => executionId)).size
  return {
    reviewedProcedures,
    procedureDenominator,
    reviewedRate: procedureDenominator ? Math.round((reviewedProcedures / procedureDenominator) * 100) : null,
    executionsWithEvidence,
    openReviewNotes: context.notes.filter(({ status }) => status !== 'resolved').length,
    signalsToInvestigate: context.exceptions.filter(({ status }) => status === 'to-investigate').length,
    openFindings: context.findings.filter(({ status }) => status === 'draft' || status === 'open').length,
    openActionPlans: context.actionPlans.filter(({ status }) => status !== 'completed').length,
  }
}

export function getClosingBlockers(context: ClosingContext): string[] {
  const metrics = calculateClosingMetrics(context)
  const blockers: string[] = []
  if (metrics.procedureDenominator === 0) blockers.push('Aucune procédure n’a été affectée à la mission de démonstration.')
  const notReviewed = metrics.procedureDenominator - metrics.reviewedProcedures
  if (notReviewed > 0) blockers.push(`${notReviewed} procédure(s) n’ont pas encore le statut « revue ».`)
  if (metrics.openReviewNotes > 0) blockers.push(`${metrics.openReviewNotes} note(s) de revue restent ouvertes ou en attente de résolution.`)
  if (metrics.signalsToInvestigate > 0) blockers.push(`${metrics.signalsToInvestigate} signal(aux) analytique(s) restent « à investiguer ».`)
  if (metrics.openFindings > 0) blockers.push(`${metrics.openFindings} constat(s) sont encore à l’état brouillon ou ouvert.`)
  if (metrics.openActionPlans > 0) blockers.push(`${metrics.openActionPlans} plan(s) de suivi ne sont pas marqués terminés.`)
  return blockers
}

export function filterFindings(findings: Finding[], filter: 'all' | 'open' | 'resolved') {
  if (filter === 'open') return findings.filter(({ status }) => status === 'draft' || status === 'open')
  if (filter === 'resolved') return findings.filter(({ status }) => status === 'resolved' || status === 'closed')
  return findings
}

export async function createFinding(db: AuditMissionDatabase, input: FindingInput): Promise<{ finding: Finding; actionPlan: ActionPlan }> {
  const required: [string, string][] = [
    ['titre', input.title], ['faits', input.facts], ['critère / référence', input.criteria], ['cause', input.cause],
    ['impact indicatif', input.indicativeImpact], ['recommandation', input.recommendation], ['responsable', input.owner], ['délai', input.dueDate],
  ]
  const missing = required.filter(([, value]) => !value.trim())
  if (missing.length) throw new Error(`Complétez les champs requis : ${missing.map(([label]) => label).join(', ')}.`)
  const mission = await db.missions.get(input.missionId)
  if (!mission) throw new Error('La mission du constat n’existe pas.')
  const cycle = await db.cycles.get(input.cycleId)
  if (!cycle || cycle.missionId !== mission.id) throw new Error('Choisissez un cycle de la mission active.')
  const timestamp = input.now ?? new Date().toISOString()
  const id = input.id ?? `finding-${globalThis.crypto.randomUUID()}`
  const finding: Finding = {
    id, missionId: mission.id, cycleId: cycle.id, title: input.title.trim(), facts: input.facts.trim(), criteria: input.criteria.trim(),
    cause: input.cause.trim(), indicativeImpact: input.indicativeImpact.trim(), recommendation: input.recommendation.trim(),
    owner: input.owner.trim(), dueDate: input.dueDate, sourceReferences: input.sourceReferences, status: 'open', createdAt: timestamp, updatedAt: timestamp,
  }
  const actionPlan: ActionPlan = {
    id: `action-plan-${id}`, missionId: mission.id, findingId: id, description: finding.recommendation, owner: finding.owner,
    dueDate: finding.dueDate, status: 'open', createdAt: timestamp, updatedAt: timestamp,
  }
  const event: AuditEvent = {
    id: `event-${id}-created`, missionId: mission.id, actorId: input.actorId, entityType: 'finding', entityId: id,
    action: 'finding-created', summary: `Constat de démonstration ouvert : ${finding.title}. Évaluation indicative, décision humaine requise.`, occurredAt: timestamp,
  }
  await db.transaction('rw', db.findings, db.actionPlans, db.auditEvents, async () => {
    await db.findings.add(finding)
    await db.actionPlans.add(actionPlan)
    await db.auditEvents.add(event)
  })
  return { finding, actionPlan }
}

export async function completeFindingAction(db: AuditMissionDatabase, actionPlanId: string, actorId: string, now = new Date().toISOString()) {
  const actionPlan = await db.actionPlans.get(actionPlanId)
  if (!actionPlan) throw new Error('Le plan de suivi est introuvable.')
  if (actionPlan.status === 'completed') throw new Error('Le plan de suivi est déjà marqué comme terminé.')
  const updated: ActionPlan = { ...actionPlan, status: 'completed', updatedAt: now }
  const event: AuditEvent = {
    id: `event-${actionPlan.id}-completed`, missionId: actionPlan.missionId, actorId, entityType: 'actionPlan', entityId: actionPlan.id,
    action: 'finding-action-completed', summary: `Suivi humain marqué comme réalisé pour le constat ${actionPlan.findingId}.`, occurredAt: now,
  }
  await db.transaction('rw', db.actionPlans, db.auditEvents, async () => {
    await db.actionPlans.put(updated)
    await db.auditEvents.add(event)
  })
  return updated
}

export async function resolveFinding(db: AuditMissionDatabase, findingId: string, actorId: string, now = new Date().toISOString()) {
  const finding = await db.findings.get(findingId)
  if (!finding) throw new Error('Le constat n’existe plus.')
  if (finding.status !== 'draft' && finding.status !== 'open') throw new Error('Ce constat n’est plus ouvert.')
  const plan = await db.actionPlans.where('findingId').equals(finding.id).first()
  if (!plan || plan.status !== 'completed') throw new Error('Terminez d’abord le suivi humain associé au constat.')
  const updated: Finding = { ...finding, status: 'resolved', updatedAt: now }
  const event: AuditEvent = {
    id: `event-${finding.id}-resolved`, missionId: finding.missionId, actorId, entityType: 'finding', entityId: finding.id,
    action: 'finding-resolved', summary: `Constat ${finding.title} marqué résolu après réalisation du suivi humain.`, occurredAt: now,
  }
  await db.transaction('rw', db.findings, db.auditEvents, async () => {
    await db.findings.put(updated)
    await db.auditEvents.add(event)
  })
  return updated
}

export function sourceAnchor(reference: Pick<GeneratedDocumentSourceReference, 'entityType' | 'entityId'>) {
  const slug = `${reference.entityType}-${reference.entityId}`.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `index-${slug}`
}

export function collectDossierSources(context: ClosingContext): GeneratedDocumentSourceReference[] {
  return [
    makeSource('mission', context.mission.id, `Mission — ${context.mission.name}`),
    ...context.cycles.map((item) => makeSource('cycle', item.id, `Cycle — ${item.name}`)),
    ...context.executions.map((item) => makeSource('procedureExecution', item.id, `Procédure — ${item.title}`)),
    ...context.samples.map((item) => makeSource('sampleItem', item.id, `Échantillon — ${item.reference} (ligne ${item.lineNumber})`)),
    ...context.evidence.map((item) => makeSource('evidenceReference', item.id, `Preuve — ${item.label} (${item.reference})`)),
    ...context.notes.map((item) => makeSource('reviewNote', item.id, `Note de revue — ${item.question}`)),
    ...context.findings.map((item) => makeSource('finding', item.id, `Constat — ${item.title}`)),
    ...context.actionPlans.map((item) => makeSource('actionPlan', item.id, `Suivi — ${item.description}`)),
    ...context.imports.map((item) => makeSource('importJob', item.id, `Import — ${item.fileName} (${item.sourceFingerprint})`)),
    ...context.exceptions.map((item) => makeSource('analyticsException', item.id, `Signal — ${item.ruleCode}, ligne CSV ${item.lineNumber}`)),
    ...context.ledgerEntries.map((item) => makeSource('ledgerEntry', item.id, `Ligne source ${item.lineNumber} — ${item.entryNumber} / compte ${item.account}`)),
  ]
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    planned: 'Planifié', 'in-progress': 'En cours', submitted: 'Soumis à la revue', reviewed: 'Revu',
    open: 'Ouvert', answered: 'Réponse reçue', resolved: 'Résolu', closed: 'Clos', draft: 'Brouillon',
    'to-investigate': 'À investiguer', explained: 'Expliqué — décision humaine', dismissed: 'Écarté — décision humaine',
    'not-started': 'À démarrer', completed: 'Terminé',
  }
  return labels[status] ?? status
}

export function buildDossierHtml(context: ClosingContext, exportedAt = new Date().toISOString()) {
  const metrics = calculateClosingMetrics(context)
  const blockers = getClosingBlockers(context)
  const sources = collectDossierSources(context)
  const sourceLookup = new Map(sources.map((reference) => [`${reference.entityType}:${reference.entityId}`, reference]))
  const link = (entityType: string, entityId: string) => {
    const source = sourceLookup.get(`${entityType}:${entityId}`)
    return source ? `<a href="#${sourceAnchor(source)}">${escapeHtml(source.label)}</a>` : '—'
  }
  const procedures = context.executions.map((execution) => {
    const evidence = context.evidence.filter(({ executionId }) => executionId === execution.id)
    const linkedSignals = context.exceptions.filter(({ linkedExecutionId }) => linkedExecutionId === execution.id)
    return `<tr><td>${link('procedureExecution', execution.id)}</td><td>${escapeHtml(statusText(execution.status))}</td><td>${evidence.length ? evidence.map((item) => link('evidenceReference', item.id)).join('<br>') : '—'}</td><td>${linkedSignals.length ? linkedSignals.map((item) => link('analyticsException', item.id)).join('<br>') : '—'}</td></tr>`
  }).join('') || '<tr><td colspan="4">Aucune procédure affectée.</td></tr>'
  const findings = context.findings.map((finding) => {
    const followup = context.actionPlans.find(({ findingId }) => findingId === finding.id)
    const relatedSources = finding.sourceReferences.map((reference) => link(reference.entityType, reference.entityId)).join('<br>') || '—'
    return `<tr><td>${link('finding', finding.id)}</td><td>${relatedSources}</td><td>${escapeHtml(finding.facts)}</td><td>${escapeHtml(finding.criteria)}</td><td>${escapeHtml(finding.cause)}</td><td>${escapeHtml(finding.indicativeImpact)}</td><td>${escapeHtml(finding.recommendation)}</td><td>${escapeHtml(finding.owner)}</td><td>${escapeHtml(finding.dueDate)}</td><td>${escapeHtml(statusText(finding.status))} · suivi : ${escapeHtml(followup ? statusText(followup.status) : 'non enregistré')}</td></tr>`
  }).join('') || '<tr><td colspan="10">Aucun constat saisi. L’absence de constat enregistré ne vaut pas conclusion d’absence d’anomalie.</td></tr>'
  const blockersHtml = blockers.length ? `<ul>${blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>` : '<p>Aucun blocage de workflow détecté dans les objets enregistrés. Une validation professionnelle humaine reste distincte de cet état de démonstration.</p>'
  const sourceRows = sources.map((reference) => `<tr id="${sourceAnchor(reference)}"><td>${escapeHtml(reference.entityType)}</td><td><code>${escapeHtml(reference.entityId)}</code></td><td>${escapeHtml(reference.label)}</td></tr>`).join('')
  const openNotes = context.notes.filter(({ status }) => status !== 'resolved')
  const openSignals = context.exceptions.filter(({ status }) => status === 'to-investigate')
  const notesHtml = openNotes.map((item) => `<li>${link('reviewNote', item.id)} — ${escapeHtml(statusText(item.status))}</li>`).join('') || '<li>Aucun point de revue non résolu enregistré.</li>'
  const signalsHtml = openSignals.map((item) => `<li>${link('analyticsException', item.id)} — Import : ${link('importJob', item.importJobId)} — Ligne source : ${link('ledgerEntry', item.sourceEntryId)} — ${escapeHtml(item.description)}</li>`).join('') || '<li>Aucun signal à investiguer enregistré.</li>'
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dossier simulé — ${escapeHtml(context.mission.name)}</title><style>
@page{size:A4;margin:17mm 15mm 20mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#293a30;line-height:1.55;margin:0}header{border-bottom:2px solid #284c38;padding-bottom:10px;margin-bottom:18px;display:flex;justify-content:space-between;gap:12px}h1{font-size:21pt;color:#193a31;margin:12px 0}h2{font-size:13pt;color:#315542;margin:22px 0 8px}p{margin:7px 0}.meta,.notice{padding:10px;background:#f6f8f6;border:1px solid #dfe7df;border-radius:5px}.notice{background:#fbf8ef;border-color:#e7ddc4;color:#715d31;font-weight:bold;text-align:center}.watermark{position:fixed;top:44%;left:8%;width:84%;text-align:center;transform:rotate(-30deg);font-size:30pt;font-weight:bold;color:rgba(70,105,75,.12);z-index:-1;pointer-events:none}table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:8pt;table-layout:auto}th,td{border:1px solid #dfe5df;padding:6px;vertical-align:top;overflow-wrap:anywhere}th{background:#f0f4f0;text-align:left}a{color:#315e40;text-decoration:underline}code{font-size:7pt;overflow-wrap:anywhere}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kpis>div{border:1px solid #dfe7df;padding:9px}.kpis strong{display:block;color:#193a31;font-size:14pt}.muted{color:#68756b;font-size:8pt}li{margin:4px 0}footer{margin-top:20px;border-top:1px solid #dfe5df;padding-top:8px;color:#6d796f;font-size:8pt}.keep{break-inside:avoid}@media print{a{color:inherit}}
</style></head><body><div class="watermark" aria-hidden="true">DÉMONSTRATION · DOSSIER SIMULÉ</div>
<header><strong>AuditMission360</strong><span>Dossier de clôture · v${CLOSING_DOSSIER_VERSION}</span></header>
<div class="notice">DONNÉES SYNTHÉTIQUES · DOCUMENT SIMULÉ · AUCUNE OPINION GÉNÉRÉE</div><h1>Dossier de clôture — ${escapeHtml(context.mission.name)}</h1>
<div class="meta"><p><strong>Entité fictive :</strong> ${escapeHtml(context.mission.entityName)}</p><p><strong>Mission :</strong> ${escapeHtml(context.mission.id)} · <strong>Période :</strong> ${escapeHtml(context.mission.periodStart)} — ${escapeHtml(context.mission.periodEnd)}</p><p><strong>Référentiel pédagogique :</strong> ${escapeHtml(context.mission.framework)} · ${escapeHtml(context.mission.frameworkVersion)}</p><p><strong>État de mission enregistré :</strong> ${escapeHtml(statusText(context.mission.status))} · <strong>Export :</strong> ${escapeHtml(exportedAt)}</p><p><strong>Profil d’export :</strong> ${escapeHtml(context.actorId)}</p></div>
<h2>Cockpit et définitions des indicateurs</h2><div class="kpis"><div><strong>${metrics.reviewedProcedures} / ${metrics.procedureDenominator}</strong>Procédures revues${metrics.reviewedRate === null ? ' — taux non calculé' : ` (${metrics.reviewedRate} %)`}</div><div><strong>${metrics.openReviewNotes}</strong>Notes de revue non résolues</div><div><strong>${metrics.signalsToInvestigate}</strong>Signaux « à investiguer »</div><div><strong>${metrics.openFindings}</strong>Constats brouillon / ouverts</div><div><strong>${metrics.openActionPlans}</strong>Plans de suivi non terminés</div><div><strong>${metrics.executionsWithEvidence} / ${metrics.procedureDenominator}</strong>Procédures ayant au moins une référence de preuve</div></div><p class="muted">Le taux de revue = procédures au statut « revu » / procédures affectées. Sans dénominateur, le taux n’est pas calculé. Le décompte de preuves indique seulement la présence d’une référence liée, pas sa qualité. Ces indicateurs mesurent l’état des données de démonstration, pas la qualité ou la suffisance de l’audit.</p>
<h2>État du workflow de clôture</h2>${blockersHtml}<h2>Procédures, preuves, exceptions et revue</h2><table><thead><tr><th>Procédure / référence</th><th>État</th><th>Preuves liées</th><th>Signaux liés</th></tr></thead><tbody>${procedures}</tbody></table>
<h2>Constats saisis et plans de suivi</h2><p>Les critères, impacts et recommandations ci-dessous sont saisis par une personne. L’impact reste indicatif, sans qualification automatique de fraude ou de significativité.</p><table><thead><tr><th>Constat</th><th>Sources liées</th><th>Faits</th><th>Critère / référence</th><th>Cause</th><th>Impact indicatif</th><th>Recommandation</th><th>Responsable</th><th>Délai</th><th>État / suivi</th></tr></thead><tbody>${findings}</tbody></table>
<h2>Points de revue ouverts</h2><ul>${notesHtml}</ul><h2>Signaux analytiques à examiner</h2><ul>${signalsHtml}</ul>
<h2>Index des pièces et des liens source</h2><table><thead><tr><th>Type</th><th>Identifiant stable</th><th>Libellé / provenance</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="3">Aucune pièce source enregistrée.</td></tr>'}</tbody></table>
<footer>AuditMission360 · démonstration fictive · dossier simulé v${CLOSING_DOSSIER_VERSION} · mission ${escapeHtml(context.mission.id)} · aucune signature, opinion ou transmission réelle.</footer></body></html>`
}

export function createDossierDocumentDraft(context: ClosingContext): DocumentDraft {
  const metrics = calculateClosingMetrics(context)
  const blockers = getClosingBlockers(context)
  const sources = collectDossierSources(context)
  return {
    fields: [
      { id: 'mission-id', label: 'Identifiant de mission', value: context.mission.id, required: true },
      { id: 'mission-status', label: 'État du workflow', value: context.mission.status, required: true },
      { id: 'version', label: 'Version du dossier', value: CLOSING_DOSSIER_VERSION, required: true },
    ],
    body: [
      `Dossier de clôture simulé — ${context.mission.name}`,
      `Procédures revues : ${metrics.reviewedProcedures}/${metrics.procedureDenominator}${metrics.reviewedRate === null ? ' (taux non calculé)' : ` (${metrics.reviewedRate} %)`}`,
      `Notes de revue ouvertes : ${metrics.openReviewNotes} ; signaux à investiguer : ${metrics.signalsToInvestigate}.`,
      `Constats ouverts : ${metrics.openFindings} ; plans de suivi ouverts : ${metrics.openActionPlans}.`,
      blockers.length ? `Blocages de workflow : ${blockers.join(' | ')}` : 'Aucun blocage de workflow enregistré ; aucune opinion ou conclusion réelle n’en découle.',
      'Données synthétiques — document simulé — les décisions de clôture et évaluations restent humaines. Aucun jugement automatique de fraude, significativité ou conformité.',
    ].join('\n\n'),
    sourceReferences: sources,
  }
}

export async function exportClosingDossier(db: AuditMissionDatabase, context: ClosingContext, now = new Date().toISOString()) {
  const draft = createDossierDocumentDraft(context)
  return exportDocument(db, {
    missionId: context.mission.id, templateId: CLOSING_MEMO_TEMPLATE_ID, templateVersion: CLOSING_DOSSIER_VERSION,
    title: `Dossier de clôture — ${context.mission.name}`, content: serializeDocumentDraft(draft), actorId: context.actorId,
    id: `document-closing-${globalThis.crypto.randomUUID()}`, createdAt: now,
  })
}
