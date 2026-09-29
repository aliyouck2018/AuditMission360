import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { database } from '../data/database'
import { DEMO_MISSION_ID } from '../data/demoSeed'
import { resetDemoData } from '../data/demoService'

function renderClosing() {
  return render(<MemoryRouter initialEntries={['/cloture']}><App /></MemoryRouter>)
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
  await database.procedureExecutions.add({
    id: 'execution-closing-test', missionId: DEMO_MISSION_ID, cycleId: 'cycle-demo-cash', procedureTemplateId: 'template-demo', procedureTemplateVersion: '1.0.0',
    riskId: 'risk-demo', assertionIds: [], title: 'Rapprochement de démonstration', objective: 'Test fictif', steps: [], expectedEvidence: [],
    sampleSeed: 'demo', sampleMethod: 'test', status: 'planned', assignedToId: null, reviewerId: null, dueDate: null, result: null, submittedAt: null,
    reviewedAt: null, reviewConclusion: null, createdAt: '2026-09-29T12:00:00.000Z', updatedAt: '2026-09-29T12:00:00.000Z',
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('page de clôture et registre des constats', () => {
  it('montre les blocages, crée un constat complet et n’autorise sa résolution qu’après son suivi', async () => {
    renderClosing()
    expect(await screen.findByRole('heading', { name: 'Clôture de démonstration' })).toBeInTheDocument()
    expect(screen.getByText('Procédures revues')).toBeInTheDocument()
    expect(screen.getAllByText(/1 procédure\(s\) n’ont pas encore le statut/i)).toHaveLength(2)
    const finalizeButton = screen.getByRole('button', { name: /finaliser le workflow de démonstration/i })
    expect(finalizeButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Titre du constat *'), { target: { value: 'Écart de démonstration à rapprocher' } })
    fireEvent.change(screen.getByLabelText('Responsable fictif *'), { target: { value: 'Samira — rôle fictif' } })
    fireEvent.change(screen.getByLabelText('Délai de suivi *'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Faits observés *'), { target: { value: 'Une écriture fictive nécessite un rapprochement de pièce.' } })
    fireEvent.change(screen.getByLabelText('Critère et référence à confirmer *'), { target: { value: 'Référence interne de la procédure de démonstration.' } })
    fireEvent.change(screen.getByLabelText('Cause documentée *'), { target: { value: 'Cause en attente de validation humaine.' } })
    fireEvent.change(screen.getByLabelText('Risque / impact indicatif *'), { target: { value: 'Impact indicatif, sans seuil ni significativité calculés.' } })
    fireEvent.change(screen.getByLabelText('Recommandation *'), { target: { value: 'Rapprocher la pièce et documenter le résultat.' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le constat et son suivi/i }))

    const findingTitle = 'Écart de démonstration à rapprocher'
    await screen.findByRole('heading', { name: findingTitle })
    const currentCard = () => screen.getByRole('heading', { name: findingTitle }).closest<HTMLElement>('.finding-card')!
    expect(within(currentCard()).getByText('Référence interne de la procédure de démonstration.')).toBeInTheDocument()
    expect(await database.findings.where('missionId').equals(DEMO_MISSION_ID).count()).toBe(1)
    expect((await database.actionPlans.where('missionId').equals(DEMO_MISSION_ID).first())?.status).toBe('open')
    expect(within(currentCard()).getByRole('button', { name: /marquer le constat résolu/i })).toBeDisabled()

    fireEvent.click(within(currentCard()).getByRole('button', { name: /marquer le suivi réalisé/i }))
    await waitFor(async () => expect((await database.actionPlans.where('missionId').equals(DEMO_MISSION_ID).first())?.status).toBe('completed'))
    fireEvent.click(within(currentCard()).getByRole('button', { name: /marquer le constat résolu/i }))
    await waitFor(async () => expect((await database.findings.where('missionId').equals(DEMO_MISSION_ID).first())?.status).toBe('resolved'))

    fireEvent.change(screen.getByLabelText('Filtrer les constats'), { target: { value: 'resolved' } })
    expect(screen.getByRole('heading', { name: findingTitle })).toBeInTheDocument()
    expect(screen.getByText(/impact reste indicatif/i)).toBeInTheDocument()
    expect(finalizeButton).toBeDisabled()
  }, 15000)

  it('prévisualise et enregistre le dossier simulé avant impression PDF avec statut/version et index de sources', async () => {
    renderClosing()
    await screen.findByRole('heading', { name: 'Clôture de démonstration' })

    expect(screen.getByText('Dossier simulé · version 1.0.0')).toBeInTheDocument()
    expect(screen.getByText(/démonstration · données synthétiques/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Index des pièces' })).toBeInTheDocument()
    expect(within(document.getElementById('closing-print-preview')!).getByRole('link', { name: /rapprochement de démonstration/i })).toHaveAttribute('href', `#index-procedureExecution-execution-closing-test`)
    expect(screen.getByRole('button', { name: /exporter le dossier html et son index/i })).toBeEnabled()
    const printButton = screen.getByRole('button', { name: /enregistrer le dossier en pdf/i })
    expect(printButton).toBeEnabled()
    expect(screen.getByText(/n’en mesure pas la qualité/i)).toBeInTheDocument()

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    fireEvent.click(printButton)
    await waitFor(async () => expect(await database.generatedDocuments.count()).toBe(1))
    expect(print).toHaveBeenCalledTimes(1)
    expect(await database.generatedDocuments.toCollection().first()).toMatchObject({ isFictitious: true, templateVersion: '1.0.0' })
    expect(await database.auditEvents.where('action').equals('document-exported').count()).toBe(1)
  })

  it('finalise uniquement l’état local de démonstration quand les objets enregistrés ne présentent plus de blocage', async () => {
    const execution = await database.procedureExecutions.get('execution-closing-test')
    await database.procedureExecutions.put({ ...execution!, status: 'reviewed' })
    renderClosing()
    await screen.findByRole('heading', { name: 'Clôture de démonstration' })
    const finalizeButton = await screen.findByRole('button', { name: /finaliser le workflow de démonstration/i })
    expect(finalizeButton).toBeEnabled()
    fireEvent.click(finalizeButton)

    await waitFor(async () => {
      expect(await database.missions.get(DEMO_MISSION_ID)).toMatchObject({ status: 'completed' })
      expect(await database.auditEvents.where('action').equals('demo-mission-finalized').count()).toBe(1)
    })
    expect(await screen.findByText(/workflow de démonstration finalisé/i)).toBeInTheDocument()
    expect(screen.getByText(/ne représente ni une clôture professionnelle/i)).toBeInTheDocument()
  })
})
