// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/** Where the FastAPI backend lives during local development. */
const API_TARGET = process.env["API_PROXY_TARGET"] ?? "http://127.0.0.1:8000";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },

  // Production target. The Lovable sandbox pins its own preset, so this applies
  // to our own builds: a Node server image behind nginx on the VPS, not a worker.
  nitro: { preset: process.env["NITRO_PRESET"] ?? "node-server" },

  vite: {
    server: {
      // Same-origin API in development, so cookies, CORS and the cart token
      // behave exactly as they will in production behind nginx.
      proxy: {
        "/api": {
          target: API_TARGET,
          changeOrigin: true,
        },
      },
    },
  },
});
