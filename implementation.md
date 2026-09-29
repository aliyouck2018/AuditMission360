# AuditMission360 — Plan d’implémentation par étapes et sessions

Ce plan est conçu pour être exécuté sur plusieurs sessions OpenCode. Chaque session a un périmètre réduit et son prompt peut être repris sans dépendre de l’historique conversationnel.

## Références obligatoires

- Cahier des charges : [`cahier-des-charges-auditmission360.md`](cahier-des-charges-auditmission360.md)
- Dossier de conception : [`dossier-auditmission360.html`](dossier-auditmission360.html)
- Suivi d’exécution : [`tracking.md`](tracking.md)
- Application existante : `README.md` et code BrokerControl360 ; à lire seulement pour les conventions utiles.

## Règles d’exécution pour chaque session

1. Lire ce fichier, le cahier des charges et `tracking.md` au début de chaque session.
2. Inspecter le statut Git et les fichiers concernés avant modification. Préserver les changements préexistants, y compris les fichiers non suivis. Ne jamais les réinitialiser, supprimer, déplacer ou reformater sans nécessité pour l’étape demandée.
3. Dans une session donnée, implémenter uniquement les étapes nommées par le prompt copié. Ne pas anticiper les étapes suivantes.
4. Construire AuditMission360 en application indépendante dans ce repertoire.
5. Suivre les versions, conventions et critères du cahier des charges. Si une contradiction ou un prérequis manquant empêche l’étape, ne pas inventer une nouvelle portée : noter le blocage dans `tracking.md` et s’arrêter à cette étape.
6. Ajouter des tests ciblés avec les fonctions métier. Éviter les tests qui dupliquent simplement l’implémentation.
7. À la fin de chaque étape : effectuer ses vérifications, lire le diff, mettre à jour `tracking.md`, ajouter exactement la ligne `etapeX completee` (où X est le numéro réel de l’étape) **uniquement si l’étape est réellement complète**, puis fournir un résumé des fichiers modifiés et résultats de tests.
8. Si une étape échoue ou reste partielle, ne pas ajouter sa ligne de complétion. Décrire test échoué, blocage et prochaine action dans le suivi.
9. Ne pas faire de commit, ne pas publier ou déployer, ne pas ajouter de vraie donnée financière ou de secret.

## Convention de découpage et coût de session

- Six sessions indépendantes, dix étapes au total.
- Les petits groupes réunissent des tâches étroitement liées afin de limiter les relances et la répétition de contexte.
- Commencer une nouvelle session avec le prompt fourni pour sa session ; ne copier aucun code ni résumé depuis les anciennes conversations.
- Si le contexte ou le temps est insuffisant, terminer proprement une étape, mettre le suivi à jour, puis s’arrêter. Ne pas commencer une autre étape sans pouvoir la vérifier.

## Étapes détaillées

### Étape 1 — Squelette de l’application autonome

**Objectif :** créer le workspace séparé et un shell Vite/React/TypeScript fonctionnel, sans altérer BrokerControl360.

**Livrables attendus :**
- `frontend/` avec Vite React TypeScript, navigation minimale et identité visuelle AuditMission360 ;
- page d’accueil vide mais propre avec badge « démonstration / données fictives » et routes placeholders pour Mission, Méthodologie et Documents ;
- scripts frontend `dev`, `build`, `test` et configuration de test minimale ;
- `backend/` avec FastAPI, endpoint de santé, dépendances isolées et pytest ;
- `README.md` court indiquant prérequis et commandes de démarrage.

**Tests / vérifications :** build frontend, test smoke frontend, `pytest` backend, appel test de `/health`; vérifier le diff pour confirmer qu’aucun fichier racine existant n’a été altéré.

**Terminé si :** les deux sous-projets s’exécutent isolément, leurs commandes sont documentées et le tracking est mis à jour.

### Étape 2 — Domaine, base Dexie et données synthétiques

**Objectif :** construire les types métier et la persistance locale versionnée.

**Livrables attendus :**
- interfaces TypeScript des entités décrites dans le cahier des charges ;
- Dexie/IndexedDB autonome avec tables, index et version de schéma ;
- repositories/services typés plutôt que lectures-écritures directes dispersées dans les composants ;
- seed déterministe d’une mission fictive, quatre cycles et données de démonstration ;
- reset idempotent et tests de persistance, index, seed et reset.

