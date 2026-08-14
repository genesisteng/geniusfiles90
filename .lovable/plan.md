# Plan H — Nettoyage, fiabilisation et finalisation de GeniusFiles

## Analyse

Le projet est déjà très avancé, mais la documentation révèle surtout un problème de cohérence et de dette technique : certaines fonctionnalités sont réellement terminées, d'autres sont partielles, d'autres encore existent uniquement sous forme de code non utilisé. Le plan H doit donc éviter une nouvelle refonte générale et procéder par étapes contrôlées.

Ordre retenu : assainir le périmètre, corriger les incohérences et les écrans défectueux, terminer uniquement les fonctionnalités réellement utiles, intégrer les applications GeniusFiles au système Android, ajouter les widgets, puis terminer par une phase d'optimisation et de vérification globale.

## Vue d'ensemble des étapes

| Étape | Objectif principal                                                 |
| ----- | ------------------------------------------------------------------ |
| H1    | Audit complet et cartographie avant modification                   |
| H2    | Suppression définitive du transfert et de tout son code            |
| H3    | Suppression des fonctionnalités abandonnées et du code mort        |
| H4    | Nettoyage du système de préférences                                |
| H5    | Correction des incohérences et bugs identifiés                     |
| H6    | Finalisation des fonctionnalités réellement utiles mais partielles |
| H7    | Fiabilisation du système de navigation, états et rafraîchissement  |
| H8    | Optimisation générale des performances                             |
| H9    | Intégration Android des applications internes « Ouvrir avec »      |
| H10   | Widgets Android réels et professionnels                            |
| H11   | Nettoyage UX/UI et cohérence générale                              |
| H12   | Audit internationalisation et Genius AI                            |
| H13   | Sécurité, permissions et composants Android                        |
| H14   | Nettoyage final du projet et suppression du code mort résiduel     |
| H15   | Validation complète APK Android et contrôle anti-régression        |

---

## H1 — Audit complet avant modification

Objectif : parcourir réellement le projet et comparer l'état du code avec l'état attendu de GeniusFiles.

Éléments à identifier :

- code inutilisé
- fonctionnalités abandonnées
- composants orphelins
- routes inutiles
- préférences sans interface
- fonctionnalités partielles
- doublons
- anciens systèmes encore référencés
- dépendances inutiles
- permissions devenues inutiles
- éléments encore liés au transfert
- incohérences entre web, Android et interface
- erreurs connues
- performances potentiellement problématiques

Important : H1 reste en lecture/audit. Aucun nettoyage massif ne doit être effectué avant d'avoir établi ce diagnostic.

---

## H2 — Suppression définitive du transfert entre appareils

Supprimer complètement la fonctionnalité de transfert entre appareils :

- interface, routes, boutons, textes, états
- logique métier, services
- recherches de périphériques, découverte automatique, Wi-Fi Direct, connexions locales, QR codes
- permissions associées, notifications associées
- composants, hooks, stores, services natifs
- code de secours, anciens messages, traductions, références résiduelles

Attention : ne pas supprimer le système interne de copie/déplacement de fichiers, qui est une fonctionnalité fondamentale du gestionnaire.

Après suppression, vérifier que GeniusFiles ne demande plus aucune permission Android uniquement nécessaire au transfert entre appareils.

---

## H3 — Suppression des fonctionnalités abandonnées et du code mort

Supprimer complètement les éléments explicitement abandonnés :

- organisation intelligente
- reconnaissance faciale
- transcription audio
- résumé vidéo
- traduction de contenu
- recherche multimodale
- organisation avancée
- modèle d'habitudes
- suggestions proactives
- synchronisation multi-appareils
- anciens systèmes de transfert
- fonctionnalités retournant systématiquement une valeur vide
- messages de repli devenus inutiles

Supprimer également le code devenu orphelin à la suite de ces suppressions.

Ne pas supprimer une fonctionnalité simplement parce qu'elle semble peu utilisée : elle doit d'abord être vérifiée comme réellement inutilisée.

---

## H4 — Nettoyage du système de préférences

Réduire le système de préférences aux réglages réellement exposés et utiles. Supprimer les préférences internes devenues inutiles, notamment :

- taille du texte
- densité
- animations si elles ne sont pas réellement proposées
- réglages avancés de recherche/indexation
- canaux de notification détaillés
- contraintes d'automatisation non exposées
- verrouillage automatique hors coffre-fort
- biométrie hors coffre-fort
- widgets en tant que simple préférence fictive

