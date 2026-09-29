import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, CircleAlert, ExternalLink, FileCheck2, FileDown, FileText, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { database } from '../data/database'
import { repositories } from '../data/repositories'
import type { AuditEvent, Cycle, DocumentTemplate, Finding, GeneratedDocument, Mission, ProcedureExecution, ReviewNote, Risk, SampleItem, TeamMember } from '../domain/types'
import { useWorkspace } from '../workspace/WorkspaceContext'
import {
  createDocumentTemplateRecord,
  documentTemplates,
  exportDocument,
  findMissingRequiredFields,
  parseDocumentDraft,
  serializeDocumentDraft,
  type DocumentContext,
  type DocumentDraft,
  type DocumentTemplateDefinition,
} from '../documents/documentService'

interface LibraryData {
  cycles: Cycle[]
  risks: Risk[]
  assertions: DocumentContext['assertions']
  riskAssertionLinks: DocumentContext['riskAssertionLinks']
  executions: ProcedureExecution[]
  samples: SampleItem[]
  populations: DocumentContext['populations']
  evidence: DocumentContext['evidence']
  notes: ReviewNote[]
  findings: Finding[]
  members: TeamMember[]
  events: AuditEvent[]
  templates: DocumentTemplate[]
  generatedDocuments: GeneratedDocument[]
}

const emptyLibrary: LibraryData = {
  cycles: [], risks: [], assertions: [], riskAssertionLinks: [], executions: [], samples: [], populations: [], evidence: [], notes: [], findings: [], members: [], events: [], templates: [], generatedDocuments: [],
}