**Tests / vérifications :** tests Vitest avec IndexedDB simulée (par exemple `fake-indexeddb`), build TypeScript.

**Terminé si :** seed/reset fonctionne à plusieurs reprises sans doublonner, aucune donnée réelle ni dépendance à la base de BrokerControl360.

### Étape 3 — Shell métier, mission, navigation et rôles de démo

**Objectif :** rendre navigable le parcours et la configuration de contexte.

**Livrables attendus :**
- layout responsive, navigation, cockpit simple et routes métier ;
- formulaire de création / édition de mission : pays, secteur, période, type, devise, référentiel et version ;
- sélection de rôle fictif (responsable, préparateur, réviseur, expert données, lecteur), explicitement simulée ;
- affichage du bandeau données fictives sur les vues et la confirmation de reset ;
- validations de formulaires et états loading/empty/error.

**Tests / vérifications :** tests de validation mission, routage critique, reset, build et test frontend.

**Terminé si :** l’utilisateur peut créer/ouvrir une mission, changer de profil de démo et naviguer sans page cassée.

### Étape 4 — Catalogue starter et génération assistée risques/assertions/procédures

**Objectif :** bâtir le cœur métier explicable à partir d’un catalogue initial borné.

**Livrables attendus :**
- catalogue versionné, source et statut de revue, pour ventes/créances, achats/fournisseurs, trésorerie/banques et stocks ;
- assertions séparées par opération, solde et présentation ;
- relations risk–assertion–procedure et modèles de procédures de contrôle/substantifs ;
- écran catalogue avec filtres et pages de détail ;
- assistant déterministe qui propose les modèles par contexte/cycle, sans scores opaques ;
- possibilité humaine de confirmer, adapter, écarter et justifier ; journaliser décisions et version source ;
- documentation qui les appelle « candidats » et explique les limites.

**Tests / vérifications :** tests des règles de filtrage/proposition, relations cohérentes, exclusions et enregistrement versionné ; build et tests.

**Terminé si :** les suggestions ne deviennent pas des risques actifs sans action explicite, le même contexte donne des suggestions reproductibles et l’utilisateur peut ajouter une spécificité d’entité.

### Étape 5 — Programme de travail, exécution, échantillon, preuves et revue

**Objectif :** permettre de faire vivre un test depuis l’affectation jusqu’à la revue.

**Livrables attendus :**
- programme mission avec tests liés au risque/assertion, propriétaire et échéance ;
- détail procédure avec objectif, étapes adaptables, population, échantillon déterministe de démo et références ;
- références de pièces synthétiques, résultats, commentaires et exceptions ;
- note de revue avec demande, réponse et résolution ;
- séparation logique préparateur/réviseur dans le parcours fictif ;
- journal des transitions essentielles.

**Tests / vérifications :** transitions valides/invalides, test exécuté relié, séparation préparateur/réviseur, note résolue avec réponse gardée.

**Terminé si :** démontrer au moins une procédure complète de bout en bout, sans pièce orpheline et avec revue traçable.

### Étape 6 — Page Méthodologie et liens normatifs

**Objectif :** intégrer un guide contextualisé, consultable indépendamment ou depuis le travail en cours.

**Livrables attendus :**
- page `/methodologie` divisée en étapes (acceptation, planification, risques, réponses, preuves, évaluation, clôture/rapport) ;
- pour chaque étape : objectif, activités, décisions humaines, livrables et liens vers normes pertinentes ;
- fiches/références cliquables vers IAASB et sources OHADA ;
- statut/version/date d’effet/adoption locale séparés, mention de vérification ;
- points de vigilance ISA 240 révisée et ISA 570 révisée 2024 publiées mais non encore effectives selon Handbook IAASB 2025 ;
- aucune reproduction intégrale de textes protégés.

**Tests / vérifications :** lien de chaque fiche étape, ouverture de source externe, liens invalides absents, rendu responsive et lecteur d’écran basique.

**Terminé si :** chaque étape a au moins une référence applicable ou une explication qu’aucune norme ISA directe ne suffit sans couche OHADA/locale; le statut reste prudent.

### Étape 7 — Bibliothèque de documents et export PDF

**Objectif :** créer des documents préremplis depuis les données du dossier et les exporter.

