import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { database } from './data/database'
import { demoMission } from './data/demoSeed'
import { resetDemoData } from './data/demoService'

function renderApp(initialEntry = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  )
}

function findHeading(name: string) {
  return screen.findByRole('heading', { name }, { timeout: 10000 })
}

beforeEach(async () => {
  window.localStorage.removeItem('auditmission360-demo-role')
  await resetDemoData(database)
})

afterEach(cleanup)

describe('shell AuditMission360', () => {
  it('affiche le cockpit, la mission active et le bandeau fictif', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Cockpit de mission' })).toBeInTheDocument()
    expect(screen.getByText(/démonstration.*données fictives/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: demoMission.name })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /ventes et créances/i })).toBeInTheDocument()
  })

  it('affiche un état explicite pour une route inconnue', async () => {
    const path = '/route-inexistante'
    const title = 'Page introuvable'
    renderApp(path)

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(/vérifiez l’adresse ou revenez au cockpit/i)).toBeInTheDocument()
    expect(screen.getByText(/démonstration.*données fictives/i)).toBeInTheDocument()
  })

  it('parcourt toutes les routes de navigation et fournit un accès direct au contenu', async () => {
    renderApp()

    const skipLink = screen.getByRole('link', { name: 'Aller au contenu principal' })
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1')

    const routes = [
      { label: 'Cockpit', heading: 'Cockpit de mission', path: '/' },
      { label: 'Mission', heading: 'Informations de la mission', path: '/mission' },
      { label: 'Catalogue & risques', heading: 'Catalogue & risques candidats', path: '/catalogue' },
      { label: 'Programme & revue', heading: 'Travaux, preuves & revue', path: '/programme' },
      { label: 'Méthodologie', heading: 'Méthodologie d’audit', path: '/methodologie' },
      { label: 'Documents', heading: 'Documents de travail', path: '/documents' },
      { label: 'Imports & analytics', heading: 'Imports & signaux analytiques', path: '/imports' },
      { label: 'Clôture & dossier', heading: 'Clôture de démonstration', path: '/cloture' },
    ]

    for (const route of routes) {
      fireEvent.click(screen.getByRole('link', { name: route.label }))
      expect(await findHeading(route.heading)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: route.label })).toHaveAttribute('href', route.path)
      expect(screen.getByRole('link', { name: route.label })).toHaveAttribute('aria-current', 'page')
    }
  }, 30000)

  it('ouvre la bibliothèque de documents versionnés de la mission fictive', async () => {
    renderApp('/documents')

    expect(await screen.findByRole('heading', { name: 'Documents de travail' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lettre de mission — brouillon' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bibliothèque des modèles')).toHaveTextContent('8 modèles')
    expect(screen.getByText(/lettre reste non signée et non envoyée/i)).toBeInTheDocument()
    expect(screen.getByText(/démonstration.*données fictives/i)).toBeInTheDocument()
  })

  it('présente les étapes méthodologiques, leurs fiches officielles et le statut prudent des révisions', async () => {
    renderApp('/methodologie')

    expect(await findHeading('Méthodologie d’audit')).toBeInTheDocument()
    for (const heading of ['Acceptation et maintien', 'Planification et matérialité', 'Compréhension et risques', 'Réponses et contrôles', 'Éléments probants et tests', 'Évaluation et clôture', 'Communication et rapport']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByRole('navigation', { name: 'Étapes de la méthodologie' })).toBeInTheDocument()
    expect(screen.getByText(/ne reproduit pas les textes protégés/i)).toBeInTheDocument()
    expect(screen.getAllByText(/15 décembre 2026/)).toHaveLength(3)

    const standardLinks = screen.getAllByRole('link', { name: /source officielle IAASB/i })
    expect(standardLinks.length).toBeGreaterThanOrEqual(20)
    for (const link of standardLinks) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
      expect(link.getAttribute('href')).toMatch(/^https:\/\/(www\.)?iaasb\.org\//)
    }
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.method-reference-link')) {
      expect(document.getElementById(decodeURIComponent(link.hash.slice(1)))).toBeInTheDocument()
    }
    expect(screen.getAllByRole('link', { name: /source officielle OHADA/i })).toHaveLength(2)
    expect(screen.getAllByText(/Règlement OHADA n° 01\/2017\/CM\/OHADA/).length).toBeGreaterThan(2)
    const revisedIsaLink = screen.getByRole('link', { name: 'ISA 240 (révisée)' })
    expect(document.getElementById(decodeURIComponent(revisedIsaLink.getAttribute('href')!.slice(1)))).toBeInTheDocument()
  })

  it('navigue du cockpit au formulaire de mission', async () => {
    renderApp()

    fireEvent.click(await screen.findByRole('link', { name: /ouvrir la mission/i }))

    expect(await screen.findByRole('heading', { name: 'Informations de la mission' })).toBeInTheDocument()
    expect(screen.getByLabelText(/pays/i)).toHaveValue('Cameroun')
  })

  it('change le rôle d’expérience locale et l’identifie comme fictif', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Cockpit de mission' })

    fireEvent.change(screen.getByLabelText('Profil fictif'), { target: { value: 'reviewer' } })

    expect(screen.getByLabelText('Profil fictif')).toHaveValue('reviewer')
    expect(window.localStorage.getItem('auditmission360-demo-role')).toBe('reviewer')
    expect(screen.getByText(/ne protège pas l’accès/i)).toBeInTheDocument()
  })

  it('crée une nouvelle mission fictive et la rend active', async () => {
    renderApp('/mission')
    await screen.findByRole('heading', { name: 'Informations de la mission' })
    fireEvent.click(screen.getByRole('button', { name: /nouvelle mission/i }))

    fireEvent.change(screen.getByLabelText('Nom de la mission *'), { target: { value: 'Revue fictive 2026' } })
    fireEvent.change(screen.getByLabelText('Entité fictive *'), { target: { value: 'Atlas Démo SARL' } })
    fireEvent.change(screen.getByLabelText('Pays *'), { target: { value: 'Gabon' } })
    fireEvent.change(screen.getByLabelText('Secteur *'), { target: { value: 'Services' } })
    fireEvent.change(screen.getByLabelText('Début de période *'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Fin de période *'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('Devise (code ISO) *'), { target: { value: 'XAF' } })
    fireEvent.change(screen.getByLabelText('Référentiel comptable *'), { target: { value: 'SYSCOHADA' } })
    fireEvent.change(screen.getByLabelText('Édition / version *'), { target: { value: '2017' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la mission' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/mission enregistrée/i)
    await waitFor(async () => expect(await database.missions.count()).toBe(2))
    expect(screen.getByText(/mission ouverte :/i)).toHaveTextContent('Revue fictive 2026')
    expect((await database.missions.toArray()).find(({ name }) => name === 'Revue fictive 2026')).toMatchObject({ isFictitious: true, country: 'Gabon' })
  })

  it('demande confirmation avant le reset et restaure le scénario initial', async () => {
    renderApp('/mission')
    await screen.findByRole('heading', { name: 'Informations de la mission' })
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/données locales seront remplacées/i)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réinitialisation' }))

    await waitFor(async () => expect(await database.missions.count()).toBe(1))
    expect(await database.missions.get(demoMission.id)).toMatchObject({ name: demoMission.name, isFictitious: true })
    expect(await screen.findByText(/démonstration a retrouvé son état initial/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Nom de la mission *')).toHaveValue(demoMission.name)
  })

  it('gère le focus du dialogue de reset, la fermeture clavier et le retour du focus', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Cockpit de mission' })
    const trigger = screen.getByRole('button', { name: /réinitialiser/i })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('alertdialog')
    const cancel = screen.getByRole('button', { name: 'Annuler' })
    const confirm = screen.getByRole('button', { name: 'Confirmer la réinitialisation' })
    expect(dialog).toHaveAttribute('aria-describedby', 'reset-description')
    expect(cancel).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
