import Dexie, { type Table } from 'dexie'
import type { EntityMap } from '../domain/types'

export class AuditMissionDatabase extends Dexie {
  missions!: Table<EntityMap['missions'], string>
  teamMembers!: Table<EntityMap['teamMembers'], string>
  cycles!: Table<EntityMap['cycles'], string>
  risks!: Table<EntityMap['risks'], string>
  assertions!: Table<EntityMap['assertions'], string>
  riskAssertionLinks!: Table<EntityMap['riskAssertionLinks'], string>
  procedureTemplates!: Table<EntityMap['procedureTemplates'], string>
  procedureExecutions!: Table<EntityMap['procedureExecutions'], string>
  populations!: Table<EntityMap['populations'], string>
  sampleItems!: Table<EntityMap['sampleItems'], string>
  evidenceReferences!: Table<EntityMap['evidenceReferences'], string>
  reviewNotes!: Table<EntityMap['reviewNotes'], string>
  findings!: Table<EntityMap['findings'], string>
  actionPlans!: Table<EntityMap['actionPlans'], string>
  methodologyReferences!: Table<EntityMap['methodologyReferences'], string>
  documentTemplates!: Table<EntityMap['documentTemplates'], string>
  generatedDocuments!: Table<EntityMap['generatedDocuments'], string>
  auditEvents!: Table<EntityMap['auditEvents'], string>
  importJobs!: Table<EntityMap['importJobs'], string>
  analyticsExceptions!: Table<EntityMap['analyticsExceptions'], string>
  ledgerEntries!: Table<EntityMap['ledgerEntries'], string>

  constructor(name = 'AuditMission360') {
    super(name)

    this.version(1).stores({
      missions: '&id, updatedAt, status, country, periodEnd',
      teamMembers: '&id, missionId, role, isActive, [missionId+role]',
      cycles: '&id, missionId, code, status, position, [missionId+code]',
      risks: '&id, missionId, cycleId, code, status, [missionId+cycleId]',
      assertions: '&id, missionId, code, category',
      riskAssertionLinks: '&id, missionId, riskId, assertionId, [riskId+assertionId]',
      procedureTemplates: '&id, missionId, cycleId, code, version, status',
      procedureExecutions: '&id, missionId, cycleId, procedureTemplateId, status, assignedToId, dueDate',
      populations: '&id, missionId, executionId, itemCount',
      sampleItems: '&id, missionId, populationId, executionId, lineNumber, [populationId+lineNumber]',
      evidenceReferences: '&id, missionId, executionId, createdAt',
      reviewNotes: '&id, missionId, executionId, status, authorId, assignedToId',
      findings: '&id, missionId, cycleId, status, createdAt',
      actionPlans: '&id, missionId, findingId, status, dueDate',
      methodologyReferences: '&id, missionId, standard, effectiveStatus',
      documentTemplates: '&id, code, version, category, status',
      generatedDocuments: '&id, missionId, templateId, generatedById, createdAt',
      auditEvents: '&id, missionId, actorId, entityType, entityId, action, occurredAt',
      importJobs: '&id, missionId, status, importedById, createdAt',
      analyticsExceptions: '&id, missionId, importJobId, status, ruleCode, lineNumber',
    })

    this.version(2).stores({
      missions: '&id, updatedAt, status, country, periodEnd',
      teamMembers: '&id, missionId, role, isActive, [missionId+role]',
      cycles: '&id, missionId, code, status, position, [missionId+code]',
      risks: '&id, missionId, cycleId, code, status, [missionId+cycleId]',
      assertions: '&id, missionId, code, category',
      riskAssertionLinks: '&id, missionId, riskId, assertionId, [riskId+assertionId]',
      procedureTemplates: '&id, missionId, cycleId, code, version, status',
      procedureExecutions: '&id, missionId, cycleId, procedureTemplateId, status, assignedToId, dueDate',
      populations: '&id, missionId, executionId, itemCount',
      sampleItems: '&id, missionId, populationId, executionId, lineNumber, [populationId+lineNumber]',
      evidenceReferences: '&id, missionId, executionId, createdAt',
      reviewNotes: '&id, missionId, executionId, status, authorId, assignedToId',
      findings: '&id, missionId, cycleId, status, createdAt',
      actionPlans: '&id, missionId, findingId, status, dueDate',
      methodologyReferences: '&id, missionId, standard, effectiveStatus',
      documentTemplates: '&id, code, version, category, status',
      generatedDocuments: '&id, missionId, templateId, generatedById, createdAt',
      auditEvents: '&id, missionId, actorId, entityType, entityId, action, occurredAt',
      importJobs: '&id, missionId, status, importedById, createdAt',
      analyticsExceptions: '&id, missionId, importJobId, status, ruleCode, lineNumber, linkedExecutionId',
      ledgerEntries: '&id, missionId, importJobId, sourceFingerprint, lineNumber, entryDate, postingDate, entryNumber, account, [missionId+importJobId], [importJobId+lineNumber]',
    })
  }
}

export const database = new AuditMissionDatabase()
