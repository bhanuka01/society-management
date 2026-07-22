# Updating the AI Assistant Knowledge Base Guide

> **Target File:** `doc/guide.md`  
> **Bundling Method:** Build-time raw string import (`import guideContent from '../../doc/guide.md?raw';`)

---

## Overview

The ADSS Society Management AI Assistant uses `doc/guide.md` as its primary reference context.

Rather than fetching this document dynamically from a server at runtime, Vite bundles `doc/guide.md` directly into the JavaScript production bundle as a raw text string at build time.

### Advantages of Build-Time Bundling
1. **Zero Runtime Latency:** No additional HTTP network requests are made before querying Gemini.
2. **Offline & Bundled Reliability:** The knowledge base is always available with 100% guarantee.
3. **No Storage Overhead:** No external CMS or backend database queries required.

---

## Step-by-Step: How to Update the Knowledge Base

Whenever system features, UI navigation paths, database schemas, or role permissions change in the application:

1. **Edit the Markdown Guide:**
   Open `doc/guide.md` in your text editor and update the relevant section(s).

2. **Rebuild the Application:**
   Run the build script to compile the updated `doc/guide.md` into the application bundle:
   ```bash
   npm run build
   ```

3. **Redeploy:**
   Deploy the updated build artifacts (e.g., to Vercel, Netlify, or your hosting platform).

---

## Guidelines for Writing Guide Updates

- **Use clear section headers:** The AI Assistant relies on headers (`## 4. Step-by-Step UI Workflows`) to locate context.
- **Always include navigation paths:** Format paths as `Sidebar > Module Name` (e.g., `Sidebar > Members`) so the assistant can provide precise navigation instructions to users.
- **Explicit role permissions:** Specify whether actions require `Member`, `Editor`, or `Admin` roles.