function useDocumentLibrary(mission: Mission | null) {
  const [data, setData] = useState<LibraryData>(emptyLibrary)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const refresh = useCallback(async (initial = false) => {
    if (!mission) {
      setData(emptyLibrary)
      setState('ready')
      return
    }
    if (initial) setState('loading')
    try {
      const [cycles, risks, assertions, riskAssertionLinks, executions, samples, populations, evidence, notes, findings, members, events, templates, generatedDocuments] = await Promise.all([
        repositories.cycles.listForMission(mission.id), repositories.risks.listForMission(mission.id), repositories.assertions.listForMission(mission.id),
        repositories.riskAssertionLinks.listForMission(mission.id), repositories.procedureExecutions.listForMission(mission.id),
        repositories.sampleItems.listForMission(mission.id), repositories.populations.listForMission(mission.id),
        repositories.evidenceReferences.listForMission(mission.id), repositories.reviewNotes.listForMission(mission.id),
        repositories.findings.listForMission(mission.id), repositories.teamMembers.listForMission(mission.id),
        repositories.auditEvents.listForMission(mission.id), repositories.documentTemplates.list(), repositories.generatedDocuments.listForMission(mission.id),
      ])
      const now = new Date().toISOString()
      const currentTemplates = new Map(templates.map((template) => [template.id, template]))
      const missingOrOutdated = documentTemplates
        .map((template) => createDocumentTemplateRecord(template, now))
        .filter((template) => currentTemplates.get(template.id)?.version !== template.version)
      if (missingOrOutdated.length) await database.documentTemplates.bulkPut(missingOrOutdated)
      setData({
        cycles: cycles.sort((left, right) => left.position - right.position), risks, assertions, riskAssertionLinks, executions, samples, populations, evidence, notes, findings, members,
        events: events.filter((event) => event.action === 'document-exported').sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
        templates: documentTemplates.map((template) => createDocumentTemplateRecord(template, currentTemplates.get(template.id)?.createdAt ?? now)),
        generatedDocuments: generatedDocuments.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [mission])

  useEffect(() => { void refresh(true) }, [refresh])
  return { data, state, refresh }
}

function initialDraft(template: DocumentTemplateDefinition, context: DocumentContext) {
  return template.createDraft(context)
}

function SavedDocument({ document, onPreview }: { document: GeneratedDocument; onPreview: (document: GeneratedDocument) => void }) {
  const template = documentTemplates.find(({ id }) => id === document.templateId)
  const draft = parseDocumentDraft(document.content)
  return (
    <article className="saved-document-card" id={`document-${encodeURIComponent(document.id)}`}>
      <span className="saved-document-icon"><FileCheck2 aria-hidden="true" size={16} /></span>
      <div className="saved-document-copy"><strong>{document.title}</strong><span>{template?.code ?? document.templateId} · v{document.templateVersion} · {new Date(document.createdAt).toLocaleString('fr-FR')}</span><span>{draft?.sourceReferences.length ?? 0} lien(s) source · Mission {document.missionId}</span></div>
      <button className="button button-secondary" onClick={() => onPreview(document)} type="button">Consulter le brouillon</button>
    </article>
  )
}

function DocumentPreview({ mission, template, draft, savedDocument, missingCount, busy, onBack, onPrint }: {
  mission: Mission
  template: DocumentTemplateDefinition
  draft: DocumentDraft
  savedDocument: GeneratedDocument | null
  missingCount: number
  busy: boolean
  onBack: () => void
  onPrint: () => void
}) {
  return (
    <section className="document-preview-page" aria-labelledby="document-preview-title">
      <div className="document-preview-toolbar"><button className="button button-secondary" disabled={busy} onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={15} /> Retour au brouillon</button><button className="button button-primary" disabled={busy} onClick={onPrint} type="button"><Printer aria-hidden="true" size={15} /> {busy ? 'Enregistrement…' : 'Imprimer / Enregistrer en PDF'}</button></div>
      {savedDocument && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />Brouillon de démonstration enregistré et journalisé. La boîte d’impression du navigateur permet de choisir « Enregistrer en PDF ».</p>}
      {missingCount > 0 && <p className="form-alert" role="status"><CircleAlert aria-hidden="true" size={15} />{missingCount} champ(s) obligatoire(s) restent à compléter. Le PDF conservera ces marqueurs visibles.</p>}
      <article className="document-paper" id="document-print-preview">
        <header className="document-paper-header"><span className="document-brand">AuditMission<span>360</span></span><span className="document-paper-version">{template.code} · Modèle v{template.version}</span></header>
        <div className="document-watermark" aria-hidden="true">DÉMONSTRATION · NON ÉMIS</div>
        <div className="document-demo-ribbon">DONNÉES SYNTHÉTIQUES · DOCUMENT SIMULÉ · BROUILLON NON SIGNÉ / NON ENVOYÉ</div>
        <h1 id="document-preview-title">{template.title}</h1>
        <div className="document-paper-meta"><span><strong>Mission :</strong> {mission.name}</span><span><strong>Identifiant de mission :</strong> {mission.id}</span><span><strong>Référentiel de démonstration :</strong> {mission.framework} · {mission.frameworkVersion}</span><span><strong>Version du modèle :</strong> {template.version}</span><span><strong>État :</strong> {savedDocument ? 'Brouillon exporté pour impression' : 'Aperçu du brouillon'}</span></div>
        <dl className="document-fields-preview">{draft.fields.map((field) => <div className={!field.value.trim() && field.required ? 'document-field-missing' : ''} key={field.id}><dt>{field.label}{field.required ? ' *' : ''}</dt><dd>{field.value.trim() || '[À compléter — information indisponible]'}</dd></div>)}</dl>
        {missingCount > 0 && <p className="document-missing-print">Champs requis restant à compléter : {findMissingRequiredFields(draft.fields).map(({ label }) => label).join(' · ')}</p>}
        <div className="document-paper-body">{draft.body.split('\n').map((line, index) => line ? <p key={`${index}-${line}`}>{line}</p> : <div aria-hidden="true" className="document-paper-spacer" key={`space-${index}`} />)}</div>
        <section className="document-source-list" aria-label="Sources du document"><strong>Sources liées au contenu</strong><ul>{draft.sourceReferences.map((reference) => <li key={`${reference.entityType}-${reference.entityId}`}><code>{reference.entityType}:{reference.entityId}</code> — {reference.label}</li>)}</ul></section>
        <footer className="document-paper-footer"><span>AuditMission360 · démonstration fictive · aucune signature, émission ou transmission</span><span>Mission {mission.id} · {template.code} v{template.version}</span></footer>
      </article>
    </section>
  )
}

export function DocumentsPage() {
  const { activeMission, role } = useWorkspace()
  const { data, state, refresh } = useDocumentLibrary(activeMission)
  const [selectedTemplateId, setSelectedTemplateId] = useState(documentTemplates[0].id)
  const [draft, setDraft] = useState<DocumentDraft | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [savedPreview, setSavedPreview] = useState<GeneratedDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const template = documentTemplates.find(({ id }) => id === selectedTemplateId) ?? documentTemplates[0]
  const actor = data.members.find((member) => member.role === role && member.isActive)
  const context = useMemo<DocumentContext | null>(() => activeMission && actor ? ({ mission: activeMission, actor, ...data }) : null, [activeMission, actor, data])

  useEffect(() => {
    if (!context || state !== 'ready') return
    const selected = documentTemplates.find(({ id }) => id === selectedTemplateId) ?? documentTemplates[0]
    setDraft((current) => current && current.sourceReferences[0]?.entityId === context.mission.id ? current : initialDraft(selected, context))
  }, [context, selectedTemplateId, state])

  function chooseTemplate(id: string) {
    setSelectedTemplateId(id)
    setSavedPreview(null)
    setPreviewing(false)
    setMessage('')
    setError('')
    if (context) {
      const next = documentTemplates.find((item) => item.id === id)
      if (next) setDraft(initialDraft(next, context))
    }
  }

  function updateField(id: string, value: string) {
    setDraft((current) => current ? ({ ...current, fields: current.fields.map((field) => field.id === id ? { ...field, value } : field) }) : current)
  }

  async function saveAndPrint() {
    if (!activeMission || !context || !draft) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const doc = await exportDocument(database, {
        missionId: activeMission.id,
        templateId: template.id,
        templateVersion: template.version,
        title: template.title,
        content: serializeDocumentDraft(draft),
        actorId: actor?.id ?? role,
      })
      setSavedPreview(doc)
      await refresh()
      setMessage('Brouillon de démonstration enregistré et journalisé. La boîte de dialogue du navigateur permet de choisir « Enregistrer en PDF ».')
      window.print()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le brouillon n’a pas pu être enregistré.')
    } finally {
      setBusy(false)
    }
  }

  function openSavedPreview(document: GeneratedDocument) {
    const content = parseDocumentDraft(document.content)
    if (!content) {
      setError('Le contenu historique est illisible ; aucune donnée n’a été modifiée.')
      return
    }
    const savedTemplate = documentTemplates.find(({ id }) => id === document.templateId)
    if (!savedTemplate) return
    setSelectedTemplateId(savedTemplate.id)
    setDraft(content)
    setSavedPreview(document)
    setPreviewing(true)
    setError('')
  }

  function previewDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setSavedPreview(null)
    setPreviewing(true)
    setMessage('')
  }

  if (!activeMission) return <div className="state-card"><h1>Aucune mission ouverte</h1><Link className="text-link" to="/mission">Configurer une mission</Link></div>
  if (state === 'loading') return <p className="state-card" role="status">Chargement des modèles et du dossier fictif…</p>
  if (state === 'error') return <p className="state-card state-error" role="alert">Les modèles ou les documents de la mission ne sont pas accessibles.</p>
  if (!draft || !context) return <p className="state-card" role="status">Préparation du brouillon…</p>

  if (previewing) return (
    <DocumentPreview mission={activeMission} template={template} draft={draft} savedDocument={savedPreview} missingCount={findMissingRequiredFields(draft.fields).length} busy={busy} onBack={() => { setPreviewing(false); setSavedPreview(null) }} onPrint={() => { if (savedPreview) window.print(); else void saveAndPrint() }} />
  )

  const missing = findMissingRequiredFields(draft.fields)
  return (
    <section className="documents-page" aria-labelledby="documents-title">
      <div className="page-heading"><div><span className="eyebrow">Modèles versionnés · mission fictive</span><h1 id="documents-title">Documents de travail</h1><p>Choisissez un modèle, complétez les champs requis, puis relisez le brouillon avant impression navigateur.</p></div></div>
      <p className="form-disclosure">Tous les documents sont des exemples de démonstration. La lettre reste non signée et non envoyée. L’export enregistre une copie locale du brouillon et de ses liens de source, puis ouvre la boîte d’impression / d’enregistrement PDF du navigateur ; aucun document n’est transmis.</p>
      {message && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />{message}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}

      <div className="document-workspace">
        <aside className="document-template-list" aria-label="Bibliothèque des modèles">
          <div className="document-list-heading"><span className="eyebrow">Bibliothèque</span><span className="count-pill">{documentTemplates.length} modèles</span></div>
          {documentTemplates.map((item) => <button aria-pressed={item.id === template.id} className={`document-template-choice${item.id === template.id ? ' selected' : ''}`} key={item.id} onClick={() => chooseTemplate(item.id)} type="button"><span><FileText aria-hidden="true" size={15} />{item.title}</span><small>{item.category} · v{item.version}</small></button>)}
        </aside>

        <div className="document-editor-column">
          <form className="document-editor card" onSubmit={previewDraft}>
            <div className="document-editor-heading"><div><span className="eyebrow">{template.code} · {template.category} · v{template.version}</span><h2>{template.title}</h2><p>{template.description}</p></div><span className="status-chip">Brouillon</span></div>
            <div className="document-editor-meta"><span>Mission : <strong>{activeMission.name}</strong></span><span>Identifiant : <code>{activeMission.id}</code></span><span>Profil de démo : <strong>{actor?.displayName ?? role}</strong></span></div>
            <fieldset className="document-fields-editor"><legend>Champs du modèle</legend>{draft.fields.map((field) => <label className="form-field" htmlFor={`document-field-${field.id}`} key={field.id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}<input aria-label={field.label} aria-invalid={field.required && !field.value.trim()} id={`document-field-${field.id}`} maxLength={300} onChange={(event) => updateField(field.id, event.target.value)} value={field.value} />{field.required && !field.value.trim() && <small className="field-error">Champ obligatoire à compléter avant finalisation.</small>}</label>)}</fieldset>
            <label className="form-field document-body-editor" htmlFor="document-body">Contenu du brouillon modifiable<textarea id="document-body" maxLength={12000} onChange={(event) => setDraft((current) => current ? { ...current, body: event.target.value } : current)} rows={15} value={draft.body} /></label>
            {missing.length > 0 && <p className="form-alert" role="status"><CircleAlert aria-hidden="true" size={15} /><span>{missing.length} champ(s) obligatoire(s) manquant(s) : {missing.map(({ label }) => label).join(' · ')}. Ils restent visibles dans l’aperçu.</span></p>}
            <div className="document-editor-actions"><button className="button button-primary" type="submit"><FileDown aria-hidden="true" size={15} /> Prévisualiser le brouillon</button></div>
          </form>
        </div>
      </div>

      <section className="document-history" aria-labelledby="document-history-title"><div className="section-heading"><div><span className="eyebrow">Journal local des exports</span><h2 id="document-history-title">Documents enregistrés</h2></div><span className="count-pill">{data.generatedDocuments.length} document(s)</span></div>
        {data.generatedDocuments.length ? <div className="saved-document-list">{data.generatedDocuments.map((document) => <SavedDocument document={document} key={document.id} onPreview={openSavedPreview} />)}</div> : <p className="state-card">Aucun document n’a encore été enregistré pour cette mission.</p>}
        {data.events.length > 0 && <details className="event-log"><summary>Journal des exports ({data.events.length})</summary><ul>{data.events.map((event) => <li key={event.id}><time>{new Date(event.occurredAt).toLocaleString('fr-FR')}</time> · {event.summary} · <a href={`#document-${encodeURIComponent(event.entityId)}`}>Source : {event.entityId} <ExternalLink aria-hidden="true" size={11} /></a></li>)}</ul></details>}
      </section>
    </section>
  )
}
