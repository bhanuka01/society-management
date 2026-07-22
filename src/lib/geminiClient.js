/**
 * geminiClient.js
 *
 * Lightweight Gemini API client using the native fetch API.
 * No SDK — keeps the bundle lean.
 *
 * Model used: gemini-2.5-flash-lite
 *   Rationale: As of July 2026, `gemini-2.5-flash-lite` is the most
 *   cost-efficient multimodal Gemini model, purpose-built for high-frequency
 *   lightweight tasks (classification, Q&A, low-latency automation).
 *
 * REST endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Docs: https://ai.google.dev/gemini-api/docs/text-generation
 */

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Calls the Gemini API with a user message and optional conversation history.
 *
 * @param {string} userMessage            - The latest user message.
 * @param {Array<{role: string, text: string}>} conversationHistory
 *   - Prior turns in the conversation. Each item has a `role` ("user"|"model")
 *     and `text` field. Can be empty for single-shot queries.
 * @param {string} [systemContext=""]     - Optional system prompt / guide content
 *   to prepend as context so Gemini understands the app.
 *
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
export async function askGemini(userMessage, conversationHistory = [], systemContext = "") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("your_gemini_api_key_here") || !apiKey.trim()) {
    return {
      success: false,
      error: "Gemini API key is missing or not configured. Please set VITE_GEMINI_API_KEY in your .env file.",
    };
  }

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Build the `contents` array from conversation history + new user message.
  const contents = conversationHistory.map((turn) => ({
    role: turn.role === "model" ? "model" : "user",
    parts: [{ text: turn.text }],
  }));

  // Append the latest user message
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  // Build the request body
  const body = {
    contents,
    ...(systemContext
      ? {
        systemInstruction: {
          parts: [{ text: systemContext }],
        },
      }
      : {}),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 400) {
        return { success: false, error: "Invalid request sent to Gemini API. Please check your query." };
      }
      if (status === 401 || status === 403) {
        return { success: false, error: "Gemini API key is invalid or unauthorized." };
      }
      if (status === 429) {
        return { success: false, error: "Gemini API rate limit reached. Please wait a moment and try again." };
      }
      if (status >= 500) {
        return { success: false, error: "Gemini service is temporarily unavailable. Please try again later." };
      }

      const detail = errorBody?.error?.message || `HTTP ${status}`;
      return { success: false, error: `Gemini API error: ${detail}` };
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output ??
      null;

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") {
        return { success: false, error: "The response was blocked by Gemini's safety filters." };
      }
      return { success: false, error: "Gemini returned an empty response." };
    }

    return { success: true, text };
  } catch (networkError) {
    const message =
      networkError instanceof TypeError
        ? "Network error: Could not reach the Gemini API. Please check your internet connection."
        : `Unexpected error: ${networkError.message}`;
    return { success: false, error: message };
  }
}
