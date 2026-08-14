/**
 * Régression : un élément restauré depuis la Corbeille ou le Coffre-fort
 * conserve sa date réelle d'origine et son emplacement d'origine. Il ne
 * doit jamais être daté au moment de la restauration.
 */
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  const store = new Map<string, string>();
  const win = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: class {
      constructor(
        public type: string,
        public init?: unknown,
      ) {}
    },
  };
  Object.assign(globalThis, { window: win, localStorage: win.localStorage });
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = win.CustomEvent;
});

describe("restauration corbeille (aperçu web)", () => {
  it("conserve la date réelle et l'emplacement d'origine", async () => {
    const { mockResolve } = await import("./fs");
    const trash = await import("./trash");

    const parent = { rootId: "internal" as const, segments: ["Documents"] };
    const dir = mockResolve(parent);
    expect(dir?.children).toBeTruthy();
    const original = dir!.children!.find((c) => c.name === "Budget.xlsx")!;
    const originalMtime = original.mtime!;

    // Suppression douce simulée : le nœud sort de l'arbre et entre en corbeille.
    dir!.children = dir!.children!.filter((c) => c.name !== "Budget.xlsx");
    trash.recordMockTrash([
      {
        id: "t1",
        name: original.name,
        originalPath: "/storage/emulated/0/Documents/Budget.xlsx",
        isDirectory: false,
        size: original.size ?? 0,
        deletedAt: Date.now(),
        originalMtime,
        parentSegments: parent.segments,
        rootId: parent.rootId,
        snapshot: JSON.parse(JSON.stringify(original)),
      },
    ]);

    const listing = await trash.listTrashItems();
    const item = listing.items.find((i) => i.id === "t1")!;
    expect(item.originalMtime).toBe(originalMtime);

    const res = await trash.restoreItems([item]);
    expect(res.restored).toBe(1);

    const restored = mockResolve(parent)!.children!.find((c) => c.name === "Budget.xlsx")!;
    expect(restored).toBeTruthy();
    expect(restored.mtime).toBe(originalMtime);
  });
});
