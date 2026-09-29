import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, ClipboardCheck, FilePlus2, Play, Send, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { database } from '../data/database'
import { repositories } from '../data/repositories'
import type { Assertion, AuditEvent, Cycle, DemoRole, EvidenceReference, Population, ProcedureExecution, ProcedureTemplate, ReviewNote, Risk, RiskAssertionLink, SampleItem, TeamMember } from '../domain/types'
import { suggestProcedureTemplates } from '../catalog/catalogService'
import {
  addEvidenceReference,
  answerReviewNote,
  assignProcedure,
  createReviewNote,
  recordSampleOutcome,
  resolveReviewNote,
  transitionExecution,
  updateExecutionResult,
} from '../program/workProgramService'
import { useWorkspace } from '../workspace/WorkspaceContext'

interface ProgramData {
  cycles: Cycle[]
  risks: Risk[]
  assertions: Assertion[]
  links: RiskAssertionLink[]
  templates: ProcedureTemplate[]
  executions: ProcedureExecution[]
  populations: Population[]
  samples: SampleItem[]
  evidence: EvidenceReference[]
  notes: ReviewNote[]
  members: TeamMember[]
  events: AuditEvent[]
}

const emptyData: ProgramData = { cycles: [], risks: [], assertions: [], links: [], templates: [], executions: [], populations: [], samples: [], evidence: [], notes: [], members: [], events: [] }
const roleLabels: Record<DemoRole, string> = {
  'engagement-manager': 'Responsable de mission', preparer: 'Préparateur', reviewer: 'Réviseur',
  'data-specialist': 'Expert données', reader: 'Lecteur / qualité',
}

function statusLabel(status: ProcedureExecution['status']) {
  return status === 'planned' ? 'Planifié' : status === 'in-progress' ? 'En cours' : status === 'submitted' ? 'Soumis à la revue' : 'Revu'
}

function useProgramData() {
  const { activeMission } = useWorkspace()
  const [data, setData] = useState<ProgramData>(emptyData)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const refresh = useCallback(async (initial = false) => {
    if (!activeMission) {
      setData(emptyData)
      setState('ready')
      return
    }
    if (initial) setState('loading')
    try {
      const [cycles, risks, assertions, links, templates, executions, populations, samples, evidence, notes, members, events] = await Promise.all([
        repositories.cycles.listForMission(activeMission.id),
        repositories.risks.listForMission(activeMission.id),
        repositories.assertions.listForMission(activeMission.id),
        repositories.riskAssertionLinks.listForMission(activeMission.id),
        repositories.procedureTemplates.listForMission(activeMission.id),
        repositories.procedureExecutions.listForMission(activeMission.id),
        repositories.populations.listForMission(activeMission.id),
        repositories.sampleItems.listForMission(activeMission.id),
        repositories.evidenceReferences.listForMission(activeMission.id),
        repositories.reviewNotes.listForMission(activeMission.id),
        repositories.teamMembers.listForMission(activeMission.id),
        repositories.auditEvents.listForMission(activeMission.id),
      ])
      setData({ cycles, risks, assertions, links, templates, executions, populations, samples, evidence, notes, members, events: events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)) })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [activeMission?.id])

  useEffect(() => { void refresh(true) }, [refresh])
  return { activeMission, data, state, refresh }
}

