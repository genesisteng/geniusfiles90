# H6 / H7 — Corrections appliquées

## H6 — Fonctionnalités réellement fonctionnelles

| Sujet                                                                | Avant                                            | Après                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Scanner de documents                                                 | pipeline factice (image inchangée)               | détection de page (Sobel), correction de perspective (homographie + bilinéaire), amélioration de lisibilité |
| Archives ZIP                                                         | mot de passe saisi puis ignoré                   | mot de passe transmis au pont natif (création + extraction)                                                 |
| Cache de recherche                                                   | clé partielle → résultats erronés entre filtres  | clé incluant tous les filtres (taille, dates précises, extensions, source image)                            |
| Automatisations `organize` / `compress` / `extract` / `cleaner_scan` | messages « planifié » sans action                | exécutions réelles via `src/lib/automations/real-actions.ts`, comptages réels remontés dans l'historique    |
| Suppression définitive du coffre-fort                                | succès annoncé même sans chemin natif            | échec explicite si la suppression ne peut pas être garantie                                                 |
| Fournisseurs de recherche en erreur                                  | erreur avalée, affichée comme « aucun résultat » | avertissement « recherche incomplète »                                                                      |

## H7 — Navigation, états et rafraîchissement

1. **Nettoyeur** : le résultat d'analyse n'est plus effacé avant le nouveau scan (plus de page qui se vide/reconstruit).
2. **Recherche** : les résultats précédents restent affichés pendant un nouveau scan ; ils sont remplacés au premier lot, ou vidés uniquement si la requête ne renvoie réellement rien.
3. **Mémoire de défilement** ajoutée à : corbeille, fichiers récents, coffre-fort, applications, outils PDF, organisation, automatisations (+ historique), recherche.

Points audités et laissés en l'état (choix assumés) : navigation interne par dossier de l'accueil (interceptée par `useBackHandler`), enregistrement direct de `registerBackHandler` dans les surfaces modales.

`bun run verify` : typecheck, lint, format et build verts.
