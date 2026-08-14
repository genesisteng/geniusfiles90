# H1 — Audit complet et cartographie (lecture seule)

Aucune modification de code n'a été effectuée. Ce document est le diagnostic de référence pour H2 → H15.

## 1. Transfert entre appareils (périmètre H2)

**Conclusion : il n'existe aucun transfert appareil-à-appareil dans le projet.**

- Pas de Wi-Fi Direct, Nearby, découverte de périphériques, socket réseau, QR code (le paquet `qrcode` est installé mais jamais importé).
- Permissions Android réseau limitées à `INTERNET` / `ACCESS_NETWORK_STATE` (utilisées par Genius AI).
- Le mot « transfert » désigne ici le moteur **local** copie/déplacement, à conserver impérativement :
  - `src/lib/engine/handlers/transfer.ts` (copyHandler / moveHandler)
  - `src/lib/transfers/manager.ts`, `native-engine.ts`, `useTransfers.ts`
  - `src/components/jobs/TransferTracker.tsx`
- Mentions Bluetooth (`src/lib/recents/added.ts:64,77`, `src/components/home/RecentFilesSection.tsx`) : détection de fichiers **reçus** dans le dossier `Bluetooth/`, sans lien avec un transfert émis.

**Action H2 réduite à :** corriger le commentaire trompeur « offline P2P transfer plugin » dans `android-overrides/app/src/main/java/.../MainActivity.kt:19-20`. Aucune suppression de permission requise.

## 2. Fonctionnalités abandonnées / stubs (périmètre H3)

Toutes retournent systématiquement `null` et ne sont référencées par aucune route ni composant :

| Fonctionnalité                                                                                                                                          | Emplacement                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reconnaissance faciale, transcription audio, résumé vidéo, traduction de contenu, recherche multimodale, organisation avancée, doublons visuels avancés | `src/lib/analysis/reserved.ts`                                                           |
| Modèle d'habitudes, suggestions proactives, sync multi-appareils, renommage IA                                                                          | `src/lib/organizer/reserved.ts`                                                          |
| Profils utilisateur, HabitProfile, SyncClient                                                                                                           | `src/lib/personalization/reserved.ts`                                                    |
| Capacités `face`, `transcription`, `video_summary`, `translation`, `multimodal` (`available: false` en dur)                                             | `src/lib/analysis/capabilities.ts:53-96`, union dans `src/lib/analysis/types.ts:176-181` |

`listCapabilities()` n'est appelé par aucune UI ; seuls `pdf` et `ocr` sont réellement consommés (par `extractors.ts`).

Deviendraient orphelins : les trois fichiers `reserved.ts` entiers, les blocs de capacités ci-dessus, et les clés i18n associées (`system.cap.face*`, `system.cap.transcription*`, `system.cap.translation*`, `system.cap.multimodal*`, `system.resumeIntelligentDeVideos`, `system.detectionAvanceeDesDoublonsVisuels`) dans les 7 langues.

## 3. Préférences (périmètre H4)

Schéma : `src/lib/personalization/types.ts`, persistance `store.ts`, application DOM `applier.ts`, UI unique `src/routes/parametres.tsx`.

`parametres.tsx` n'expose que 5 réglages : thème, langue, fichiers cachés, notifications on/off, rétention corbeille.

| Clé                                                                           | UI  | Effet réel                                                     |
| ----------------------------------------------------------------------------- | --- | -------------------------------------------------------------- |
| `appearance.theme`                                                            | oui | oui                                                            |
| `appearance.textSize`, `density`, `animations`                                | non | oui (CSS via `applier.ts`) — figées sur leur valeur par défaut |
| `appearance.defaultView`                                                      | non | non                                                            |
| `notifications.channels.*`                                                    | non | non                                                            |
| `search.keepHistory / autoClearDays / smartIndex / indexFrequency`            | non | non                                                            |
| `automations.globallyEnabled / onlyWhenCharging / onlyOnWifi / batteryFloor`  | non | non                                                            |
| `privacy.autoLockSec / biometricUnlock / protectedModules / clearCacheOnExit` | non | non                                                            |
| `widgets[]`                                                                   | non | non (définitions dans `widgets.ts` seulement)                  |
| `navigation.*`                                                                | non | non                                                            |
| `reserved.*`                                                                  | non | non                                                            |
| `files.trashRetentionDays` (`src/lib/files/preferences.ts`)                   | oui | oui                                                            |

Décision à prendre en H4 pour texte/densité/animations : les exposer dans Paramètres ou les supprimer.

## 4. Bugs et incohérences (périmètre H5)