**Livrables attendus :**
- bibliothèque de modèles versionnés : lettre de mission, mémo de planification, matrice de risques, feuille de travail, note de revue, tableau d’anomalies, mémo de clôture, rapport simulé ;
- champs préremplis et champs manquants visibles ; brouillon modifiable avant aperçu ;
- gabarits HTML/CSS imprimables A4, marges, en-têtes/pieds, pagination raisonnable ;
- commande « Imprimer / Enregistrer en PDF » via le navigateur ;
- mention de simulation et identifiant de mission/version du modèle sur chaque sortie ;
- journal d’export et lien du document généré à son contenu source.

**Tests / vérifications :** tests de rendu et champs requis, test génération HTML stable, validation visuelle à l’écran/mobile et impression (si navigateur headless disponible); aucune lettre envoyée/signée.

**Terminé si :** lettre de mission fictive et feuille de travail peuvent être prévisualisées puis enregistrées en PDF à partir des données de démo.

### Étape 8 — Import CSV et analytics explicables

**Objectif :** démontrer l’analyse d’une population sans perdre la provenance.

**Livrables attendus :**
- import d’un CSV synthétique, aperçu, mapping colonnes, erreurs et contrôles débit/crédit ;
- conservation de la provenance, empreinte logique et numéros de lignes ;
- règles déterministes : doublons possibles, montants ronds, écritures tardives, comptes inhabituels et ruptures de séquence ;
- résultats décrits comme signaux à examiner et non comme fraude/anomalie avérée ;
- lien d’une exception à un test et une décision humaine documentée.

**Tests / vérifications :** CSV correct, colonnes absentes, nombres/date invalides, doublons, reproductibilité, remontée à ligne source et build/test backend éventuel.

**Terminé si :** un import de démonstration fonctionne et un signal peut être examiné, annoté puis exporté avec ses références sources.

### Étape 9 — Constats, cockpit de clôture et dossier exporté

**Objectif :** relier les résultats et revues en vue de clôture, sans produire une opinion automatique.

**Livrables attendus :**
- registre des constats avec faits, critères/référence, cause, risque/impact indicatif, recommandation, responsable et délai ;
- tableau des procédures, preuves, exceptions et points de revue encore ouverts ;
- synthèse cockpit avec définitions des KPI et limites ;
- export HTML/PDF de démonstration et index de pièces, tous marqués simulés ;
- finalisation de mission empêchée par états ouverts selon critères de workflow démo, avec explication ;
- aucune phrase générée qui affirme une opinion ou conformité réelle.

**Tests / vérifications :** calcul KPI et dénominateur, filtres ouverts/résolus, export contient statut/version/watermark et respect des liens.

**Terminé si :** le parcours complet du cahier des charges se termine par un dossier exportable et fidèle aux données.

### Étape 10 — Intégration, qualité, sécurité démo et livraison portfolio

**Objectif :** vérifier l’ensemble, traiter les incohérences et documenter le runbook final.

**Livrables attendus :**
- tests ciblés sur les parcours critiques et contrôle manuel du responsive/accessibilité ;
- aucune route cassée, aucun lien interne invalide, reset fiable ;
- scripts et README AuditMission360 complets ;
- synthèse architecture, données synthétiques, normes et limites ;
- commandes frontend `npm run build`, `npm test` et backend `pytest` exécutées ;
- revue finale des changements, status Git et tracking exact.

**Terminé si :** les contrôles passent, les défaillances connues sont consignées, et toutes les étapes précédentes sont vérifiées. Ne pas déployer sans demande séparée.

## Sessions proposées et prompts à copier

### Session 1 — Fondations

**Étapes : 1.** Garder cette première session courte : scaffold propre et commandes fiables.

**Prompt :**

> Lis `implementation.md`, `cahier-des-charges-auditmission360.md` et `tracking.md`. Inspecte d’abord le statut Git et respecte tous les changements préexistants. Implémente uniquement l’étape 1 de `implementation.md` : squelette d’AuditMission360. N’anticipe aucune autre étape. Lance les vérifications de l’étape 1, inspecte le diff puis mets à jour `tracking.md`. Si et seulement si toutes les conditions passent, ajoute exactement `etape1 completee`. Sinon note le blocage sans marquer l’étape terminée. Résume fichiers et tests.

### Session 2 — Modèle et parcours de mission

**Étapes : 2 et 3.** Le domaine persistant précède l’interface de mission qui l’utilise.

**Prompt :**

