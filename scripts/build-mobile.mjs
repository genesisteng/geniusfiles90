#!/usr/bin/env node
/**
 * build-mobile.mjs
 *
 * Produces a static SPA export for Capacitor from the TanStack Start build.
 *
 * The tricky bit: TanStack Start's client entry requires a hydrated
 * `window.$_TSR.router` blob that only the SSR pipeline can produce.
 * A hand-rolled shell → the client throws `Invariant failed` and the
 * WebView renders a black screen. So we:
 *
 *   1. Build the app with GENIUSFILES_MOBILE=1 (nitro `node-server` preset).
 *   2. Boot the built Node server on a random port.
 *   3. Fetch `/` to capture the real SSR HTML with `$_TSR` scripts.
 *   4. Copy the client assets into `dist-mobile/` and write the SSR HTML
 *      as `index.html` (paths already point at `/assets/...`).
 *
 * The Cloudflare/Lovable web deployment is unaffected — that build path
 * runs without GENIUSFILES_MOBILE and keeps the default preset.
 */
import { cp, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, "dist-mobile");
const DIST_CLIENT = join(ROOT, "dist", "client");
const DIST_SERVER_ENTRY = join(ROOT, "dist", "server", "server.mjs");
const DIST_SERVER_ENTRY_ALT = join(ROOT, "dist", "server", "index.mjs");
const PORT = 41739;

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2").trim();
  }
  return values;
}

