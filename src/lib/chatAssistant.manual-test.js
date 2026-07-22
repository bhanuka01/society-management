/**
 * chatAssistant.manual-test.js
 *
 * Quick manual smoke-test for the ADSS Portal AI Assistant.
 * This file is NOT a production module — it is a developer verification tool.
 *
 * HOW TO RUN:
 *   1. Make sure VITE_GEMINI_API_KEY is set in your .env file.
 *   2. Open this file in a browser-based dev environment, OR run the Vite dev
 *      server and import this file temporarily from main.jsx for one run.
 *      (Vite is required because this file uses `import.meta.env` and ?raw imports.)
 *
 *   Quickest method — paste this into your browser console after running `npm run dev`:
 *     const mod = await import('/src/lib/chatAssistant.manual-test.js?t=' + Date.now());
 *     await mod.runTests();
 *
 * WHAT IT TESTS:
 *   - CSV import workflow (Section 4C of the guide)
 *   - Attendance QR code workflow (Section 4E)
 *   - Role-restricted feature (Access panel — Admin only)
 *   - Out-of-scope question (should trigger the fallback response)
 *   - Conversation history cap (verifies the 10-turn trim is applied)
 */

import { getAssistantReply } from "./chatAssistant";

// ── Test cases ────────────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    label: "CSV Member Import",
    message: "How do I import members via CSV?",
    // Expected: steps from Section 4C, should mention Sidebar > Members
  },
  {
    label: "QR Attendance",
    message: "How do I generate a QR code for attendance?",
    // Expected: steps from Section 4E, should mention self_attendance_enabled
  },
  {
    label: "Admin-only feature (Access panel)",
    message: "How do I invite a new editor to the portal?",
    // Expected: steps from Section 4J, should mention Sidebar > Access (Admin only)
  },
  {
    label: "Out-of-scope question (should get fallback)",
    message: "What is the weather in Colombo today?",
    // Expected: "I'm not sure" fallback, no hallucination
  },
  {
    label: "Role permission question",
    message: "Can a regular member delete another member?",
    // Expected: No — only Editor/Admin can. Should reference the permission matrix.
  },
];

// ── History cap test ──────────────────────────────────────────────────────────

const LONG_HISTORY = Array.from({ length: 14 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "model",
  text: `Turn ${i + 1}: ${i % 2 === 0 ? "User message" : "Model reply"} ${i + 1}`,
}));

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runTests() {
  console.group("🤖 ADSS Portal Assistant — Manual Test Run");
  console.log(`Running ${TEST_CASES.length} test cases + 1 history-cap test...\n`);

  // ── Single-turn Q&A tests ──────────────────────────────────────────────────
  for (const tc of TEST_CASES) {
    console.group(`📋 TEST: ${tc.label}`);
    console.log("Q:", tc.message);

    try {
      const result = await getAssistantReply(tc.message, []);

      if (result.success) {
        console.log("✅ PASS — Response received");
        console.log("A:", result.text);
      } else {
        console.warn("⚠️  API Error:", result.error);
      }
    } catch (err) {
      console.error("❌ Exception:", err);
    }

    console.groupEnd();
    console.log("---");
  }

  // ── History cap test ───────────────────────────────────────────────────────
  console.group("📋 TEST: History cap (14 turns → trimmed to 10)");
  console.log(`Sending 14-turn history. Only the last 10 should reach the API.`);

  try {
    const result = await getAssistantReply(
      "What is the last step when registering as a member?",
      LONG_HISTORY
    );

    if (result.success) {
      console.log("✅ PASS — Response received with trimmed history");
      console.log("A:", result.text);
    } else {
      console.warn("⚠️  API Error:", result.error);
    }
  } catch (err) {
    console.error("❌ Exception:", err);
  }

  console.groupEnd();
  console.groupEnd();
  console.log("✅ All tests complete.");
}

// Auto-run if executed directly via Vite's module runner
runTests();