Exception importante : les widgets Android réels seront développés en H10 ; ne pas supprimer leur possibilité d'implémentation, seulement les anciennes préférences fictives qui ne pilotent rien.

---

## H5 — Correction des incohérences et bugs connus

1. Remplacer `X_PLACEHOLDER_MERGE_SUMMARY` par le véritable résumé de fusion PDF.
2. Supprimer le français codé en dur dans Genius AI.
3. Corriger les dates selon la langue active.
4. Corriger le pluriel de « fichier » dans l'historique des automatisations.
5. Corriger l'ouverture de `/automatisations/historique`.
6. Corriger la version affichée dans À propos afin qu'elle corresponde réellement à l'application.
7. Décider du statut du scanner de documents : implémenter réellement les fonctions annoncées, ou ne plus les présenter comme disponibles.
8. Corriger la création d'archives afin que l'interface corresponde réellement aux formats supportés.
9. Examiner le CORS de l'assistant et le réduire au strict nécessaire.
10. Supprimer ou protéger correctement `/diagnostic-clavier` pour qu'il ne soit pas exposé comme une fonctionnalité de production.

Chaque correction doit être testée dans son flux complet.

---

## H6 — Finalisation des fonctionnalités réellement utiles

Ne pas chercher à terminer toutes les fonctionnalités abandonnées ; se concentrer sur celles qui font partie du produit final :

scanner de documents · conversions Office · compression PDF · éditeur Word · création d'archives · visualisation PDF · lecteurs · éditeurs · automatisations · coffre-fort · nettoyeur · recherche.

Pour chaque fonctionnalité : fonction annoncée → comportement réel → cas limites → erreur → annulation → résultat final.

Si une fonctionnalité ne peut pas garantir ce qu'elle promet, son comportement doit être ajusté afin que l'interface ne fasse aucune promesse trompeuse.

---

## H7 — Fiabilisation globale des états et de la navigation

Éviter :

- écrans qui clignotent
- listes qui disparaissent pendant un rafraîchissement
- positions de défilement perdues
- retours Android incohérents
- pages empilées inutilement dans l'historique
- états obsolètes après suppression
- fichiers encore affichés après modification
- actualisations inutiles, chargements répétés
- perte de sélection, perte de contexte

Principe : afficher immédiatement les données connues → effectuer la mise à jour réelle → réconcilier proprement → conserver la position et le contexte.

Corriger également définitivement l'ouverture de l'historique des automatisations.

---

## H8 — Optimisation générale des performances

Optimiser sans modifier inutilement l'architecture. Priorités :

1. démarrage rapide
2. affichage immédiat du contenu disponible
3. navigation instantanée
4. défilement parfaitement fluide
5. recherche rapide
6. ouverture rapide des fichiers
7. actualisation efficace
8. faible consommation mémoire
9. faible consommation batterie
10. absence de traitements inutiles en arrière-plan

Rechercher : re-rendus inutiles, scans répétés, calculs répétés, lectures disque inutiles, requêtes redondantes, images trop lourdes, miniatures inutilement recalculées, indexations répétitives, opérations bloquantes, listeners jamais supprimés, timers persistants, caches mal invalidés.

Ne jamais sacrifier la fiabilité ou la stabilité pour un gain de performance.

---

## H9 — Intégration Android des applications internes « Ouvrir avec »

Faire de GeniusFiles un véritable fournisseur d'applications Android intégrées. Modules à déclarer lorsque c'est techniquement possible :

lecteur d'images · lecteur vidéo · lecteur audio · lecteur PDF · lecteur de documents · éditeur photo · éditeur audio · éditeur de documents · autres modules réellement capables d'ouvrir ou modifier un type de fichier.

Lorsqu'une autre application Android demande « Ouvrir avec », GeniusFiles doit apparaître comme application compatible avec les formats qu'il sait réellement traiter.

Intégration propre : bons types MIME, bonnes extensions, bonne transmission du fichier, ouverture directe dans le module approprié, retour correct vers l'application appelante, respect des permissions, aucun fichier temporaire inutile, aucun crash si le fichier n'est pas accessible, comportement cohérent pour les fichiers provenant d'autres applications.

Ne jamais déclarer GeniusFiles compatible avec un format qu'il ne sait pas réellement ouvrir.