> Lis `implementation.md`, `cahier-des-charges-auditmission360.md` et `tracking.md`; vérifie le statut Git. Implémente uniquement les étapes 2 puis 3 (modèle métier/Dexie/seed/reset, puis shell, mission et rôles fictifs). Traite-les l’une après l’autre : vérifie les critères et tests de l’étape 2, marque-la complète et ajoute exactement `etape2 completee` avant de commencer l’étape 3. Pour l’étape 3, exécute ses tests, puis ajoute exactement `etape3 completee` seulement si elle passe. Si l’étape 2 échoue, arrête-toi sans débuter l’étape 3. Rapporte commandes, résultats et fichiers touchés.

### Session 3 — Risques, catalogue et exécution

**Étapes : 4 et 5.** Elles constituent la chaîne centrale risque → travail → preuve → revue.

**Prompt :**

> Lis `implementation.md`,  `cahier-des-charges-auditmission360.md` et `tracking.md`; vérifie les étapes prérequises et le statut Git. Implémente uniquement les étapes 4 et 5. D’abord le catalogue starter versionné et les suggestions explicables, puis, seulement après réussite et suivi exact de l’étape 4, le programme, l’exécution, les preuves et la revue. Les risques sont des candidats confirmés par une personne; aucune classification de fraude/opinion automatique. Pour chaque étape terminée, exécute ses tests, inspecte le diff, marque son statut et ajoute sa ligne exacte (`etape4 completee`, puis `etape5 completee`). Si une étape bloque, ne démarre pas la suivante et documente le blocage dans `tracking.md`.

### Session 4 — Méthodologie et documents

**Étapes : 6 et 7.** Cette session couvre les ressources d’aide et les livrables exportables.

**Prompt :**

> Lis `implementation.md`,  `cahier-des-charges-auditmission360.md` et `tracking.md`; inspecte d’abord le statut Git. Implémente uniquement l’étape 6 (page Méthodologie et références normatives cliquables) puis l’étape 7 (modèles de documents et impression/export PDF navigateur). Pour chaque norme, conserve le lien officiel, la version/date et le statut d’effet/adoption; ne distribue pas de texte protégé et ne déclare pas le produit conforme. Les lettres restent des brouillons de démonstration, non signés/non envoyés. Termine et vérifie l’étape 6 avant la 7; ajoute exactement `etape6 completee` et `etape7 completee` dans `tracking.md` uniquement après leurs tests respectifs. N’ajoute aucune autre fonctionnalité.

### Session 5 — Import analytique et clôture

**Étapes : 8 et 9.** Une exception analytique doit pouvoir être tracée jusqu’au dossier et au livrable.

**Prompt :**

> Lis `implementation.md`,  `cahier-des-charges-auditmission360.md` et `tracking.md`; inspecte le statut Git et les prérequis. Implémente uniquement l’étape 8 (CSV synthétique et règles analytiques déterministes) puis l’étape 9 (constats, cockpit de clôture et export du dossier). Les signaux restent « à investiguer »; ne conclus pas automatiquement à une fraude ou à une anomalie significative. Vérifie chaque étape avant d’aller à la suivante, mets le tracking à jour et ajoute exactement `etape8 completee` puis `etape9 completee` seulement lorsque leurs critères passent. Si un blocage survient, stoppe l’étape suivante et consigne le détail.

### Session 6 — Stabilisation et livraison

**Étape : 10.** À exécuter lorsque les étapes 1 à 9 sont terminées ou que leurs blocages sont explicitement résolus.

**Prompt :**

> Lis `implementation.md`,  `cahier-des-charges-auditmission360.md` et `tracking.md`; inspecte le statut Git. Implémente uniquement l’étape 10 : intégration, accessibilité, tests, README et qualité de livraison portfolio. Ne profite pas de cette passe pour étendre le périmètre métier. Exécute les commandes prévues (frontend build/test et backend pytest), vérifie liens/routes/reset et inspecte le diff. Mets à jour `tracking.md` et ajoute exactement `etape10 completee` uniquement si tous les critères de l’étape sont satisfaits. Ne committe et ne déploie pas. Fournis résumé, résultats des tests et blocages éventuels.

## Fin de session — format de compte rendu

L’agent renvoie à chaque fin de session :

1. étapes traitées et leur état ;
2. fichiers créés/modifiés ;
3. commandes de vérification avec résultat ;
4. lignes `etapeX completee` effectivement ajoutées au suivi ;
5. blocage restant ou prochaine session recommandée.