function loadMobileEnv() {
  const files = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".env.mobile",
    ".env.mobile.local",
    ".env.android",
    ".env.android.local",
  ];
  const merged = {};
  for (const file of files) Object.assign(merged, parseEnvFile(join(ROOT, file)));
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadMobileEnv();

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`✗ command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

console.log("→ Building web bundle for mobile (node-server preset)…");
await rm(join(ROOT, "dist"), { recursive: true, force: true });
run("bun", ["run", "build"], {
  GENIUSFILES_MOBILE: "1",
  LOVABLE_SANDBOX: "0",
  DEV_SERVER__PROJECT_PATH: "",
});

if (!existsSync(DIST_CLIENT)) {
  console.error(`✗ Missing ${DIST_CLIENT}. Client build did not emit.`);
  process.exit(1);
}
const serverEntry = existsSync(DIST_SERVER_ENTRY)
  ? DIST_SERVER_ENTRY
  : existsSync(DIST_SERVER_ENTRY_ALT)
    ? DIST_SERVER_ENTRY_ALT
    : null;
if (!serverEntry) {
  console.error(`✗ Missing SSR server bundle in dist/server/.`);
  process.exit(1);
}

console.log(`→ Booting SSR server (${serverEntry}) on :${PORT}…`);
const srv = spawn("node", [serverEntry], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", NODE_ENV: "production" },
});
srv.stdout.on("data", (b) => process.stdout.write(`[ssr] ${b}`));
srv.stderr.on("data", (b) => process.stderr.write(`[ssr] ${b}`));

async function waitReady(timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { redirect: "manual" });
      if (res.status < 500) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("SSR server never became ready");
}

let ssrHtml;
try {
  const res = await waitReady();
  ssrHtml = await res.text();
  console.log(`→ Captured SSR HTML (${ssrHtml.length} bytes, status ${res.status}).`);
} finally {
  srv.kill("SIGTERM");
}

if (!ssrHtml.includes("$_TSR")) {
  console.error("✗ SSR HTML is missing the $_TSR hydration payload — client will crash.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Thème : le snapshot HTML embarqué dans l'APK ne doit imposer AUCUN thème.
// Le thème est décidé par le script de pré-peinture (cookies natifs +
// préférences persistées) avant la première frame. Si un attribut de thème
// était figé ici, chaque démarrage à froid repartirait sur ce thème puis
// l'hydratation React le réimposerait — c'était la cause racine du
// « démarrage toujours sombre » alors que Clair était sélectionné.
// ---------------------------------------------------------------------------
if (!ssrHtml.includes("gf.prefs.v1")) {
  console.error("✗ SSR HTML is missing the theme pre-paint script — cold start would flash.");
  process.exit(1);
}
ssrHtml = ssrHtml.replace(/<html\b[^>]*>/i, (tag) =>
  tag.replace(/\sdata-theme="[^"]*"/gi, "").replace(/\sclass="([^"]*)"/gi, (_m, cls) => {
    const kept = cls
      .split(/\s+/)
      .filter((c) => c && c !== "dark" && c !== "light")
      .join(" ");
    return kept ? ` class="${kept}"` : "";
  }),
);
console.log("→ Theme-neutral <html> snapshot enforced.");

console.log(`→ Copying ${DIST_CLIENT} → ${OUT}`);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(DIST_CLIENT, OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Assets Lovable (`/__l5e/assets-v1/...`)
//
// En production web, ces URLs sont servies par l'hébergement Lovable. Dans un
// APK/AAB hors ligne, aucun hôte ne répond : l'image reste vide.
//
// L'ancienne version ne scannait QUE le HTML SSR. Or les illustrations d'états
// vides sont importées depuis des pointeurs `.asset.json` : leurs URLs vivent
// dans les chunks JavaScript, jamais dans le HTML. Elles n'étaient donc jamais
// embarquées → écrans vides en APK/AAB alors que tout marchait en dev.
//
// On collecte désormais TROIS sources :
//   1. le HTML SSR ;
//   2. tous les fichiers texte émis (js / css / json / html / map…) ;
//   3. tous les pointeurs `src/assets/**/*.asset.json` du dépôt (filet de
//      sécurité : une illustration chargée dynamiquement reste embarquée).
// ---------------------------------------------------------------------------
const assetRe = /\/__l5e\/assets-v1\/[A-Za-z0-9\-_]+\/[A-Za-z0-9\-_.%]+/g;
const TEXT_EXT = /\.(js|mjs|cjs|css|html|json|map|txt|webmanifest|svg)$/i;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

// URLs réellement présentes dans le bundle émis → obligatoires.
const requiredSet = new Set(ssrHtml.match(assetRe) ?? []);

for (const file of await walk(OUT)) {
  if (!TEXT_EXT.test(file)) continue;
  const text = await readFile(file, "utf8");
  for (const m of text.match(assetRe) ?? []) requiredSet.add(m);
}

// Pointeurs du dépôt : filet de sécurité (chargement dynamique). Ils sont
// « optionnels » — un pointeur orphelin (asset d'un ancien projet, non
// référencé par le code) ne doit jamais casser le build.
const optionalSet = new Set();
// project_id déclaré par chaque pointeur : l'asset n'est servi que par
// l'hébergement du projet qui l'a créé.
const pointerProject = new Map();

const SRC_ASSETS = join(ROOT, "src", "assets");
if (existsSync(SRC_ASSETS)) {
  for (const file of await walk(SRC_ASSETS)) {
    if (!file.endsWith(".asset.json")) continue;
    try {
      const pointer = JSON.parse(await readFile(file, "utf8"));
      if (typeof pointer.url === "string" && pointer.url.startsWith("/__l5e/")) {
        if (typeof pointer.project_id === "string") {
          pointerProject.set(pointer.url, pointer.project_id);
        }
        if (!requiredSet.has(pointer.url)) optionalSet.add(pointer.url);
      }
    } catch {
      /* pointeur illisible — ignoré, la source 1/2 couvre le cas courant */
    }
  }
}

const referenced = [...requiredSet, ...optionalSet].sort();
if (referenced.length > 0) {
  // Hôtes stables (immuables même si le projet est renommé), essayés dans
  // l'ordre. `LOVABLE_ASSET_HOST` permet de forcer un hôte en CI.
  const projectIds = [
    process.env.LOVABLE_PROJECT_ID,
    "27c5973b-de66-4946-b756-899ca4736d4a",
    "cc00ea41-f4ad-49b2-b865-d70c852b0dc9",
  ].filter(Boolean);

  function hostsFor(path) {
    const ids = [pointerProject.get(path), ...projectIds].filter(Boolean);
    const hosts = [process.env.LOVABLE_ASSET_HOST].filter(Boolean);
    for (const id of new Set(ids)) {
      hosts.push(`project--${id}.lovable.app`, `project--${id}-dev.lovable.app`);
    }
    return hosts;
  }

  console.log(`→ Embedding ${referenced.length} Lovable asset(s) into the APK bundle…`);
  const skipped = [];
  for (const path of referenced) {
    let buf = null;
    let lastError = "";
    for (const host of hostsFor(path)) {
      const url = `https://${host}${path}`;
      for (let attempt = 1; attempt <= 3 && !buf; attempt += 1) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.length > 0) buf = bytes;
            else lastError = `${url}: empty body`;
          } else {
            lastError = `${url}: HTTP ${res.status}`;
          }
        } catch (error) {
          lastError = `${url}: ${error?.message ?? error}`;
        }
        if (!buf && attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
      }
      if (buf) break;
    }
    if (!buf) {
      if (optionalSet.has(path)) {
        skipped.push(`${path} (${lastError})`);
        continue;
      }
      console.error(`✗ Failed to embed ${path} — ${lastError}`);
      console.error("  L'APK afficherait des illustrations manquantes : build interrompu.");
      process.exit(1);
    }
    const dest = join(OUT, path);
    await mkdir(dest.substring(0, dest.lastIndexOf("/")), { recursive: true });
    await writeFile(dest, buf);
    console.log(`   ✓ ${path} (${buf.length} bytes)`);
  }
  if (skipped.length > 0) {
    console.warn(`⚠ ${skipped.length} pointeur(s) non référencé(s) ignoré(s) :`);
    for (const s of skipped) console.warn(`   - ${s}`);
  }

  // Garde-fou : chaque URL réellement utilisée par le bundle doit exister.
  const missing = [...requiredSet].filter((p) => !existsSync(join(OUT, p)));
  if (missing.length > 0) {
    console.error(`✗ ${missing.length} asset(s) manquant(s) dans dist-mobile:`);
    for (const m of missing) console.error(`   - ${m}`);
    process.exit(1);
  }
  console.log(`✓ ${requiredSet.size} asset(s) embarqué(s) et vérifié(s) dans dist-mobile/`);
}

await writeFile(join(OUT, "index.html"), ssrHtml);
console.log(`✓ Wrote SSR shell → dist-mobile/index.html`);
console.log("✓ Mobile web bundle ready at dist-mobile/");
