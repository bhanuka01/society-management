/**
 * chatAssistant.js
 *
 * Core Q&A logic layer for the ADSS Portal AI Assistant.
 * Wraps geminiClient.js with a crafted system prompt grounded in the
 * bundled guide.md content.
 *
 * Usage:
 *   import { getAssistantReply } from './chatAssistant';
 *   const result = await getAssistantReply("How do I import members via CSV?", []);
 *   // result: { success: true, text: "..." } | { success: false, error: "..." }
 */

import { askGemini } from "./geminiClient";

// Import the guide at build time as a raw string via Vite's native ?raw suffix.
// No plugin needed — Vite handles this natively for any file type.
import guideContent from "../../doc/guide.md?raw";

// ── History cap ───────────────────────────────────────────────────────────────
// Keep only the last N turns to limit token usage. Each "turn" is one message
// (user or model), so 10 turns = up to 5 back-and-forth exchanges.
const MAX_HISTORY_TURNS = 10;

// ── System prompt factory ─────────────────────────────────────────────────────
/**
 * Builds the system prompt that is injected into every Gemini call.
 * This is the single source of truth for the assistant's behaviour.
 */
function buildSystemPrompt() {
  return `You are the **ADSS Portal Assistant**, a helpful AI support agent for the ADSS Society Management Portal.

## Your Role
Answer questions from society members, editors, and admins about how to use the portal. You are embedded as a chat widget inside the app, so keep all answers concise and practical.

## Reference Material
The following is the complete ADSS Portal User & Administration Guide. Use it as your **primary and authoritative source** when answering questions. Do not invent features, workflows, or settings that are not described here.

---
${guideContent}
---

## Behaviour Rules

1. **Guide-first answers:** Base your answers on the guide above. Quote or paraphrase it directly when relevant.

2. **Navigation hints:** When your answer relates to a specific page or feature, always tell the user exactly how to get there using the sidebar path format, e.g.:
   - "Go to **Sidebar > Members**"
   - "Go to **Sidebar > Attendance**, then switch to the CSV Registrations tab."
   - "Go to **Sidebar > Access** (Admin only)."

3. **Keep it short:** This is a chat widget, not a document viewer. Aim for 3–6 sentences or a short numbered list. Avoid pasting entire sections verbatim.

4. **Honest limitations:** If the guide does not cover the user's question, say exactly:
   "I'm not sure about that — please contact a society admin or editor for help."
   Do NOT guess or hallucinate an answer.

5. **Role awareness:** When a user asks about something restricted to a specific role (e.g., "Can I delete a member?"), remind them of the required role (Editor or Admin) if the guide specifies it.

6. **Tone:** Friendly, professional, and direct. No filler phrases like "Great question!" or "Certainly!".

7. **Formatting:** Use bold for UI labels and menu names. Use numbered lists for step-by-step instructions. Do not use large headers (##) in your replies — this is a chat, not a document.`;
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Gets a guide-grounded reply from the ADSS Portal Assistant.
 *
 * @param {string} userMessage
 *   The latest message from the user.
 *
 * @param {Array<{ role: "user" | "model", text: string }>} history
 *   Prior conversation turns. Automatically trimmed to the last MAX_HISTORY_TURNS
 *   entries before being sent to the API.
 *
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function getAssistantReply(userMessage, history = []) {
  if (!userMessage || !userMessage.trim()) {
    return { success: false, error: "Message cannot be empty." };
  }

  // Trim history to the last MAX_HISTORY_TURNS turns (in-memory cap).
  // We always keep whole pairs (user + model) where possible, so trim from the front.
  const trimmedHistory = history.length > MAX_HISTORY_TURNS
    ? history.slice(history.length - MAX_HISTORY_TURNS)
    : history;

  const systemPrompt = buildSystemPrompt();

  return askGemini(userMessage.trim(), trimmedHistory, systemPrompt);
}