export function WorkProgramPage() {
  const { activeMission, data, state, refresh } = useProgramData()
  const { role } = useWorkspace()
  const [cycleId, setCycleId] = useState('')
  const [riskId, setRiskId] = useState('')
  const [assertionId, setAssertionId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sampleDrafts, setSampleDrafts] = useState<Record<string, { result: string; notes: string }>>({})
  const member = data.members.find((item) => item.role === role)
  const manager = role === 'engagement-manager'
  const preparer = role === 'preparer'
  const reviewer = role === 'reviewer'
  const cycles = [...data.cycles].sort((left, right) => left.position - right.position)
  const selectedCycle = cycles.find((item) => item.id === cycleId) ?? cycles[0]
  const eligibleRisks = data.risks.filter((risk) => risk.cycleId === selectedCycle?.id && ['confirmed', 'adapted'].includes(risk.status))
  const selectedRisk = eligibleRisks.find((item) => item.id === riskId) ?? eligibleRisks[0]
  const linkedAssertions = selectedRisk ? data.links.filter((link) => link.riskId === selectedRisk.id).map((link) => ({ link, assertion: data.assertions.find((item) => item.id === link.assertionId) })).filter((item): item is { link: RiskAssertionLink; assertion: Assertion } => Boolean(item.assertion)) : []
  const selectedAssertion = linkedAssertions.find(({ assertion }) => assertion.id === assertionId)?.assertion ?? linkedAssertions[0]?.assertion
  const suitableTemplates = selectedRisk && selectedAssertion
    ? suggestProcedureTemplates(selectedRisk, selectedAssertion.code, data.templates)
    : []
  const selectedTemplate = suitableTemplates.find((item) => item.id === templateId) ?? suitableTemplates[0]
  const preparers = data.members.filter((item) => item.role === 'preparer' && item.isActive)
  const reviewers = data.members.filter((item) => item.role === 'reviewer' && item.isActive)

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await refresh()
      setMessage(successMessage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cette action n’a pas pu être enregistrée.')
    } finally {
      setBusy(false)
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeMission || !selectedCycle || !selectedRisk || !selectedAssertion || !selectedTemplate) return
    const form = new FormData(event.currentTarget)
    await runAction(() => assignProcedure(database, {
      missionId: activeMission.id,
      procedureTemplateId: selectedTemplate.id,
      riskId: selectedRisk.id,
      assertionId: selectedAssertion.id,
      preparerId: String(form.get('preparerId')),
      reviewerId: String(form.get('reviewerId')),
      dueDate: String(form.get('dueDate') ?? '') || null,
      populationName: String(form.get('populationName') ?? ''),
      populationDescription: String(form.get('populationDescription') ?? ''),
      populationSize: Number(form.get('populationSize')),
      sampleSize: Number(form.get('sampleSize')),
      assignedById: member?.id ?? '',
    }), 'Travail affecté avec un échantillon synthétique reproductible.')
  }

  if (!activeMission) return <div className="state-card"><h1>Aucune mission ouverte</h1><Link className="text-link" to="/mission">Configurer une mission <ArrowRight aria-hidden="true" size={15} /></Link></div>
  if (state === 'loading') return <p className="state-card" role="status">Chargement du programme de mission…</p>
  if (state === 'error') return <p className="state-card state-error" role="alert">Les travaux de la mission ne sont pas accessibles pour le moment.</p>

  return (
    <section className="program-page" aria-labelledby="program-title">
      <div className="page-heading">
        <div><span className="eyebrow">Programme de travail · Mission fictive</span><h1 id="program-title">Travaux, preuves & revue</h1><p>Profil de démonstration actif : {roleLabels[role]}. Les procédures et échantillons sont des modèles synthétiques à adapter.</p></div>
        <Link className="button button-secondary" to="/catalogue"><ClipboardCheck aria-hidden="true" size={16} /> Catalogue & risques</Link>
      </div>
      <p className="form-disclosure">Les résultats et écarts sont consignés pour examen par une personne ; le logiciel ne qualifie automatiquement ni fraude, ni opinion. Les rôles affichés simulent un parcours et ne constituent pas un contrôle d’accès réel.</p>
      {message && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />{message}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}

      <div className="section-heading"><div><span className="eyebrow">Planification humaine</span><h2>Affecter une procédure</h2></div><span className="count-pill">{data.executions.length} travail(x)</span></div>
      {!eligibleRisks.length && <div className="state-card"><h2>Aucun risque confirmé pour ce cycle</h2><p>Examinez d’abord les candidats du catalogue et consignez la décision humaine justifiée.</p><Link className="text-link" to="/catalogue">Ouvrir le catalogue <ArrowRight aria-hidden="true" size={15} /></Link></div>}
      {manager && eligibleRisks.length > 0 && <form className="assignment-form card" onSubmit={(event) => void createAssignment(event)}>
        <div className="form-grid">
          <label className="form-field">Cycle *<select aria-label="Cycle du travail" onChange={(event) => { setCycleId(event.target.value); setRiskId(''); setAssertionId(''); setTemplateId('') }} value={selectedCycle?.id ?? ''}>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label>
          <label className="form-field">Risque retenu par une personne *<select aria-label="Risque retenu" onChange={(event) => { setRiskId(event.target.value); setAssertionId(''); setTemplateId('') }} value={selectedRisk?.id ?? ''}>{eligibleRisks.map((risk) => <option key={risk.id} value={risk.id}>{risk.title} · {risk.status === 'adapted' ? 'adapté' : 'confirmé'}</option>)}</select></label>
          <label className="form-field">Assertion liée *<select aria-label="Assertion du travail" onChange={(event) => { setAssertionId(event.target.value); setTemplateId('') }} value={selectedAssertion?.id ?? ''}>{linkedAssertions.map(({ assertion }) => <option key={assertion.id} value={assertion.id}>{assertion.name}</option>)}</select></label>
          <label className="form-field">Procédure type liée *<select aria-label="Procédure type" onChange={(event) => setTemplateId(event.target.value)} value={selectedTemplate?.id ?? ''}>{suitableTemplates.map((template) => <option key={template.id} value={template.id}>{template.title} · v{template.version}</option>)}</select></label>
          <label className="form-field">Préparateur fictif *<select name="preparerId" required defaultValue={preparers[0]?.id ?? ''}>{preparers.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
          <label className="form-field">Réviseur fictif *<select name="reviewerId" required defaultValue={reviewers[0]?.id ?? ''}>{reviewers.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
          <label className="form-field">Échéance<input aria-label="Échéance" name="dueDate" type="date" /></label>
          <label className="form-field">Nom de la population synthétique *<input aria-label="Nom de la population" defaultValue="Population fictive de démonstration" maxLength={120} name="populationName" required /></label>
          <label className="form-field">Description de la population<input aria-label="Description de la population" defaultValue={selectedTemplate?.populationDescription ?? ''} maxLength={300} name="populationDescription" /></label>
          <label className="form-field">Taille de la population *<input aria-label="Taille de la population" defaultValue={30} max={100000} min={1} name="populationSize" required type="number" /></label>
          <label className="form-field">Taille de l’échantillon *<input aria-label="Taille de l’échantillon" defaultValue={5} max={100} min={1} name="sampleSize" required type="number" /></label>
        </div>
        {selectedTemplate && <p className="form-disclosure">Objectif : {selectedTemplate.objective} · Étapes du modèle adaptables : {selectedTemplate.steps.length} · La sélection de numéros de ligne est déterministe pour ce contexte.</p>}
        <div className="form-actions"><button className="button button-primary" disabled={busy || !selectedRisk || !selectedAssertion || !selectedTemplate || !preparers.length || !reviewers.length} type="submit"><FilePlus2 aria-hidden="true" size={16} /> Affecter le travail</button></div>
      </form>}
      {!manager && eligibleRisks.length > 0 && <p className="state-card">L’affectation des procédures est réservée au Responsable de mission fictif.</p>}

      <div className="section-heading"><div><span className="eyebrow">Exécution de la mission</span><h2>Programme et feuilles de travail</h2></div></div>
      {!data.executions.length && <p className="state-card">Aucun travail affecté pour cette mission.</p>}
      <div className="work-list">
        {data.executions.map((execution) => {
          const risk = data.risks.find((item) => item.id === execution.riskId)
          const population = data.populations.find((item) => item.executionId === execution.id)
          const samples = data.samples.filter((item) => item.executionId === execution.id).sort((left, right) => left.lineNumber - right.lineNumber)
          const evidence = data.evidence.filter((item) => item.executionId === execution.id)
          const notes = data.notes.filter((item) => item.executionId === execution.id).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
          const assignedPreparer = data.members.find((item) => item.id === execution.assignedToId)
          const assignedReviewer = data.members.find((item) => item.id === execution.reviewerId)
          const workEvents = data.events.filter((item) => item.missionId === execution.missionId && (item.entityId === execution.id || notes.some((note) => note.id === item.entityId) || evidence.some((reference) => reference.id === item.entityId) || samples.some((sample) => sample.id === item.entityId)))
          const myExecution = Boolean(member && (member.id === execution.assignedToId || member.id === execution.reviewerId))
          return <article className="work-card card" key={execution.id}>
            <div className="work-card-heading"><div><span className="eyebrow">{data.cycles.find((item) => item.id === execution.cycleId)?.name} · Catalogue {execution.procedureTemplateVersion}</span><h3>{execution.title}</h3></div><span className={`status-chip status-${execution.status}`}>{statusLabel(execution.status)}</span></div>
            <p className="work-objective">{execution.objective}</p>
            <div className="work-assignment-meta"><span>Risque : <strong>{risk?.title ?? 'Risque archivé'}</strong></span><span>Assertions : <strong>{execution.assertionIds.map((id) => data.assertions.find((item) => item.id === id)?.name ?? 'Assertion archivée').join(', ')}</strong></span><span>Préparateur : <strong>{assignedPreparer?.displayName}</strong></span><span>Réviseur : <strong>{assignedReviewer?.displayName}</strong></span><span>Échéance : <strong>{execution.dueDate || 'Non définie'}</strong></span></div>
            <div className="work-detail-grid"><section><h4>Étapes adaptables</h4><ol>{execution.steps.map((step, index) => <li key={`${execution.id}-step-${index}`}>{step}</li>)}</ol><h4>Éléments attendus du modèle</h4><ul>{execution.expectedEvidence.map((item) => <li key={item}>{item}</li>)}</ul><h4>Échantillon synthétique déterministe</h4><p>{population?.name} · {samples.length} / {population?.itemCount} éléments retenus</p><p className="catalog-muted">{execution.sampleMethod}</p></section>
              <section><h4>Résultat du préparateur</h4><p>{execution.result || 'Résultat à consigner pendant l’exécution.'}</p><h4>Références des preuves fictives ({evidence.length})</h4>{evidence.length ? <ul>{evidence.map((item) => <li key={item.id}><strong>{item.label}</strong> · {item.reference}<small>{item.notes}</small></li>)}</ul> : <p className="catalog-muted">Aucune référence liée pour le moment.</p>}{execution.reviewConclusion && <><h4>Conclusion de revue</h4><p>{execution.reviewConclusion}</p></>}</section></div>
            <div className="sample-table-wrap"><h4>Résultats par élément de l’échantillon</h4><table className="sample-table"><thead><tr><th>Référence fictive</th><th>Description</th><th>Montant de démonstration</th><th>Résultat / observation</th></tr></thead><tbody>{samples.map((sample) => {
              const draft = sampleDrafts[sample.id] ?? { result: sample.result, notes: sample.notes }
              return <tr key={sample.id}><td>{sample.reference}</td><td>{sample.description}</td><td>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: sample.currency }).format(sample.amount)}</td><td>{execution.status === 'in-progress' && preparer && member?.id === execution.assignedToId ? <div className="sample-edit"><select aria-label={`Résultat ${sample.reference}`} onChange={(event) => setSampleDrafts((current) => ({ ...current, [sample.id]: { ...draft, result: event.target.value } }))} value={draft.result}><option value="pending">À documenter</option><option value="consistent">Éléments rapprochés</option><option value="exception">Écart à examiner</option></select><input aria-label={`Observation ${sample.reference}`} onChange={(event) => setSampleDrafts((current) => ({ ...current, [sample.id]: { ...draft, notes: event.target.value } }))} placeholder="Observation descriptive" value={draft.notes} /><button className="button button-secondary" disabled={busy || draft.result === 'pending'} onClick={() => void runAction(() => recordSampleOutcome(database, sample.id, member.id, draft.result as 'consistent' | 'exception', draft.notes), `Résultat consigné pour ${sample.reference}.`)} type="button">Enregistrer</button></div> : <><span className={`status-chip status-${sample.result}`}>{sample.result === 'pending' ? 'À documenter' : sample.result === 'consistent' ? 'Éléments rapprochés' : 'Écart à examiner'}</span><small>{sample.notes || 'Aucune observation consignée.'}</small></>}</td></tr>
            })}</tbody></table></div>

            {execution.status === 'in-progress' && preparer && member?.id === execution.assignedToId && <div className="execution-entry-grid">
              <form className="execution-entry card" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const value = String(new FormData(form).get('result') ?? ''); void runAction(async () => { await updateExecutionResult(database, execution.id, member.id, value); form.reset() }, 'Résultat descriptif enregistré.') }}><h4>Consigner le résultat</h4><label className="form-field">Résultat descriptif du travail *<textarea defaultValue={execution.result ?? ''} name="result" required /></label><button className="button button-secondary" disabled={busy} type="submit">Enregistrer le résultat</button></form>
              <form className="execution-entry card" onSubmit={(event) => { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); void runAction(async () => { await addEvidenceReference(database, { executionId: execution.id, actorId: member.id, label: String(form.get('label') ?? ''), reference: String(form.get('reference') ?? ''), evidenceType: String(form.get('evidenceType') ?? 'fictional-document') as EvidenceReference['evidenceType'], notes: String(form.get('notes') ?? '') }); element.reset() }, 'Référence fictive liée au travail.') }}><h4>Lier une pièce / référence fictive</h4><div className="form-grid"><label className="form-field">Type<select name="evidenceType"><option value="fictional-document">Pièce fictive</option><option value="source-line">Référence de ligne source</option><option value="comment">Commentaire de travail</option></select></label><label className="form-field">Libellé *<input maxLength={120} name="label" required /></label><label className="form-field">Référence *<input maxLength={150} name="reference" required /></label><label className="form-field">Note<textarea maxLength={500} name="notes" /></label></div><button className="button button-secondary" disabled={busy} type="submit">Lier la référence</button></form>
              <button className="button button-primary" disabled={busy} onClick={() => void runAction(() => transitionExecution(database, execution.id, member.id, 'submitted'), 'Travail soumis à la revue; son préparateur ne peut pas le réviser.')} type="button"><Send aria-hidden="true" size={15} /> Soumettre à la revue</button>
            </div>}

            {execution.status === 'planned' && preparer && member?.id === execution.assignedToId && <button className="button button-primary" disabled={busy} onClick={() => void runAction(() => transitionExecution(database, execution.id, member.id, 'in-progress'), 'Travail démarré par le préparateur désigné.')} type="button"><Play aria-hidden="true" size={15} /> Démarrer les travaux</button>}

            {execution.status === 'submitted' && reviewer && member?.id === execution.reviewerId && <div className="review-panel">
              <form className="execution-entry card" onSubmit={(event) => { event.preventDefault(); const element = event.currentTarget; const question = String(new FormData(element).get('question') ?? ''); void runAction(async () => { await createReviewNote(database, { executionId: execution.id, actorId: member.id, question }); element.reset() }, 'Demande de revue adressée au préparateur.') }}><h4><ShieldCheck aria-hidden="true" size={16} /> Note de revue</h4><label className="form-field">Demande / question du réviseur *<textarea maxLength={1000} name="question" required /></label><button className="button button-secondary" disabled={busy} type="submit">Ouvrir une note</button></form>
              {notes.map((note) => <ReviewNoteCard key={note.id} note={note} role={role} member={member} busy={busy} runAction={runAction} />)}
              <form className="execution-entry card" onSubmit={(event) => { event.preventDefault(); const conclusion = String(new FormData(event.currentTarget).get('conclusion') ?? ''); void runAction(() => transitionExecution(database, execution.id, member.id, 'reviewed', conclusion), 'Revue terminée avec une conclusion humaine tracée.') }}><h4>Terminer la revue</h4><label className="form-field">Conclusion du réviseur *<textarea defaultValue={execution.reviewConclusion ?? ''} maxLength={1000} name="conclusion" required /></label><button className="button button-primary" disabled={busy || notes.some((note) => note.status !== 'resolved')} type="submit"><Check aria-hidden="true" size={15} /> Marquer comme revu</button>{notes.some((note) => note.status !== 'resolved') && <p className="catalog-muted">Répondez et résolvez d’abord toutes les notes de revue ouvertes.</p>}</form>
            </div>}

            {notes.length > 0 && !(execution.status === 'submitted' && reviewer && member?.id === execution.reviewerId) && <div className="review-panel">{notes.map((note) => <ReviewNoteCard key={note.id} note={note} role={role} member={member} busy={busy} runAction={runAction} />)}</div>}
            {!myExecution && <p className="catalog-muted">Le parcours d’exécution est présenté au préparateur et au réviseur fictifs affectés à ce travail.</p>}
            <details className="event-log"><summary>Journal des transitions et consignations ({workEvents.length})</summary><ul>{workEvents.map((item) => <li key={item.id}><time>{item.occurredAt}</time> · {item.summary}</li>)}</ul></details>
          </article>
        })}
      </div>
    </section>
  )
}

