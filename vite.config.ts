// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // On Vercel (VERCEL=1 is set by their build env) target the Vercel preset,
  // which emits the Build Output API folder at .vercel/output.
  // Everywhere else the default (Cloudflare) target is kept.
  ...(process.env["STATIC"]
    ? { nitro: false as const }
    : process.env["VERCEL"]
      ? { nitro: { preset: "vercel" } }
      : {}),
  tanstackStart: process.env["STATIC"]
    ? // STATIC=1 builds a self-contained SPA (dist/client/index.html) for
      // zip-based portals like Playgama, which need a single index.html at root.
      { spa: { enabled: true }, prerender: { enabled: true } }
    : {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      },
  vite: {
    // Relative base for the STATIC (zip) build so index.html works from any subfolder.
    ...(process.env["STATIC"] ? { base: "./" } : {}),
    // No production source maps: keeps the game logic minified and unreadable
    // in DevTools, so score handling is not trivially inspectable.
    build: { sourcemap: false },
  },
});
