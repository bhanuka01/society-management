import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guideContent } from "./guide.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Rate Limiting / Abuse Protection ──────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;
const ipRequestCounts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequestCounts.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  timestamps.push(now);
  ipRequestCounts.set(ip, timestamps);
  return false;
}

// ── System Prompt Construction ───────────────────────────────────────────────
function buildSystemPrompt(guideText: string, userRole = "guest"): string {
  const isStaff = userRole === "admin" || userRole === "editor";

  const roleInstruction = isStaff
    ? `The current user has a **${userRole.toUpperCase()}** role. They have staff/administrative privileges in the portal.`
    : `The current user has a **${userRole.toUpperCase()}** role (General Member / Visitor). They DO NOT have staff or administrative privileges.

CRITICAL ROLE-BASED ACCESS CONTROL (RBAC) RESTRICTION:
- If the user asks about performing staff-only or admin-only actions (such as importing members via CSV, deleting members, approving/rejecting registrations, creating/editing/deleting events, generating QR attendance codes, managing letter request statuses, inviting staff, promoting users, or accessing system settings):
  1. Clearly state that this action is restricted to Editors and Admins.
  2. Inform the user that as a ${userRole}, they cannot perform this administrative action.
  3. Briefly explain what regular members ARE allowed to do (e.g., register, view public/assigned events, check in via QR code when enabled, apply to OC, submit letter requests, edit own profile photo/LinkedIn).
  4. Advise them to contact a society Editor or Admin if they need staff assistance.`;

  return `You are the **ADSS Portal Assistant**, a helpful AI support agent for the ADSS Society Management Portal.

## Current User Context
${roleInstruction}

## Your Role
Answer questions from society members, editors, and admins about how to use the portal. You are embedded as a chat widget inside the app, so keep all answers concise and practical.

## Reference Material
The following is the complete ADSS Portal User & Administration Guide. Use it as your **primary and authoritative source** when answering questions. Do not invent features, workflows, or settings that are not described here.

---
${guideText}
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

5. **Role awareness & Restrictions:** Enforce the Role-Based Access Control rules specified above. When a user with a member/guest role asks about an editor/admin-only action, inform them that the feature is restricted to staff and do not provide instructions as if they can perform it.

6. **Tone:** Friendly, professional, and direct. No filler phrases like "Great question!" or "Certainly!".

7. **Formatting:** Use bold for UI labels and menu names. Use numbered lists for step-by-step instructions. Do not use large headers (##) in your replies — this is a chat, not a document.`;
}

// ── HTTP Request Handler ──────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Basic Authorization header validation (reject if missing anon key or auth token)
  const authHeader = req.headers.get('authorization') || req.headers.get('apikey') || req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: missing authorization headers' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Basic Rate Limiting by IP
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown-ip';
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait a moment before trying again.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { userMessage, history = [], userRole = "guest" } = await req.json();

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message cannot be empty.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY via Supabase secrets.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(guideContent, userRole);

    // Build Gemini REST payload
    const contents = history.map((turn: { role: string; text: string }) => ({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    }));

    contents.push({
      role: 'user',
      parts: [{ text: userMessage.trim() }],
    });

    // Supported Gemini REST models: gemini-2.5-flash or gemini-1.5-flash
    const geminiModel = 'gemini-3.5-flash-lite';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json().catch(() => ({}));
      const status = geminiResponse.status;

      let errorMsg = `Gemini API error (HTTP ${status})`;
      if (status === 400) errorMsg = 'Invalid request sent to Gemini API.';
      if (status === 401 || status === 403) errorMsg = 'Gemini API key is invalid or unauthorized.';
      if (status === 429) errorMsg = 'Gemini API rate limit reached. Please wait a moment and try again.';
      if (status >= 500) errorMsg = 'Gemini service is temporarily unavailable. Please try again later.';

      const detail = errorBody?.error?.message;
      if (detail) errorMsg += `: ${detail}`;

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiResponse.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output ??
      null;

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        return new Response(
          JSON.stringify({ success: false, error: "The response was blocked by Gemini's safety filters." }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Gemini returned an empty response.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, text }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'An unexpected error occurred.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
