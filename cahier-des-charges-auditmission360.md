# Cahier des charges — AuditMission360

**Version :** 1.0 — 29 septembre 2026  
**Nature :** application portfolio / démonstrateur métier  
**Documents de référence :** [`dossier-auditmission360.html`](dossier-auditmission360.html), [`rapport-audit-financier-cemac.html`](rapport-audit-financier-cemac.html)  
**Plan d’exécution pour l’agent :** [`implementation.md`](implementation.md) · **Suivi :** [`tracking.md`](tracking.md)

## 1. Résumé et objectif

AuditMission360 est un démonstrateur de gestion de mission d’audit financier. Il rend visible et traçable le lien entre le contexte de mission, les risques, les assertions, les procédures, les éléments probants, les revues et les livrables.

Le premier scénario est une PME entièrement fictive de l’espace OHADA. Le référentiel SYSCOHADA est montré comme choix pédagogique du scénario, pas comme règle universelle. Le produit est pensé pour un portfolio développeur et non pour la conduite réelle de missions avec données sensibles.

### Résultat attendu

Un utilisateur peut parcourir un cas de bout en bout : créer une mission, examiner un catalogue de risques candidats, sélectionner les assertions et procédures, exécuter des travaux documentés, résoudre une note de revue, consulter la méthodologie, générer des documents et exporter le dossier de démonstration en PDF.

## 2. Principes impératifs

1. **Décision humaine :** le logiciel ne certifie pas de comptes, ne rend pas d’opinion et ne conclut pas automatiquement à une fraude ou à une anomalie significative.
2. **Suggestions explicables :** les risques et procédures sont proposés depuis un catalogue versionné ; chaque suggestion peut être confirmée, ajustée ou écartée avec justification.
3. **Référentiels explicites :** pays, secteur, type de mission, référentiel, édition et période sont visibles dans le dossier.
4. **Traçabilité :** conserver qui a créé, changé, revu et exporté les objets métier. Les modèles utilisés sur une mission sont figés/versionnés.
5. **Démo sûre :** toutes les entités, pièces, montants et personnes sont fictifs ; chaque export porte une mention visible de démonstration.
6. **Séparation de produit :** développer l’application autonome dans `auditmission360/`. Ne pas incorporer ses objets au schéma métier de BrokerControl360, ne pas modifier l’application existante ni ses fichiers de travail.
7. **Évolution sans promesse réglementaire :** les normes citées sont des liens de méthode à vérifier ; le prototype ne se déclare pas conforme à une norme ou à une juridiction.

## 3. Périmètre

### Inclus au MVP

- Application web responsive en français, utilisable localement.
- Mission de démonstration persistée dans IndexedDB/Dexie.
- Contexte de mission, membres fictifs, navigation et rôles simulés.
- Starter catalogue borné à quatre cycles : ventes/créances, achats/fournisseurs, trésorerie/banques, stocks.
- Risques candidats, assertions, procédures types et liens entre ces objets.
- Modification humaine, justification des choix et version du catalogue employée.
- Programme de travail, procédures exécutées, populations/échantillons de démonstration, références de preuves, exceptions et notes de revue.
- Page Méthodologie avec phases de mission, descriptions, références ISA/OHADA et liens vers sources officielles.
- Modèles de lettre de mission, feuilles de travail, note de revue, tableau d’anomalies et rapport de démo.
- Prévisualisation, impression / enregistrement PDF et filigrane de démonstration.
- Import CSV synthétique de grand livre, mapping et analyses déterministes explicables.
- Journal d’événements local, reset de la démo et tests pertinents.

### Exclu

- Authentification, autorisation, partage ou stockage multi-utilisateur sécurisés en production.
- Données, relevés, pièces, personnes ou clients réels.
- Opinion d’audit générée, signature électronique ou envoi automatique de courriers.
- Prétention à un catalogue complet de tous les risques et règles CEMAC/OHADA.
- Validation automatique de l’applicabilité d’une norme dans un pays.
- Connecteurs bancaires, comptables, BVMAC, COBAC ou COSUMAF.
- IA générative ou décisionnelle. Le MVP emploie un assemblage déterministe de modèles.

## 4. Utilisateurs de démonstration

| Rôle | Capacités de démonstration |
|---|---|
| Responsable de mission | Configure le dossier, affecte les travaux, confirme les risques et supervise les étapes. |
| Préparateur | Réalise les procédures affectées, ajoute des références de preuves, répond aux notes. |
| Réviseur | Consulte et commente les travaux, demande un complément, ferme les notes de revue. |
| Expert données | Importe une population de test et examine les exceptions analytiques. |
| Lecteur / qualité | Consulte le dossier, les versions et le journal en lecture seule. |

