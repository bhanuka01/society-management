-- ==============================================================================
-- Migration: OC Candidates Search View
-- Run this in your Supabase SQL Editor (supabase.com -> SQL Editor -> New Query)
-- ==============================================================================
-- This view flattens `oc`, `members`, and `functions` so that candidate names,
-- emails, and function names are first-class columns.
-- This allows direct, high-performance `.or('candidate_name.ilike.%q%,st_id.ilike.%q%')`
-- queries without needing multi-step client-side foreign key lookups.
-- ==============================================================================

CREATE OR REPLACE VIEW oc_candidates_view AS
SELECT 
    o.event_id,
    o.st_id,
    o.function_id,
    o.oc_position,
    o.apply_status,
    o.interview_date,
    o.interview_link,
    o.cal_booking_id,
    o.interview_notes,
    o.interviewer_email,
    m.name AS candidate_name,
    m.preferred_name AS candidate_preferred_name,
    m.email AS candidate_email,
    m.mobile_number AS candidate_mobile,
    m.level AS candidate_level,
    f.function_name
FROM oc o
LEFT JOIN members m ON o.st_id = m.st_id
LEFT JOIN functions f ON o.function_id = f.id;

-- Grant permissions for authenticated and anonymous users
GRANT SELECT ON oc_candidates_view TO authenticated;
GRANT SELECT ON oc_candidates_view TO anon;
GRANT ALL ON oc_candidates_view TO service_role;
