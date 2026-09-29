import { afterEach, describe, expect, it } from 'vitest'
import { AuditMissionDatabase } from '../data/database'
import { demoMission, DEMO_MISSION_ID } from '../data/demoSeed'
import { seedDemoData } from '../data/demoService'
import { documentTemplates, exportDocument, findMissingRequiredFields, parseDocumentDraft, serializeDocumentDraft, type DocumentContext } from './documentService'

let databaseIndex = 0
const openDatabases: AuditMissionDatabase[] = []

function createTestDatabase() {
  const db = new AuditMissionDatabase(`AuditMission360-documents-test-${databaseIndex++}`)
  openDatabases.push(db)
  return db
}

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((db) => db.delete()))
})

async function seedDocumentContext(db: AuditMissionDatabase): Promise<DocumentContext> {
  await seedDemoData(db)
  const [cycles, risks, assertions, riskAssertionLinks, members] = await Promise.all([
    db.cycles.where('missionId').equals(DEMO_MISSION_ID).toArray(), db.risks.where('missionId').equals(DEMO_MISSION_ID).toArray(),
    db.assertions.where('missionId').equals(DEMO_MISSION_ID).toArray(), db.riskAssertionLinks.where('missionId').equals(DEMO_MISSION_ID).toArray(),
    db.teamMembers.where('missionId').equals(DEMO_MISSION_ID).toArray(),
  ])
  return {
    mission: demoMission,
    actor: members.find(({ role }) => role === 'engagement-manager')!,
    members, cycles, risks, assertions, riskAssertionLinks,
    executions: [], samples: [], populations: [], evidence: [], notes: [], findings: [], events: [],
  }
}

describe('bibliothèque et exports documentaires', () => {
  it('fournit huit modèles versionnés dont les brouillons reprennent le dossier et les liens de source', async () => {
    const db = createTestDatabase()
    const context = await seedDocumentContext(db)

    expect(documentTemplates).toHaveLength(8)
    expect(new Set(documentTemplates.map(({ version }) => version))).toEqual(new Set(['1.0.0']))
    for (const template of documentTemplates) {
      const draft = template.createDraft(context)
      expect(draft.sourceReferences[0]).toMatchObject({ entityType: 'mission', entityId: DEMO_MISSION_ID })
      expect(draft.sourceReferences.every(({ entityType, entityId, label }) => entityType && entityId && label)).toBe(true)
      expect(draft.fields.length).toBeGreaterThan(0)
      expect(findMissingRequiredFields(draft.fields).length).toBeGreaterThan(0)
      expect(parseDocumentDraft(serializeDocumentDraft(draft))).toEqual(draft)
    }

    const letter = documentTemplates.find(({ code }) => code === 'LETTRE-MISSION-DEMO')!.createDraft(context)
    expect(letter.body).toMatch(/NON SIGNÉ \/ NON ENVOYÉ/)
    expect(letter.body).not.toMatch(/signature électronique|envoyer automatiquement/i)
    const report = documentTemplates.find(({ code }) => code === 'RAPPORT-SIMULE')!.createDraft(context)
    expect(report.body).toMatch(/SANS OPINION \/ NON ÉMIS/)
    expect(report.body).toMatch(/Aucune opinion d’audit n’est générée/)
  })

  it('enregistre ensemble le brouillon figé, sa version et ses liens sources avec son événement d’export', async () => {
    const db = createTestDatabase()
    const context = await seedDocumentContext(db)
    const template = documentTemplates.find(({ code }) => code === 'FEUILLE-TRAVAIL')!
    const draft = template.createDraft(context)
    draft.fields.find(({ id }) => id === 'preuve')!.value = 'TEST-PIECE-SYNTHETIQUE-01'
    const content = serializeDocumentDraft(draft)

    const saved = await exportDocument(db, {
      missionId: DEMO_MISSION_ID, templateId: template.id, templateVersion: template.version, title: template.title,
      content, actorId: context.actor.id, id: 'document-test-001', createdAt: '2026-09-29T12:00:00.000Z',
    })

    expect(saved).toMatchObject({
      id: 'document-test-001', missionId: DEMO_MISSION_ID, templateVersion: '1.0.0',
      generatedById: context.actor.id, isFictitious: true, content,
      sourceReferences: draft.sourceReferences,
    })
    expect(await db.generatedDocuments.get(saved.id)).toEqual(saved)
    expect(await db.auditEvents.where('entityId').equals(saved.id).first()).toMatchObject({
      entityType: 'generatedDocument', action: 'document-exported', actorId: context.actor.id,
      summary: expect.stringContaining('brouillon non signé'),
    })
    await expect(exportDocument(db, {
      missionId: DEMO_MISSION_ID, templateId: template.id, templateVersion: template.version, title: template.title,
      content, actorId: context.actor.id, id: saved.id,
    })).rejects.toThrow()
    expect(await db.generatedDocuments.count()).toBe(1)
    expect(await db.auditEvents.where('action').equals('document-exported').count()).toBe(1)
  })

  it('refuse un document sans mission source ou avec un contenu non sérialisable', async () => {
    const db = createTestDatabase()
    const template = documentTemplates[0]
    const validDraft = template.createDraft({
      mission: demoMission,
      actor: { id: 'actor', missionId: DEMO_MISSION_ID, displayName: 'Démo', role: 'engagement-manager', email: 'demo@example.test', isFictitious: true, isActive: true, createdAt: demoMission.createdAt, updatedAt: demoMission.updatedAt },
      members: [], cycles: [], risks: [], assertions: [], riskAssertionLinks: [], executions: [], samples: [], populations: [], evidence: [], notes: [], findings: [], events: [],
    })
    await expect(exportDocument(db, {
      missionId: 'absent', templateId: template.id, templateVersion: template.version, title: template.title,
      content: serializeDocumentDraft(validDraft), actorId: 'actor',
    })).rejects.toThrow(/mission source/i)
    await seedDemoData(db)
    await expect(exportDocument(db, {
      missionId: DEMO_MISSION_ID, templateId: template.id, templateVersion: template.version, title: template.title,
      content: 'not-json', actorId: 'actor',
    })).rejects.toThrow(/format de document valide/i)
    expect(await db.generatedDocuments.count()).toBe(0)
  })
})
