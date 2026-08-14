import ReactMarkdown from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Mise en page des réponses de Genius AI.
 *
 * Le contenu (markdown) est produit par le modèle ; ce composant ne touche
 * jamais au texte : il ne fait que lui donner une hiérarchie visuelle
 * lisible sur un écran de smartphone (titres de section discrets,
 * paragraphes aérés, listes multi-lignes, chiffres mis en valeur).
 */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="gf-answer">
      <ReactMarkdown
        components={{
          h1: (p: ComponentPropsWithoutRef<"h1">) => <h3 className="gf-answer-title" {...p} />,
          h2: (p: ComponentPropsWithoutRef<"h2">) => <h3 className="gf-answer-title" {...p} />,
          h3: (p: ComponentPropsWithoutRef<"h3">) => <h3 className="gf-answer-title" {...p} />,
          h4: (p: ComponentPropsWithoutRef<"h4">) => <h3 className="gf-answer-title" {...p} />,
          p: (p: ComponentPropsWithoutRef<"p">) => <p className="gf-answer-p" {...p} />,
          ul: (p: ComponentPropsWithoutRef<"ul">) => <ul className="gf-answer-list" {...p} />,
          ol: (p: ComponentPropsWithoutRef<"ol">) => <ol className="gf-answer-list" {...p} />,
          li: (p: ComponentPropsWithoutRef<"li">) => <li className="gf-answer-item" {...p} />,
          strong: (p: ComponentPropsWithoutRef<"strong">) => (
            <strong className="gf-answer-strong" {...p} />
          ),
          em: (p: ComponentPropsWithoutRef<"em">) => <em className="gf-answer-em" {...p} />,
          hr: () => <hr className="gf-answer-rule" />,
          blockquote: (p: ComponentPropsWithoutRef<"blockquote">) => (
            <blockquote className="gf-answer-quote" {...p} />
          ),
          code: (p: ComponentPropsWithoutRef<"code">) => <code className="gf-answer-code" {...p} />,
          pre: (p: ComponentPropsWithoutRef<"pre">) => <pre className="gf-answer-pre" {...p} />,
          a: ({ children }: ComponentPropsWithoutRef<"a">) => <>{children}</>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
