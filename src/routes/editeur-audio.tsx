import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useT, t, t as translate } from "@/lib/i18n";
import { AudioEditor } from "@/components/audio/AudioEditor";
import { kindOf } from "@/lib/files/format";
import type { FileEntry, PathRef, StorageRootId } from "@/lib/files/types";

type Search = { root: string; dir: string; name: string };

export const Route = createFileRoute("/editeur-audio")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    root: typeof s.root === "string" && s.root ? s.root : "internal",
    dir: typeof s.dir === "string" ? s.dir : "",
    name: typeof s.name === "string" ? s.name : "",
  }),
  head: () => ({
    meta: [
      { title: translate("meta.audioEditor.title") },
      {
        name: "description",
        content: translate("meta.audioEditor.description"),
      },
      { property: "og:title", content: translate("meta.audioEditor.title") },
      {
        property: "og:description",
        content: translate("meta.audioEditor.ogDescription"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudioEditorRoute,
});

function AudioEditorRoute() {
  const t = useT();
  const { root, dir, name } = Route.useSearch();
  const navigate = useNavigate();
  const segments = dir.split("/").filter(Boolean);
  const parent: PathRef = { rootId: root as StorageRootId, segments };
  const entry: FileEntry = {
    name,
    path: [...segments, name].join("/"),
    isDirectory: false,
    kind: kindOf(name, false),
    ext: name.includes(".") ? name.split(".").pop()!.toLowerCase() : undefined,
  };
  if (!name) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-muted-foreground">
        {t("media.editor.noFileSelected")}
      </div>
    );
  }
  return <AudioEditor parent={parent} entry={entry} onExit={() => void navigate({ to: "/" })} />;
}
