import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { database } from '../data/database'
import { repositories } from '../data/repositories'
import type { Assertion, Cycle, DemoRole, ProcedureTemplate, Risk, RiskAssertionLink } from '../domain/types'
import { addEntitySpecificRisk, recordRiskDecision, suggestProcedureTemplates, suggestRiskCandidates } from '../catalog/catalogService'
import { STARTER_CATALOG_VERSION } from '../catalog/catalogData'
import { useWorkspace } from '../workspace/WorkspaceContext'

const roleLabel: Record<DemoRole, string> = {
  'engagement-manager': 'Responsable de mission', preparer: 'Préparateur', reviewer: 'Réviseur',
  'data-specialist': 'Expert données', reader: 'Lecteur / qualité',
}

function useCatalogData() {
  const { activeMission } = useWorkspace()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [assertions, setAssertions] = useState<Assertion[]>([])
  const [links, setLinks] = useState<RiskAssertionLink[]>([])
  const [procedures, setProcedures] = useState<ProcedureTemplate[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    if (!activeMission) {
      setState('ready')
      return () => { active = false }
    }
    setState('loading')
    Promise.all([
      repositories.cycles.listForMission(activeMission.id),
      repositories.risks.listForMission(activeMission.id),
      repositories.assertions.listForMission(activeMission.id),
      repositories.riskAssertionLinks.listForMission(activeMission.id),
      repositories.procedureTemplates.listForMission(activeMission.id),
    ]).then(([nextCycles, nextRisks, nextAssertions, nextLinks, nextProcedures]) => {
      if (!active) return
      setCycles(nextCycles.sort((left, right) => left.position - right.position))
      setRisks(nextRisks)
      setAssertions(nextAssertions)
      setLinks(nextLinks)
      setProcedures(nextProcedures)
      setState('ready')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [activeMission?.id])

  return { activeMission, cycles, risks, setRisks, assertions, links, procedures, state }
}

function CatalogMeta({ source, reviewStatus, version, author, reviewer }: { source: string; reviewStatus: string; version: string; author: string; reviewer: string }) {
  return <div className="catalog-meta"><span>Catalogue {version}</span><span>Revue : {reviewStatus === 'reviewed' ? 'revue pédagogique' : reviewStatus}</span><span>Source : {source}</span><span>Auteur : {author} · Relecteur : {reviewer}</span></div>
}

function CatalogLoadState({ state, hasMission }: { state: string; hasMission: boolean }) {
  if (!hasMission) return <div className="state-card"><h2>Aucune mission ouverte</h2><Link className="text-link" to="/mission">Ouvrir une mission <ArrowRight aria-hidden="true" size={16} /></Link></div>
  if (state === 'loading') return <p className="state-card" role="status">Chargement du catalogue versionné…</p>
  if (state === 'error') return <p className="state-card state-error" role="alert">Le catalogue de la mission n’est pas accessible pour le moment.</p>
  return null
}

export function CatalogPage() {
  const { activeMission, cycles, risks, setRisks, assertions, links, procedures, state } = useCatalogData()
  const { role } = useWorkspace()
  const [cycleId, setCycleId] = useState('all')
  const [itemState, setItemState] = useState('candidate')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [entityCycleId, setEntityCycleId] = useState('')
  const [entityTitle, setEntityTitle] = useState('')
  const [entityDescription, setEntityDescription] = useState('')
  const [entityReason, setEntityReason] = useState('')
  const [entityAssertions, setEntityAssertions] = useState<string[]>([])
  const manager = role === 'engagement-manager'

  const cycleRisks = useMemo(() => risks.filter((risk) => cycleId === 'all' || risk.cycleId === cycleId), [risks, cycleId])
  const shownRisks = cycleRisks.filter((risk) => itemState === 'all' || risk.status === itemState)
  const suggestions = activeMission ? cycles.flatMap((cycle) => suggestRiskCandidates(activeMission, cycle.id, risks))
    .filter(({ risk }) => cycleId === 'all' || risk.cycleId === cycleId) : []
  const suggestedIds = new Set(suggestions.map(({ risk }) => risk.id))

  async function decide(risk: Risk, decision: 'confirmed' | 'adapted' | 'excluded', form: HTMLFormElement) {
    if (!activeMission) return
    setError('')
    setNotice('')
    const values = new FormData(form)
    const justification = String(values.get('justification') ?? '')
    const adapted = { title: String(values.get('adaptedTitle') ?? ''), description: String(values.get('adaptedDescription') ?? '') }
    try {
      const member = await repositories.teamMembers.listForMission(activeMission.id).then((members) => members.find((item) => item.role === role))
      const saved = await recordRiskDecision(database, risk, decision, justification, member?.id ?? 'demo-human', adapted)
      setRisks((current) => current.map((item) => item.id === saved.id ? saved : item))
      setNotice(`Décision humaine enregistrée pour « ${saved.title} » avec le catalogue ${saved.catalogVersion}.`)
      form.reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La décision n’a pas pu être enregistrée.')
    }
  }

  async function addSpecificity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeMission) return
    setError('')
    setNotice('')
    try {
      const member = await repositories.teamMembers.listForMission(activeMission.id).then((members) => members.find((item) => item.role === role))
      const risk = await addEntitySpecificRisk(database, {
        missionId: activeMission.id,
        cycleId: entityCycleId,
        title: entityTitle,
        description: entityDescription,
        assertionIds: entityAssertions,
        justification: entityReason,
      }, member?.id ?? 'demo-human')
      setRisks((current) => [...current, risk])
      setItemState('confirmed')
      setCycleId(entityCycleId)
      setEntityTitle('')
      setEntityDescription('')
      setEntityReason('')
      setEntityAssertions([])
      setNotice('Spécificité de l’entité enregistrée et reliée aux assertions choisies par une personne.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La spécificité ne peut pas être enregistrée.')
    }
  }

  if (state !== 'ready' || !activeMission) return <CatalogLoadState state={state} hasMission={Boolean(activeMission)} />

  return (
    <section aria-labelledby="catalog-title" className="catalog-page">
      <div className="page-heading">
        <div><span className="eyebrow">Modèles pédagogiques · {STARTER_CATALOG_VERSION}</span><h1 id="catalog-title">Catalogue & risques candidats</h1><p>Des propositions déterministes et motivées, à examiner dans le contexte de chaque mission. Profil de démonstration actif : {roleLabel[role]}.</p></div>
      </div>
      <p className="form-disclosure">Un modèle est un point de départ, pas un constat. Chaque risque demeure un candidat jusqu’à une décision explicite et justifiée par une personne. Aucune fraude, opinion ou significativité n’est classifiée automatiquement. Sources et références sont pédagogiques et requièrent une appréciation professionnelle.</p>

      {notice && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />{notice}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}

      <div className="catalog-toolbar card">
        <label className="form-field">Cycle
          <select value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="all">Tous les cycles</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select>
        </label>
        <label className="form-field">État
          <select value={itemState} onChange={(event) => setItemState(event.target.value)}><option value="candidate">Candidats à examiner</option><option value="confirmed">Confirmés par une personne</option><option value="adapted">Adaptés par une personne</option><option value="excluded">Écartés par une personne</option><option value="all">Tous les états</option></select>
        </label>
        <span className="count-pill">{shownRisks.length} modèle(s) affiché(s)</span>
      </div>

      <div className="catalog-layout">
        <div>
          <div className="section-heading"><div><span className="eyebrow">Catalogue source</span><h2>Risques et relations</h2></div><span className="count-pill">{risks.length} risques</span></div>
          {shownRisks.length === 0 && <p className="state-card">Aucun modèle pour ces filtres.</p>}
          <div className="catalog-list">
            {shownRisks.map((risk) => {
              const cycle = cycles.find((item) => item.id === risk.cycleId)
              const riskLinks = links.filter((link) => link.riskId === risk.id)
              const riskAssertions = riskLinks.map((link) => ({ link, assertion: assertions.find((item) => item.id === link.assertionId) })).filter((item) => item.assertion)
              const isSuggested = suggestedIds.has(risk.id)
              return (
                <article className="catalog-card card" key={risk.id}>
                  <div className="catalog-card-heading"><div><span className="eyebrow">{cycle?.name} · {risk.category === 'operation' ? 'Opération' : risk.category === 'balance' ? 'Solde' : 'Information fournie'}</span><h3><Link to={`/catalogue/risque/${risk.code}`}>{risk.title}</Link></h3></div><span className={`status-chip status-${risk.status}`}>{risk.status === 'candidate' ? 'Candidat' : risk.status === 'confirmed' ? 'Confirmé par une personne' : risk.status === 'adapted' ? 'Adapté par une personne' : 'Écarté par une personne'}</span></div>
                  <p>{risk.description}</p>
                  {isSuggested && <div className="suggestion-reasons"><strong><ShieldAlert aria-hidden="true" size={15} /> Pourquoi ce candidat ?</strong><ul>{suggestions.find(({ risk: item }) => item.id === risk.id)?.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
                  {!isSuggested && risk.status === 'candidate' && <p className="catalog-muted">Le modèle ne correspond pas au secteur sélectionné ou au contexte de cette mission ; il reste consultable sans suggestion.</p>}
                  <div className="catalog-relations"><strong>Assertions reliées</strong>{riskAssertions.map(({ link, assertion }) => <span key={link.id}><Link to={`/catalogue/assertion/${assertion!.code}`}>{assertion!.name}</Link><small>{link.rationale}</small></span>)}</div>
                  <div className="catalog-relations"><strong>Procédures suggérées par relation risque–assertion</strong>{riskAssertions.map(({ link, assertion }) => {
                    const relatedProcedures = suggestProcedureTemplates(risk, assertion!.code, procedures)
                    return <span key={link.id}><Link to={`/catalogue/assertion/${assertion!.code}`}>{assertion!.name}</Link>{relatedProcedures.length ? relatedProcedures.map((procedure) => <Link key={procedure.id} to={`/catalogue/procedure/${procedure.code}`}>{procedure.title} <ArrowRight aria-hidden="true" size={13} /></Link>) : <small>Aucun modèle de procédure lié à cette paire dans cette version.</small>}</span>
                  })}</div>
                  <CatalogMeta source={risk.source} reviewStatus={risk.reviewStatus} version={risk.catalogVersion} author={risk.author} reviewer={risk.reviewer} />
                  {risk.justification && <p className="decision-reason"><strong>Justification de la décision :</strong> {risk.justification}</p>}
                  {risk.status === 'candidate' && manager && <form className="decision-form" onSubmit={(event) => event.preventDefault()}>
                    <label className="form-field">Motif de la décision humaine *<textarea name="justification" required maxLength={1000} placeholder="Décrivez le contexte, l’adaptation ou le motif d’exclusion." /></label>
                    <div className="form-grid"><label className="form-field">Intitulé adapté <input name="adaptedTitle" maxLength={150} placeholder={risk.title} /></label><label className="form-field">Description adaptée <input name="adaptedDescription" maxLength={500} placeholder={risk.description} /></label></div>
                    <div className="catalog-actions"><button className="button button-primary" onClick={(event) => void decide(risk, 'confirmed', event.currentTarget.form!)} type="button">Confirmer</button><button className="button button-secondary" onClick={(event) => void decide(risk, 'adapted', event.currentTarget.form!)} type="button">Adapter</button><button className="button button-secondary button-danger" onClick={(event) => void decide(risk, 'excluded', event.currentTarget.form!)} type="button">Écarter</button></div>
                  </form>}
                </article>
              )
            })}
          </div>
        </div>

        <aside className="catalog-aside">
          <div className="section-heading"><div><span className="eyebrow">Travail humain</span><h2>Spécificité d’entité</h2></div><Plus aria-hidden="true" size={17} /></div>
          <form className="specificity-form card" onSubmit={(event) => void addSpecificity(event)}>
            <p>Ajoutez un élément propre à la mission fictive. Il est attribué à son auteur et relié aux assertions choisies ; ce n’est pas une suggestion automatique.</p>
            <label className="form-field">Cycle *<select required onChange={(event) => setEntityCycleId(event.target.value)} value={entityCycleId}><option value="">Choisir un cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label>
            <label className="form-field">Intitulé *<input required maxLength={150} onChange={(event) => setEntityTitle(event.target.value)} value={entityTitle} /></label>
            <label className="form-field">Description *<textarea required maxLength={500} onChange={(event) => setEntityDescription(event.target.value)} value={entityDescription} /></label>
            <fieldset className="assertion-picker"><legend>Assertions concernées *</legend>{assertions.map((assertion) => <label key={assertion.id}><input checked={entityAssertions.includes(assertion.id)} onChange={(event) => setEntityAssertions((current) => event.target.checked ? [...current, assertion.id] : current.filter((id) => id !== assertion.id))} type="checkbox" />{assertion.name} <small>({assertion.category === 'transaction' ? 'opération' : assertion.category === 'balance' ? 'solde' : 'information'})</small></label>)}</fieldset>
            <label className="form-field">Justification *<textarea required maxLength={1000} onChange={(event) => setEntityReason(event.target.value)} value={entityReason} /></label>
            <button className="button button-primary" disabled={!manager} type="submit"><Plus aria-hidden="true" size={15} /> Ajouter à la mission</button>
            {!manager && <p className="catalog-muted">La saisie et la décision sont réservées au profil fictif Responsable de mission.</p>}
          </form>
          <div className="section-heading"><div><span className="eyebrow">Détail des modèles</span><h2>Assertions</h2></div></div>
          <div className="assertion-list card">{assertions.map((assertion) => <Link key={assertion.id} to={`/catalogue/assertion/${assertion.code}`}><span>{assertion.name}<small>{assertion.category === 'transaction' ? 'Opérations' : assertion.category === 'balance' ? 'Soldes' : 'Présentation / informations'}</small></span><ArrowRight aria-hidden="true" size={14} /></Link>)}</div>
        </aside>
      </div>
    </section>
  )
}

export function CatalogDetailPage() {
  const { kind, code } = useParams()
  const { activeMission, cycles, risks, assertions, links, procedures, state } = useCatalogData()
  if (state !== 'ready' || !activeMission) return <CatalogLoadState state={state} hasMission={Boolean(activeMission)} />

  const risk = kind === 'risque' ? risks.find((item) => item.code === code) : undefined
  const assertion = kind === 'assertion' ? assertions.find((item) => item.code === code) : undefined
  const procedure = kind === 'procedure' ? procedures.find((item) => item.code === code) : undefined
  const title = risk?.title ?? assertion?.name ?? procedure?.title
  if (!title) return <div className="state-card"><h1>Modèle introuvable</h1><Link className="text-link" to="/catalogue"><ArrowLeft aria-hidden="true" size={15} /> Retour au catalogue</Link></div>

  const cycle = risk ? cycles.find((item) => item.id === risk.cycleId) : procedure ? cycles.find((item) => item.id === procedure.cycleId) : undefined
  const relatedLinks = risk ? links.filter((item) => item.riskId === risk.id) : assertion ? links.filter((item) => item.assertionId === assertion.id) : []
  const relatedRisks = assertion ? relatedLinks.map((link) => risks.find((item) => item.id === link.riskId)).filter((item): item is Risk => Boolean(item)) : []

  return <section className="catalog-detail-page" aria-labelledby="catalog-detail-title">
    <Link className="text-link" to="/catalogue"><ArrowLeft aria-hidden="true" size={15} /> Retour au catalogue</Link>
    <article className="catalog-detail card">
      <span className="eyebrow">Fiche de modèle · {kind} · Catalogue {risk?.catalogVersion ?? assertion?.catalogVersion ?? procedure?.version}</span>
      <h1 id="catalog-detail-title">{title}</h1>
      {cycle && <p className="catalog-detail-cycle">Cycle : {cycle.name}</p>}
      {risk && <><p>{risk.description}</p><div className="suggestion-reasons"><strong>Motif explicatif du modèle</strong><p>{risk.rationale}</p></div><div className="catalog-relations"><strong>Assertions et motifs du lien</strong>{relatedLinks.map((link) => <span key={link.id}>{assertions.find((item) => item.id === link.assertionId)?.name}<small>{link.rationale}</small></span>)}</div><div className="catalog-relations"><strong>Procédures liées</strong>{procedures.filter((item) => item.riskCodes.includes(risk.code)).map((item) => <Link key={item.id} to={`/catalogue/procedure/${item.code}`}>{item.title}<ArrowRight aria-hidden="true" size={13} /></Link>)}</div><CatalogMeta source={risk.source} reviewStatus={risk.reviewStatus} version={risk.catalogVersion} author={risk.author} reviewer={risk.reviewer} /></>}
      {assertion && <><p>{assertion.description}</p><p className="form-disclosure">Catégorie d’assertion : {assertion.category === 'transaction' ? 'opérations / événements' : assertion.category === 'balance' ? 'soldes' : 'informations fournies'}. Le libellé est pédagogique ; sa correspondance exacte dépend de la traduction et de l’édition applicables.</p><div className="catalog-relations"><strong>Risques candidats reliés et justification</strong>{relatedRisks.map((item) => <Link key={item.id} to={`/catalogue/risque/${item.code}`}>{item.title}<small>{relatedLinks.find((link) => link.riskId === item.id)?.rationale}</small></Link>)}</div><CatalogMeta source={assertion.source} reviewStatus={assertion.reviewStatus} version={assertion.catalogVersion} author={assertion.author} reviewer={assertion.reviewer} /></>}
      {procedure && <><p>{procedure.objective}</p><div className="detail-two-columns"><div><h2>Étapes adaptables</h2><ol>{procedure.steps.map((step) => <li key={step}>{step}</li>)}</ol><h2>Prérequis</h2><ul>{procedure.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h2>Population indicative</h2><p>{procedure.populationDescription}</p><h2>Éléments attendus</h2><ul>{procedure.expectedEvidence.map((item) => <li key={item}>{item}</li>)}</ul><h2>Résultat à consigner</h2><p>{procedure.expectedResult}</p><h2>Références indicatives</h2><p>{procedure.standardReferences.join(' · ')}</p></div></div><div className="catalog-relations"><strong>Risques candidats reliés</strong>{procedure.riskCodes.map((riskCode) => { const item = risks.find((candidate) => candidate.code === riskCode); return item && <Link key={riskCode} to={`/catalogue/risque/${item.code}`}>{item.title}<ArrowRight aria-hidden="true" size={13} /></Link> })}</div><CatalogMeta source={procedure.source} reviewStatus={procedure.status} version={procedure.version} author={procedure.author} reviewer={procedure.reviewer} /></>}
      <p className="form-disclosure">Ces contenus sont des modèles de démonstration à adapter. Ils ne déterminent ni fraude, ni conformité, ni opinion d’audit.</p>
    </article>
  </section>
}
