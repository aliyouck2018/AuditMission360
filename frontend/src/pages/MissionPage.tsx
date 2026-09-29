import { useEffect, useState, type FormEvent } from 'react'
import { Check, Plus, Save } from 'lucide-react'
import { demoMission, DEMO_SEED_DATE } from '../data/demoSeed'
import { isMissionType, validateMission, type MissionFormValues } from '../domain/missionValidation'
import type { Mission } from '../domain/types'
import { useWorkspace } from '../workspace/WorkspaceContext'

function emptyMissionValues(): MissionFormValues {
  return {
    name: '', entityName: '', country: '', sector: '', periodStart: '', periodEnd: '',
    missionType: 'statutory-audit', currency: '', framework: '', frameworkVersion: '',
  }
}

function missionValues(mission: Mission): MissionFormValues {
  return {
    name: mission.name,
    entityName: mission.entityName,
    country: mission.country,
    sector: mission.sector,
    periodStart: mission.periodStart,
    periodEnd: mission.periodEnd,
    missionType: mission.missionType,
    currency: mission.currency,
    framework: mission.framework,
    frameworkVersion: mission.frameworkVersion,
  }
}

const fieldLabels: Record<keyof MissionFormValues, string> = {
  name: 'Nom de la mission',
  entityName: 'Entité fictive',
  country: 'Pays',
  sector: 'Secteur',
  periodStart: 'Début de période',
  periodEnd: 'Fin de période',
  missionType: 'Type de mission',
  currency: 'Devise (code ISO)',
  framework: 'Référentiel comptable',
  frameworkVersion: 'Édition / version',
}

export function MissionPage() {
  const { missions, activeMission, openMission, saveMission } = useWorkspace()
  const [isCreating, setIsCreating] = useState(false)
  const [values, setValues] = useState<MissionFormValues>(() => activeMission ? missionValues(activeMission) : emptyMissionValues())
  const [errors, setErrors] = useState<Partial<Record<keyof MissionFormValues, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isCreating && activeMission) setValues(missionValues(activeMission))
  }, [activeMission?.id, activeMission?.updatedAt, isCreating])

  function startNewMission() {
    setValues(emptyMissionValues())
    setErrors({})
    setFormError(null)
    setSaved(false)
    setIsCreating(true)
  }

  function openSavedMission(id: string) {
    openMission(id)
    const mission = missions.find((item) => item.id === id)
    if (mission) setValues(missionValues(mission))
    setErrors({})
    setFormError(null)
    setSaved(false)
    setIsCreating(false)
  }

  function updateField(field: keyof MissionFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateMission(values)
    setErrors(validationErrors)
    setSaved(false)
    if (Object.keys(validationErrors).length > 0 || !isMissionType(values.missionType)) return

    setSaving(true)
    setFormError(null)
    const timestamp = new Date().toISOString()
    const mission: Mission = {
      ...(isCreating ? {} : activeMission ?? demoMission),
      id: isCreating ? globalThis.crypto.randomUUID() : activeMission?.id ?? demoMission.id,
      ...values,
      missionType: values.missionType,
      currency: values.currency.trim().toUpperCase(),
      frameworkStatus: 'Édition choisie pour la démonstration — applicabilité à vérifier',
      status: isCreating ? 'planning' : activeMission?.status ?? 'planning',
      isFictitious: true,
      createdAt: isCreating ? timestamp : activeMission?.createdAt ?? DEMO_SEED_DATE,
      updatedAt: timestamp,
    }

    try {
      await saveMission(mission)
      setValues(missionValues(mission))
      setIsCreating(false)
      setSaved(true)
    } catch {
      setFormError('La mission n’a pas pu être enregistrée. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  const activeFormMission = !isCreating ? activeMission : null

  return (
    <section className="mission-page" aria-labelledby="mission-title">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Contexte du dossier</span>
          <h1 id="mission-title">Mission</h1>
          <p>Configurez une mission entièrement fictive et son référentiel pédagogique.</p>
        </div>
        <button className="button button-secondary" onClick={startNewMission} type="button">
          <Plus aria-hidden="true" size={17} /> Nouvelle mission
        </button>
      </div>

      {missions.length > 0 && (
        <div className="mission-picker card">
          <label htmlFor="open-mission">Mission à ouvrir</label>
          <select id="open-mission" onChange={(event) => openSavedMission(event.target.value)} value={activeFormMission?.id ?? ''}>
            {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}
            {isCreating && <option value="">Nouvelle mission (brouillon)</option>}
          </select>
          <span className="field-hint">Le sélecteur de profil est une simulation locale, sans authentification ni contrôle d’accès.</span>
        </div>
      )}

      <form className="mission-form card" noValidate onSubmit={handleSubmit}>
        <div className="form-section-heading">
          <div>
            <span className="eyebrow">Paramètres</span>
            <h2>{isCreating ? 'Créer une mission' : 'Informations de la mission'}</h2>
          </div>
          <span className="fictitious-chip">Dossier fictif</span>
        </div>

        <div className="form-grid">
          {(Object.keys(fieldLabels) as (keyof MissionFormValues)[]).map((field) => (
            <div className={`form-field${errors[field] ? ' has-error' : ''}`} key={field}>
              <label htmlFor={`mission-${field}`}>{fieldLabels[field]} <span aria-hidden="true">*</span></label>
              {field === 'missionType' ? (
                <select id={`mission-${field}`} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : undefined} onChange={(event) => updateField(field, event.target.value)} value={values[field]}>
                  <option value="statutory-audit">Audit légal</option>
                  <option value="contractual-audit">Audit contractuel</option>
                  <option value="review">Examen limité</option>
                  <option value="other">Autre mission</option>
                </select>
              ) : (
                <input
                  id={`mission-${field}`}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={errors[field] ? `${field}-error` : undefined}
                  maxLength={field === 'currency' ? 3 : undefined}
                  onChange={(event) => updateField(field, event.target.value)}
                  type={field.startsWith('period') ? 'date' : 'text'}
                  value={values[field]}
                />
              )}
              {errors[field] && <span className="field-error" id={`${field}-error`}>{errors[field]}</span>}
            </div>
          ))}
        </div>
        <p className="form-disclosure">Le référentiel et son édition sont des choix de démonstration ; leur applicabilité locale doit être vérifiée par une personne.</p>

        {formError && <p className="form-alert" role="alert">{formError}</p>}
        {saved && <p className="form-success" role="status"><Check aria-hidden="true" size={16} /> Mission enregistrée dans cette démonstration locale.</p>}
        <div className="form-actions">
          <button className="button button-primary" disabled={saving} type="submit">
            <Save aria-hidden="true" size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer la mission'}
          </button>
        </div>
      </form>
    </section>
  )
}
