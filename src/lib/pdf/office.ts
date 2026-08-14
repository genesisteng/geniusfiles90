/**
 * Best-effort offline extraction of Office documents (DOCX / XLSX / PPTX)
 * into a normalized structure the PDF renderer can lay out. Fidelity is
 * intentionally simple — the goal is a legible PDF containing all textual
 * content, tables and slide bullets, not a byte-perfect reproduction.
 */
export type OfficeBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; rows: string[][] }
  | { kind: "pageBreak" };

export type OfficeDocument = {
  title?: string;
  blocks: OfficeBlock[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/* ---------- DOCX ---------- */

export async function docxToBlocks(bytes: Uint8Array): Promise<OfficeDocument> {
  // Use the main `mammoth` entry — the `mammoth/mammoth.browser` subpath is
  // not declared in the package `exports` map, so bundlers (Vite → Capacitor
  // WebView) fail to resolve it at runtime with
  // "Failed to resolve module specifier 'mammoth/mammoth.browser'".
  const mod = (await import("mammoth")) as unknown as {
    convertToHtml: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const src = new Uint8Array(bytes);
  const ab = src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength);
  const res = await mod.convertToHtml({ arrayBuffer: ab });
  return { blocks: htmlToBlocks(res.value) };
}

function htmlToBlocks(html: string): OfficeBlock[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const blocks: OfficeBlock[] = [];

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text && tag !== "table" && tag !== "hr") return;

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
        blocks.push({
          kind: "heading",
          level: tag === "h1" ? 1 : tag === "h2" ? 2 : 3,
          text,
        });
        break;
      case "p":
        blocks.push({ kind: "paragraph", text });
        break;
      case "ul":
      case "ol": {
        const items = Array.from(el.querySelectorAll(":scope > li")).map((li) =>
          (li.textContent ?? "").replace(/\s+/g, " ").trim(),
        );
        blocks.push({ kind: "list", items, ordered: tag === "ol" });
        break;
      }
      case "table": {
        const rows: string[][] = [];
        el.querySelectorAll("tr").forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("th,td")).map((c) =>
            (c.textContent ?? "").replace(/\s+/g, " ").trim(),
          );
          if (cells.length) rows.push(cells);
        });
        if (rows.length) blocks.push({ kind: "table", rows });
        break;
      }
      case "hr":
        blocks.push({ kind: "pageBreak" });
        break;
      default:
        // Recurse for divs / sections / body wrappers.
        Array.from(el.children).forEach(walk);
        if (!el.children.length && text) blocks.push({ kind: "paragraph", text });
    }
  };

  Array.from(container.children).forEach(walk);
  return blocks;
}

/* ---------- XLSX ---------- */

export async function xlsxToBlocks(bytes: Uint8Array): Promise<OfficeDocument> {
  const XLSX = (await import("xlsx")) as typeof import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  const blocks: OfficeBlock[] = [];
  wb.SheetNames.forEach((name, i) => {
    if (i > 0) blocks.push({ kind: "pageBreak" });
    blocks.push({ kind: "heading", level: 2, text: name });
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as unknown[][];
    if (rows.length) {
      blocks.push({
        kind: "table",
        rows: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
      });
    }
  });
  return { blocks };
}

/* ---------- PPTX ---------- */

export async function pptxToBlocks(bytes: Uint8Array): Promise<OfficeDocument> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });

  const blocks: OfficeBlock[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    if (i > 0) blocks.push({ kind: "pageBreak" });
    const xml = await zip.file(slidePaths[i])!.async("string");
    const paragraphs: string[] = [];
    // Collect <a:t> runs grouped per <a:p>.
    const paras = xml.match(/<a:p[\s\S]*?<\/a:p>/g) ?? [];
    for (const p of paras) {
      const runs = p.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
      const text = runs
        .map((r) => decodeEntities(r.replace(/<[^>]+>/g, "")))
        .join("")
        .trim();
      if (text) paragraphs.push(text);
    }
    if (paragraphs.length === 0) {
      blocks.push({ kind: "heading", level: 2, text: `Diapositive ${i + 1}` });
      continue;
    }
    blocks.push({ kind: "heading", level: 2, text: paragraphs[0] });
    if (paragraphs.length > 1) {
      blocks.push({ kind: "list", items: paragraphs.slice(1) });
    }
  }
  return { blocks };
}

/* ---------- Plain text ---------- */

export function textToBlocks(text: string): OfficeDocument {
  const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return {
    blocks: paras
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ kind: "paragraph", text: p }) as OfficeBlock),
  };
}

/* ---------- RTF (best-effort stripper) ---------- */

export function rtfToBlocks(bytes: Uint8Array): OfficeDocument {
  const raw = new TextDecoder("latin1").decode(bytes);
  const out = raw
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => {
      const code = parseInt(n, 10);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    })
    .replace(/\\par[d]?/g, "\n\n")
    .replace(/\\line ?/g, "\n")
    .replace(/\\tab ?/g, "\t")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "");
  return textToBlocks(out.trim());
}

/* ---------- EPUB ---------- */

export async function epubToBlocks(bytes: Uint8Array): Promise<OfficeDocument> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  let opfPath = "";
  if (container) {
    const m = container.match(/full-path="([^"]+)"/);
    if (m) opfPath = m[1];
  }
  const opf = opfPath ? await zip.file(opfPath)?.async("string") : undefined;
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  let title: string | undefined;
  const tm = opf?.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  if (tm) title = decodeEntities(tm[1].replace(/<[^>]+>/g, "").trim());

  const manifest = new Map<string, string>();
  if (opf) {
    const items = opf.match(/<item [^>]+>/g) ?? [];
    for (const it of items) {
      const id = it.match(/id="([^"]+)"/)?.[1];
      const href = it.match(/href="([^"]+)"/)?.[1];
      if (id && href) manifest.set(id, href);
    }
  }
  const spineIds: string[] = [];
  if (opf) {
    const spine = opf.match(/<spine[\s\S]*?<\/spine>/i)?.[0] ?? "";
    const refs = spine.match(/idref="([^"]+)"/g) ?? [];
    for (const r of refs) {
      const id = r.match(/idref="([^"]+)"/)?.[1];
      if (id) spineIds.push(id);
    }
  }
  const paths = spineIds
    .map((id) => manifest.get(id))
    .filter((p): p is string => !!p)
    .map((p) => base + p);
  const fallback = Object.keys(zip.files).filter((p) => /\.x?html?$/i.test(p));
  const chapters = paths.length ? paths : fallback;

  const blocks: OfficeBlock[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const html = await zip.file(chapters[i])?.async("string");
    if (!html) continue;
    if (i > 0) blocks.push({ kind: "pageBreak" });
    const body = html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
    blocks.push(...htmlToBlocks(body));
  }
  return { title, blocks };
}
