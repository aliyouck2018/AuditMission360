export interface StandardReference {
  id: string
  title: string
  version: string
  publicationDate: string
  effectiveStatus: string
  localAdoptionStatus: string
  sourceUrl: string
  statusNote?: string
}

export interface MethodologyStage {
  id: string
  title: string
  objective: string
  activities: string[]
  humanDecisions: string[]
  deliverables: string[]
  referenceIds: string[]
}

const handbookUrl = 'https://www.iaasb.org/publications/2025-handbook-international-quality-management-auditing-review-other-assurance-and-related-services'
const ohadaAdoption = 'Cadre régional : Règlement OHADA n° 01/2017/CM/OHADA, en vigueur depuis le 1er janvier 2018. L’applicabilité de cette édition à l’État et à la mission reste à confirmer.'
const handbookEffective = 'Édition de référence du Handbook 2025 ; date d’effet de l’édition concernée à confirmer pour la période auditée.'

function isa(id: string, title: string, overrides: Partial<StandardReference> = {}): StandardReference {
  return {
    id,
    title,
    version: 'Édition de référence : Handbook IAASB 2025',
    publicationDate: '17 septembre 2025 (publication du Handbook)',
    effectiveStatus: handbookEffective,
    localAdoptionStatus: ohadaAdoption,
    sourceUrl: handbookUrl,
    ...overrides,
  }
}

export const standardReferences: StandardReference[] = [
  isa('ISA 210', 'Accord sur les termes des missions d’audit'),
  isa('ISA 220', 'Gestion de la qualité d’un audit d’états financiers'),
  isa('ISQM 1', 'Gestion de la qualité par les cabinets réalisant des audits ou examens limités d’états financiers'),
  isa('ISA 300', 'Planification d’un audit d’états financiers'),
  isa('ISA 320', 'Caractère significatif dans la planification et la réalisation d’un audit'),
  isa('ISA 315', 'Identification et évaluation des risques d’anomalies significatives'),
  isa('ISA 240', 'Responsabilités de l’auditeur concernant les fraudes'),
  isa('ISA 240 (révisée)', 'Responsabilités de l’auditeur concernant les fraudes — version révisée', {
    version: 'ISA 240 (révisée)',
    publicationDate: '8 juillet 2025',
    effectiveStatus: 'Publiée, mais non encore effective au 29 septembre 2026. Application aux périodes ouvertes à compter du 15 décembre 2026 ; adoption anticipée à vérifier.',
    sourceUrl: 'https://www.iaasb.org/publications/isa-240-revised-auditor-s-responsibilities-relating-fraud-audit-financial-statements',
    statusNote: 'Ne pas confondre avec ISA 240 de l’édition antérieure ; ne pas activer silencieusement.',
  }),
  isa('ISA 250', 'Prise en considération des textes légaux et réglementaires'),
  isa('ISA 330', 'Réponses de l’auditeur aux risques évalués'),
  isa('ISA 265', 'Communication des déficiences du contrôle interne'),
  isa('ISA 540', 'Audit des estimations comptables et des informations y afférentes'),
  isa('ISA 500', 'Éléments probants'),
  isa('ISA 501', 'Éléments probants — considérations spécifiques à certains éléments'),
  isa('ISA 505', 'Confirmations externes'),
  isa('ISA 520', 'Procédures analytiques'),
  isa('ISA 530', 'Sondages en audit'),
  isa('ISA 230', 'Documentation d’audit'),
  isa('ISA 450', 'Évaluation des anomalies relevées au cours de l’audit'),
  isa('ISA 560', 'Événements postérieurs à la clôture'),
  isa('ISA 570', 'Continuité de l’exploitation'),
  isa('ISA 570 (révisée 2024)', 'Continuité de l’exploitation — version révisée 2024', {
    version: 'ISA 570 (révisée 2024)',
    publicationDate: '9 avril 2025',
    effectiveStatus: 'Publiée, mais non encore effective au 29 septembre 2026. Application aux périodes ouvertes à compter du 15 décembre 2026 ; adoption anticipée à vérifier.',
    sourceUrl: 'https://www.iaasb.org/publications/isa-570-revised-2024-going-concern',
    statusNote: 'Ne pas confondre avec ISA 570 de l’édition antérieure ; ne pas activer silencieusement.',
  }),
  isa('ISA 260', 'Communication avec les personnes constituant le gouvernement d’entreprise'),
  isa('ISA 700', 'Fondement de l’opinion et rapport sur des états financiers'),
  isa('ISA 701', 'Communication des points clés de l’audit dans le rapport de l’auditeur indépendant'),
  isa('ISA 705', 'Opinions modifiées dans le rapport de l’auditeur indépendant'),
  isa('ISA 706', 'Paragraphes d’observation et paragraphes relatifs à d’autres points'),
  isa('ISA 720', 'Obligations de l’auditeur au regard des autres informations'),
]

