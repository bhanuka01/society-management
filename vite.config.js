import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: '/',
  // base: '/society-management/'

  // ── Markdown / Raw text imports ────────────────────────────────────────────
  // Vite supports the `?raw` query suffix natively (no plugin needed) for ANY
  // file type, including .md.  Example usage in JS/JSX:
  //
  //   import guideContent from './assets/guide.md?raw';
  //   import guideContent from '../doc/guide.md?raw';
  //
  // The `?raw` import returns the file contents as a plain string at build time.
  // `assetsInclude` below makes Vite also recognise .md as a static asset so
  // that direct (non-?raw) URL imports resolve correctly too.
  assetsInclude: ["**/*.md"],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("html5-qrcode")) {
              return "vendor-scanner";
            }
            if (id.includes("marked") || id.includes("dompurify")) {
              return "vendor-markdown";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("react") || id.includes("scheduler")) {
              return "vendor-react";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