function ReviewNoteCard({ note, role, member, busy, runAction }: {
  note: ReviewNote
  role: DemoRole
  member: TeamMember | undefined
  busy: boolean
  runAction: (action: () => Promise<unknown>, successMessage: string) => Promise<void>
}) {
  return <article className="review-note card"><div className="work-card-heading"><div><span className="eyebrow">Note de revue · {note.status === 'open' ? 'Ouverte' : note.status === 'answered' ? 'Réponse reçue' : 'Résolue'}</span><h4>{note.question}</h4></div><span className={`status-chip status-${note.status}`}>{note.status === 'open' ? 'Ouverte' : note.status === 'answered' ? 'Répondue' : 'Résolue'}</span></div>
    {note.response && <p className="review-response"><strong>Réponse conservée :</strong> {note.response}</p>}
    {note.status === 'open' && role === 'preparer' && member?.id === note.assignedToId && <form className="execution-entry" onSubmit={(event) => { event.preventDefault(); const response = String(new FormData(event.currentTarget).get('response') ?? ''); void runAction(() => answerReviewNote(database, note.id, member.id, response), 'Réponse du préparateur enregistrée et conservée dans la note.') }}><label className="form-field">Réponse du préparateur *<textarea maxLength={1000} name="response" required /></label><button className="button button-secondary" disabled={busy} type="submit">Envoyer la réponse</button></form>}
    {note.status === 'answered' && role === 'reviewer' && member?.id === note.authorId && <button className="button button-secondary" disabled={busy} onClick={() => void runAction(() => resolveReviewNote(database, note.id, member.id), 'Note résolue; question, réponse et réviseur conservés.')} type="button"><Check aria-hidden="true" size={15} /> Résoudre la note</button>}
    {note.status === 'resolved' && <p className="catalog-muted">Résolue par le profil fictif {note.resolvedById}; réponse conservée.</p>}
  </article>
}
