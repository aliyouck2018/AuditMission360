import type { MissionType } from './types'

export interface MissionFormValues {
  name: string
  entityName: string
  country: string
  sector: string
  periodStart: string
  periodEnd: string
  missionType: string
  currency: string
  framework: string
  frameworkVersion: string
}

export type MissionField = keyof MissionFormValues
export type MissionValidationErrors = Partial<Record<MissionField, string>>

const requiredFields: MissionField[] = [
  'name', 'entityName', 'country', 'sector', 'periodStart', 'periodEnd',
  'missionType', 'currency', 'framework', 'frameworkVersion',
]

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateMission(values: MissionFormValues): MissionValidationErrors {
  const errors: MissionValidationErrors = {}

  for (const field of requiredFields) {
    if (!values[field].trim()) errors[field] = 'Ce champ est obligatoire.'
  }

  if (values.periodStart && !isCalendarDate(values.periodStart)) {
    errors.periodStart = 'Saisissez une date de début valide.'
  }
  if (values.periodEnd && !isCalendarDate(values.periodEnd)) {
    errors.periodEnd = 'Saisissez une date de fin valide.'
  }
  if (isCalendarDate(values.periodStart) && isCalendarDate(values.periodEnd) && values.periodStart > values.periodEnd) {
    errors.periodEnd = 'La fin de période doit être égale ou postérieure au début.'
  }
  if (values.currency && !/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.currency = 'Utilisez un code devise de trois lettres (ex. XAF).'
  }
  if (values.missionType && !(['statutory-audit', 'contractual-audit', 'review', 'other'] as string[]).includes(values.missionType)) {
    errors.missionType = 'Sélectionnez un type de mission valide.'
  }

  return errors
}

export function isMissionType(value: string): value is MissionType {
  return ['statutory-audit', 'contractual-audit', 'review', 'other'].includes(value)
}