Les rôles sont un **sélecteur d’expérience locale** pour le portfolio, jamais une mesure de sécurité ou une véritable authentification.

## 5. Parcours métier requis

1. **Initialiser le scénario** — charger/reset les données synthétiques et afficher le mode démonstration.
2. **Créer la mission** — saisir nom fictif, pays, exercice, secteur, type de mission, devise, équipe et référentiel avec statut/version.
3. **Comprendre l’entité** — consulter ou compléter le questionnaire et les cycles de la mission.
4. **Construire la matrice** — voir les risques candidats et leurs motifs, choisir les assertions concernées, évaluer manuellement et documenter la décision.
5. **Planifier les travaux** — choisir les procédures types liées aux risques/assertions, adapter étapes et étendue, désigner responsable et échéance.
6. **Exécuter** — joindre une preuve factice ou une référence de ligne, saisir la population / sélection et consigner le résultat.
7. **Réviser** — le réviseur ouvre une note, le préparateur répond, les versions et décisions restent visibles.
8. **Traiter les exceptions** — qualifier un signal comme à investiguer, lier des éléments et documenter la résolution humaine.
9. **Générer les documents** — remplir depuis le dossier les modèles autorisés, contrôler les champs et prévisualiser.
10. **Conclure la démo** — afficher les éléments ouverts et l’état de revue, générer l’index et les exports simulés.

## 6. Génération des risques, assertions et procédures

### Mécanisme

La génération est déterministe et assistée :

1. Contexte mission + cycle activent les modèles marqués comme candidats pour ce contexte.
2. Réponses de compréhension permettent de suggérer des risques types / questions complémentaires.
3. Pour chaque risque, le produit montre les assertions liées et explique le rattachement.
4. Pour chaque relation risque–assertion, le produit suggère un ou plusieurs modèles de procédure de contrôle ou substantifs.
5. L’utilisateur confirme, adapte ou écarte ; toute évaluation du risque et toute décision de signification reste saisie/revue par une personne.
6. Les analyses CSV ne font que générer des signaux explicables à investiguer ; elles ne créent pas seules une conclusion de risque.

### Starter catalogue

Prévoir, à titre initial de démonstration, 3 à 6 risques candidats et 3 à 5 procédures types par cycle, sans imposer ces volumes comme modèle universel.

| Cycle | Exemples de risques candidats | Assertions possibles | Exemples de procédure |
|---|---|---|---|
| Ventes / créances | Vente non justifiée, cut-off, créance douteuse sous-évaluée | Réalité, exhaustivité, exactitude, cut-off, évaluation, droits, présentation | Facture/commande/livraison, cut-off, encaissements postérieurs, balance âgée |
| Achats / fournisseurs | Passif omis, réception non facturée, doublon, cut-off | Exhaustivité, réalité, exactitude, cut-off, classification, obligations | Recherche de passifs, facture/commande/réception, paiement postérieur |
| Trésorerie / banques | Rapprochement erroné, suspens ancien, fonds restreint mal présenté | Existence, exhaustivité, exactitude/évaluation, cut-off, droits, présentation | Recalcul rapprochement, relevé/GL, cut-off, confirmation fictive |
| Stocks | Quantité inexacte, obsolescence, valorisation ou mouvement de clôture erroné | Existence, exhaustivité, droits, évaluation, cut-off, classification | Comptage simulé, coût sur pièces, rotation/dépréciation, mouvements de clôture |

Les assertions doivent être distinguées selon opérations/événements, soldes et informations fournies. Exemple de vocabulaire : occurrence/réalité, exhaustivité, exactitude, cut-off, classification, existence, droits et obligations, évaluation/imputation, présentation/compréhensibilité. Libellés à aligner sur la traduction/édition de la norme applicable.

### Modèle de données d’un item catalogue

- identifiant stable, type (`risk`, `assertion`, `procedure`, `control`), libellé et description ;
- cycle, catégorie d’opération/solde/information, contexte applicable et mots-clés ;
- identifiants des risques/assertions/procédures reliés ;
- objectif et étapes suggérées ; prérequis, population, preuves attendues et résultat à consigner ;
- références de normes à titre indicatif ; source, édition/date et statut de validation ;
- version, auteur, réviseur, état (brouillon, revu, approuvé, retiré) ;
- justification utilisateur pour personnalisation, ajout et exclusion.

Ne pas afficher un risque suggéré comme avéré, un contrôle comme testé ni une procédure modèle comme adéquate sans adaptation.

## 7. Fonctionnalités, écrans et exigences détaillées

