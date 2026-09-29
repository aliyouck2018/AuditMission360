import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { database } from '../data/database'
import { resetDemoData } from '../data/demoService'

function renderCatalog() {
  return render(<MemoryRouter initialEntries={['/catalogue']}><App /></MemoryRouter>)
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
})

afterEach(cleanup)

describe('interface du catalogue et décisions humaines', () => {
  it('explique les candidats, filtre les cycles et ouvre les fiches liées', async () => {
    renderCatalog()
    expect(await screen.findByRole('heading', { name: 'Catalogue & risques candidats' })).toBeInTheDocument()
    expect((await screen.findAllByText('Pourquoi ce candidat ?')).length).toBeGreaterThan(0)
    expect(screen.getByText(/demeure un candidat jusqu’à une décision explicite/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Cycle')).toHaveValue('all')
    fireEvent.change(screen.getByLabelText('Cycle'), { target: { value: 'cycle-mission-demo-cemac-2025-inventory' } })
    expect(screen.getAllByRole('link', { name: 'Rapprochement d’un comptage simulé au registre' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Rapprochement facture, commande et livraison' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cycle'), { target: { value: 'all' } })
    fireEvent.click(screen.getAllByRole('link', { name: 'Rapprochement facture, commande et livraison' })[0])
    expect(await screen.findByRole('heading', { name: 'Rapprochement facture, commande et livraison' })).toBeInTheDocument()
    expect(screen.getByText(/Étapes adaptables/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Retour au catalogue/i })).toBeInTheDocument()
  }, 15000)

  it('exige une justification et conserve la confirmation humaine versionnée', async () => {
    renderCatalog()
    await screen.findByRole('heading', { name: 'Catalogue & risques candidats' })
    const riskHeading = screen.getByRole('heading', { name: 'Vente enregistrée sans éléments concordants', level: 3 })
    const card = riskHeading.closest('article')!
    const cardQueries = within(card)
    fireEvent.click(cardQueries.getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/justification humaine est requise/i)
    expect(await database.risks.get('risk-mission-demo-cemac-2025-sales-unsupported')).toMatchObject({ status: 'candidate', justification: null })

    fireEvent.change(cardQueries.getByLabelText(/Motif de la décision humaine/i), { target: { value: 'Contexte discuté par la responsable fictive.' } })
    fireEvent.click(cardQueries.getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/décision humaine enregistrée/i)
    expect(await database.risks.get('risk-mission-demo-cemac-2025-sales-unsupported')).toMatchObject({
      status: 'confirmed', justification: 'Contexte discuté par la responsable fictive.', catalogVersion: 'starter-1.0.0',
    })
    await waitFor(async () => expect(await database.auditEvents.where('entityId').equals('risk-mission-demo-cemac-2025-sales-unsupported').count()).toBe(1))
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'confirmed' } })
    expect(screen.getByRole('heading', { name: 'Vente enregistrée sans éléments concordants', level: 3 })).toBeInTheDocument()
  })

  it('permet d’ajouter une spécificité propre à la mission avec ses assertions', async () => {
    renderCatalog()
    await screen.findByRole('heading', { name: 'Catalogue & risques candidats' })
    const form = screen.getByRole('button', { name: /Ajouter à la mission/i }).closest('form')!
    const formQueries = within(form)
    fireEvent.change(formQueries.getByLabelText('Cycle *'), { target: { value: 'cycle-mission-demo-cemac-2025-sales-receivables' } })
    fireEvent.change(formQueries.getByLabelText('Intitulé *'), { target: { value: 'Risque propre au scénario fictif' } })
    fireEvent.change(formQueries.getByLabelText('Description *'), { target: { value: 'Description rédigée par une personne.' } })
    fireEvent.click(formQueries.getByLabelText(/Existence/))
    fireEvent.change(formQueries.getByLabelText('Justification *'), { target: { value: 'Information documentée lors de la compréhension.' } })
    fireEvent.click(formQueries.getByRole('button', { name: /Ajouter à la mission/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Spécificité de l’entité enregistrée/i)
    const specific = await database.risks.where('missionId').equals('mission-demo-cemac-2025').filter(({ code }) => code.startsWith('ENTITY-')).first()
    expect(specific).toMatchObject({ status: 'confirmed', title: 'Risque propre au scénario fictif', reviewStatus: 'draft' })
    expect(await database.riskAssertionLinks.where('riskId').equals(specific!.id).count()).toBe(1)
  })
})
