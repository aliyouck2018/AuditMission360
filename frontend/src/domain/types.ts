export type DemoRole =
  | 'engagement-manager'
  | 'preparer'
  | 'reviewer'
  | 'data-specialist'
  | 'reader'

export type MissionType = 'statutory-audit' | 'contractual-audit' | 'review' | 'other'
export type MissionStatus = 'planning' | 'in-progress' | 'completed'
export type CycleCode = 'sales-receivables' | 'purchases-payables' | 'cash-banks' | 'inventory'
export type CycleStatus = 'not-started' | 'in-progress' | 'completed'
export type CatalogItemStatus = 'candidate' | 'confirmed' | 'adapted' | 'excluded'
export type CatalogReviewStatus = 'draft' | 'reviewed' | 'approved' | 'retired'
export type AssertionCategory = 'transaction' | 'balance' | 'disclosure'
export type ProcedureStatus = 'planned' | 'in-progress' | 'submitted' | 'reviewed'
export type ReviewNoteStatus = 'open' | 'answered' | 'resolved'
export type FindingStatus = 'draft' | 'open' | 'resolved' | 'closed'
export type ImportJobStatus = 'pending' | 'completed' | 'failed'

export interface Timestamped {
  createdAt: string
  updatedAt: string
}

export interface Mission extends Timestamped {
  id: string
  name: string
  entityName: string
  country: string
  sector: string
  periodStart: string
  periodEnd: string
  missionType: MissionType
  currency: string
  framework: string
  frameworkVersion: string
  frameworkStatus: string
  status: MissionStatus
  isFictitious: true
}

export interface TeamMember extends Timestamped {
  id: string
  missionId: string
  displayName: string
  role: DemoRole
  email: string
  isFictitious: true
  isActive: boolean
}

export interface Cycle extends Timestamped {
  id: string
  missionId: string
  code: CycleCode
  name: string
  description: string
  status: CycleStatus
  position: number
}

export interface Risk extends Timestamped {
  id: string
  missionId: string
  cycleId: string
  code: string
  title: string
  description: string
  rationale: string
  status: CatalogItemStatus
  catalogVersion: string
  category: 'operation' | 'balance' | 'disclosure'
  applicableMissionTypes: MissionType[]
  applicableSectors: string[]
  keywords: string[]
  source: string
  reviewStatus: CatalogReviewStatus
  author: string
  reviewer: string
  justification: string | null
}

export interface Assertion extends Timestamped {
  id: string
  missionId: string
  code: string
  name: string
  description: string
  category: AssertionCategory
  catalogVersion: string
  source: string
  reviewStatus: CatalogReviewStatus
  author: string
  reviewer: string
}

export interface RiskAssertionLink extends Timestamped {
  id: string
  missionId: string
  riskId: string
  assertionId: string
  rationale: string
  catalogVersion: string
}

export interface ProcedureTemplate extends Timestamped {
  id: string
  missionId: string
  cycleId: string
  code: string
  title: string
  objective: string
  procedureType: 'control' | 'substantive'
  steps: string[]
  expectedEvidence: string[]
  prerequisites: string[]
  populationDescription: string
  expectedResult: string
  riskCodes: string[]
  assertionCodes: string[]
  standardReferences: string[]
  version: string
  status: 'draft' | 'reviewed' | 'approved' | 'retired'
  source: string
  author: string
  reviewer: string
}

export interface ProcedureExecution extends Timestamped {
  id: string
  missionId: string
  cycleId: string
  procedureTemplateId: string
  procedureTemplateVersion: string
  riskId: string
  assertionIds: string[]
  title: string
  objective: string
  steps: string[]
  expectedEvidence: string[]
  sampleSeed: string
  sampleMethod: string
  status: ProcedureStatus
  assignedToId: string | null
  reviewerId: string | null
  dueDate: string | null
  result: string | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewConclusion: string | null
}

export interface Population extends Timestamped {
  id: string
  missionId: string
  executionId: string
  name: string
  description: string
  itemCount: number
  sourceLabel: string
  isFictitious: true
}

