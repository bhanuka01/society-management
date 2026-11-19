-- Google sign-up: complete registration after OAuth.
-- Run in Supabase SQL Editor. Does NOT touch handle_new_user().

create or replace function public.complete_google_registration(
  p_full_name text,
  p_preferred_name text,
  p_st_id text,
  p_level integer,
  p_mobile text,
  p_membership_status text,   -- 'executive' | 'member'
  p_member_function text,
  p_st_position text,
  p_is_appeal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_st_id text;
  v_name text;
  v_status text;
  v_auto text;
  v_pre boolean := false;
  v_prof record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  -- Never overwrite an already-approved account or staff
  select * into v_prof from profiles where id = v_uid;
  if found and (v_prof.role in ('editor','admin')
     or (v_prof.status in ('approved','active') and coalesce(v_prof.st_id,'') <> '')) then
    return jsonb_build_object('status', v_prof.status, 'skipped', true);
  end if;

  v_name := coalesce(nullif(trim(p_full_name), ''), v_email);

  -- Normalise ST ID (same rule as handle_new_user)
  v_st_id := trim(coalesce(p_st_id, ''));
  if v_st_id <> '' then
    if lower(v_st_id) like 'sc/%' then
      v_st_id := 'SC/' || substring(v_st_id from 4);
    else
      v_st_id := 'SC/' || v_st_id;
    end if;
  end if;

  -- Pre-registered member (matched by email)?
  declare v_m_st text;
  begin
    select st_id into v_m_st from members where lower(email) = v_email limit 1;
    if v_m_st is not null then
      v_pre := true;
      v_st_id := v_m_st;
    end if;
  end;

  if v_st_id = '' then
    raise exception 'Student ID is required';
  end if;

  if not v_pre then
    if exists (select 1 from members where lower(st_id) = lower(v_st_id)) then
      raise exception 'Student ID % is already registered to another member.', v_st_id;
    end if;
    insert into members (
      st_id, name, preferred_name, email, level, mobile_number,
      st_position, member_function, membership_status
    ) values (
      v_st_id, v_name, nullif(trim(p_preferred_name), ''), v_email,
      coalesce(p_level, 1), nullif(trim(p_mobile), ''),
      coalesce(nullif(p_st_position, ''), 'Member'),
      coalesce(nullif(p_member_function, ''), 'General'),
      coalesce(p_membership_status, 'member')
    );
  else
    update members set
      preferred_name = coalesce(nullif(trim(p_preferred_name), ''), preferred_name),
      mobile_number = coalesce(nullif(trim(p_mobile), ''), mobile_number),
      member_function = coalesce(nullif(p_member_function, ''), member_function),
      st_position = coalesce(nullif(p_st_position, ''), st_position),
      membership_status = coalesce(p_membership_status, membership_status)
    where lower(st_id) = lower(v_st_id);
  end if;

  -- Status
  if p_is_appeal then
    v_status := 'pending_editor_review';
  elsif v_pre then
    v_status := 'approved';
  else
    if p_membership_status = 'executive' then
      select coalesce((select value from system_settings where key='registration_auto_approve_executive'),
                      (select value from system_settings where key='registration_auto_approve'), 'false') into v_auto;
    else
      select coalesce((select value from system_settings where key='registration_auto_approve_member'),
                      (select value from system_settings where key='registration_auto_approve'), 'false') into v_auto;
    end if;
    v_status := case when v_auto = 'true' then 'approved' else 'pending' end;
  end if;

  insert into profiles (id, email, full_name, preferred_name, role, st_id, status, membership_status)
  values (v_uid, v_email, v_name, nullif(trim(p_preferred_name), ''), 'member', v_st_id, v_status,
          coalesce(p_membership_status, 'member'))
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    preferred_name = excluded.preferred_name,
    role = 'member',
    st_id = excluded.st_id,
    status = excluded.status,
    membership_status = excluded.membership_status,
    updated_at = now();

  return jsonb_build_object('status', v_status, 'st_id', v_st_id, 'skipped', false);
end;
$$;

grant execute on function public.complete_google_registration(text,text,text,integer,text,text,text,text,boolean) to authenticated;

notify pgrst, 'reload schema';

