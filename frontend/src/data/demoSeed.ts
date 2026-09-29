import type { Assertion, Cycle, Mission, TeamMember } from '../domain/types'
import { STARTER_CATALOG_AUTHOR, STARTER_CATALOG_REVIEWER, STARTER_CATALOG_SOURCE, STARTER_CATALOG_VERSION, starterAssertions } from '../catalog/catalogData'

export const DEMO_MISSION_ID = 'mission-demo-cemac-2025'
export const DEMO_SEED_DATE = '2026-09-29T00:00:00.000Z'

export const demoMission: Mission = {
  id: DEMO_MISSION_ID,
  name: 'Audit de démonstration — exercice 2025',
  entityName: 'Kivu Services & Négoce SARL',
  country: 'Cameroun',
  sector: 'Services et négoce',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  missionType: 'statutory-audit',
  currency: 'XAF',
  framework: 'SYSCOHADA révisé',
  frameworkVersion: 'AUDCIF 2017',
  frameworkStatus: 'Choix pédagogique du scénario — applicabilité à vérifier',
  status: 'planning',
  isFictitious: true,
  createdAt: DEMO_SEED_DATE,
  updatedAt: DEMO_SEED_DATE,
}

export const demoTeamMembers: TeamMember[] = [
  { id: 'member-demo-manager', missionId: DEMO_MISSION_ID, displayName: 'Alex Nguema', role: 'engagement-manager', email: 'alex.nguema@example.test', isFictitious: true, isActive: true, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'member-demo-preparer', missionId: DEMO_MISSION_ID, displayName: 'Samira Mbala', role: 'preparer', email: 'samira.mbala@example.test', isFictitious: true, isActive: true, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'member-demo-reviewer', missionId: DEMO_MISSION_ID, displayName: 'Chris Ewane', role: 'reviewer', email: 'chris.ewane@example.test', isFictitious: true, isActive: true, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'member-demo-data', missionId: DEMO_MISSION_ID, displayName: 'Noa Moukouri', role: 'data-specialist', email: 'noa.moukouri@example.test', isFictitious: true, isActive: true, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'member-demo-reader', missionId: DEMO_MISSION_ID, displayName: 'Jordan Etoga', role: 'reader', email: 'jordan.etoga@example.test', isFictitious: true, isActive: true, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
]

export const demoCycles: Cycle[] = [
  { id: 'cycle-demo-sales', missionId: DEMO_MISSION_ID, code: 'sales-receivables', name: 'Ventes et créances', description: 'Opérations de vente, encaissements et soldes clients — données fictives.', status: 'not-started', position: 1, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'cycle-demo-purchases', missionId: DEMO_MISSION_ID, code: 'purchases-payables', name: 'Achats et fournisseurs', description: 'Achats, réceptions et soldes fournisseurs — données fictives.', status: 'not-started', position: 2, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'cycle-demo-cash', missionId: DEMO_MISSION_ID, code: 'cash-banks', name: 'Trésorerie et banques', description: 'Comptes bancaires et rapprochements — données fictives.', status: 'not-started', position: 3, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
  { id: 'cycle-demo-inventory', missionId: DEMO_MISSION_ID, code: 'inventory', name: 'Stocks', description: 'Quantités et valorisation des stocks — données fictives.', status: 'not-started', position: 4, createdAt: DEMO_SEED_DATE, updatedAt: DEMO_SEED_DATE },
]

export const demoAssertions: Assertion[] = starterAssertions.map((assertion) => ({
  ...assertion,
  id: `assertion-${DEMO_MISSION_ID}-${assertion.code.toLowerCase()}`,
  missionId: DEMO_MISSION_ID,
  catalogVersion: STARTER_CATALOG_VERSION,
  source: STARTER_CATALOG_SOURCE,
  reviewStatus: 'reviewed',
  author: STARTER_CATALOG_AUTHOR,
  reviewer: STARTER_CATALOG_REVIEWER,
  createdAt: DEMO_SEED_DATE,
  updatedAt: DEMO_SEED_DATE,
}))
