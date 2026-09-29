import { describe, expect, it } from 'vitest'
import { isOfficialNormativeUrl, methodologyStages, normativeReferenceAnchor, ohadaReferences, standardReferences } from './methodologyData'

describe('références et étapes de méthodologie', () => {
  it('relie chaque étape à des fiches officielles et chaque fiche distingue version, publication, effet et adoption', () => {
    expect(methodologyStages).toHaveLength(7)
    const referenceIds = new Set(standardReferences.map(({ id }) => id))
    for (const stage of methodologyStages) {
      expect(stage.objective).toBeTruthy()
      expect(stage.activities.length).toBeGreaterThan(0)
      expect(stage.humanDecisions.length).toBeGreaterThan(0)
      expect(stage.deliverables.length).toBeGreaterThan(0)
      expect(stage.referenceIds.length).toBeGreaterThan(0)
      for (const id of stage.referenceIds) expect(referenceIds.has(id)).toBe(true)
    }
    for (const reference of [...standardReferences, ...ohadaReferences]) {
      expect(reference.version).toBeTruthy()
      expect(reference.publicationDate).toBeTruthy()
      expect(reference.effectiveStatus).toBeTruthy()
      expect(reference.localAdoptionStatus).toBeTruthy()
      expect(isOfficialNormativeUrl(reference.sourceUrl)).toBe(true)
      expect(normativeReferenceAnchor(reference.id)).toMatch(/^reference-[a-z0-9-]+$/)
    }
  })

  it('distingue ISA 240 et ISA 570 révisées des éditions antérieures et indique leur date d’effet', () => {
    for (const id of ['ISA 240 (révisée)', 'ISA 570 (révisée 2024)']) {
      const reference = standardReferences.find((item) => item.id === id)
      expect(reference).toBeDefined()
      expect(reference?.effectiveStatus).toMatch(/non encore effective/)
      expect(reference?.effectiveStatus).toContain('15 décembre 2026')
      expect(reference?.statusNote).toMatch(/Ne pas confondre/)
      expect(reference?.sourceUrl).toMatch(/^https:\/\/www\.iaasb\.org\/publications\//)
    }
  })
})
