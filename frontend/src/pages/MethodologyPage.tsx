import { ArrowUpRight, BookOpenCheck, CircleAlert, ExternalLink, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../workspace/WorkspaceContext'
import { isOfficialNormativeUrl, methodologyStages, normativeReferenceAnchor, ohadaReferences, standardReferences } from './methodologyData'

function ReferenceLink({ id }: { id: string }) {
  const reference = standardReferences.find((item) => item.id === id)
  if (!reference) return null
  return <a className="method-reference-link" href={`#${normativeReferenceAnchor(reference.id)}`}>{reference.id}<ArrowUpRight aria-hidden="true" size={13} /></a>
}

function ExternalReference({ reference }: { reference: (typeof standardReferences)[number] }) {
  const valid = isOfficialNormativeUrl(reference.sourceUrl)
  return (
    <article className="method-standard-card" id={normativeReferenceAnchor(reference.id)}>
      <div className="method-standard-heading">
        <div><span className="eyebrow">{reference.id}</span><h3>{reference.title}</h3></div>
        <a aria-label={`Consulter la source officielle pour ${reference.id}`} className="method-source-icon" href={reference.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={16} /></a>
      </div>
      <dl className="method-metadata">
        <div><dt>Version / édition</dt><dd>{reference.version}</dd></div>
        <div><dt>Publication</dt><dd>{reference.publicationDate}</dd></div>
        <div><dt>Effet</dt><dd>{reference.effectiveStatus}</dd></div>
        <div><dt>Adoption OHADA / locale</dt><dd>{reference.localAdoptionStatus}</dd></div>
      </dl>
      {reference.statusNote && <p className="method-alert"><CircleAlert aria-hidden="true" size={15} />{reference.statusNote}</p>}
      {valid ? <a className="method-source-link" href={reference.sourceUrl} rel="noreferrer" target="_blank">Source officielle IAASB <ExternalLink aria-hidden="true" size={13} /></a> : <p className="method-alert" role="alert">Lien officiel à vérifier avant consultation.</p>}
    </article>
  )
}

function OhadaReference({ reference }: { reference: (typeof ohadaReferences)[number] }) {
  return (
    <article className="method-standard-card" id={normativeReferenceAnchor(reference.id)}>
      <div className="method-standard-heading">
        <div><span className="eyebrow">{reference.id}</span><h3>{reference.title}</h3></div>
        {isOfficialNormativeUrl(reference.sourceUrl) && <a aria-label={`Consulter la source officielle pour ${reference.id}`} className="method-source-icon" href={reference.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={16} /></a>}
      </div>
      <dl className="method-metadata">
        <div><dt>Version / adoption</dt><dd>{reference.version}</dd></div>
        <div><dt>Publication</dt><dd>{reference.publicationDate}</dd></div>
        <div><dt>Effet</dt><dd>{reference.effectiveStatus}</dd></div>
        <div><dt>Champ / adoption locale</dt><dd>{reference.localAdoptionStatus}</dd></div>
      </dl>
      {isOfficialNormativeUrl(reference.sourceUrl) && <a className="method-source-link" href={reference.sourceUrl} rel="noreferrer" target="_blank">Source officielle OHADA <ExternalLink aria-hidden="true" size={13} /></a>}
    </article>
  )
}

export function MethodologyPage() {
  const { activeMission } = useWorkspace()
  const referencesById = new Map(standardReferences.map((reference) => [reference.id, reference]))

  return (
    <section className="methodology-page" aria-labelledby="methodology-title">
      <div className="page-heading">
        <div><span className="eyebrow">Guide de travail · références à vérifier</span><h1 id="methodology-title">Méthodologie d’audit</h1><p>Un fil conducteur consultable à chaque phase ; les procédures et conclusions nécessitent une appréciation professionnelle.</p></div>
      </div>

      {activeMission && <p className="method-context">Contexte pédagogique de la mission : <strong>{activeMission.framework} · {activeMission.frameworkVersion}</strong> · {activeMission.country}. Le contexte ne détermine pas l’applicabilité des normes.</p>}

      <div className="method-disclaimer" role="note"><BookOpenCheck aria-hidden="true" size={19} /><p><strong>Repères informatifs, pas une déclaration de conformité.</strong> Les références ISA et OHADA sont des points de départ. Vérifiez les textes officiels, leur traduction, leur date d’effet, leur adoption dans l’État concerné et les règles sectorielles pour chaque mission. Cette démonstration ne reproduit pas les textes protégés.</p></div>

      <nav className="method-stage-index" aria-label="Étapes de la méthodologie"><strong>Parcourir les étapes</strong><div>{methodologyStages.map((stage) => <a key={stage.id} href={`#etape-${stage.id}`}>{stage.title}</a>)}</div></nav>

      <div className="method-stage-list">
        {methodologyStages.map((stage, index) => (
          <article className="method-stage card" id={`etape-${stage.id}`} key={stage.id}>
            <header className="method-stage-heading"><span className="method-step-number">{String(index + 1).padStart(2, '0')}</span><div><span className="eyebrow">Étape {index + 1} sur {methodologyStages.length}</span><h2>{stage.title}</h2></div></header>
            <p className="method-objective">{stage.objective}</p>
            <div className="method-stage-columns">
              <div><h3><ListChecks aria-hidden="true" size={15} />Activités</h3><ul>{stage.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul></div>
              <div><h3><CircleAlert aria-hidden="true" size={15} />Décisions humaines</h3><ul>{stage.humanDecisions.map((decision) => <li key={decision}>{decision}</li>)}</ul></div>
              <div><h3><BookOpenCheck aria-hidden="true" size={15} />Livrables attendus</h3><ul>{stage.deliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}</ul></div>
            </div>
            <div className="method-stage-references" aria-label={`Références de l’étape : ${stage.title}`}><strong>Références indicatives</strong><div>{stage.referenceIds.map((id) => referencesById.has(id) ? <ReferenceLink id={id} key={id} /> : null)}</div></div>
            {(stage.id === 'acceptation' || stage.id === 'risques' || stage.id === 'rapport') && <div className="method-stage-navigation"><Link className="text-link" to={stage.id === 'acceptation' ? '/mission' : stage.id === 'risques' ? '/catalogue' : '/programme'}>{stage.id === 'acceptation' ? 'Consulter le contexte de mission' : stage.id === 'risques' ? 'Ouvrir le catalogue des risques candidats' : 'Consulter le programme et la revue'} <ArrowUpRight aria-hidden="true" size={14} /></Link></div>}
          </article>
        ))}
      </div>

      <section className="method-reference-library" aria-labelledby="method-reference-title">
        <div className="section-heading"><div><span className="eyebrow">Édition, date et statut distincts</span><h2 id="method-reference-title">Références ISA</h2></div><span className="count-pill">{standardReferences.length} références</span></div>
        <p className="method-library-intro">Les liens conduisent aux publications officielles IAASB. Pour les éditions ordinaires, le Handbook 2025 est la source de consultation ; la date d’effet précise de l’édition et son adoption nationale sont à confirmer au regard de la période et de la juridiction.</p>
        <div className="method-standard-grid">{standardReferences.map((reference) => <ExternalReference key={reference.id} reference={reference} />)}</div>
      </section>

      <section className="method-reference-library" aria-labelledby="ohada-reference-title">
        <div className="section-heading"><div><span className="eyebrow">Couche juridique régionale</span><h2 id="ohada-reference-title">Sources OHADA</h2></div></div>
        <p className="method-library-intro">Les normes ISA ne suffisent pas à établir les obligations applicables dans un État : examiner le droit OHADA, les textes nationaux et les règles propres au secteur et à l’entité. Le rattachement ci-dessous est informatif, pas une conclusion juridique.</p>
        <div className="method-standard-grid">{ohadaReferences.map((reference) => <OhadaReference key={reference.id} reference={reference} />)}</div>
      </section>

      <aside className="method-revised-notice" aria-label="Alerte sur les normes révisées"><CircleAlert aria-hidden="true" size={19} /><p><strong>Attention aux versions révisées ISA 240 et ISA 570.</strong> Les textes révisés figurent au Handbook 2025 mais leur date d’effet est le 15 décembre 2026 (périodes ouvertes à compter de cette date). Au 29 septembre 2026, ils ne sont pas encore effectifs. Confirmez séparément toute adoption anticipée ou locale ; les versions révisées et antérieures ne sont pas interchangeables.</p></aside>
    </section>
  )
}
