import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { database } from '../data/database'
import { DEMO_MISSION_ID } from '../data/demoSeed'
import { resetDemoData } from '../data/demoService'

function renderImports() {
  return render(<MemoryRouter initialEntries={['/imports']}><App /></MemoryRouter>)
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
  await database.procedureExecutions.add({
    id: 'execution-import-test', missionId: DEMO_MISSION_ID, cycleId: 'cycle-demo-cash', procedureTemplateId: 'template-demo', procedureTemplateVersion: '1.0.0',
    riskId: 'risk-demo', assertionIds: [], title: 'Rapprochement du journal fictif', objective: 'Examiner les signaux de la population', steps: [], expectedEvidence: [],
    sampleSeed: 'demo', sampleMethod: 'test déterministe', status: 'planned', assignedToId: null, reviewerId: null, dueDate: null, result: null, submittedAt: null,
    reviewedAt: null, reviewConclusion: null, createdAt: '2026-09-29T12:00:00.000Z', updatedAt: '2026-09-29T12:00:00.000Z',
  })
})

afterEach(cleanup)

describe('page Imports & analytics', () => {
  it('importe le CSV fictif équilibré, conserve les références et documente une décision humaine liée à un test', async () => {
    renderImports()
    expect(await screen.findByRole('heading', { name: 'Imports & signaux analytiques' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /charger le csv synthétique/i }))

    expect(screen.getByRole('heading', { name: 'Associer les colonnes' })).toBeInTheDocument()
    expect(screen.getByText(/Débit : 2 425 000 · Crédit : 2 425 000/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /importer et enregistrer les sources/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /importer et enregistrer les sources/i }))

    expect(await screen.findByText(/import de démonstration enregistré/i)).toBeInTheDocument()
    await waitFor(async () => expect(await database.ledgerEntries.count()).toBe(6))
    expect(await database.analyticsExceptions.count()).toBeGreaterThan(0)
    const pendingSignal = await database.analyticsExceptions.where('ruleCode').equals('POSSIBLE_DUPLICATE').first()
    expect(pendingSignal).toMatchObject({ status: 'to-investigate', lineNumber: 4, humanNote: null, linkedExecutionId: null })

    const signal = await screen.findByText(/POSSIBLE_DUPLICATE\s*· ligne CSV\s*4/i)
    const card = signal.closest<HTMLElement>('.analytics-signal')!
    fireEvent.change(within(card).getByLabelText('Test lié — ligne 4'), { target: { value: 'execution-import-test' } })
    fireEvent.change(within(card).getByLabelText('Note de décision — ligne 4'), { target: { value: 'Référence rapprochée au justificatif synthétique de la procédure.' } })
    fireEvent.click(within(card).getByRole('button', { name: /enregistrer la revue humaine/i }))

    await waitFor(async () => expect(await database.analyticsExceptions.get(pendingSignal!.id)).toMatchObject({
      status: 'explained', linkedExecutionId: 'execution-import-test', humanDecision: 'explained',
      humanNote: 'Référence rapprochée au justificatif synthétique de la procédure.',
    }))
    expect(await database.auditEvents.where('action').equals('analytics-signal-reviewed').count()).toBe(1)
    expect(await database.auditEvents.where('entityType').equals('importJob').count()).toBe(1)
  })

  it('empêche un import déséquilibré après validation de mapping', async () => {
    renderImports()
    await screen.findByRole('heading', { name: 'Imports & signaux analytiques' })
    fireEvent.click(screen.getByRole('button', { name: /charger le csv synthétique/i }))
    fireEvent.change(screen.getByLabelText('Colonne CSV — Débit'), { target: { value: '' } })

    expect(screen.getByText(/colonne requise non mappée : débit/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /importer et enregistrer les sources/i })).toBeDisabled()
    expect(await database.importJobs.count()).toBe(0)
  })
})
