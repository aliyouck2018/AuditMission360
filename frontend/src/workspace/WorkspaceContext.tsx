import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { database } from '../data/database'
import { resetDemoData, seedDemoData } from '../data/demoService'
import { repositories } from '../data/repositories'
import { ensureMissionCatalog } from '../catalog/catalogService'
import type { DemoRole, Mission } from '../domain/types'

export type WorkspaceStatus = 'loading' | 'ready' | 'error'

export const demoRoles: { value: DemoRole; label: string }[] = [
  { value: 'engagement-manager', label: 'Responsable de mission' },
  { value: 'preparer', label: 'Préparateur' },
  { value: 'reviewer', label: 'Réviseur' },
  { value: 'data-specialist', label: 'Expert données' },
  { value: 'reader', label: 'Lecteur / qualité' },
]

interface WorkspaceValue {
  status: WorkspaceStatus
  error: string | null
  missions: Mission[]
  activeMission: Mission | null
  role: DemoRole
  setRole: (role: DemoRole) => void
  openMission: (missionId: string) => void
  saveMission: (mission: Mission) => Promise<void>
  resetDemo: () => Promise<void>
  retryInitialization: () => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

function isDemoRole(value: string | null): value is DemoRole {
  return demoRoles.some(({ value: role }) => role === value)
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null)
  const [role, setRoleState] = useState<DemoRole>(() => {
    const stored = window.localStorage.getItem('auditmission360-demo-role')
    return isDemoRole(stored) ? stored : 'engagement-manager'
  })

  const loadMissions = useCallback(async (initialize: boolean) => {
    setStatus('loading')
    setError(null)
    try {
      await database.open()
      if (initialize && await database.missions.count() === 0) await seedDemoData(database)
      const savedMissions = await repositories.missions.list()
      await Promise.all(savedMissions.map((mission) => ensureMissionCatalog(database, mission)))
      setMissions(savedMissions)
      setActiveMissionId((current) => savedMissions.some(({ id }) => id === current) ? current : savedMissions[0]?.id ?? null)
      setStatus('ready')
    } catch {
      setError('Les données locales ne sont pas accessibles. Réessayez de charger la démonstration.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadMissions(true)
  }, [loadMissions])

  const setRole = useCallback((nextRole: DemoRole) => {
    setRoleState(nextRole)
    window.localStorage.setItem('auditmission360-demo-role', nextRole)
  }, [])

  const openMission = useCallback((missionId: string) => {
    if (missions.some(({ id }) => id === missionId)) setActiveMissionId(missionId)
  }, [missions])

  const saveMission = useCallback(async (mission: Mission) => {
    await repositories.missions.save(mission)
    await ensureMissionCatalog(database, mission)
    const savedMissions = await repositories.missions.list()
    setMissions(savedMissions)
    setActiveMissionId(mission.id)
  }, [])

  const resetDemo = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      await resetDemoData(database)
      const savedMissions = await repositories.missions.list()
      setMissions(savedMissions)
      setActiveMissionId(savedMissions[0]?.id ?? null)
      setRole('engagement-manager')
      setStatus('ready')
    } catch {
      setError('La réinitialisation a échoué. Vos données locales sont conservées.')
      setStatus('error')
      throw new Error('La réinitialisation de la démonstration a échoué.')
    }
  }, [setRole])

  const value = useMemo<WorkspaceValue>(() => ({
    status,
    error,
    missions,
    activeMission: missions.find(({ id }) => id === activeMissionId) ?? null,
    role,
    setRole,
    openMission,
    saveMission,
    resetDemo,
    retryInitialization: () => { void loadMissions(true) },
  }), [status, error, missions, activeMissionId, role, setRole, openMission, saveMission, resetDemo, loadMissions])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceValue {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('useWorkspace doit être utilisé dans WorkspaceProvider.')
  return workspace
}
