import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EMAIL_TYPES = new Set([
  'APPLICATION_RECEIVED',
  'INTERVIEW_INVITE',
  'STATUS_ACCEPTED',
  'STATUS_REJECTED',
  'INTERVIEW_CONFIRMED',
]);

interface EmailPayload {
  to: string;
  subject?: string;
  type: 'APPLICATION_RECEIVED' | 'INTERVIEW_INVITE' | 'STATUS_ACCEPTED' | 'STATUS_REJECTED' | 'INTERVIEW_CONFIRMED';
  data?: {
    studentName?: string;
    eventName?: string;
    ocPosition?: string;
    calLink?: string;
    interviewDate?: string;
    interviewLink?: string;
    customMessage?: string;
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeSafeUrl(rawUrl: unknown, fallback = ''): string {
  const str = String(rawUrl ?? '').trim();
  if (!str) return fallback;
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Reject invalid or non-HTTP(S) URLs (e.g., javascript:, data:)
  }
  return fallback;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase environment configuration missing.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── SECURITY FIX (#4): Authenticate caller & require approved staff or service_role ──
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Bearer token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Empty Bearer token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow trusted server-to-server invocations (e.g., cal-webhook using service_role key)
    const isServiceRoleCall = constantTimeEqual(token, SUPABASE_SERVICE_ROLE_KEY.trim());

    if (!isServiceRoleCall) {
      const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .maybeSingle();

      const isApprovedStaff =
        !profileErr &&
        profile?.status === 'approved' &&
        (profile?.role === 'admin' || profile?.role === 'editor');

      if (!isApprovedStaff) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only approved staff (admin/editor) can send emails.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const GMAIL_USER = Deno.env.get('GMAIL_USER');
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'GMAIL_USER and GMAIL_APP_PASSWORD must be configured in Supabase Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: EmailPayload = await req.json();
    const { to, type, data } = body;

    if (!to || typeof to !== 'string' || !type || !ALLOWED_EMAIL_TYPES.has(type)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanTo = sanitizeHeaderValue(to);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawStudentName = data?.studentName || 'Applicant';
    const rawEventName = data?.eventName || 'Society Event';
    const rawPosition = data?.ocPosition || 'Committee Member';

    // Escape all dynamic fields to prevent HTML/XSS injection in email templates
    const studentName = escapeHtml(rawStudentName);
    const eventName = escapeHtml(rawEventName);
    const position = escapeHtml(rawPosition);
    const safeInterviewDate = escapeHtml(data?.interviewDate || 'Scheduled via Cal.com');
    const safeCustomMessage = data?.customMessage ? escapeHtml(data.customMessage) : '';

    let subject = body.subject ? sanitizeHeaderValue(body.subject) : '';
    let htmlContent = '';

    switch (type) {
      case 'APPLICATION_RECEIVED':
        subject = subject || sanitizeHeaderValue(`Application Received: ${rawPosition} - ${rawEventName}`);
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #4f46e5; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Application Confirmation</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>Thank you for applying for the position of <strong>${position}</strong> for <strong>${eventName}</strong>!</p>
              <p>We have successfully received your application. Our committee team is currently reviewing applications and will reach out to you shortly regarding the next steps.</p>
              <br/>
              <p>Best regards,<br/><strong>Society Organizing Committee</strong></p>
            </div>
          </div>
        `;
        break;

      case 'INTERVIEW_INVITE': {
        subject = subject || sanitizeHeaderValue(`Interview Invitation: ${rawPosition} - ${rawEventName}`);
        const bookingUrl = sanitizeSafeUrl(data?.calLink, 'https://cal.com');
        const escapedBookingUrl = escapeHtml(bookingUrl);
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #0284c7; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">You're Invited for an Interview! 🎉</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>We were impressed by your application for <strong>${position}</strong> (${eventName}) and would love to schedule a quick interview with you!</p>
              <p>Please select a time slot that works best for you using our online scheduling page:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${escapedBookingUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  📅 Schedule Your Interview (Cal.com)
                </a>
              </div>
              <p style="font-size: 13px; color: #666666;">Or copy this link: <a href="${escapedBookingUrl}" rel="noopener noreferrer">${escapedBookingUrl}</a></p>
              <br/>
              <p>We look forward to meeting you!</p>
              <p>Best regards,<br/><strong>Society Interview Panel</strong></p>
            </div>
          </div>
        `;
        break;
      }

      case 'INTERVIEW_CONFIRMED': {
        subject = subject || sanitizeHeaderValue(`Interview Scheduled: ${rawPosition} - ${rawEventName}`);
        const safeMeetingUrl = sanitizeSafeUrl(data?.interviewLink, '');
        const escapedMeetingUrl = escapeHtml(safeMeetingUrl);
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #16a34a; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Interview Booking Confirmed! ✅</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>Your interview for <strong>${position}</strong> (${eventName}) has been officially confirmed.</p>
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date &amp; Time:</strong> ${safeInterviewDate}</p>
                ${safeMeetingUrl ? `<p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="${escapedMeetingUrl}" rel="noopener noreferrer">${escapedMeetingUrl}</a></p>` : ''}
              </div>
              ${safeCustomMessage ? `<p style="background-color: #f0fdf4; padding: 12px; border-left: 4px solid #16a34a; color: #166534;">${safeCustomMessage}</p>` : ''}
              <p>Please make sure to join on time. See you soon!</p>
              <br/>
              <p>Best regards,<br/><strong>Society Committee</strong></p>
            </div>
          </div>
        `;
        break;
      }

      case 'STATUS_ACCEPTED':
        subject = subject || sanitizeHeaderValue(`Congratulations! Accepted for ${rawPosition} - ${rawEventName}`);
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #16a34a; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Congratulations &amp; Welcome Aboard! 🌟</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Dear <strong>${studentName}</strong>,</p>
              <p>We are delighted to inform you that you have been selected for the position of <strong>${position}</strong> for <strong>${eventName}</strong>!</p>
              <p>Your enthusiasm and skills stood out during the interview process. We are super excited to have you on our team.</p>
              ${safeCustomMessage ? `<p style="background-color: #f0fdf4; padding: 12px; border-left: 4px solid #16a34a; color: #166534;">${safeCustomMessage}</p>` : ''}
              <p>We will share details regarding our onboarding meeting soon.</p>
              <br/>
              <p>Warm regards,<br/><strong>Society Executive Committee</strong></p>
            </div>
          </div>
        `;
        break;

      case 'STATUS_REJECTED':
        subject = subject || sanitizeHeaderValue(`Update regarding your application for ${rawPosition} - ${rawEventName}`);
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #4b5563; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Application Status Update</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Dear <strong>${studentName}</strong>,</p>
              <p>Thank you for taking the time to apply and interview for the position of <strong>${position}</strong> (${eventName}).</p>
              <p>After careful consideration, we regret to inform you that we are unable to offer you the position at this time due to high competition and limited slots.</p>
              <p>We appreciate your interest in our society and encourage you to apply for future events and roles.</p>
              <br/>
              <p>Best regards,<br/><strong>Society Executive Committee</strong></p>
            </div>
          </div>
        `;
        break;
    }

    // Helper to strip HTML tags for plain text fallback (reduces spam score)
    const textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Send via Gmail SMTP with explicit host/port
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: GMAIL_USER.trim(),
        pass: GMAIL_APP_PASSWORD.trim().replace(/\s+/g, ''),
      },
    });

    const mailOptions = {
      from: GMAIL_USER.trim(),
      to: cleanTo,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully via Gmail SMTP:', info.messageId);

    return new Response(
      JSON.stringify({ success: true, provider: 'gmail', messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Edge Function Exception:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
