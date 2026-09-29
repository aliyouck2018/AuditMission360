import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { database } from '../data/database'
import { recordRiskDecision } from '../catalog/catalogService'
import { resetDemoData } from '../data/demoService'

function renderProgram() {
  return render(<MemoryRouter initialEntries={['/programme']}><App /></MemoryRouter>)
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
  const risk = await database.risks.where('code').equals('SALES-UNSUPPORTED').first()
  await recordRiskDecision(database, risk!, 'confirmed', 'Contexte fictif examiné par la responsable.', 'member-demo-manager')
})

afterEach(cleanup)

describe('parcours de programme, preuve et revue dans l’interface', () => {
  it('exécute un travail fictif de bout en bout avec préparateur et réviseur distincts', async () => {
    renderProgram()
    expect(await screen.findByRole('heading', { name: 'Travaux, preuves & revue' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Affecter le travail/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/travail affecté avec un échantillon/i)
    await waitFor(async () => expect(await database.procedureExecutions.count()).toBe(1))
    const [execution] = await database.procedureExecutions.toArray()
    expect(execution).toMatchObject({ status: 'planned', assignedToId: 'member-demo-preparer', reviewerId: 'member-demo-reviewer' })

    fireEvent.change(screen.getByLabelText('Profil fictif'), { target: { value: 'preparer' } })
    fireEvent.click(await screen.findByRole('button', { name: /Démarrer les travaux/i }))
    await screen.findByText('Travail démarré par le préparateur désigné.')
    const samples = await database.sampleItems.where('executionId').equals(execution.id).toArray()
    for (const sample of samples) {
      const result = await screen.findByLabelText(`Résultat ${sample.reference}`)
      fireEvent.change(result, { target: { value: 'consistent' } })
      const row = result.closest('tr')!
      fireEvent.change(within(row).getByLabelText(`Observation ${sample.reference}`), { target: { value: `Rapprochement fictif documenté ${sample.reference}.` } })
      fireEvent.click(within(row).getByRole('button', { name: 'Enregistrer' }))
      await waitFor(async () => expect((await database.sampleItems.get(sample.id))?.result).toBe('consistent'))
    }
    fireEvent.change(screen.getByLabelText('Résultat descriptif du travail *'), { target: { value: 'Résultats synthétiques rapprochés pour revue.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }))
    await screen.findByText('Résultat descriptif enregistré.')

    fireEvent.change(screen.getByLabelText('Libellé *'), { target: { value: 'Pièce de vente fictive' } })
    fireEvent.change(screen.getByLabelText('Référence *'), { target: { value: 'DEMO-FAC-001' } })
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Document synthétique de démonstration.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lier la référence' }))
    await screen.findByText('Référence fictive liée au travail.')
    expect(await database.evidenceReferences.where('executionId').equals(execution.id).count()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Soumettre à la revue/i }))
    await screen.findByText(/Travail soumis à la revue/i)
    expect((await database.procedureExecutions.get(execution.id))?.status).toBe('submitted')
    fireEvent.change(screen.getByLabelText('Profil fictif'), { target: { value: 'reviewer' } })
    fireEvent.change(await screen.findByLabelText('Demande / question du réviseur *'), { target: { value: 'Confirmer la référence de la pièce fictive.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir une note' }))
    await screen.findByText('Demande de revue adressée au préparateur.')
    const note = (await database.reviewNotes.where('executionId').equals(execution.id).toArray())[0]
    expect(note).toMatchObject({ status: 'open', authorId: 'member-demo-reviewer', assignedToId: 'member-demo-preparer' })

    fireEvent.change(screen.getByLabelText('Profil fictif'), { target: { value: 'preparer' } })
    fireEvent.change(await screen.findByLabelText('Réponse du préparateur *'), { target: { value: 'La référence DEMO-FAC-001 correspond à la pièce synthétique jointe.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la réponse' }))
    await screen.findByText('Réponse du préparateur enregistrée et conservée dans la note.')
    expect(await database.reviewNotes.get(note.id)).toMatchObject({ status: 'answered', response: expect.stringContaining('DEMO-FAC-001') })

    fireEvent.change(screen.getByLabelText('Profil fictif'), { target: { value: 'reviewer' } })
    fireEvent.click(await screen.findByRole('button', { name: /Résoudre la note/i }))
    await screen.findByText('Note résolue; question, réponse et réviseur conservés.')
    fireEvent.change(screen.getByLabelText('Conclusion du réviseur *'), { target: { value: 'Réponse consultée; note résolue par le réviseur fictif.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme revu' }))
    await screen.findByText('Revue terminée avec une conclusion humaine tracée.')

    expect(await database.procedureExecutions.get(execution.id)).toMatchObject({ status: 'reviewed', reviewedAt: expect.any(String), reviewConclusion: expect.stringContaining('note résolue') })
    expect(await database.reviewNotes.get(note.id)).toMatchObject({ status: 'resolved', response: expect.stringContaining('DEMO-FAC-001') })
    expect(await database.evidenceReferences.where('executionId').equals(execution.id).first()).toMatchObject({ reference: 'DEMO-FAC-001', executionId: execution.id })
  }, 30000)
})
