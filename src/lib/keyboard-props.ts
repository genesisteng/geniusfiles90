/**
 * Presets de propriétés clavier pour Android WebView (Gboard, SwiftKey,
 * Samsung Keyboard). L'objectif est de restaurer, dans tous les champs
 * texte de l'application, l'expérience native complète :
 *
 *  - suggestions au-dessus du clavier
 *  - correction orthographique
 *  - majuscule automatique en début de phrase
 *  - ponctuation intelligente
 *  - apprentissage du dictionnaire personnel
 *
 * Points sensibles Android WebView (à connaître avant toute modification) :
 *
 *  - `type="search"` fait basculer WebView vers `TYPE_TEXT_VARIATION_FILTER`
 *    qui inclut `IME_FLAG_NO_SUGGESTIONS`. **Ne jamais utiliser** pour un
 *    champ où l'on veut des suggestions. À la place :
 *    `type="text"` + `inputMode="search"` + `enterKeyHint="search"`.
 *  - `autoComplete="off"` désactive aussi les suggestions Gboard dans
 *    certaines versions de WebView : préférer l'omission.
 *  - `autoCorrect` / `autoCapitalize` sont des attributs standard HTML
 *    reconnus par Chromium/WebView.
 *
 * Les presets ci-dessous sont typés séparément pour <input> et <textarea>
 * pour éviter que TypeScript n'accepte des attributs invalides.
 */
import type { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type CommonKeyboardProps = {
  autoCorrect?: string;
  autoCapitalize?: HTMLAttributes<HTMLElement>["autoCapitalize"];
  spellCheck?: boolean;
  autoComplete?: string;
  enterKeyHint?: HTMLAttributes<HTMLElement>["enterKeyHint"];
  inputMode?: HTMLAttributes<HTMLElement>["inputMode"];
  lang?: string;
};

/** Champ texte ordinaire (nom de dossier, renommage, champ générique). */
export const kbText: InputHTMLAttributes<HTMLInputElement> & CommonKeyboardProps = {
  type: "text",
  autoCorrect: "on",
  autoCapitalize: "sentences",
  spellCheck: true,
  enterKeyHint: "done",
  inputMode: "text",
  lang: "fr",
};

/** Champ de recherche : garde clavier avec suggestions + touche « Rechercher ». */
export const kbSearch: InputHTMLAttributes<HTMLInputElement> & CommonKeyboardProps = {
  type: "text",
  autoCorrect: "on",
  autoCapitalize: "sentences",
  spellCheck: true,
  enterKeyHint: "search",
  inputMode: "search",
  lang: "fr",
};

/** Zone de texte conversationnelle (commentaires, notes). */
export const kbSentence: TextareaHTMLAttributes<HTMLTextAreaElement> & CommonKeyboardProps = {
  autoCorrect: "on",
  autoCapitalize: "sentences",
  spellCheck: true,
  enterKeyHint: "send",
  inputMode: "text",
  lang: "fr",
};

/** Nom de personne / titre court (majuscule sur chaque mot). */
export const kbWords: InputHTMLAttributes<HTMLInputElement> & CommonKeyboardProps = {
  type: "text",
  autoCorrect: "on",
  autoCapitalize: "words",
  spellCheck: true,
  enterKeyHint: "done",
  inputMode: "text",
  lang: "fr",
};