---

## H10 — Widgets Android réels et professionnels

Créer de véritables widgets utilisables depuis l'écran d'accueil : réellement fonctionnels, rapides, légers, adaptatifs aux différentes tailles, compatibles thèmes clair et sombre, cohérents avec le design GeniusFiles, utilisables sans ouvrir inutilement l'application.

Exemples pertinents : accès rapide aux stockages · espace disponible · fichiers récents · raccourcis vers les catégories · accès rapide au coffre-fort · lancement rapide de la recherche · éventuellement état des automatisations.

Les widgets doivent utiliser uniquement des informations réellement disponibles et ne jamais afficher de données fictives ou obsolètes.

---

## H11 — Nettoyage et harmonisation UI/UX

Passe complète sur l'interface : tailles des icônes, espacements, typographie, boutons, cartes, dialogues, feuilles, toasts, états vides, erreurs, chargements, animations, barres de navigation, lecteurs, outils, paramètres.

L'objectif n'est pas de refaire GeniusFiles mais de supprimer les incohérences restantes. Toutes les pages doivent donner l'impression d'appartenir à une seule application Android premium.

---

## H12 — Audit complet des langues

Scanner toute l'application à la recherche de : français codé en dur, anglais codé en dur, chaînes non traduites, pluriels incorrects, dates mal localisées, formats numériques incorrects, messages d'erreur non traduits, textes des lecteurs, des dialogues, des notifications et des widgets.

Les 7 langues doivent rester cohérentes : Français · English · Español · Deutsch · Português · Italiano · Türkçe.

Genius AI doit continuer à répondre dans la langue du message de l'utilisateur, indépendamment de la langue de l'interface.

---

## H13 — Audit sécurité et permissions Android

Pour chaque permission : pourquoi existe-t-elle ? → quelle fonctionnalité l'utilise réellement ? → est-elle indispensable ?

Supprimer les permissions devenues inutiles, notamment celles liées aux fonctionnalités abandonnées.

Vérifier également : coffre-fort, fichiers temporaires, FileProvider, installation APK, partage, notifications, automatisations, services en arrière-plan, assistant IA, accès stockage.

Objectif : ne conserver que les permissions réellement justifiées.

---

## H14 — Nettoyage final du projet

Seconde recherche complète après toutes les modifications : fichiers inutilisés, composants orphelins, routes mortes, fonctions jamais utilisées, imports inutilisés, variables inutilisées, anciens textes, anciennes traductions, anciens assets, anciens systèmes de navigation, anciens stores, anciennes permissions, commentaires devenus faux, code de compatibilité devenu inutile, références aux fonctionnalités supprimées.

Ne supprimer du code qu'après avoir vérifié qu'il n'est utilisé nulle part.

---

## H15 — Validation finale

Ne plus ajouter de fonctionnalité. Validation complète de GeniusFiles, en testant au minimum :

premier lancement · permissions · accueil · stockages · carte SD · USB/OTG · catégories · recherche · fichiers récents · sélection · copier · déplacer · supprimer · corbeille · restauration · coffre-fort · PDF · images · vidéos · audio · documents · éditeurs · nettoyeur · automatisations · historique des automatisations · Genius AI · paramètres · changement de langue · thème clair/sombre · retour Android · partage · « Ouvrir avec » · widgets · ouverture depuis une autre application · fichiers volumineux · dossiers contenant beaucoup de fichiers · absence de réseau · reprise après mise en arrière-plan.

Vérifications finales : aucun crash → aucune régression évidente → aucun écran cassé → aucun texte non traduit → aucune permission inutile → aucun code mort important → navigation fluide → démarrage rapide → APK stable.

---

## Ordre recommandé

H1 → H2 → H3 → H4 → H5 → H6 → H7 → H8 → H9 → H10 → H11 → H12 → H13 → H14 → H15

Le point essentiel : ne pas tout faire dans un seul prompt. H1 établit la situation réelle, H2–H4 nettoient le périmètre, H5–H7 stabilisent le produit, H8 optimise, H9–H10 ajoutent les véritables intégrations Android, puis H11–H15 servent à polir et valider l'ensemble.

Ainsi, on évite qu'une grosse opération de « nettoyage » supprime accidentellement une fonctionnalité encore utilisée ou qu'une optimisation casse le fonctionnement Android.
