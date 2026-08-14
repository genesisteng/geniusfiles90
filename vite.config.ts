// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GENIUSFILES_MOBILE=1 switches the nitro preset to `node-server` so the
// mobile prerender step (scripts/build-mobile.mjs) can run the built server
// under Node and capture the SSR HTML for `/`. The default Cloudflare preset
// is preserved for the standard Lovable/hosted build.
const IS_MOBILE_BUILD = process.env.GENIUSFILES_MOBILE === "1";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(IS_MOBILE_BUILD
    ? {
        nitro: {
          preset: "node-server",
          output: {
            dir: "dist",
            serverDir: "dist/server",
            publicDir: "dist/client",
          },
        },
      }
    : {}),
});