export const ohadaReferences: StandardReference[] = [
  {
    id: 'AUDCIF',
    title: 'Acte uniforme relatif au droit comptable et à l’information financière (AUDCIF)',
    version: 'Acte uniforme adopté le 26 janvier 2017',
    publicationDate: 'Publication au Journal officiel : 15 février 2017',
    effectiveStatus: 'En vigueur depuis le 1er janvier 2018 (comptes personnels) et le 1er janvier 2019 (comptes consolidés/combinés et états IFRS visés).',
    localAdoptionStatus: 'Texte OHADA ; vérifier l’État partie, les règles sectorielles et le référentiel applicable à l’entité.',
    sourceUrl: 'https://www.ohada.org/acte-uniforme-relatif-au-droit-comptable-et-a-linformation-financiere-audcif/',
  },
  {
    id: 'Règlement n° 01/2017/CM/OHADA',
    title: 'Harmonisation des pratiques des professionnels de la comptabilité et de l’audit',
    version: 'Règlement n° 01/2017/CM/OHADA, adopté le 8 juin 2017',
    publicationDate: 'Mise en ligne officielle : 18 juin 2017',
    effectiveStatus: 'En vigueur depuis le 1er janvier 2018 selon la publication officielle OHADA.',
    localAdoptionStatus: 'Cadre professionnel régional OHADA ; vérifier les dispositions nationales, sectorielles et la version des normes applicable à la mission.',
    sourceUrl: 'https://www.ohada.org/mise-en-ligne-du-reglement-portant-harmonisation-des-pratiques-des-professionnels-de-la-comptabilite-et-de-l-audit-dans-les-etats-membres-de-l-ohada/',
  },
]

