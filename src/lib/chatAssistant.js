/**
 * chatAssistant.js
 *
 * Core Q&A logic layer for the ADSS Portal AI Assistant.
 * Invokes the secure Supabase Edge Function ('chat-assistant') which holds
 * the Gemini API key server-side.
 *
 * Usage:
 *   import { getAssistantReply } from './chatAssistant';
 *   const result = await getAssistantReply("How do I import members via CSV?", [], "admin");
 *   // result: { success: true, text: "..." } | { success: false, error: "..." }
 */

import { supabase } from "../supabaseClient";

// ── History cap ───────────────────────────────────────────────────────────────
// Keep only the last N turns to limit token usage. Each "turn" is one message
// (user or model), so 10 turns = up to 5 back-and-forth exchanges.
const MAX_HISTORY_TURNS = 10;

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Gets a guide-grounded reply from the ADSS Portal Assistant via Edge Function.
 *
 * @param {string} userMessage
 *   The latest message from the user.
 *
 * @param {Array<{ role: "user" | "model", text: string }>} history
 *   Prior conversation turns. Automatically trimmed to the last MAX_HISTORY_TURNS
 *   entries before being sent to the Edge Function.
 *
 * @param {string} userRole
 *   The role of the current user ('admin', 'editor', 'member', 'guest').
 *
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function getAssistantReply(userMessage, history = [], userRole = "guest") {
  if (!userMessage || !userMessage.trim()) {
    return { success: false, error: "Message cannot be empty." };
  }

  // Trim history to the last MAX_HISTORY_TURNS turns.
  const trimmedHistory = history.length > MAX_HISTORY_TURNS
    ? history.slice(history.length - MAX_HISTORY_TURNS)
    : history;

  try {
    const { data, error } = await supabase.functions.invoke("chat-assistant", {
      body: {
        userMessage: userMessage.trim(),
        history: trimmedHistory,
        userRole,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to communicate with AI Assistant service.",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "No response received from AI Assistant service.",
      };
    }

    return data;
  } catch (err) {
    return {
      success: false,
      error: err.message || "Unexpected error connecting to AI Assistant.",
    };
  }
}
