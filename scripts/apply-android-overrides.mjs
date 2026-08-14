#!/usr/bin/env node
/**
 * apply-android-overrides.mjs
 *
 * Applies GeniusFiles-specific overrides on top of the freshly generated
 * `android/` folder produced by `npx cap add android`. Idempotent — safe
 * to re-run on every CI build.
 *
 * Overrides:
 *  - AndroidManifest.xml : permissions + FileProvider.
 *  - res/values/strings.xml : force app_name = "GeniusFiles".
 *  - app/debug.keystore : stable committed keystore so every CI build
 *    is signed with the same key (fixes "signature mismatch" on update).
 *  - app/build.gradle : wire the committed keystore into the debug
 *    signing config and inject versionCode / versionName from env.
 */
import { cp, readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(process.cwd());
const OVERRIDES = join(ROOT, "android-overrides");
const ANDROID = join(ROOT, "android");
const ANDROID_PACKAGE_NAME = "app.geniusfiles.mobile";

if (!existsSync(ANDROID)) {
  console.error("✗ android/ folder does not exist. Run `npx cap add android` first.");
  process.exit(1);
}
if (!existsSync(OVERRIDES)) {
  console.log("→ No android-overrides/ folder found — nothing to apply.");
  process.exit(0);
}

console.log(`→ Copying android-overrides/ → android/`);
await cp(OVERRIDES, ANDROID, { recursive: true, force: true });

// Ensure Kotlin sources (MainActivity + GeniusFilesTransferPlugin) land in
// the exact package folder Capacitor expects, overwriting any stub
// MainActivity produced by `cap add android`.
const pkgDir = join(ANDROID, "app", "src", "main", "java", "app", "geniusfiles", "mobile");
const overridesKotlin = join(
  OVERRIDES,
  "app",
  "src",
  "main",
  "java",
  "app",
  "geniusfiles",
  "mobile",
);
if (existsSync(overridesKotlin)) {
  await mkdir(pkgDir, { recursive: true });
  for (const file of await readdir(overridesKotlin)) {
    await cp(join(overridesKotlin, file), join(pkgDir, file), { force: true });
  }
  // Capacitor generates an empty MainActivity.java by default. If it stays in
  // place, Android either compiles that empty activity instead of our Kotlin
  // activity or fails with a duplicate class once Kotlin is enabled. In both
  // cases the custom plugins are not registered, which makes the permission
  // button a no-op and makes manual permission grants invisible to JS.
  if (existsSync(join(pkgDir, "MainActivity.kt"))) {
    await rm(join(pkgDir, "MainActivity.java"), { force: true });
  }
  console.log(`✓ Kotlin sources copied to ${relative(ROOT, pkgDir)}`);
}

// Capacitor's generated Android project is Java-only. GeniusFiles' native
// filesystem and transfer backends are Kotlin files under android-overrides/,
// so the generated Gradle files must be patched before the APK/AAB build.
// Without this, the APK installs but the WebView cannot call GeniusFilesNative.
const rootGradlePath = join(ANDROID, "build.gradle");
if (existsSync(rootGradlePath)) {
  let rootGradle = await readFile(rootGradlePath, "utf8");
  if (!rootGradle.includes("org.jetbrains.kotlin:kotlin-gradle-plugin")) {
    rootGradle = rootGradle.replace(
      /classpath 'com\.android\.tools\.build:gradle:[^']+'\n/,
      (m) => `${m}        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21'\n`,
    );
    await writeFile(rootGradlePath, rootGradle, "utf8");
    console.log("✓ Kotlin Gradle plugin enabled in android/build.gradle.");
  }
}