1. `src/routes/pdf-outils.tsx:1223` — `X_PLACEHOLDER_MERGE_SUMMARY` affiché tel quel à l'utilisateur.
2. Français codé en dur : `src/routes/applications.tsx:626,639,642-643` ; titres meta en dur `src/routes/assistant.tsx:55,60`.
3. Dates non localisées : `src/routes/automatisations.historique.tsx:132,229` utilisent `toLocaleString(undefined, …)` au lieu de la locale de l'app.
4. Pluriel : `countLabel(record.filesProcessed, "fichier")` et `"action"` — `automatisations.historique.tsx:235,237` : mots français bruts au lieu de clés i18n.
5. `/automatisations/historique` : route valide mais **aucun lien ni `navigate()`** vers elle dans `src` → inaccessible depuis l'UI.
6. Version : `APP_VERSION = "0.1.0"` en dur (`src/routes/parametres.tsx:59`) vs `ANDROID_VERSION_NAME || "1.0.0"` injecté par `scripts/apply-android-overrides.mjs:100`. Trois sources jamais synchronisées.
7. Scanner de documents : statut à trancher (voir H6).
8. Archives (`src/lib/files/archive.ts`) : `ARCHIVE_EXTS` liste zip/jar/apk/aab/rar/7z/tar/gz/tgz/bz2/xz, mais `CREATE_FORMATS` = **zip seul** et `READ_FORMATS` = zip/jar/apk/aab. RAR/7z/tar affichés comme archives sans extraction possible.
9. CORS : `src/routes/api/public/chat.ts:130-134` — `Access-Control-Allow-Origin: *` avec `Authorization` autorisé, sur toutes les réponses.
10. `/diagnostic-clavier` (`src/routes/diagnostic-clavier.tsx`) : orpheline, accessible par URL directe en production.

## 5. Code mort et dépendances (périmètre H14)

Composants jamais importés :

- `src/components/analysis/AnalysisProgressPanel.tsx`
- `src/components/brand/Logo.tsx`
- `src/components/files/FilesToolbar.tsx`
- ~36 composants `src/components/ui/*` non utilisés (accordion, alert, avatar, badge, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, sidebar, slider, sonner, switch, table, tabs, textarea, toggle-group, …)

Exports inutilisés : `SCROLL_ROOT_ATTR` (`src/hooks/use-virtual-list.ts`), `useVisualViewportRect` (`src/hooks/use-visual-viewport-rect.ts`).

Dépendances jamais importées dans `src` : `@zxing/browser`, `date-fns`, `qrcode`, `@hookform/resolvers`.

## 6. Android (périmètre H9, H10, H13)

Permissions déclarées (`android-overrides/app/src/main/AndroidManifest.xml`) : `MANAGE_EXTERNAL_STORAGE`, `QUERY_ALL_PACKAGES`, `PACKAGE_USAGE_STATS`, `REQUEST_DELETE_PACKAGES`, `REQUEST_INSTALL_PACKAGES`, `READ_MEDIA_IMAGES/VIDEO/AUDIO`, `READ_EXTERNAL_STORAGE` (≤32), `WRITE_EXTERNAL_STORAGE` (≤29), `FOREGROUND_SERVICE(+DATA_SYNC, +MEDIA_PLAYBACK)`, `WAKE_LOCK`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA`, `USE_BIOMETRIC`, `USE_FINGERPRINT` (≤28).

À réexaminer en H13 : `USE_BIOMETRIC`/`USE_FINGERPRINT` (aucune intégration biométrique trouvée), `CAMERA` (dépend du sort du scanner), `QUERY_ALL_PACKAGES` et `PACKAGE_USAGE_STATS` (page Applications), `REQUEST_INSTALL_PACKAGES`.

Intent-filters : `MainActivity` n'a que `MAIN`/`LAUNCHER` — **aucun `VIEW` / `SEND`**, donc GeniusFiles n'apparaît jamais dans « Ouvrir avec » (tout le travail H9 reste à faire). Receivers existants : `FileOpsActionReceiver`, `AutomationAlarmReceiver`, `AutomationBootReceiver`.

AppWidget : **aucun** `AppWidgetProvider` ni `<receiver>` widget (H10 entièrement à créer).

FileProvider : présent, autorité `${applicationId}.fileprovider`, `exported=false`, chemins dans `res/xml/file_paths.xml`.

## 7. i18n

Système maison `src/lib/i18n/` (`store.ts`, `translate.ts`, `format.ts`, `react.tsx`, `messages/<lang>/<domaine>.ts`), 7 langues présentes : de, en, es, fr, it, pt, tr. Écarts identifiés au point 4 (items 2, 3, 4).

## 8. Ajustements recommandés au plan H

- **H2** devient une micro-étape (commentaire natif à corriger) — aucun code de transfert P2P à supprimer.
- **H4** doit trancher explicitement le cas texte/densité/animations : exposer ou supprimer.
- **H9** et **H10** sont des développements Android natifs complets, pas des corrections.
- Les composants `ui/*` inutilisés relèvent de H14 et peuvent être conservés sans risque (tree-shakés au build) ; leur suppression est optionnelle.
