import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { database } from '../data/database'
import { demoMission, DEMO_MISSION_ID } from '../data/demoSeed'
import { resetDemoData } from '../data/demoService'
import { assignProcedure } from '../program/workProgramService'
import { recordRiskDecision } from '../catalog/catalogService'
import { WorkspaceProvider } from '../workspace/WorkspaceContext'
import { DocumentsPage } from './DocumentsPage'

function renderDocuments() {
  return render(<MemoryRouter><WorkspaceProvider><DocumentsPage /></WorkspaceProvider></MemoryRouter>)
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
  const risk = await database.risks.where('code').equals('SALES-UNSUPPORTED').first()
  const assertion = await database.assertions.where('code').equals('OCCURRENCE').first()
  const template = await database.procedureTemplates.where('code').equals('SALES-VOUCHING').first()
  await recordRiskDecision(database, risk!, 'confirmed', 'Risque fictif confirmé pour le test d’export.', 'member-demo-manager')
  const execution = await assignProcedure(database, {
    missionId: DEMO_MISSION_ID, procedureTemplateId: template!.id, riskId: risk!.id, assertionId: assertion!.id,
    preparerId: 'member-demo-preparer', reviewerId: 'member-demo-reviewer', dueDate: null,
    populationName: 'Factures de vente fictives', populationDescription: 'Population synthétique de test.', populationSize: 12, sampleSize: 2,
    assignedById: 'member-demo-manager',
  })
  expect(execution).toBeDefined()
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('bibliothèque des documents', () => {
  it('prévisualise et imprime une lettre non signée puis une feuille liée aux travaux et aux sources', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    renderDocuments()

    expect(await screen.findByRole('heading', { name: 'Lettre de mission — brouillon' })).toBeInTheDocument()
    await waitFor(async () => expect(await database.documentTemplates.count()).toBe(8))
    expect(screen.getByText(/non signée et non envoyée/i)).toBeInTheDocument()
    expect(screen.getByText(/champ\(s\) obligatoire\(s\) manquant\(s\)/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Destinataire fictif'), { target: { value: 'Destinataire de démonstration' } })
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser le brouillon' }))

    expect(screen.getByRole('heading', { name: 'Lettre de mission — brouillon' })).toBeInTheDocument()
    expect(screen.getAllByText(/NON SIGNÉ \/ NON ENVOYÉ/).length).toBeGreaterThan(0)
    expect(screen.getByText('Destinataire de démonstration')).toBeInTheDocument()
    expect(screen.getByText(/DONNÉES SYNTHÉTIQUES · DOCUMENT SIMULÉ/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Imprimer \/ Enregistrer en PDF/i }))
    expect(await screen.findByText(/Brouillon de démonstration enregistré et journalisé/i)).toBeInTheDocument()
    expect(print).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retour au brouillon' }))
    fireEvent.click(screen.getByRole('button', { name: /Feuille de travail/ }))
    expect(await screen.findByRole('heading', { name: 'Feuille de travail' })).toBeInTheDocument()
    expect(screen.getByLabelText('Objectif et étendue revus')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Objectif et étendue revus'), { target: { value: 'Revue de démonstration.' } })
    fireEvent.change(screen.getByLabelText('Référence de preuve examinée'), { target: { value: 'PIECE-DEMO-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Prévisualiser le brouillon' }))

    expect(screen.getByText(/PIECE-DEMO-01/)).toBeInTheDocument()
    expect(screen.getByText(/procedureExecution:/)).toBeInTheDocument()
    expect(screen.getAllByText(/sampleItem:/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Revue de démonstration/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Imprimer \/ Enregistrer en PDF/i }))
    await waitFor(async () => expect(await database.generatedDocuments.count()).toBe(2))
    expect(print).toHaveBeenCalledTimes(2)

    const documents = await database.generatedDocuments.where('missionId').equals(demoMission.id).toArray()
    const worksheet = documents.find(({ templateId }) => templateId === 'template-demo-working-paper')!
    expect(worksheet).toMatchObject({ templateVersion: '1.0.0', isFictitious: true })
    expect(worksheet.sourceReferences.map(({ entityType }) => entityType)).toContain('procedureExecution')
    expect(worksheet.sourceReferences.map(({ entityType }) => entityType)).toContain('sampleItem')
    expect(await database.auditEvents.where('action').equals('document-exported').count()).toBe(2)
  })
})