| Module | Écran / fonctions | Résultat vérifiable |
|---|---|---|
| Cockpit | Statut par cycle, travaux en cours, notes de revue, demandes et échéances | L’utilisateur peut retrouver les blocages et ouvrir l’objet concerné. |
| Mission | Paramètres, personnes/roles de démo, dates, référentiel | Contexte persiste et est réutilisé dans les autres écrans. |
| Catalogue | Cycles, risques, assertions, procédures types et état de validation | Les éléments sont filtrables, consultables et distingués des choix déjà confirmés. |
| Risques | Liste et matrice cycle–risque–assertion–réponse | L’utilisateur confirme, ajuste ou écarte un candidat en donnant le motif. |
| Programme | Procédures assignées, statut, responsable, échéance et objectifs | Une procédure est liée à au moins un risque ou objectif documenté. |
| Feuille de travail | Étapes, échantillon, références, résultat, conclusion du préparateur | Un travail soumis conserve auteur/date/version et peut être revu. |
| Revue / constats | Notes, réponses, exceptions, constats et actions de suivi | Cycle ouvert → répondu → résolu avec commentaires conservés. |
| Méthodologie | Étapes d’audit et normes associées, liens externes officiels | Chaque référence est cliquable ; son statut d’effet/adoption n’est pas confondu. |
| Documents | Galerie de modèles, génération, aperçu, impression PDF | Document prérempli, éditable en brouillon, daté, versionné et marqué démo. |
| Imports | CSV, mapping, validation, contrôles simples et exceptions | La provenance et les numéros de ligne source sont conservés. |
| Journal | Événements d’actions métier | Les changements structurants et exports sont consultables par date/acteur. |

## 8. Génération documentaire et PDF

### Modèles MVP

1. Lettre de mission fictive (brouillon / modèle de démonstration).
2. Mémo de planification.
3. Matrice risques/assertions.
4. Programme et feuille de travail de cycle / test.
5. Feuille d’échantillonnage.
6. Note de revue et réponse.
7. Tableau des anomalies / suivi.
8. Lettre de recommandations ou communication des points de contrôle interne.
9. Mémo de clôture / index de dossier.
10. Projet de rapport explicitement simulé.

### Flux attendu

- choisir un type et une version de gabarit ;
- préremplir uniquement les champs connus et afficher les champs obligatoires manquants ;
- permettre une revue/correction avant génération ;
- produire un aperçu A4 HTML/CSS et imprimer / enregistrer au format PDF dans le navigateur ;
- ajouter un bandeau/filigrane « AuditMission360 — données synthétiques — document simulé » ;
- journaliser type, version du modèle, horodatage, mission et utilisateur de démo ;
- garder le document source et les références de données liés à l’export.

L’envoi à un client, la signature, l’émission d’une vraie lettre ou l’opinion finale sont hors périmètre.

## 9. Méthodologie et référentiels

La page est un guide pratique lié au dossier actif. Pour chaque étape, elle expose : objectif, activités, résultat attendu, questions de revue, documents associés et liens normatifs.

| Étape | Normes ISA à relier dans la démo |
|---|---|
| Acceptation / maintien | ISA 210, ISA 220, ISQM 1 ; règles d’éthique et textes OHADA applicables |
| Planification / matérialité | ISA 300, ISA 320, ISA 220 |
| Compréhension / risques | ISA 315, ISA 240, ISA 250 |
| Réponses / contrôles | ISA 330, ISA 265, ISA 540 si estimations |
| Éléments probants / tests | ISA 500, ISA 501, ISA 505, ISA 520, ISA 530 |
| Évaluation / clôture | ISA 230, ISA 450, ISA 540, ISA 560, ISA 570 |
| Communication / rapport | ISA 260, ISA 265, ISA 700, ISA 701, ISA 705, ISA 706, ISA 720 |

