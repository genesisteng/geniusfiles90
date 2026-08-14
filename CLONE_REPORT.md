# Rapport de comparaison — Clone de `Mayev1/geniusfiles72`

Source : https://github.com/Mayev1/geniusfiles72.git (clone `--depth 1`, branche par défaut)

## 1. Éléments reproduits à l'identique

- **Intégralité du dépôt** copiée fichier par fichier (439 fichiers). Vérification `diff -rq` source/destination : **aucune différence de contenu**.
- Code applicatif : `src/` complet — 20 routes (`index`, `applications`, `assistant`, `automatisations(.historique)`, `categorie.$kind`, `coffre-fort`, `corbeille`, `diagnostic-clavier`, `editeur-audio`, `fichiers-recents`, `nettoyeur`, `organisation`, `outils`, `parametres`, `pdf-outils`, `recherche`, `transfert`, `api/public/chat`), tous les composants (`components/**`), toutes les librairies métier (`lib/**` : engine, files, fs, organizer, analysis, audio, photo, pdf, vault, transfer(s), automations, personalization, search, player, jobs, native, ai…), hooks, types.
- Design system : `src/styles.css`, `components.json`, `tailwind` v4, composants shadcn tels quels. Aucune modification visuelle.
- Navigation, animations, états, parcours utilisateur : inchangés (fichiers non modifiés).
- Mobile / APK-AAB : `capacitor.config.ts`, `android-overrides/**` (Kotlin, manifest, res, keystore debug), `ANDROID_BUILD.md`, `.github/workflows/android-build.yml`, `scripts/build-mobile.mjs`, `scripts/apply-android-overrides.mjs`, `scripts/generate-app-icons.mjs`, `resources/source-logo.png`, `public/brand/**`.
- Config projet : `package.json` (scripts + dépendances identiques), `bun.lock`, `bunfig.toml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.env.example`, `AGENTS.md`, `README.md`.

## 2. Validation d'exécution

- `bun install` : OK (1095 paquets).
- Typecheck : OK, 0 erreur.
- `bun run build` (production + bundle Nitro/worker) : OK.
- Preview `/` : HTTP 200, titre « GeniusFiles », rendu identique, **aucune erreur console**.

## 3. Différences détectées (mineures, non fonctionnelles)

- `public/favicon.ico` : présent dans ce projet (hérité du gabarit Lovable), absent du dépôt source. Sans effet — l'app référence `public/favicon.png` et `public/brand/*`.
- `.lovable/project.json` : conservé celui de ce projet (identifiant/révision de gabarit propres à ce projet). Même template `tanstack_start_ts_current`.
- `bun run test` sort en erreur : le dépôt source ne contient **aucun** fichier `src/**/*.test.ts` — comportement identique à la source, pas une régression.

## 4. Éléments impossibles à reproduire exactement

- **Mémoire projet** : le dépôt ne contient aucun fichier de mémoire (`.lovable/` ne contient que `project.json`). La mémoire Lovable n'est pas versionnée dans Git et n'a donc pas pu être importée depuis cette source.
- `src/assets/geniusfiles-logo.asset.json` : pointeur d'asset appartenant au projet source (project_id `7852a4f0-…`). Le fichier a été copié tel quel ; il n'est **importé nulle part** dans le code (le logo réel est servi depuis `public/brand/`), donc aucun impact.
- `dist-mobile/` : absent du dépôt (dossier de build ignoré par Git). Il est régénéré par `bun run build:mobile`.
- Historique Git, releases, artefacts CI et éventuels secrets/variables d'environnement du projet source ne sont pas transférables.

## 5. Base de données

Le dépôt source **ne contient aucun backend base de données** (pas de dossier `supabase/`, aucune migration, aucun client généré). L'application est 100 % locale/native (Capacitor Filesystem, Preferences, stockage natif). Schéma, relations, contraintes : **néant à reproduire** — la structure de données est celle des stores locaux TypeScript (`src/lib/**/store.ts`, `types.ts`), copiés à l'identique.

## 6. Actions manuelles requises

1. **Clé IA** : `src/routes/api/public/chat.ts` lit `LOVABLE_API_KEY` — déjà disponible dans cet environnement. Vérifier le quota/facturation côté passerelle IA.
2. **Build Android** : exécuter `bun run android:build` sur une machine avec le SDK Android + JDK (impossible dans ce sandbox). Le workflow `.github/workflows/android-build.yml` est prêt à l'emploi une fois le dépôt poussé sur GitHub.
3. **Signature de release** : `android-overrides/app/debug.keystore` est une clé de debug ; fournir votre keystore de production pour un AAB publiable.
4. **`VITE_API_BASE_URL`** : créer un `.env` à partir de `.env.example` et pointer vers l'URL publiée de CE projet avant de builder l'APK/AAB, sinon l'app native appellera l'API du projet d'origine (`https://geniusfiles.lovable.app`).
5. Publier le projet pour disposer d'une URL stable.
