import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, Check, CircleAlert, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { database } from '../data/database'
import { repositories } from '../data/repositories'
import type { AnalyticsException, ImportJob, LedgerEntry, ProcedureExecution, TeamMember } from '../domain/types'
import { useWorkspace } from '../workspace/WorkspaceContext'
import demoLedgerCsv from '../data/ledger-demo.csv?raw'
import {
  analyzeLedger, documentAnalyticsReview, importLedger, LEDGER_COLUMNS, parseCsv, suggestLedgerMapping,
  validateLedgerCsv, type CsvPreview, type LedgerDraft, type LedgerMapping,
} from '../analytics/ledgerService'

interface ImportsData {
  members: TeamMember[]
  jobs: ImportJob[]
  entries: LedgerEntry[]
  exceptions: AnalyticsException[]
  executions: ProcedureExecution[]
}
const emptyData: ImportsData = { members: [], jobs: [], entries: [], exceptions: [], executions: [] }
const maximumCsvBytes = 5 * 1024 * 1024
const maximumCsvRows = 10_000

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function buildSignalsCsv(job: ImportJob, exceptions: AnalyticsException[], entries: LedgerEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const header = ['mission_id', 'fichier_source', 'empreinte_logique', 'ligne_csv', 'id_ligne_source', 'regle', 'signal_a_examiner', 'statut_humain', 'decision_humaine', 'note_humaine', 'test_lie', 'date_comptable', 'date_saisie', 'numero_piece', 'compte', 'libelle', 'debit', 'credit']
  const rows = exceptions.map((exception) => {
    const source = byId.get(exception.sourceEntryId)
    return [job.missionId, job.fileName, job.sourceFingerprint, exception.lineNumber, exception.sourceEntryId, exception.ruleCode,
      exception.description, exception.status, exception.humanDecision ?? '', exception.humanNote ?? '', exception.linkedExecutionId ?? '',
      source?.entryDate ?? '', source?.postingDate ?? '', source?.entryNumber ?? '', source?.account ?? '', source?.description ?? '',
      source?.debit ?? '', source?.credit ?? ''].map(csvCell).join(';')
  })
  return `\uFEFF${[header.map(csvCell).join(';'), ...rows].join('\r\n')}`
}

