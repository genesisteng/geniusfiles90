/**
 * Simulation d'un plan d'organisation — pur, sans écriture.
 *
 * Construit un diff avant/après par dossier concerné, ainsi que la liste
 * des dossiers qui seront créés. Consommé par le composant Aperçu.
 */
import { listDirectory } from "@/lib/files/fs";
import type { PathRef } from "@/lib/files/types";
import type { OrgAction, OrgPlan, OrgPreview, OrgPreviewNode } from "./types";

function keyOf(p: PathRef): string {
  return `${p.rootId}::${p.segments.join("/")}`;
}

async function loadBefore(p: PathRef): Promise<string[]> {
  const r = await listDirectory(p);
  if (!r.ok) return [];
  return r.entries.map((e) => e.name);
}

export async function buildPreview(plan: OrgPlan): Promise<OrgPreview> {
  const nodesMap = new Map<string, OrgPreviewNode>();
  const createdFolders: PathRef[] = [];

  async function nodeFor(parent: PathRef): Promise<OrgPreviewNode> {
    const k = keyOf(parent);
    let n = nodesMap.get(k);
    if (n) return n;
    const before = await loadBefore(parent);
    n = {
      parent,
      before,
      after: before.slice(),
      additions: [],
      removals: [],
      renames: [],
    };
    nodesMap.set(k, n);
    return n;
  }

  const ensureCreated = (p: PathRef) => {
    const k = keyOf(p);
    if (!nodesMap.has(k)) {
      const empty: OrgPreviewNode = {
        parent: p,
        before: [],
        after: [],
        additions: [],
        removals: [],
        renames: [],
      };
      nodesMap.set(k, empty);
      createdFolders.push(p);
    }
  };

  for (const action of plan.actions) {
    switch (action.kind) {
      case "rename": {
        const n = await nodeFor(action.parent);
        n.after = n.after.map((x) => (x === action.from ? action.to : x));
        n.renames.push({ from: action.from, to: action.to });
        break;
      }
      case "move": {
        const from = await nodeFor(action.from);
        from.after = from.after.filter((x) => x !== action.entryName);
        from.removals.push(action.entryName);
        if (action.createParent) ensureCreated(action.toParent);
        const to = await nodeFor(action.toParent);
        to.after.push(action.entryName);
        to.additions.push(action.entryName);
        break;
      }
      case "group": {
        const src = await nodeFor(action.parent);
        const folderPath: PathRef = {
          rootId: action.parent.rootId,
          segments: [...action.parent.segments, action.folderName],
        };
        ensureCreated(folderPath);
        const dst = await nodeFor(folderPath);
        for (const name of action.entryNames) {
          src.after = src.after.filter((x) => x !== name);
          src.removals.push(name);
          dst.after.push(name);
          dst.additions.push(name);
        }
        if (!src.after.includes(action.folderName)) {
          src.after.push(action.folderName);
          src.additions.push(action.folderName);
        }
        break;
      }
      case "archive": {
        const src = await nodeFor(action.parent);
        const folderPath: PathRef = {
          rootId: action.parent.rootId,
          segments: [...action.parent.segments, "Archives"],
        };
        ensureCreated(folderPath);
        const dst = await nodeFor(folderPath);
        for (const name of action.entryNames) {
          src.after = src.after.filter((x) => x !== name);
          src.removals.push(name);
          dst.after.push(name);
          dst.additions.push(name);
        }
        break;
      }
      case "collection_add":
        // Virtuel — n'affecte pas le disque.
        break;
    }
  }

  return {
    planId: plan.id,
    nodes: Array.from(nodesMap.values()),
    createdFolders,
  };
}

export function summarizeActions(actions: OrgAction[]): {
  renames: number;
  moves: number;
  groups: number;
  archives: number;
} {
  const out = { renames: 0, moves: 0, groups: 0, archives: 0 };
  for (const a of actions) {
    if (a.kind === "rename") out.renames++;
    else if (a.kind === "move") out.moves++;
    else if (a.kind === "group") out.groups++;
    else if (a.kind === "archive") out.archives++;
  }
  return out;
}