// Patch app/build.gradle: stable debug signing + versionCode/versionName from env.
const gradlePath = join(ANDROID, "app", "build.gradle");
if (existsSync(gradlePath)) {
  let gradle = await readFile(gradlePath, "utf8");

  if (!gradle.includes("org.jetbrains.kotlin.android")) {
    gradle = gradle.replace(
      /apply plugin: 'com\.android\.application'\n/,
      (m) => `${m}apply plugin: 'org.jetbrains.kotlin.android'\n`,
    );
  }

  const versionCode = Number(
    process.env.ANDROID_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 1,
  );
  const versionName = process.env.ANDROID_VERSION_NAME || pkg.version;

  gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

  // Inject a signingConfigs block (idempotent) and wire debug + release to it.
  // Release signing reads a keystore reconstructed at CI time from GitHub
  // Secrets (ANDROID_KEYSTORE_BASE64) plus ANDROID_KEYSTORE_PASSWORD /
  // ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD. When those env vars are
  // missing (local dev), release falls back to the debug key so builds
  // never break; CI enforces their presence in a separate preflight step.
  if (!gradle.includes("GENIUSFILES_SIGNING")) {
    const signingBlock = `
    // GENIUSFILES_SIGNING — debug uses the committed debug.keystore for
    // stable signatures across CI builds. Release uses a keystore
    // reconstructed at CI time from GitHub Secrets, never committed.
    signingConfigs {
        debug {
            storeFile file("debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
        release {
            def ksPath = System.getenv("GENIUSFILES_RELEASE_KEYSTORE") ?: "release.keystore"
            def ksFile = file(ksPath)
            if (ksFile.exists()
                    && System.getenv("ANDROID_KEYSTORE_PASSWORD")
                    && System.getenv("ANDROID_KEY_ALIAS")
                    && System.getenv("ANDROID_KEY_PASSWORD")) {
                storeFile ksFile
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                storeFile file("debug.keystore")
                storePassword "android"
                keyAlias "androiddebugkey"
                keyPassword "android"
            }
        }
    }
`;
    gradle = gradle.replace(/android\s*\{/, (m) => `${m}\n${signingBlock}`);
    gradle = gradle.replace(
      /buildTypes\s*\{\s*release\s*\{/,
      `buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release`,
    );
  }

  // Coffre-fort : la biométrie native (GeniusFilesBiometricPlugin) dépend
  // d'AndroidX Biometric, absent du projet généré par `cap add android`.
  // Sans cette dépendance le module ne compile pas et l'APK repart sans
  // biométrie ("non disponible sur cet appareil").
  if (!gradle.includes("androidx.biometric:biometric")) {
    gradle = gradle.replace(
      /dependencies\s*\{/,
      (m) =>
        `${m}\n    implementation "androidx.biometric:biometric:1.1.0"\n    implementation "androidx.fragment:fragment-ktx:1.8.5"\n`,
    );
    console.log("✓ androidx.biometric dependency added to app/build.gradle.");
  }

  await writeFile(gradlePath, gradle, "utf8");
  console.log(`✓ build.gradle patched (versionCode=${versionCode}, versionName=${versionName}).`);
}

const manifestPath = join(ANDROID, "app", "src", "main", "AndroidManifest.xml");
const manifest = await readFile(manifestPath, "utf8");

const checks = [
  [
    "Application theme bootstrap declared",
    /android:name="app\.geniusfiles\.mobile\.GeniusFilesApplication"/,
  ],
  ["MainActivity declared", /android:name="app\.geniusfiles\.mobile\.MainActivity"/],
  ["LAUNCHER intent-filter", /android\.intent\.category\.LAUNCHER/],
  ["MAIN action", /android\.intent\.action\.MAIN/],
  ["app label bound to strings.xml", /android:label="@string\/app_name"/],
  ["launcher icon set", /android:icon="@mipmap\/ic_launcher"/],
];
const failed = checks.filter(([, re]) => !re.test(manifest));
if (failed.length) {
  console.error("✗ AndroidManifest.xml is missing required entries:");
  for (const [name] of failed) console.error(`   - ${name}`);
  process.exit(1);
}

const stringsPath = join(ANDROID, "app", "src", "main", "res", "values", "strings.xml");
const strings = await readFile(stringsPath, "utf8");
if (!/<string name="app_name">GeniusFiles<\/string>/.test(strings)) {
  console.error("✗ strings.xml does not define app_name = GeniusFiles.");
  process.exit(1);
}
const appGradle = await readFile(gradlePath, "utf8");
const rootGradle = await readFile(rootGradlePath, "utf8");
const kotlinMain = join(pkgDir, "MainActivity.kt");
const kotlinApplication = join(pkgDir, "GeniusFilesApplication.kt");
const javaMain = join(pkgDir, "MainActivity.java");
if (!rootGradle.includes("org.jetbrains.kotlin:kotlin-gradle-plugin")) {
  console.error("✗ Android root build.gradle is missing the Kotlin Gradle plugin.");
  process.exit(1);
}
if (!appGradle.includes("org.jetbrains.kotlin.android")) {
  console.error("✗ Android app/build.gradle does not apply the Kotlin Android plugin.");
  process.exit(1);
}
if (!existsSync(kotlinMain)) {
  console.error("✗ MainActivity.kt is missing; GeniusFiles native plugins will not register.");
  process.exit(1);
}
if (!existsSync(kotlinApplication)) {
  console.error("✗ GeniusFilesApplication.kt is missing; cold-start theming will be incorrect.");
  process.exit(1);
}
if (existsSync(javaMain)) {
  console.error(
    "✗ Stale generated MainActivity.java still exists and can hide the native plugins.",
  );
  process.exit(1);
}
console.log("✓ Manifest sanity checks passed (MainActivity + LAUNCHER + label).");
console.log("✓ Native Kotlin plugin sanity checks passed (Application + MainActivity.kt).");
console.log("✓ Android overrides applied.");
