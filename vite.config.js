import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
});
