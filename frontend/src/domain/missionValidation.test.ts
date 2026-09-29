import { describe, expect, it } from 'vitest'
import { validateMission, type MissionFormValues } from './missionValidation'

const validMission: MissionFormValues = {
  name: 'Mission fictive 2025',
  entityName: 'Entité Démo SARL',
  country: 'Cameroun',
  sector: 'Services',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  missionType: 'statutory-audit',
  currency: 'XAF',
  framework: 'SYSCOHADA',
  frameworkVersion: '2017',
}

describe('validation du contexte de mission', () => {
  it('accepte un contexte complet et une période chronologique', () => {
    expect(validateMission(validMission)).toEqual({})
  })

  it('signale les champs obligatoires manquants', () => {
    const errors = validateMission({ ...validMission, name: ' ', country: '', frameworkVersion: '' })

    expect(errors.name).toBe('Ce champ est obligatoire.')
    expect(errors.country).toBe('Ce champ est obligatoire.')
    expect(errors.frameworkVersion).toBe('Ce champ est obligatoire.')
  })

  it('refuse les dates impossibles, une période inversée et un code devise invalide', () => {
    const invalidStart = validateMission({ ...validMission, periodStart: '2025-02-30' })
    const errors = validateMission({ ...validMission, periodStart: '2025-02-01', periodEnd: '2024-12-31', currency: 'FCFA' })

    expect(invalidStart.periodStart).toMatch(/date de début valide/i)
    expect(errors.periodEnd).toMatch(/fin de période/i)
    expect(errors.currency).toMatch(/trois lettres/i)
  })
})
