# Plan : finaliser la traduction FR/EN de GeniusFiles

## Contexte
Le sélecteur de langue est fonctionnel et le système i18n (`src/lib/i18n`) dispose déjà de 2308 clés FR/EN. Il reste néanmoins de nombreux textes français écrits en dur dans les composants et les routes.

## Objectif
Rendre toutes les chaînes visibles par l'utilisateur traduisibles via `t()` et s'assurer que les équivalents anglais existent.

## Périmètre identifié
Les fichiers suivants contiennent encore des textes français en dur :

### Composants
- `src/components/cleaner/CategorySheet.tsx`
- `src/components/common/QuickScrollFab.tsx`
- `src/components/files/PackageSheet.tsx`
- `src/components/files/ProgressDialog.tsx`
- `src/components/files/SelectionBar.tsx`
- `src/components/files/StateViews.tsx`
- `src/components/organizer/OrganizerPreview.tsx`
- `src/components/organizer/RenameProposalSheet.tsx`
- `src/components/pdf/PdfAnnotator.tsx`
- `src/components/pdf/PostCreateActions.tsx`
- `src/components/photo/EditorPanels.tsx`
- `src/components/photo/PhotoEditor.tsx`
- `src/components/storage/StorageAccessDialog.tsx`
- `src/components/viewer/UniversalViewer.tsx`

### Routes
- `src/routes/applications.tsx`
- `src/routes/automatisations.tsx`
- `src/routes/coffre-fort.tsx`
- `src/routes/corbeille.tsx`
- `src/routes/fichiers-recents.tsx`
- `src/routes/index.tsx`
- `src/routes/nettoyeur.tsx`
- `src/routes/pdf-outils.tsx`
- `src/routes/recherche.tsx`

## Méthode
1. Pour chaque fichier, extraire les littéraux français visibles (JSX texte, `label=`, `title=`, `aria-label=`, `placeholder=`).
2. Remplacer par `{t("domaine.sousDomaine.cle")}` ou `t("...")` selon le contexte.
3. Ajouter les clés manquantes dans les fichiers de messages appropriés (`common.ts`, `files.ts`, `media.ts`, `pdf.ts`, etc.) en français et en anglais.
4. S'appuyer sur les clés existantes quand c'est possible (ex. `action.move`, `action.apply`).
5. Exécuter `bun run verify` à la fin de chaque fichier modifié pour garantir typecheck + lint + build.

## Livrables
- Tous les textes utilisateur passent par `t()`.
- Parité FR/EN conservée (mêmes clés, traductions complètes).
- `bun run verify` passe sans erreur.

## Risques / points de vigilance
- Certains textes longs ou techniques peuvent être répartis sur plusieurs lignes ; il faudra veiller à ne pas couper les chaînes de traduction.
- Quelques libellés peuvent être partagés entre plusieurs domaines ; ils iront dans `common.ts`.
- Le scan automatique peut générer de faux positifs (commentaires, noms de classes) ; chaque remplacement sera vérifié manuellement.
