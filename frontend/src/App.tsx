import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, BriefcaseBusiness, ChartNoAxesCombined, ClipboardCheck, ClipboardList, FileCheck2, FileText, Leaf, RotateCcw, ShieldCheck } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { repositories } from './data/repositories'
import type { Cycle } from './domain/types'
import { demoRoles, useWorkspace, WorkspaceProvider } from './workspace/WorkspaceContext'

const MissionPage = lazy(() => import('./pages/MissionPage').then(({ MissionPage }) => ({ default: MissionPage })))
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(({ CatalogPage }) => ({ default: CatalogPage })))
const CatalogDetailPage = lazy(() => import('./pages/CatalogPage').then(({ CatalogDetailPage }) => ({ default: CatalogDetailPage })))
const WorkProgramPage = lazy(() => import('./pages/WorkProgramPage').then(({ WorkProgramPage }) => ({ default: WorkProgramPage })))
const MethodologyPage = lazy(() => import('./pages/MethodologyPage').then(({ MethodologyPage }) => ({ default: MethodologyPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(({ DocumentsPage }) => ({ default: DocumentsPage })))
const ImportsPage = lazy(() => import('./pages/ImportsPage').then(({ ImportsPage }) => ({ default: ImportsPage })))
const ClosingPage = lazy(() => import('./pages/ClosingPage').then(({ ClosingPage }) => ({ default: ClosingPage })))

const navigation = [
  { to: '/', label: 'Cockpit', icon: Leaf },
  { to: '/mission', label: 'Mission', icon: BriefcaseBusiness },
  { to: '/catalogue', label: 'Catalogue & risques', icon: ClipboardList },
  { to: '/programme', label: 'Programme & revue', icon: ClipboardCheck },
  { to: '/methodologie', label: 'Méthodologie', icon: BookOpen },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/imports', label: 'Imports & analytics', icon: ChartNoAxesCombined },
  { to: '/cloture', label: 'Clôture & dossier', icon: FileCheck2 },
]

const routeTitles: Record<string, string> = {
  '/': 'Cockpit',
  '/mission': 'Mission',
  '/catalogue': 'Catalogue & risques',
  '/programme': 'Programme de travail',
  '/methodologie': 'Méthodologie',
  '/documents': 'Documents',
  '/imports': 'Imports & analytics',
  '/cloture': 'Clôture & dossier',
}

function HomePage() {
  const { activeMission } = useWorkspace()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleState, setCycleState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let current = true
    if (!activeMission) {
      setCycles([])
      setCycleState('ready')
      return () => { current = false }
    }
    setCycleState('loading')
    repositories.cycles.listForMission(activeMission.id).then((items) => {
      if (current) {
        setCycles(items.sort((left, right) => left.position - right.position))
        setCycleState('ready')
      }
    }).catch(() => {
      if (current) setCycleState('error')
    })
    return () => { current = false }
  }, [activeMission])

  return (
    <section className="cockpit-page" aria-labelledby="cockpit-title">
      <div className="page-heading cockpit-heading">
        <div>
          <span className="eyebrow">Vue d’ensemble</span>
          <h1 id="cockpit-title">Cockpit de mission</h1>
          <p>Un aperçu du contexte de travail fictif et de ses cycles.</p>
        </div>
        <Link className="button button-primary" to="/mission">Ouvrir la mission <ArrowRight aria-hidden="true" size={16} /></Link>
      </div>

      {activeMission ? (
        <>
          <article className="active-mission-card card">
            <div className="active-mission-copy">
              <span className="eyebrow">Mission active · {activeMission.status === 'planning' ? 'Planification' : activeMission.status === 'in-progress' ? 'En cours' : 'Terminée'}</span>
              <h2>{activeMission.name}</h2>
              <p>{activeMission.entityName} <span>·</span> {activeMission.country} <span>·</span> {activeMission.sector}</p>
            </div>
            <div className="mission-period"><span>Exercice</span><strong>{activeMission.periodStart} — {activeMission.periodEnd}</strong></div>
            <div className="mission-framework"><span>Référentiel pédagogique</span><strong>{activeMission.framework} · {activeMission.frameworkVersion}</strong></div>
          </article>

          <div className="section-heading">
            <div><span className="eyebrow">Dossier</span><h2>Cycles de la mission</h2></div>
            <span className="count-pill">{cycles.length} cycles</span>
          </div>
          {cycleState === 'loading' && <p className="state-card" role="status">Chargement des cycles…</p>}
          {cycleState === 'error' && <p className="state-card state-error" role="alert">Les cycles ne sont pas accessibles pour le moment.</p>}
          {cycleState === 'ready' && cycles.length === 0 && <p className="state-card">Aucun cycle n’est associé à cette mission.</p>}
          {cycleState === 'ready' && cycles.length > 0 && (
            <div className="cycle-grid">
              {cycles.map((cycle) => (
                <article className="cycle-card card" key={cycle.id}>
                  <span className="cycle-number">{String(cycle.position).padStart(2, '0')}</span>
                  <div><h3>{cycle.name}</h3><p>{cycle.description}</p></div>
                  <span className="cycle-status">À démarrer</span>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="state-card"><h2>Aucune mission ouverte</h2><p>Créez ou ouvrez une mission fictive pour commencer.</p><Link className="text-link" to="/mission">Configurer une mission <ArrowRight aria-hidden="true" size={16} /></Link></div>
      )}
    </section>
  )
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-card" aria-labelledby="placeholder-title">
      <span className="placeholder-icon"><BriefcaseBusiness aria-hidden="true" size={21} /></span>
      <span className="eyebrow">Espace en préparation</span>
      <h1 id="placeholder-title">{title}</h1>
      <p>{description}</p>
      <span className="placeholder-note">Vérifiez l’adresse ou revenez au cockpit pour poursuivre.</span>
    </section>
  )
}

function WorkspaceState() {
  const { status, error, retryInitialization } = useWorkspace()
  if (status === 'loading') return <div className="state-card" role="status">Chargement de la démonstration locale…</div>
  if (status === 'error') return <div className="state-card state-error" role="alert"><h1>Chargement impossible</h1><p>{error}</p><button className="button button-primary" onClick={retryInitialization} type="button">Réessayer</button></div>
  return null
}

function AppShell() {
  const { pathname } = useLocation()
  const { status, error, role, setRole, activeMission, resetDemo } = useWorkspace()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const resetCancelRef = useRef<HTMLButtonElement>(null)
  const resetDialogRef = useRef<HTMLElement>(null)
  const dialogWasOpen = useRef(false)
  const resettingRef = useRef(resetting)
  resettingRef.current = resetting

  useEffect(() => {
    if (!confirmReset) {
      if (dialogWasOpen.current) resetTriggerRef.current?.focus()
      dialogWasOpen.current = false
      return
    }

    dialogWasOpen.current = true
    resetCancelRef.current?.focus()
    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !resettingRef.current) {
        event.preventDefault()
        setConfirmReset(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(resetDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      if (!focusable.length) {
        event.preventDefault()
        resetDialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => document.removeEventListener('keydown', handleDialogKeyDown)
  }, [confirmReset])

  async function handleReset() {
    setResetting(true)
    setResetError(null)
    setResetNotice(null)
    try {
      await resetDemo()
      setConfirmReset(false)
      setResetNotice('La démonstration a retrouvé son état initial fictif.')
    } catch {
      setResetError('La réinitialisation a échoué. Réessayez.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Aller au contenu principal</a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="AuditMission360, accueil">
          <span className="brand-mark"><Leaf aria-hidden="true" size={21} /></span>
          <span className="brand-name">AuditMission<span>360</span></span>
        </Link>

        <div className="sidebar-label">ESPACE DE TRAVAIL</div>
        <nav className="navigation" aria-label="Navigation principale">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end={to === '/'} key={to} to={to}>
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="footer-mark"><ShieldCheck aria-hidden="true" size={17} /></span>
          <p>Les profils et données sont fictifs. Ce sélecteur ne protège pas l’accès au dossier.</p>
        </div>
      </aside>

      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb"><span>AuditMission360</span><span className="breadcrumb-separator">/</span><strong>{routeTitles[pathname] ?? 'Espace de travail'}</strong></div>
          <div className="topbar-actions">
            <label className="role-picker" htmlFor="demo-role"><span>Profil fictif</span>
              <select id="demo-role" onChange={(event) => setRole(event.target.value as typeof role)} value={role}>
                {demoRoles.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <span className="demo-badge"><span className="status-dot" /> Démonstration <span className="badge-divider">·</span> données fictives</span>
            <button className="reset-button" onClick={() => { setConfirmReset(true); setResetError(null) }} ref={resetTriggerRef} type="button"><RotateCcw aria-hidden="true" size={15} /><span>Réinitialiser</span></button>
          </div>
        </header>
        {activeMission && <div className="current-mission-strip">Mission ouverte : <strong>{activeMission.name}</strong></div>}
        <div className="page-content">
          <WorkspaceState />
          {status === 'ready' && (
            <Suspense fallback={<p className="state-card" role="status">Chargement de la section…</p>}>
              <Routes>
                <Route element={<HomePage />} path="/" />
                <Route element={<MissionPage />} path="/mission" />
                <Route element={<CatalogPage />} path="/catalogue" />
                <Route element={<CatalogDetailPage />} path="/catalogue/:kind/:code" />
                <Route element={<WorkProgramPage />} path="/programme" />
                <Route element={<MethodologyPage />} path="/methodologie" />
                <Route element={<DocumentsPage />} path="/documents" />
                <Route element={<ImportsPage />} path="/imports" />
                <Route element={<ClosingPage />} path="/cloture" />
                <Route element={<PlaceholderPage title="Page introuvable" description="Cette adresse ne correspond à aucune section de l’espace de travail." />} path="*" />
              </Routes>
            </Suspense>
          )}
          {error && <span className="sr-only">{error}</span>}
          {resetNotice && <p className="toast-success" role="status">{resetNotice}</p>}
        </div>
        <footer className="page-footer">AuditMission360 <span>·</span> Démonstrateur de mission d’audit</footer>
      </main>

      {confirmReset && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" aria-describedby="reset-description" aria-labelledby="reset-title" aria-modal="true" ref={resetDialogRef} role="alertdialog" tabIndex={-1}>
            <span className="placeholder-icon"><RotateCcw aria-hidden="true" size={20} /></span>
            <h2 id="reset-title">Réinitialiser la démonstration ?</h2>
            <p id="reset-description">Les données locales seront remplacées par le scénario fictif de départ. Cette action ne concerne que cette démonstration.</p>
            {resetError && <p className="form-alert" role="alert">{resetError}</p>}
            <div className="dialog-actions">
              <button className="button button-secondary" disabled={resetting} onClick={() => setConfirmReset(false)} ref={resetCancelRef} type="button">Annuler</button>
              <button className="button button-primary" disabled={resetting} onClick={() => void handleReset()} type="button">{resetting ? 'Réinitialisation…' : 'Confirmer la réinitialisation'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function App() {
  return <WorkspaceProvider><AppShell /></WorkspaceProvider>
}

export default App
