<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Règle obligatoire de vérification (GeniusFiles)

**À la fin de CHAQUE modification de code, avant de répondre à l'utilisateur, exécuter :**

```bash
bun run verify
```

Ce script enchaîne, dans cet ordre : `tsc --noEmit` (typecheck) → `eslint .` →
`prettier --check .` → `vite build`.

Conditions non négociables :

- La tâche n'est **pas terminée** tant que `bun run verify` ne passe pas.
- Zéro erreur TypeScript, zéro erreur ESLint, zéro fichier mal formaté, build vert.
- `react-hooks/exhaustive-deps` est configurée en **erreur** dans `eslint.config.js`
  car elle peut causer des bugs en production (closures périmées). Toute nouvelle
  erreur de cette règle bloque `verify` et la CI Android.
- Corriger tout avertissement d'une règle ayant un impact fonctionnel ou visuel
  (même minime) sur l'APK/AAB, en montant la règle en erreur ou en corrigeant le code.
- Les avertissements `react-refresh/only-export-components` ne concernent que le
  rechargement à chaud en développement ; ils ne bloquent pas la vérification car
  ils n'ont aucun impact sur l'APK/AAB final.
- Ne jamais désactiver une règle, ajouter `eslint-disable`, ni ajouter
  `continue-on-error` dans la CI pour faire passer la vérification.
- Cette règle s'applique aussi après un remix du projet, pour toute session
  Lovable ou tout agent travaillant sur ce dépôt.

La CI Android (`.github/workflows/android-build.yml`) applique la même barrière :
le job `validate` échoue et bloque la génération de l'APK/AAB si `verify` échoue.