export interface SampleItem extends Timestamped {
  id: string
  missionId: string
  populationId: string
  executionId: string
  lineNumber: number
  reference: string
  description: string
  amount: number
  currency: string
  result: 'pending' | 'consistent' | 'exception'
  notes: string
}

export interface EvidenceReference extends Timestamped {
  id: string
  missionId: string
  executionId: string
  label: string
  reference: string
  evidenceType: 'fictional-document' | 'source-line' | 'comment'
  notes: string
  actorId: string
}

export interface ReviewNote extends Timestamped {
  id: string
  missionId: string
  executionId: string
  authorId: string
  assignedToId: string
  question: string
  response: string | null
  status: ReviewNoteStatus
  resolvedById: string | null
  resolvedAt: string | null
}

export interface Finding extends Timestamped {
  id: string
  missionId: string
  cycleId: string
  title: string
  facts: string
  criteria: string
  cause: string
  indicativeImpact: string
  recommendation: string
  owner: string
  dueDate: string
  sourceReferences: GeneratedDocumentSourceReference[]
  status: FindingStatus
}

export interface ActionPlan extends Timestamped {
  id: string
  missionId: string
  findingId: string
  description: string
  owner: string
  dueDate: string | null
  status: 'open' | 'in-progress' | 'completed'
}

export interface MethodologyReference extends Timestamped {
  id: string
  missionId: string
  standard: string
  title: string
  edition: string
  effectiveStatus: string
  sourceUrl: string
}

export interface DocumentTemplate extends Timestamped {
  id: string
  code: string
  title: string
  version: string
  category: string
  status: 'draft' | 'published' | 'retired'
}

export interface GeneratedDocument extends Timestamped {
  id: string
  missionId: string
  templateId: string
  templateVersion: string
  title: string
  content: string
  generatedById: string
  isFictitious: true
  sourceReferences: GeneratedDocumentSourceReference[]
}

export interface GeneratedDocumentSourceReference {
  entityType: string
  entityId: string
  label: string
}

export interface AuditEvent {
  id: string
  missionId: string
  actorId: string
  entityType: string
  entityId: string
  action: string
  summary: string
  occurredAt: string
}

export interface ImportJob extends Timestamped {
  id: string
  missionId: string
  fileName: string
  status: ImportJobStatus
  rowCount: number
  importedById: string
  sourceFingerprint: string
  columnMapping: Record<LedgerColumnKey, string>
  debitTotal: number
  creditTotal: number
}

export interface AnalyticsException extends Timestamped {
  id: string
  missionId: string
  importJobId: string
  lineNumber: number
  sourceEntryId: string
  ruleCode: string
  description: string
  status: 'to-investigate' | 'explained' | 'dismissed'
  linkedExecutionId: string | null
  humanDecision: string | null
  humanNote: string | null
}

export type LedgerColumnKey = 'entryDate' | 'postingDate' | 'entryNumber' | 'account' | 'description' | 'debit' | 'credit'

export interface LedgerEntry extends Timestamped {
  id: string
  missionId: string
  importJobId: string
  sourceFingerprint: string
  lineNumber: number
  entryDate: string
  postingDate: string
  entryNumber: string
  account: string
  description: string
  debit: number
  credit: number
}

export interface EntityMap {
  missions: Mission
  teamMembers: TeamMember
  cycles: Cycle
  risks: Risk
  assertions: Assertion
  riskAssertionLinks: RiskAssertionLink
  procedureTemplates: ProcedureTemplate
  procedureExecutions: ProcedureExecution
  populations: Population
  sampleItems: SampleItem
  evidenceReferences: EvidenceReference
  reviewNotes: ReviewNote
  findings: Finding
  actionPlans: ActionPlan
  methodologyReferences: MethodologyReference
  documentTemplates: DocumentTemplate
  generatedDocuments: GeneratedDocument
  auditEvents: AuditEvent
  importJobs: ImportJob
  analyticsExceptions: AnalyticsException
  ledgerEntries: LedgerEntry
}

export type EntityTableName = keyof EntityMap
export type MissionEntityName = Exclude<EntityTableName, 'missions' | 'documentTemplates'>