Références à contrôler et lier : [Handbook IAASB 2025](https://www.iaasb.org/publications/2025-handbook-international-quality-management-auditing-review-other-assurance-and-related-services), [référentiel officiel IAASB](https://www.iaasb.org/standards-pronouncements), [AUDCIF OHADA](https://www.ohada.org/acte-uniforme-relatif-au-droit-comptable-et-a-linformation-financiere-audcif/), [Règlement professionnel OHADA 01/2017](https://www.ohada.org/mise-en-ligne-du-reglement-portant-harmonisation-des-pratiques-des-professionnels-de-la-comptabilite-et-de-l-audit-dans-les-etats-membres-de-l-ohada/).

Édition publiée, date d’entrée en vigueur et adoption locale sont des propriétés distinctes. Le Handbook IAASB 2025 annonce ISA 240 (révisée) et ISA 570 (révisée 2024) comme non encore effectives dans cette édition : elles doivent être présentées avec une alerte de statut et ne pas être activées silencieusement. Liens normatifs destinés à l’information/conception, pas à la distribution non autorisée des textes protégés.

## 10. Architecture et contraintes techniques

### Organisation isolée

```text
  frontend/     # React + TypeScript + Vite
  backend/      # FastAPI stateless, Pydantic, tests pytest
  README.md     # démarrage, scénario de démo, limites
```

On peut s’inspirer de React/TypeScript, React Router, Dexie/IndexedDB, validation de schémas, tests Vitest et FastAPI utilisés dans le projet "../BrokerControl360".

### Architecture MVP

- Frontend : React + TypeScript + Vite, React Router, `lucide-react`, tests Vitest/Testing Library.
- Persistance locale : Dexie/IndexedDB dédiée à AuditMission360, versionnée et migrable ; aucun sync multi-utilisateur.
- Backend FastAPI stateless indépendant : validations / calculs analytics si requis ; le workflow mission reste local dans le MVP.
- PDF : HTML/CSS avec print stylesheet A4 et `window.print()` ; pas de service PDF hébergé nécessaire au portfolio.
- Données : seed synthétique réinitialisable, contrôlé par identifiants stables.
- Pas de mot de passe ni secret réel ; profils de démo annoncés comme tels.

### Entités de premier niveau

`Mission`, `TeamMember`, `Cycle`, `Risk`, `Assertion`, `RiskAssertionLink`, `ProcedureTemplate`, `ProcedureExecution`, `Population`, `SampleItem`, `EvidenceReference`, `ReviewNote`, `Finding`, `ActionPlan`, `MethodologyReference`, `DocumentTemplate`, `GeneratedDocument`, `AuditEvent`, `ImportJob`, `AnalyticsException`.

Chaque entité a au minimum un id et des timestamps appropriés. Tous les objets de mission sont rattachés à un `missionId`. Les modèles catalogue et instances utilisées dans un dossier sont distincts/versionnés.

## 11. Données de démonstration

- PME, employés, clients, fournisseurs, banques et données inventés.
- Jeu CSV contenant débit/crédit équilibrés et des anomalies injectées décrites dans un manifeste.
- Scénarios : transaction tardive, doublon apparent, pièce manquante, rapprochement normal, note de revue non résolue.
- Aucune donnée issue des activités ou fichiers clients de BrokerControl360.
- Bouton « Réinitialiser la démo » restaure un état de départ déterministe.

## 12. Exigences UX, accessibilité et qualité

- Français, responsive mobile/desktop, navigation clavier et libellés compréhensibles.
- États de chargement, vide, erreur, succès et lecture seule.
- Les actions irréversibles simulées sont confirmées ; suppression/remplacement de données source évité.
- Les champs obligatoires et raisons de validation sont visibles.
- Pas de données sensibles dans les logs ou captures.
- Les KPI affichent leur définition et rappellent qu’une complétude documentaire ne mesure pas la qualité d’audit.

## 13. Critères d’acceptation du projet

- Le démarrage et les tests de l’application sont documentés et ne dépendent pas de BrokerControl360.
- Création d’une mission et réinitialisation des données fonctionne.
- Pour chaque risque suggéré, l’interface affiche le statut de suggestion et exige une confirmation explicite avant activation.
- Risques, assertions et procédures sont liés et peuvent être adaptés avec justification.
- Une procédure peut être exécutée, documentée et revue ; l’historique de revue est conservé.
- Le guide Méthodologie contient des liens navigables vers les normes et sources officielles correspondant aux étapes.
- Les modèles lettre de mission et feuille de travail peuvent être prévisualisés puis imprimés en PDF.
- Un CSV synthétique peut être mappé, validé et analysé ; chaque exception peut remonter aux données d’origine.
- Les exports sont marqués comme fictifs/simulés.
- `npm run build`, `npm test` dans le frontend et `pytest` pour le backend passent pour les changements applicables.
- `tracking.md` ne marque une étape achevée qu’après satisfaction de ses critères et contrôles.

## 14. Risques produit à éviter

- Employer « génération automatique des risques » comme promesse de couverture exhaustive.
- Présenter un score de risque comme une évaluation normative ou professionnellement approuvée.
- Confondre erreur de qualité de données, anomalie d’audit et fraude.
- Appliquer un modèle SYSCOHADA général à une institution explicitement assujettie à un régime sectoriel.
- Oublier l’édition et l’entrée en vigueur des références publiées.
- Faire croire qu’un rôle simulé ou une base navigateur assure confidentialité et contrôle d’accès.
