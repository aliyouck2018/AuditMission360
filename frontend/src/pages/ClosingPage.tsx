import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Download, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { database } from '../data/database'
import { repositories } from '../data/repositories'
import type { ActionPlan, AnalyticsException, AuditEvent, Cycle, EvidenceReference, Finding, ImportJob, LedgerEntry, ProcedureExecution, ReviewNote, SampleItem } from '../domain/types'
import { useWorkspace } from '../workspace/WorkspaceContext'
import {
  calculateClosingMetrics, collectDossierSources, completeFindingAction, createFinding, exportClosingDossier,
  filterFindings, getClosingBlockers, resolveFinding, sourceAnchor, buildDossierHtml,
} from '../closing/closingService'
import type { ClosingContext } from '../closing/closingService'

interface ClosingData {
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
const emptyData: ClosingData = { cycles: [], executions: [], samples: [], evidence: [], notes: [], findings: [], actionPlans: [], imports: [], exceptions: [], ledgerEntries: [], events: [] }

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    planned: 'Planifié', 'in-progress': 'En cours', submitted: 'Soumis à la revue', reviewed: 'Revu',
    open: 'Ouvert', answered: 'Réponse reçue', resolved: 'Résolu', closed: 'Clos', draft: 'Brouillon',
    'to-investigate': 'À investiguer', explained: 'Expliqué — décision humaine', dismissed: 'Écarté — décision humaine',
    completed: 'Terminé',
  }
  return labels[status] ?? status
}

function findingSourcePath(entityType: string) {
  if (entityType === 'analyticsException' || entityType === 'importJob' || entityType === 'ledgerEntry') return '/imports'
  if (entityType === 'procedureExecution' || entityType === 'evidenceReference' || entityType === 'sampleItem' || entityType === 'reviewNote') return '/programme'
  return '/cloture'
}

