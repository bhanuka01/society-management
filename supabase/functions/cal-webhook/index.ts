import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials missing in Edge secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body request handling
    }

    console.log('Cal.com Webhook Payload received:', JSON.stringify(body));

    const triggerEvent = body.triggerEvent || body.event || body.type;
    const payload = body.payload || body;

    // Handle Cal.com Ping Test
    if (!triggerEvent || triggerEvent === 'PING' || triggerEvent === 'ping' || body.ping || req.method === 'GET') {
      return new Response(
        JSON.stringify({ success: true, message: 'Ping test successful!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_RESCHEDULED') {
      const bookingId = String(payload.bookingId || payload.id || '');
      const startTime = payload.startTime;
      const meetingLink = payload.metadata?.videoCallUrl || payload.location || payload.videoCallUrl || '';

      // Attendees array from Cal.com
      const attendees = payload.attendees || [];
      const primaryAttendee = attendees[0] || {};
      const secondaryAttendee = attendees[1] || {}; // Guest/Interviewer added natively by Cal.com

      const candidateEmail = primaryAttendee.email || payload.responses?.email?.value || payload.email;
      const candidateName = primaryAttendee.name || payload.responses?.name?.value || 'Applicant';
      
      // Check for guests / interviewer email passed via query param or responses
      const stId = payload.responses?.st_id?.value || payload.responses?.student_id?.value;
      const customGuests = payload.responses?.guests?.value || payload.responses?.guests;
      const guestParamEmail = Array.isArray(customGuests) ? customGuests[0] : (typeof customGuests === 'string' ? customGuests : null);

      const customInterviewerEmail = secondaryAttendee.email || guestParamEmail || payload.responses?.interviewer_email?.value;

      let ocRecord = null;
      let memberRecord = null;

      // 1. Try finding member by st_id or email
      if (stId) {
        const { data: member } = await supabase.from('members').select('*').eq('st_id', stId).maybeSingle();
        memberRecord = member;
      }

      if (!memberRecord && candidateEmail) {
        const { data: member } = await supabase.from('members').select('*').eq('email', candidateEmail).maybeSingle();
        memberRecord = member;
      }

      // 2. Locate active OC record
      if (memberRecord) {
        const { data: ocRows } = await supabase
          .from('oc')
          .select('*, events(name), functions(function_name)')
          .eq('st_id', memberRecord.st_id)
          .neq('apply_status', 'Accept')
          .neq('apply_status', 'Reject')
          .order('event_id', { ascending: false });

        if (ocRows && ocRows.length > 0) {
          ocRecord = ocRows[0];
        }
      }

      // 3. Fallback search directly on OC table if member search yielded no active row
      if (!ocRecord && (stId || candidateEmail)) {
        const queryTerm = stId || candidateEmail;
        const { data: fallbackRows } = await supabase
          .from('oc')
          .select('*, events(name), functions(function_name)')
          .or(`st_id.ilike.%${queryTerm}%,oc_position.ilike.%${queryTerm}%`)
          .neq('apply_status', 'Accept')
          .neq('apply_status', 'Reject')
          .order('event_id', { ascending: false });

        if (fallbackRows && fallbackRows.length > 0) {
          ocRecord = fallbackRows[0];
        }
      }

      const interviewerEmail = customInterviewerEmail || ocRecord?.interviewer_email;
      const targetStId = ocRecord?.st_id || memberRecord?.st_id || stId;

      // 4. Update Database: Update OC table with booked interview date and link
      if (targetStId) {
        let updateQuery = supabase
          .from('oc')
          .update({
            interview_date: startTime,
            interview_link: meetingLink,
            cal_booking_id: bookingId,
            interviewer_email: interviewerEmail || undefined,
            apply_status: 'Interview Scheduled'
          });

        if (ocRecord?.event_id) {
          updateQuery = updateQuery.eq('event_id', ocRecord.event_id).eq('st_id', targetStId);
        } else {
          updateQuery = updateQuery.eq('st_id', targetStId);
        }

        const { error: updateErr } = await updateQuery;

        if (updateErr) {
          console.error('Failed to update OC table:', updateErr);
        } else {
          console.log(`Successfully updated interview for candidate ${targetStId}`);
        }
      } else {
        console.warn('Could not determine candidate targetStId to update OC record.');
      }

      const formattedDate = new Date(startTime).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short'
      });

      const positionName = ocRecord?.oc_position || ocRecord?.functions?.function_name || 'Committee Member';
      const eventName = ocRecord?.events?.name || 'Society Event';

      // 📧 Send Confirmation Email to Candidate A
      if (candidateEmail) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: candidateEmail,
            type: 'INTERVIEW_CONFIRMED',
            subject: `Interview Scheduled: ${positionName} - ${eventName}`,
            data: {
              studentName: candidateName,
              eventName: eventName,
              ocPosition: positionName,
              interviewDate: formattedDate,
              interviewLink: meetingLink
            }
          }
        });
      }

      // 📧 Send Notification Email to Interviewer B
      if (interviewerEmail && interviewerEmail.toLowerCase() !== candidateEmail.toLowerCase()) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: interviewerEmail,
            type: 'INTERVIEW_CONFIRMED',
            subject: `📅 New Interview Booked: ${candidateName} (${positionName})`,
            data: {
              studentName: `Interviewer (Candidate: ${candidateName})`,
              eventName: eventName,
              ocPosition: positionName,
              interviewDate: formattedDate,
              interviewLink: meetingLink,
              customMessage: `Candidate <strong>${candidateName}</strong> (${candidateEmail}) has booked their interview slot for <strong>${positionName}</strong>.`
            }
          }
        });
        console.log(`Notification sent to Interviewer B: ${interviewerEmail}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Booking processed successfully', candidateEmail, interviewerEmail }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (triggerEvent === 'BOOKING_CANCELLED') {
      const bookingId = String(payload.bookingId || payload.id || '');
      if (bookingId) {
        await supabase
          .from('oc')
          .update({
            apply_status: 'Pending',
            interview_notes: 'Interview booking was cancelled'
          })
          .eq('cal_booking_id', bookingId);
      }
      return new Response(JSON.stringify({ success: true, message: 'Booking cancellation processed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Event processed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