function downloadText(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ImportsPage() {
  const { activeMission, role } = useWorkspace()
  const [data, setData] = useState<ImportsData>(emptyData)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [mapping, setMapping] = useState<LedgerMapping | null>(null)
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { executionId: string; status: 'explained' | 'dismissed'; note: string }>>({})

  const refresh = useCallback(async (initial = false) => {
    if (!activeMission) { setData(emptyData); setState('ready'); return }
    if (initial) setState('loading')
    try {
      const [members, jobs, entries, exceptions, executions] = await Promise.all([
        repositories.teamMembers.listForMission(activeMission.id), repositories.importJobs.listForMission(activeMission.id),
        repositories.ledgerEntries.listForMission(activeMission.id), repositories.analyticsExceptions.listForMission(activeMission.id),
        repositories.procedureExecutions.listForMission(activeMission.id),
      ])
      setData({ members, jobs: jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), entries, exceptions, executions })
      setState('ready')
    } catch { setState('error') }
  }, [activeMission?.id])

  useEffect(() => { void refresh(true) }, [refresh])

  const validation = useMemo(() => preview && mapping ? validateLedgerCsv(preview, mapping) : { entries: [] as LedgerDraft[], errors: [] }, [preview, mapping])
  const signals = useMemo(() => activeMission && validation.errors.length === 0 ? analyzeLedger(validation.entries, activeMission) : [], [activeMission, validation])
  const activeMember = data.members.find((member) => member.role === role && member.isActive)

  function loadCsv(name: string, content: string) {
    setError(''); setMessage('')
    try {
      const next = parseCsv(content)
      if (next.rows.length > maximumCsvRows) throw new Error(`Le fichier dépasse la limite de ${maximumCsvRows.toLocaleString('fr-FR')} lignes.`)
      setFileName(name)
      setCsvText(content)
      setPreview(next)
      setMapping(suggestLedgerMapping(next.headers))
    } catch (cause) {
      setPreview(null); setMapping(null); setCsvText('')
      setError(cause instanceof Error ? cause.message : 'Le CSV ne peut pas être lu.')
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > maximumCsvBytes) { setError('Le fichier dépasse la limite de 5 Mio.'); return }
    try { loadCsv(file.name, await file.text()) }
    catch { setError('Le fichier sélectionné n’a pas pu être lu.') }
  }

  async function saveImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeMission || !mapping || !preview || validation.errors.length || !activeMember) return
    setBusy(true); setError(''); setMessage('')
    try {
      await importLedger(database, { mission: activeMission, fileName, csvText, mapping, entries: validation.entries, importedById: activeMember.id })
      await refresh()
      setMessage(`Import de démonstration enregistré : ${validation.entries.length} lignes ; ${signals.length} signal(aux) à investiguer.`)
      setPreview(null); setMapping(null); setCsvText(''); setFileName('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'L’import n’a pas pu être enregistré.') }
    finally { setBusy(false) }
  }

  async function reviewSignal(event: FormEvent<HTMLFormElement>, exception: AnalyticsException) {
    event.preventDefault()
    const draft = drafts[exception.id]
    if (!draft || !activeMember) return
    setBusy(true); setError(''); setMessage('')
    try {
      await documentAnalyticsReview(database, { exceptionId: exception.id, actorId: activeMember.id, linkedExecutionId: draft.executionId, status: draft.status, humanNote: draft.note })
      await refresh()
      setMessage('Décision humaine documentée et reliée au test sélectionné.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'La revue du signal n’a pas été enregistrée.') }
    finally { setBusy(false) }
  }

  async function exportSignals(job: ImportJob) {
    const exceptions = data.exceptions.filter((item) => item.importJobId === job.id)
    const entries = data.entries.filter((item) => item.importJobId === job.id)
    const content = buildSignalsCsv(job, exceptions, entries)
    downloadText(`signaux-${job.id}.csv`, content, 'text/csv;charset=utf-8')
    const timestamp = new Date().toISOString()
    await database.auditEvents.add({ id: `event-analytics-export-${job.id}-${timestamp}`, missionId: job.missionId, actorId: activeMember?.id ?? role, entityType: 'importJob', entityId: job.id, action: 'analytics-exported', summary: `Export CSV des signaux avec empreinte et lignes sources — ${job.fileName}.`, occurredAt: timestamp })
    setMessage('Export CSV des signaux téléchargé avec les lignes sources, l’empreinte et les décisions humaines.')
  }

  if (!activeMission) return <div className="state-card"><h1>Aucune mission ouverte</h1><Link className="text-link" to="/mission">Configurer une mission <ArrowRight aria-hidden="true" size={15} /></Link></div>
  if (state === 'loading') return <p className="state-card" role="status">Chargement des imports de la mission…</p>
  if (state === 'error') return <p className="state-card state-error" role="alert">Les imports et leurs lignes sources ne sont pas accessibles.</p>

  return <section className="imports-page" aria-labelledby="imports-title">
    <div className="page-heading"><div><span className="eyebrow">Population synthétique · traçabilité source</span><h1 id="imports-title">Imports & signaux analytiques</h1><p>Mappez un CSV, vérifiez l’équilibre débit/crédit et examinez des règles explicables.</p></div></div>
    <p className="form-disclosure">Un signal est uniquement « à investiguer ». Il ne constitue ni une fraude, ni une anomalie avérée ou significative. Les seuils et comptes inhabituels sont des règles pédagogiques, pas un référentiel comptable.</p>
    {message && <p className="form-success" role="status"><Check aria-hidden="true" size={15} />{message}</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}

    <form className="import-card card" onSubmit={(event) => void saveImport(event)}>
      <div className="form-section-heading"><div><span className="eyebrow">Importer une population</span><h2>CSV de grand livre fictif</h2></div><span className="fictitious-chip">Limite 5 Mio · 10 000 lignes</span></div>
      <div className="import-actions"><label className="button button-secondary import-file-button"><Upload aria-hidden="true" size={15} /> Choisir un fichier CSV<input accept=".csv,text/csv" aria-label="Choisir un fichier CSV" onChange={(event) => void onFileChange(event)} type="file" /></label><button className="button button-secondary" onClick={() => loadCsv('grand-livre-demo.csv', demoLedgerCsv)} type="button"><FileSpreadsheet aria-hidden="true" size={15} /> Charger le CSV synthétique</button>{fileName && <span className="catalog-muted">Fichier sélectionné : <strong>{fileName}</strong></span>}</div>
      {preview && mapping && <>
        <div className="section-heading"><div><span className="eyebrow">Aperçu · {preview.rows.length} lignes détectées</span><h2>Associer les colonnes</h2></div><span className="count-pill">Séparateur {preview.delimiter === ';' ? 'point-virgule' : 'virgule'}</span></div>
        <div className="mapping-grid">{LEDGER_COLUMNS.map(({ key, label }) => <label className="form-field" htmlFor={`mapping-${key}`} key={key}>{label} *<select id={`mapping-${key}`} aria-label={`Colonne CSV — ${label}`} onChange={(event) => setMapping((current) => current ? { ...current, [key]: event.target.value } : current)} value={mapping[key]}><option value="">— choisir une colonne —</option>{preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
        <div className="sample-table-wrap"><table className="sample-table"><caption>Aperçu des cinq premières lignes · références source = numéro réel de ligne CSV</caption><thead><tr><th>Ligne CSV</th>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 5).map((row) => <tr key={row.lineNumber}><td>{row.lineNumber}</td>{preview.headers.map((header, index) => <td key={`${row.lineNumber}-${header}`}>{row.values[index]}</td>)}</tr>)}</tbody></table></div>
        <div className="validation-panel" aria-live="polite">
          {validation.errors.length ? <><h3><CircleAlert aria-hidden="true" size={15} />{validation.errors.length} contrôle(s) à corriger</h3><ul>{validation.errors.slice(0, 12).map((item, index) => <li key={`${item.lineNumber}-${index}`}>{item.lineNumber ? `Ligne ${item.lineNumber} — ` : ''}{item.message}</li>)}</ul></> : <><h3><Check aria-hidden="true" size={15} />Contrôles structurels validés</h3><p>Débit : {validation.entries.reduce((sum, row) => sum + row.debit, 0).toLocaleString('fr-FR')} · Crédit : {validation.entries.reduce((sum, row) => sum + row.credit, 0).toLocaleString('fr-FR')} · {signals.length} signaux déterministes à investiguer.</p>{signals.length > 0 && <ul>{signals.slice(0, 8).map((signal, index) => <li key={`${signal.lineNumber}-${signal.ruleCode}-${index}`}>Ligne {signal.lineNumber} · {signal.ruleCode} — {signal.description}</li>)}</ul>}</>}
        </div>
        <div className="form-actions"><button className="button button-primary" disabled={busy || validation.errors.length > 0 || !validation.entries.length} type="submit"><Upload aria-hidden="true" size={15} />{busy ? 'Import en cours…' : 'Importer et enregistrer les sources'}</button></div>
      </>}
    </form>

    <section aria-labelledby="import-history-title"><div className="section-heading"><div><span className="eyebrow">Provenance conservée</span><h2 id="import-history-title">Imports enregistrés</h2></div><span className="count-pill">{data.jobs.length} import(s)</span></div>
      {!data.jobs.length && <p className="state-card">Aucun import pour cette mission. Le bouton « Charger le CSV synthétique » utilise des écritures fictives déterministes.</p>}
      <div className="import-job-list">{data.jobs.map((job) => {
        const jobExceptions = data.exceptions.filter((exception) => exception.importJobId === job.id).sort((a, b) => a.lineNumber - b.lineNumber || a.ruleCode.localeCompare(b.ruleCode))
        const jobEntries = data.entries.filter((entry) => entry.importJobId === job.id)
        return <article className="import-job card" key={job.id}>
          <div className="work-card-heading"><div><span className="eyebrow">{job.rowCount} lignes · importé le {new Date(job.createdAt).toLocaleString('fr-FR')}</span><h3>{job.fileName}</h3></div><span className="status-chip">{jobExceptions.length} signal(aux)</span></div>
          <div className="import-provenance"><span>Empreinte logique</span><code>{job.sourceFingerprint}</code><span>Débit / crédit</span><strong>{job.debitTotal.toLocaleString('fr-FR')} / {job.creditTotal.toLocaleString('fr-FR')}</strong><span>Mapping figé</span><span>{LEDGER_COLUMNS.map(({ key, label }) => `${label} ← ${job.columnMapping[key]}`).join(' · ')}</span></div>
          <div className="form-actions"><button className="button button-secondary" onClick={() => void exportSignals(job)} type="button"><Download aria-hidden="true" size={15} /> Exporter les signaux et leurs sources en CSV</button></div>
          <div className="analytics-signal-list">{jobExceptions.map((exception) => {
            const source = jobEntries.find((entry) => entry.id === exception.sourceEntryId)
            const draft = drafts[exception.id] ?? { executionId: '', status: 'explained' as const, note: '' }
            const linkedExecution = data.executions.find((execution) => execution.id === exception.linkedExecutionId)
            return <article className="analytics-signal" key={exception.id}>
              <div className="work-card-heading"><div><span className="eyebrow">{exception.ruleCode} · ligne CSV {exception.lineNumber}</span><h4>{exception.description}</h4></div><span className={`status-chip status-${exception.status}`}>{exception.status === 'to-investigate' ? 'À investiguer' : exception.status === 'explained' ? 'Expliqué — décision humaine' : 'Écarté — décision humaine'}</span></div>
              <p className="source-line">Source : <code>{job.fileName}#{exception.lineNumber}</code> · <code>{exception.sourceEntryId}</code> · Empreinte <code>{job.sourceFingerprint}</code>{source && <> · {source.entryDate} · {source.entryNumber} · compte {source.account} · débit {source.debit} · crédit {source.credit}</>}</p>
              {exception.linkedExecutionId && <p className="source-line">Test lié : <Link to="/programme">{linkedExecution?.title ?? 'Test de la mission'} · {exception.linkedExecutionId}</Link></p>}
              {exception.humanNote && <p className="review-response"><strong>Décision humaine conservée :</strong> {exception.humanNote}</p>}
              {exception.status === 'to-investigate' && <form className="signal-review-form" onSubmit={(event) => void reviewSignal(event, exception)}><label className="form-field">Test de la mission à lier *<select aria-label={`Test lié — ligne ${exception.lineNumber}`} onChange={(event) => setDrafts((current) => ({ ...current, [exception.id]: { ...draft, executionId: event.target.value } }))} required value={draft.executionId}><option value="">— choisir un test —</option>{data.executions.map((execution) => <option key={execution.id} value={execution.id}>{execution.title} · {execution.status}</option>)}</select></label><label className="form-field">Décision humaine documentée *<textarea aria-label={`Note de décision — ligne ${exception.lineNumber}`} maxLength={1000} onChange={(event) => setDrafts((current) => ({ ...current, [exception.id]: { ...draft, note: event.target.value } }))} placeholder="Décrire les éléments rapprochés ou le motif de non-retenue ; aucune qualification automatique." required value={draft.note} /></label><div className="signal-review-actions"><label className="form-field">Issue consignée<select aria-label={`Issue humaine — ligne ${exception.lineNumber}`} onChange={(event) => setDrafts((current) => ({ ...current, [exception.id]: { ...draft, status: event.target.value as 'explained' | 'dismissed' } }))} value={draft.status}><option value="explained">Éléments expliqués après examen</option><option value="dismissed">Signal non retenu, motif conservé</option></select></label><button className="button button-primary" disabled={busy || !draft.executionId || !draft.note.trim()} type="submit"><Check aria-hidden="true" size={15} /> Enregistrer la revue humaine</button></div></form>}
            </article>
          })}</div>
        </article>
      })}</div>
    </section>
  </section>
}

export { maximumCsvBytes, maximumCsvRows }
