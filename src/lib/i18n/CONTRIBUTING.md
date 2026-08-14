# GeniusFiles — contrat d'internationalisation (FR / EN)

Toute chaîne visible par l'utilisateur passe par `@/lib/i18n`. Aucun texte
français ne doit rester en dur dans un composant, un service ou un toast.

## API

```tsx
import { useT } from "@/lib/i18n";

function MyScreen() {
  const t = useT();
  return <h1>{t("cleaner.title")}</h1>;
}
```

Hors React (services, moteurs, toasts déclenchés depuis une lib) :

```ts
toast.success(t("files.moved", { count: n, folder: name }));
```

Formatage dépendant de la langue :

```ts
import { formatBytes, formatNumber, formatDateValue, formatPercent } from "@/lib/i18n";
```

## Fichiers de traduction

- `src/lib/i18n/messages/fr/<domaine>.ts`
- `src/lib/i18n/messages/en/<domaine>.ts`

Chaque fichier exporte par défaut un objet plat `clé → texte`, terminé par
`as const`. Les fichiers sont agrégés automatiquement (aucun index à
maintenir). **Un agent ne modifie que les fichiers de son propre domaine**
pour éviter tout conflit.

## Conventions de clés

- `domaine.section.element`, en minuscules, sans accent : `pdf.merge.title`.
- Interpolation entre accolades : `"Déplacé vers {folder}"`.
- Pluriels : deux clés `xxx_one` / `xxx_other`, sélectionnées par `{ count }`.
  Exemple :
  ```ts
  "files.selected_one": "{count} fichier sélectionné",
  "files.selected_other": "{count} fichiers sélectionnés",
  ```
  Appel : `t("files.selected", { count: n })`.
- Les nombres passés en variables sont automatiquement formatés selon la
  langue ; ne pas les pré-formater.

## Vocabulaire commun

Avant de créer une clé, vérifier `messages/fr/common.ts` : actions
(`action.cancel`, `action.delete`, `action.share`…), états
(`state.loading`, `state.noResults`…), unités (`count.files`…) et
navigation (`nav.home`…) y sont déjà traduits. Les réutiliser.

## Règles de traduction

- L'anglais doit être naturel et idiomatique, pas une traduction littérale.
  Ton court, direct, sans jargon technique — comme la version française.
- Conserver la ponctuation et les majuscules propres à chaque langue
  (français : espace insécable évitée, pas de capitalisation de titre ;
  anglais : « sentence case »).
- Les textes d'accessibilité (`aria-label`, `title`, `alt`) sont traduits
  eux aussi.
- Les commentaires de code restent en français : ils ne sont pas traduits.
- Ne pas traduire : noms de fichiers, chemins, extensions, « GeniusFiles »,
  clés techniques, valeurs de `localStorage`, identifiants.
- Les métadonnées SEO `head()` des routes restent en français (contenu
  serveur unique) — ne pas y toucher.
- Ne jamais changer la logique métier, la mise en page ou le style : seule
  la source des textes change.
