import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailPayload {
  to: string;
  subject?: string;
  type: 'APPLICATION_RECEIVED' | 'INTERVIEW_INVITE' | 'STATUS_ACCEPTED' | 'STATUS_REJECTED' | 'INTERVIEW_CONFIRMED';
  data: {
    studentName?: string;
    eventName?: string;
    ocPosition?: string;
    calLink?: string;
    interviewDate?: string;
    interviewLink?: string;
    customMessage?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GMAIL_USER = Deno.env.get('GMAIL_USER');
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!GMAIL_USER && !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Neither GMAIL_USER nor RESEND_API_KEY is set in Supabase Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: EmailPayload = await req.json();
    const { to, type, data } = body;

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const studentName = data?.studentName || 'Applicant';
    const eventName = data?.eventName || 'Society Event';
    const position = data?.ocPosition || 'Committee Member';

    let subject = body.subject;
    let htmlContent = '';

    switch (type) {
      case 'APPLICATION_RECEIVED':
        subject = subject || `Application Received: ${position} - ${eventName}`;
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

      case 'INTERVIEW_INVITE':
        subject = subject || `Interview Invitation: ${position} - ${eventName}`;
        const bookingUrl = data?.calLink || 'https://cal.com';
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
                <a href="${bookingUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  📅 Schedule Your Interview (Cal.com)
                </a>
              </div>
              <p style="font-size: 13px; color: #666666;">Or copy this link: <a href="${bookingUrl}">${bookingUrl}</a></p>
              <br/>
              <p>We look forward to meeting you!</p>
              <p>Best regards,<br/><strong>Society Interview Panel</strong></p>
            </div>
          </div>
        `;
        break;

      case 'INTERVIEW_CONFIRMED':
        subject = subject || `Interview Scheduled: ${position} - ${eventName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #16a34a; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Interview Booking Confirmed! ✅</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>Your interview for <strong>${position}</strong> (${eventName}) has been officially confirmed.</p>
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${data?.interviewDate || 'Scheduled via Cal.com'}</p>
                ${data?.interviewLink ? `<p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="${data.interviewLink}">${data.interviewLink}</a></p>` : ''}
              </div>
              <p>Please make sure to join on time. See you soon!</p>
              <br/>
              <p>Best regards,<br/><strong>Society Committee</strong></p>
            </div>
          </div>
        `;
        break;

      case 'STATUS_ACCEPTED':
        subject = subject || `Congratulations! Accepted for ${position} - ${eventName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <div style="background-color: #16a34a; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; color: #ffffff;">
              <h2 style="margin: 0;">Congratulations & Welcome Aboard! 🌟</h2>
            </div>
            <div style="padding: 24px; color: #333333;">
              <p>Dear <strong>${studentName}</strong>,</p>
              <p>We are delighted to inform you that you have been selected for the position of <strong>${position}</strong> for <strong>${eventName}</strong>!</p>
              <p>Your enthusiasm and skills stood out during the interview process. We are super excited to have you on our team.</p>
              ${data?.customMessage ? `<p style="background-color: #f0fdf4; padding: 12px; border-left: 4px solid #16a34a; color: #166534;">${data.customMessage}</p>` : ''}
              <p>We will share details regarding our onboarding meeting soon.</p>
              <br/>
              <p>Warm regards,<br/><strong>Society Executive Committee</strong></p>
            </div>
          </div>
        `;
        break;

      case 'STATUS_REJECTED':
        subject = subject || `Update regarding your application for ${position} - ${eventName}`;
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

    // 1. Preferred Option: Send via Gmail SMTP if GMAIL_USER and GMAIL_APP_PASSWORD are set
    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD,
        },
      });

      const mailOptions = {
        from: `Society Team <${GMAIL_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully via Gmail SMTP:', info.messageId);

      return new Response(
        JSON.stringify({ success: true, provider: 'gmail', messageId: info.messageId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fallback Option: Send via Resend API
    if (RESEND_API_KEY) {
      const FROM_EMAIL = Deno.env.get('SOCIETY_FROM_EMAIL') || 'Society Team <onboarding@resend.dev>';
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error('Resend Error:', resendData);
        return new Response(
          JSON.stringify({ error: 'Failed to send email via Resend', details: resendData }),
          { status: resendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, provider: 'resend', messageId: resendData.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'No valid email configuration found' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Edge Function Exception:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