function downloadHtml(fileName: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ClosingPage() {
  const { activeMission, role, saveMission } = useWorkspace()
  const [data, setData] = useState<ClosingData>(emptyData)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [findingFilter, setFindingFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async (initial = false) => {
    if (!activeMission) { setData(emptyData); setState('ready'); return }
    if (initial) setState('loading')
    try {
      const [cycles, executions, samples, evidence, notes, findings, actionPlans, imports, exceptions, ledgerEntries, events] = await Promise.all([
        repositories.cycles.listForMission(activeMission.id), repositories.procedureExecutions.listForMission(activeMission.id),
        repositories.sampleItems.listForMission(activeMission.id), repositories.evidenceReferences.listForMission(activeMission.id),
        repositories.reviewNotes.listForMission(activeMission.id), repositories.findings.listForMission(activeMission.id),
        repositories.actionPlans.listForMission(activeMission.id), repositories.importJobs.listForMission(activeMission.id),
        repositories.analyticsExceptions.listForMission(activeMission.id), repositories.ledgerEntries.listForMission(activeMission.id),
        repositories.auditEvents.listForMission(activeMission.id),
      ])
      setData({ cycles: cycles.sort((a, b) => a.position - b.position), executions, samples, evidence, notes, findings: findings.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), actionPlans, imports, exceptions, ledgerEntries, events: events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) })
      setState('ready')
    } catch { setState('error') }
  }, [activeMission?.id])

  useEffect(() => { void refresh(true) }, [refresh])

  const actorId = useMemo(() => role, [role])
  const context: ClosingContext | null = activeMission ? { mission: activeMission, actorId, ...data } : null
  const metrics = context ? calculateClosingMetrics(context) : null
  const blockers = context ? getClosingBlockers(context) : []
  const visibleFindings = filterFindings(data.findings, findingFilter)
  const sourceOptions = context ? collectDossierSources(context).filter(({ entityType }) => ['analyticsException', 'ledgerEntry', 'importJob', 'procedureExecution', 'evidenceReference', 'sampleItem', 'reviewNote'].includes(entityType)) : []

  async function runAction(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('')
    try { await action(); await refresh(); setMessage(success) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Cette action n’a pas pu être enregistrée.') }
    finally { setBusy(false) }
  }

  async function submitFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeMission) return
    const form = event.currentTarget
    const values = new FormData(form)
    const cycleId = String(values.get('cycleId') ?? '')
    const selectedSources = values.getAll('sourceReferences').map(String).map((value) => {
      const colon = value.indexOf(':')
      const entityType = value.slice(0, colon)
      const entityId = value.slice(colon + 1)
      return sourceOptions.find((reference) => reference.entityType === entityType && reference.entityId === entityId)
    }).filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
    await runAction(async () => {
      await createFinding(database, {
        missionId: activeMission.id, cycleId, title: String(values.get('title') ?? ''), facts: String(values.get('facts') ?? ''),
        criteria: String(values.get('criteria') ?? ''), cause: String(values.get('cause') ?? ''),
        indicativeImpact: String(values.get('indicativeImpact') ?? ''), recommendation: String(values.get('recommendation') ?? ''),
        owner: String(values.get('owner') ?? ''), dueDate: String(values.get('dueDate') ?? ''), sourceReferences: selectedSources, actorId,
      })
      form.reset()
    }, 'Constat et plan de suivi créés, attribués et journalisés. Leur état reste une saisie humaine.')
  }

  async function exportDossier(kind: 'html' | 'pdf') {
    if (!context) return
    await runAction(async () => {
      const saved = await exportClosingDossier(database, context)
      if (kind === 'html') downloadHtml(`dossier-cloture-${activeMission!.id}.html`, buildDossierHtml(context, saved.createdAt))
      else window.print()
    }, kind === 'html' ? 'Dossier HTML exporté et index source enregistré dans le journal local.' : 'Dossier de clôture enregistré ; choisissez « Enregistrer au format PDF » dans la boîte d’impression.')
  }

  async function finalizeDemo() {
    if (!activeMission || !context) return
    if (blockers.length) { setError('La finalisation de démonstration reste bloquée tant que des états ouverts sont enregistrés.'); return }
    await runAction(async () => {
      const updated = { ...activeMission, status: 'completed' as const, updatedAt: new Date().toISOString() }
      await saveMission(updated)
      await database.auditEvents.add({ id: `event-mission-finalized-${Date.now()}`, missionId: activeMission.id, actorId, entityType: 'mission', entityId: activeMission.id, action: 'demo-mission-finalized', summary: 'Workflow de démonstration marqué terminé après contrôle des états ouverts. Aucune opinion générée.', occurredAt: updated.updatedAt })
    }, 'Workflow de démonstration finalisé. Cet état ne représente ni une clôture professionnelle, ni une opinion d’audit.')
  }

  if (!activeMission) return <div className="state-card"><h1>Aucune mission ouverte</h1><Link className="text-link" to="/mission">Configurer une mission</Link></div>
  if (state === 'loading') return <p className="state-card" role="status">Chargement du dossier de clôture…</p>
  if (state === 'error' || !context || !metrics) return <p className="state-card state-error" role="alert">Les données du dossier de clôture ne sont pas accessibles.</p>
  const filteredFindings = visibleFindings

  return <section className="closing-page" aria-labelledby="closing-title">
    <div className="page-heading"><div><span className="eyebrow">Constats · cockpit · index du dossier</span><h1 id="closing-title">Clôture de démonstration</h1><p>Synthèse du workflow et des éléments enregistrés pour {activeMission.name}.</p></div></div>
    <p className="form-disclosure">Les indicateurs décrivent uniquement les enregistrements présents. Ils ne mesurent pas la qualité ni la suffisance de l’audit. Aucun constat, indicateur ou état de clôture ne constitue une opinion, une conformité réelle, une fraude ou une anomalie significative.</p>
    {message && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />{message}</p>}{error && <p className="form-alert" role="alert">{error}</p>}

    <section aria-labelledby="closing-kpi-title"><div className="section-heading"><div><span className="eyebrow">Indicateurs avec dénominateur visible</span><h2 id="closing-kpi-title">Cockpit de mission</h2></div><span className="status-chip">Mission : {statusLabel(activeMission.status)}</span></div>
      <div className="closing-kpi-grid">
        <article className="closing-kpi card"><span>Procédures revues</span><strong>{metrics.reviewedProcedures} / {metrics.procedureDenominator}</strong><small>{metrics.reviewedRate === null ? 'Taux non calculé — aucune procédure affectée' : `${metrics.reviewedRate} % des procédures affectées`}</small></article>
        <article className="closing-kpi card"><span>Preuves référencées</span><strong>{metrics.executionsWithEvidence} / {metrics.procedureDenominator}</strong><small>Procédures avec au moins une référence, pas une mesure de qualité</small></article>
        <article className="closing-kpi card"><span>Notes de revue ouvertes</span><strong>{metrics.openReviewNotes}</strong><small>Statut différent de « résolu »</small></article>
        <article className="closing-kpi card"><span>Signaux à investiguer</span><strong>{metrics.signalsToInvestigate}</strong><small>État de signal non tranché par le logiciel</small></article>
        <article className="closing-kpi card"><span>Constats ouverts</span><strong>{metrics.openFindings}</strong><small>Brouillon ou ouvert</small></article>
        <article className="closing-kpi card"><span>Plans de suivi ouverts</span><strong>{metrics.openActionPlans}</strong><small>État différent de « terminé »</small></article>
      </div>
      <details className="event-log closing-definitions"><summary>Définition des KPI et limites</summary><p>Procédures revues : nombre de procédures au statut « revu » divisé par toutes les procédures affectées. Preuves référencées : nombre de procédures ayant au moins une référence de preuve divisé par le même dénominateur ; présence ne signifie ni pertinence ni suffisance. Notes, signaux, constats et plans ouverts : décomptes de leurs états persistés. Si aucune procédure n’est affectée, le taux de revue n’est pas calculé. Ces KPI mesurent une complétude de workflow uniquement.</p></details>
    </section>

    <section className="closing-workflow" aria-labelledby="workflow-status-title"><div className="section-heading"><div><span className="eyebrow">Workflow de démonstration</span><h2 id="workflow-status-title">États empêchant la finalisation</h2></div><span className={`status-chip ${blockers.length ? 'status-to-investigate' : 'status-explained'}`}>{blockers.length ? `${blockers.length} blocage(s)` : 'Aucun état ouvert détecté'}</span></div>
      <div className="closing-blocker-card card">{blockers.length ? <><p>Finalisation désactivée jusqu’au traitement humain des éléments suivants :</p><ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></> : <p>Les états de workflow enregistrés ne signalent plus de blocage. Cette vérification de démonstration ne remplace aucune revue professionnelle.</p>}
        <button className="button button-primary" disabled={busy || blockers.length > 0 || activeMission.status === 'completed'} onClick={() => void finalizeDemo()} type="button">{activeMission.status === 'completed' ? 'Démonstration marquée terminée' : 'Finaliser le workflow de démonstration'}</button>
      </div>
    </section>

    <section aria-labelledby="closing-procedures-title"><div className="section-heading"><div><span className="eyebrow">Procédures · preuves · exceptions · revue</span><h2 id="closing-procedures-title">État des travaux</h2></div><span className="count-pill">{data.executions.length} procédure(s)</span></div>
      <div className="closing-table-wrap"><table className="closing-table"><thead><tr><th>Procédure</th><th>Cycle</th><th>Statut</th><th>Preuves</th><th>Résultats d’échantillon en exception</th><th>Notes de revue ouvertes</th><th>Signaux liés</th></tr></thead><tbody>{data.executions.map((execution) => {
        const notes = data.notes.filter((note) => note.executionId === execution.id && note.status !== 'resolved')
        const samples = data.samples.filter((sample) => sample.executionId === execution.id && sample.result === 'exception')
        const linkedSignals = data.exceptions.filter((exception) => exception.linkedExecutionId === execution.id)
        return <tr key={execution.id}><td><Link to="/programme">{execution.title}</Link><small>{execution.id}</small></td><td>{data.cycles.find((cycle) => cycle.id === execution.cycleId)?.name ?? 'Cycle archivé'}</td><td><span className={`status-chip status-${execution.status}`}>{statusLabel(execution.status)}</span></td><td>{data.evidence.filter((item) => item.executionId === execution.id).map((item) => <span className="closing-ref" key={item.id}><Link to="/programme">{item.label} · {item.reference}</Link></span>)}</td><td>{samples.length ? samples.map((item) => <span className="closing-ref" key={item.id}><Link to="/programme">{item.reference} · ligne {item.lineNumber}</Link></span>) : '—'}</td><td>{notes.length ? notes.map((note) => <span className="closing-ref" key={note.id}><Link to="/programme">{note.question} · {statusLabel(note.status)}</Link></span>) : '—'}</td><td>{linkedSignals.length ? linkedSignals.map((item) => <span className="closing-ref" key={item.id}><Link to="/imports">{item.ruleCode} · CSV {item.lineNumber} · {statusLabel(item.status)}</Link></span>) : '—'}</td></tr>
      })}{!data.executions.length && <tr><td colSpan={7}>Aucune procédure affectée. Cette absence bloque la finalisation de démonstration.</td></tr>}</tbody></table></div>
    </section>

    <section aria-labelledby="finding-register-title"><div className="section-heading"><div><span className="eyebrow">Registre · évaluation humaine</span><h2 id="finding-register-title">Constats et plans de suivi</h2></div><label className="form-field finding-filter">Filtrer les constats<select aria-label="Filtrer les constats" onChange={(event) => setFindingFilter(event.target.value as typeof findingFilter)} value={findingFilter}><option value="all">Tous</option><option value="open">Ouverts</option><option value="resolved">Résolus / clos</option></select></label></div>
      <form className="finding-form card" onSubmit={(event) => void submitFinding(event)}><div className="form-section-heading"><div><span className="eyebrow">Saisie par une personne</span><h3>Documenter un constat</h3></div><span className="fictitious-chip">Impact indicatif</span></div>
        <div className="form-grid"><label className="form-field">Cycle *<select name="cycleId" required defaultValue={data.cycles[0]?.id ?? ''}>{data.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label className="form-field">Titre du constat *<input maxLength={180} name="title" required /></label><label className="form-field">Responsable fictif *<input maxLength={120} name="owner" required /></label><label className="form-field">Délai de suivi *<input name="dueDate" required type="date" /></label>
          <label className="form-field finding-wide">Faits observés *<textarea maxLength={1500} name="facts" required /></label><label className="form-field finding-wide">Critère et référence à confirmer *<textarea maxLength={1000} name="criteria" required /></label><label className="form-field">Cause documentée *<textarea maxLength={800} name="cause" required /></label><label className="form-field">Risque / impact indicatif *<textarea maxLength={800} name="indicativeImpact" required /></label><label className="form-field finding-wide">Recommandation *<textarea maxLength={1000} name="recommendation" required /></label>
          <fieldset className="finding-source-picker"><legend>Sources associées (facultatif)</legend><select aria-label="Sources associées au constat" multiple name="sourceReferences" size={Math.min(5, Math.max(3, sourceOptions.length))}>{sourceOptions.map((reference) => <option key={`${reference.entityType}:${reference.entityId}`} value={`${reference.entityType}:${reference.entityId}`}>{reference.entityType} · {reference.label}</option>)}</select><small>Utilisez Ctrl/Cmd pour associer plusieurs lignes, preuves, procédures ou signaux conservés.</small></fieldset>
        </div><p className="catalog-muted">L’enregistrement crée un constat ouvert et un plan de suivi ouvert. L’impact reste indicatif ; la qualification, le critère et la conclusion ne sont jamais déduits automatiquement.</p><div className="form-actions"><button className="button button-primary" disabled={busy || !data.cycles.length} type="submit">Enregistrer le constat et son suivi</button></div>
      </form>
      <div className="finding-list">{filteredFindings.map((finding) => {
        const plan = data.actionPlans.find((item) => item.findingId === finding.id)
        const cycle = data.cycles.find((item) => item.id === finding.cycleId)
        return <article className="finding-card card" key={finding.id}><div className="work-card-heading"><div><span className="eyebrow">{cycle?.name ?? 'Cycle archivé'} · Responsable {finding.owner} · Délai {finding.dueDate}</span><h3>{finding.title}</h3></div><span className={`status-chip status-${finding.status}`}>{statusLabel(finding.status)}</span></div>
          <div className="finding-facts-grid"><div><strong>Faits</strong><p>{finding.facts}</p></div><div><strong>Critère / référence</strong><p>{finding.criteria}</p></div><div><strong>Cause</strong><p>{finding.cause}</p></div><div><strong>Impact indicatif</strong><p>{finding.indicativeImpact}</p></div><div><strong>Recommandation</strong><p>{finding.recommendation}</p></div><div><strong>Plan de suivi</strong><p>{plan?.description ?? 'Aucun plan associé'} · {plan ? statusLabel(plan.status) : '—'} · {plan?.owner ?? finding.owner} · {plan?.dueDate ?? finding.dueDate}</p></div></div>
          {finding.sourceReferences.length > 0 && <div className="finding-source-links"><strong>Sources :</strong>{finding.sourceReferences.map((reference) => <Link key={`${reference.entityType}-${reference.entityId}`} to={findingSourcePath(reference.entityType)}>{reference.label}</Link>)}</div>}
          <div className="catalog-actions">{plan && plan.status !== 'completed' && <button className="button button-secondary" disabled={busy} onClick={() => void runAction(() => completeFindingAction(database, plan.id, actorId), 'Plan de suivi marqué réalisé par une action humaine.')} type="button">Marquer le suivi réalisé</button>}{(finding.status === 'open' || finding.status === 'draft') && <button className="button button-secondary" disabled={busy || !plan || plan.status !== 'completed'} onClick={() => void runAction(() => resolveFinding(database, finding.id, actorId), 'Constat marqué résolu après réalisation du suivi humain.')} type="button">Marquer le constat résolu</button>}{finding.status === 'open' && plan?.status !== 'completed' && <span className="catalog-muted">Pour résoudre : consigner d’abord le suivi comme réalisé.</span>}</div>
        </article>
      })}{!filteredFindings.length && <p className="state-card">Aucun constat ne correspond à ce filtre.</p>}</div>
    </section>

    <section className="closing-export-section" aria-labelledby="closing-export-title"><div className="section-heading"><div><span className="eyebrow">Export versionné · index des pièces</span><h2 id="closing-export-title">Dossier de clôture simulé</h2></div><span className="count-pill">v1.0.0 · {collectDossierSources(context).length} référence(s)</span></div>
      <p className="form-disclosure">Le dossier reprend les statuts, versions, indicateurs et liens présents au moment de l’export. La prévisualisation imprimable et le fichier HTML comportent un filigrane visible. L’export peut montrer des blocages sans les transformer en opinion.</p>
      <div className="closing-export-actions"><button className="button button-secondary" disabled={busy} onClick={() => void exportDossier('html')} type="button"><Download aria-hidden="true" size={15} /> Exporter le dossier HTML et son index</button><button className="button button-primary" disabled={busy} onClick={() => void exportDossier('pdf')} type="button"><Printer aria-hidden="true" size={15} /> Enregistrer le dossier en PDF</button></div>
      <details className="event-log"><summary>Journal des événements du dossier ({data.events.length})</summary><ul>{data.events.map((item) => <li key={item.id}><time>{new Date(item.occurredAt).toLocaleString('fr-FR')}</time> · {item.action} · {item.summary}</li>)}</ul></details>
      <article className="closing-print-preview" id="closing-print-preview"><header className="closing-paper-header"><strong>AuditMission360</strong><span>Dossier simulé · version 1.0.0</span></header><div className="closing-watermark" aria-hidden="true">DÉMONSTRATION · DONNÉES SYNTHÉTIQUES</div><div className="closing-demo-ribbon">DONNÉES SYNTHÉTIQUES · DOSSIER SIMULÉ · AUCUNE OPINION GÉNÉRÉE</div><h2>Dossier de clôture — {activeMission.name}</h2><p>Mission <code>{activeMission.id}</code> · {activeMission.entityName} · {activeMission.periodStart} — {activeMission.periodEnd}</p><p>État enregistré : {statusLabel(activeMission.status)} · Version dossier 1.0.0 · Référentiel pédagogique : {activeMission.framework} {activeMission.frameworkVersion}</p>
        <h3>Cockpit</h3><p>Procédures revues : {metrics.reviewedProcedures}/{metrics.procedureDenominator} {metrics.reviewedRate === null ? '(taux non calculé)' : `(${metrics.reviewedRate} %)`} · Preuves liées : {metrics.executionsWithEvidence}/{metrics.procedureDenominator} · Notes ouvertes : {metrics.openReviewNotes} · Signaux à investiguer : {metrics.signalsToInvestigate} · Constats ouverts : {metrics.openFindings} · Plans de suivi ouverts : {metrics.openActionPlans}</p><p className="catalog-muted">Le taux de revue utilise toutes les procédures affectées comme dénominateur. La présence d’une référence de preuve n’en mesure pas la qualité. Aucun indicateur ne représente une conclusion d’audit.</p>
        <h3>Blocages du workflow</h3>{blockers.length ? <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>Aucun état ouvert détecté; la revue et le jugement humains restent requis.</p>}
        <h3>Procédures, preuves et exceptions</h3><div className="closing-table-wrap"><table className="closing-table"><thead><tr><th>Procédure</th><th>Statut</th><th>Preuves</th><th>Signaux liés</th></tr></thead><tbody>{data.executions.map((execution) => <tr key={execution.id}><td><a href={`#${sourceAnchor({ entityType: 'procedureExecution', entityId: execution.id })}`}>{execution.title}</a> · {data.cycles.find(({ id }) => id === execution.cycleId)?.name}</td><td>{statusLabel(execution.status)}</td><td>{data.evidence.filter(({ executionId }) => executionId === execution.id).map((item) => <a href={`#${sourceAnchor({ entityType: 'evidenceReference', entityId: item.id })}`} key={item.id}>{item.label} · {item.reference}</a>)}</td><td>{data.exceptions.filter(({ linkedExecutionId }) => linkedExecutionId === execution.id).map((item) => <a href={`#${sourceAnchor({ entityType: 'analyticsException', entityId: item.id })}`} key={item.id}>{item.ruleCode} · ligne {item.lineNumber}</a>)}</td></tr>)}</tbody></table></div>
        <h3>Constats saisis</h3>{data.findings.map((finding) => <section className="closing-finding-print" key={finding.id}><h4><a href={`#${sourceAnchor({ entityType: 'finding', entityId: finding.id })}`}>{finding.title}</a> · {statusLabel(finding.status)}</h4><p><strong>Faits :</strong> {finding.facts}</p><p><strong>Critère :</strong> {finding.criteria}</p><p><strong>Cause :</strong> {finding.cause}</p><p><strong>Impact indicatif :</strong> {finding.indicativeImpact}</p><p><strong>Recommandation :</strong> {finding.recommendation} · Responsable : {finding.owner} · Délai : {finding.dueDate}</p></section>)}{!data.findings.length && <p>Aucun constat saisi. L’absence de constat ne prouve pas l’absence d’anomalie.</p>}
        <h3>Index des pièces</h3><ol className="closing-source-index">{collectDossierSources(context).map((reference) => <li id={sourceAnchor(reference)} key={`${reference.entityType}-${reference.entityId}`}><strong>{reference.entityType}</strong> · <code>{reference.entityId}</code> — {reference.label}</li>)}</ol>
        <footer>AuditMission360 · démonstration fictive · document simulé v1.0.0 · aucun envoi, signature ou opinion.</footer>
      </article>
    </section>
  </section>
}
