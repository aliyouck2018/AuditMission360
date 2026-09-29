import type { Table } from 'dexie'
import { database, type AuditMissionDatabase } from './database'
import type { EntityMap, EntityTableName, MissionEntityName } from '../domain/types'

type MissionScopedEntity = { id: string; missionId: string }
type Repository<T extends MissionScopedEntity> = {
  get(id: string): Promise<T | undefined>
  listForMission(missionId: string): Promise<T[]>
  save(entity: T): Promise<string>
  saveMany(entities: T[]): Promise<string[]>
  remove(id: string): Promise<void>
}

function missionRepository<K extends MissionEntityName>(
  db: AuditMissionDatabase,
  tableName: K,
): Repository<EntityMap[K] & MissionScopedEntity> {
  const table = db[tableName] as unknown as Table<EntityMap[K] & MissionScopedEntity, string>
  return {
    get: (id) => table.get(id),
    listForMission: (missionId) => table.where('missionId').equals(missionId).toArray(),
    save: (entity) => table.put(entity),
    saveMany: (entities) => table.bulkPut(entities, { allKeys: true }),
    remove: async (id) => { await table.delete(id) },
  }
}

export function createRepositories(db: AuditMissionDatabase) {
  return {
    missions: {
      get: (id: string) => db.missions.get(id),
      list: () => db.missions.toArray(),
      save: (mission: EntityMap['missions']) => db.missions.put(mission),
      remove: async (id: string) => { await db.missions.delete(id) },
    },
    teamMembers: missionRepository(db, 'teamMembers'),
    cycles: missionRepository(db, 'cycles'),
    risks: missionRepository(db, 'risks'),
    assertions: missionRepository(db, 'assertions'),
    riskAssertionLinks: missionRepository(db, 'riskAssertionLinks'),
    procedureTemplates: missionRepository(db, 'procedureTemplates'),
    procedureExecutions: missionRepository(db, 'procedureExecutions'),
    populations: missionRepository(db, 'populations'),
    sampleItems: missionRepository(db, 'sampleItems'),
    evidenceReferences: missionRepository(db, 'evidenceReferences'),
    reviewNotes: missionRepository(db, 'reviewNotes'),
    findings: missionRepository(db, 'findings'),
    actionPlans: missionRepository(db, 'actionPlans'),
    methodologyReferences: missionRepository(db, 'methodologyReferences'),
    documentTemplates: {
      get: (id: string) => db.documentTemplates.get(id),
      list: () => db.documentTemplates.toArray(),
      save: (template: EntityMap['documentTemplates']) => db.documentTemplates.put(template),
    },
    generatedDocuments: missionRepository(db, 'generatedDocuments'),
    auditEvents: missionRepository(db, 'auditEvents'),
    importJobs: missionRepository(db, 'importJobs'),
    analyticsExceptions: missionRepository(db, 'analyticsExceptions'),
    ledgerEntries: missionRepository(db, 'ledgerEntries'),
  }
}

export const repositories = createRepositories(database)

export type { EntityTableName }