export const methodologyStages: MethodologyStage[] = [
  {
    id: 'acceptation', title: 'Acceptation et maintien',
    objective: 'Décider si le contexte permet d’accepter ou de poursuivre la mission et d’en convenir les termes.',
    activities: ['Examiner l’intégrité et les conditions préalables de la mission.', 'Identifier les exigences d’éthique, d’indépendance et de qualité applicables.', 'Formaliser le périmètre, le référentiel et les responsabilités convenus.'],
    humanDecisions: ['L’acceptation, le maintien et les mesures de sauvegarde relèvent du professionnel responsable.', 'Confirmer la base juridique, le référentiel local et l’indépendance.'],
    deliverables: ['Évaluation documentée d’acceptation / maintien.', 'Projet de lettre de mission et éléments relatifs à la qualité.'],
    referenceIds: ['ISA 210', 'ISA 220', 'ISQM 1'],
  },
  {
    id: 'planification', title: 'Planification et matérialité',
    objective: 'Définir une stratégie et un plan de travail adaptés au contexte documenté de la mission.',
    activities: ['Comprendre le périmètre, le calendrier et les ressources.', 'Déterminer la matérialité et organiser la coordination de l’équipe.', 'Actualiser le plan lorsque de nouvelles informations sont examinées.'],
    humanDecisions: ['La stratégie, les ressources et les seuils sont déterminés et revus par une personne compétente.', 'Considérer la complexité et les règles sectorielles éventuelles.'],
    deliverables: ['Mémo de planification.', 'Calendrier, stratégie et matérialité documentés.'],
    referenceIds: ['ISA 300', 'ISA 320', 'ISA 220'],
  },
  {
    id: 'risques', title: 'Compréhension et risques',
    objective: 'Comprendre l’entité et son environnement pour identifier et évaluer les risques d’anomalies significatives.',
    activities: ['Recueillir des informations sur l’entité, son contrôle interne et les textes pertinents.', 'Identifier les risques aux niveaux des états financiers et des assertions.', 'Garder distincts les risques candidats du dossier et les évaluations effectivement retenues.'],
    humanDecisions: ['Confirmer, adapter ou écarter chaque risque avec une justification.', 'Évaluer professionnellement les risques de fraude et les obligations réglementaires.'],
    deliverables: ['Compréhension documentée de l’entité.', 'Matrice de risques et assertions examinée.'],
    referenceIds: ['ISA 315', 'ISA 240', 'ISA 240 (révisée)', 'ISA 250'],
  },
  {
    id: 'reponses', title: 'Réponses et contrôles',
    objective: 'Concevoir des réponses d’audit qui traitent les risques évalués et documenter leur adaptation.',
    activities: ['Définir la nature, le calendrier et l’étendue des travaux.', 'Décider si les contrôles sont pertinents et prévoir leur test le cas échéant.', 'Adapter les travaux portant sur les estimations et les déficiences identifiées.'],
    humanDecisions: ['Approuver les réponses et leur adéquation au risque évalué.', 'Interpréter les écarts de contrôle sans conclusion automatique.'],
    deliverables: ['Programme de travail lié aux risques.', 'Résultats des tests de contrôle et communication appropriée.'],
    referenceIds: ['ISA 330', 'ISA 265', 'ISA 540'],
  },
  {
    id: 'preuves', title: 'Éléments probants et tests',
    objective: 'Obtenir des éléments probants suffisants et appropriés au soutien des travaux réalisés.',
    activities: ['Définir les éléments probants attendus et leur provenance.', 'Choisir confirmations, procédures analytiques ou sondages selon le besoin.', 'Documenter les exceptions, les limites et les éléments contradictoires.'],
    humanDecisions: ['Apprécier la pertinence et la fiabilité des éléments probants.', 'Définir la population et la méthode d’échantillonnage adaptée.'],
    deliverables: ['Feuilles de travail et références de preuves.', 'Population, sélection et résultats commentés.'],
    referenceIds: ['ISA 500', 'ISA 501', 'ISA 505', 'ISA 520', 'ISA 530'],
  },
  {
    id: 'evaluation', title: 'Évaluation et clôture',
    objective: 'Évaluer les résultats, les anomalies et les événements jusqu’à la date du rapport.',
    activities: ['Finaliser et indexer la documentation de mission.', 'Recenser les anomalies et examiner leur incidence individuellement et cumulativement.', 'Examiner les événements postérieurs et la continuité de l’exploitation.'],
    humanDecisions: ['Conclure sur les éléments collectés et sur les points non résolus.', 'Évaluer la continuité selon l’édition et la date d’effet pertinentes.'],
    deliverables: ['Mémo de clôture et tableau des anomalies.', 'Dossier de travail revu et points ouverts identifiés.'],
    referenceIds: ['ISA 230', 'ISA 450', 'ISA 540', 'ISA 560', 'ISA 570', 'ISA 570 (révisée 2024)'],
  },
  {
    id: 'rapport', title: 'Communication et rapport',
    objective: 'Communiquer les constats et préparer un rapport uniquement après les décisions et revues professionnelles requises.',
    activities: ['Communiquer les sujets pertinents aux personnes responsables de la gouvernance.', 'Examiner les autres informations et les éléments de rapport pertinents.', 'Documenter la version du rapport soumise à la revue.'],
    humanDecisions: ['La forme de l’opinion et le contenu du rapport ne sont jamais déduits par le logiciel.', 'Faire valider la communication et le rapport selon les textes applicables.'],
    deliverables: ['Projet de communication et rapport explicitement simulés.', 'Trace de revue et des questions non résolues.'],
    referenceIds: ['ISA 260', 'ISA 265', 'ISA 700', 'ISA 701', 'ISA 705', 'ISA 706', 'ISA 720'],
  },
]

export function isOfficialNormativeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'iaasb.org' || url.hostname === 'www.iaasb.org' || url.hostname === 'ohada.org' || url.hostname === 'www.ohada.org')
  } catch {
    return false
  }
}

export function normativeReferenceAnchor(id: string): string {
  return `reference-${id.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}
