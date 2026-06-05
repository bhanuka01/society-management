-- Supabase Auth + RLS setup for Society Management.
-- Run this in Supabase SQL Editor after the base tables exist.

-- Add email column to members table if not exists
alter table members add column if not exists email varchar(255) unique;
alter table members add column if not exists mobile_number varchar(50);
alter table members add column if not exists profile_image_url text;
alter table members add column if not exists linkedin_url text;

-- Add application date range to events
alter table events add column if not exists apply_start_date date;
alter table events add column if not exists apply_end_date date;


create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'member' check (role in ('member', 'editor', 'admin')),
  st_id varchar(50) references members(st_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists access_invites (
  id bigserial primary key,
  email text not null,
  role text not null check (role in ('editor', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (email, role)
);

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role from profiles where id = auth.uid()),
    'guest'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_app_role() in ('admin', 'editor');
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.can_register_staff(p_email text, p_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from access_invites
    where lower(email) = lower(p_email)
      and role = p_role
      and used_at is null
  );
$$;

create or replace function public.get_member_by_email(p_email text)
returns table (st_id varchar(50), name varchar(255))
language sql
security definer
set search_path = public
stable
as $$
  select st_id, name
  from members
  where lower(email) = lower(p_email);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  v_st_id varchar(50);
  v_name varchar(255);
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'member');

  if requested_role not in ('member', 'editor', 'admin') then
    requested_role := 'member';
  end if;

  if requested_role in ('editor', 'admin') and not public.can_register_staff(new.email, requested_role) then
    requested_role := 'member';
  end if;

  -- Look up member by email to link their st_id and name
  select st_id, name into v_st_id, v_name
  from members
  where lower(email) = lower(new.email);

  -- If registering as a member, they MUST exist in the members table
  if requested_role = 'member' and v_st_id is null then
    raise exception 'Email % is not registered as a member.', new.email;
  end if;

  insert into profiles (id, email, full_name, role, st_id)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), v_name),
    requested_role,
    v_st_id
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        st_id = excluded.st_id,
        updated_at = now();

  if requested_role in ('editor', 'admin') then
    update access_invites
    set used_at = now()
    where lower(email) = lower(new.email)
      and role = requested_role
      and used_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table access_invites enable row level security;
alter table members enable row level security;
alter table functions enable row level security;
alter table roles enable row level security;
alter table events enable row level security;
alter table oc enable row level security;
alter table attendance enable row level security;

drop policy if exists "profiles read own or admin" on profiles;
drop policy if exists "authenticated read profiles" on profiles;
create policy "authenticated read profiles"
on profiles for select
to authenticated
using (true);

drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own"
on profiles for insert
to authenticated
with check (
  id = auth.uid()
  and lower(email) = lower(auth.email())
  and (
    role = 'member'
    or public.can_register_staff(email, role)
  )
);

drop policy if exists "profiles update own or admin" on profiles;
create policy "profiles update own or admin"
on profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and lower(email) = lower(auth.email())
    and role = public.current_app_role()
  )
);

drop policy if exists "access invites admin read" on access_invites;
create policy "access invites admin read"
on access_invites for select
to authenticated
using (public.is_admin());

drop policy if exists "access invites admin insert" on access_invites;
create policy "access invites admin insert"
on access_invites for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "access invites admin update" on access_invites;
create policy "access invites admin update"
on access_invites for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "access invites admin delete" on access_invites;
create policy "access invites admin delete"
on access_invites for delete
to authenticated
using (public.is_admin());

drop policy if exists "public read members" on members;
drop policy if exists "authenticated read members" on members;
create policy "authenticated read members" on members for select to authenticated using (true);
drop policy if exists "staff insert members" on members;
create policy "staff insert members" on members for insert to authenticated with check (public.is_staff());
drop policy if exists "staff update members" on members;
create policy "staff update members" on members for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete members" on members;
create policy "staff delete members" on members for delete to authenticated using (public.is_staff());

drop policy if exists "members update own" on members;
create policy "members update own" on members for update to authenticated
using (st_id = (select st_id from profiles where id = auth.uid()))
with check (st_id = (select st_id from profiles where id = auth.uid()));

drop policy if exists "public read functions" on functions;
create policy "public read functions" on functions for select using (true);
drop policy if exists "staff insert functions" on functions;
create policy "staff insert functions" on functions for insert to authenticated with check (public.is_staff());
drop policy if exists "staff update functions" on functions;
create policy "staff update functions" on functions for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete functions" on functions;
create policy "staff delete functions" on functions for delete to authenticated using (public.is_staff());

drop policy if exists "public read roles" on roles;
create policy "public read roles" on roles for select using (true);
drop policy if exists "admin manage roles" on roles;
create policy "admin manage roles" on roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read events" on events;
create policy "public read events" on events for select using (true);
drop policy if exists "staff insert events" on events;
create policy "staff insert events" on events for insert to authenticated with check (public.is_staff());
drop policy if exists "staff update events" on events;
create policy "staff update events" on events for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete events" on events;
create policy "staff delete events" on events for delete to authenticated using (public.is_staff());

drop policy if exists "public read oc" on oc;
create policy "public read oc" on oc for select using (true);
drop policy if exists "staff insert oc" on oc;
create policy "staff insert oc" on oc for insert to authenticated with check (public.is_staff());
drop policy if exists "staff update oc" on oc;
create policy "staff update oc" on oc for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete oc" on oc;
create policy "staff delete oc" on oc for delete to authenticated using (public.is_staff());

drop policy if exists "member insert own oc" on oc;
create policy "member insert own oc" on oc for insert to authenticated with check (
  st_id = (select st_id from profiles where id = auth.uid())
  and apply_status = 'Pending'
);

drop policy if exists "public read attendance" on attendance;
create policy "public read attendance" on attendance for select using (true);
drop policy if exists "staff insert attendance" on attendance;
create policy "staff insert attendance" on attendance for insert to authenticated with check (public.is_staff());
drop policy if exists "staff update attendance" on attendance;
create policy "staff update attendance" on attendance for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete attendance" on attendance;
create policy "staff delete attendance" on attendance for delete to authenticated using (public.is_staff());

notify pgrst, 'reload schema';

-- One-time sync: link student ID for any already-registered accounts where emails match
update profiles p
set st_id = m.st_id
from members m
where lower(p.email) = lower(m.email)
  and p.st_id is null;

-- Create messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_st_id varchar(50) references members(st_id) on delete set null,
  receiver_st_id varchar(50) references members(st_id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

-- Enable RLS
alter table messages enable row level security;

-- Policies for Messages
drop policy if exists "staff read all messages" on messages;
create policy "staff read all messages" on messages for select
to authenticated
using (public.is_staff());

drop policy if exists "staff insert messages" on messages;
create policy "staff insert messages" on messages for insert
to authenticated
with check (public.is_staff());

drop policy if exists "member read own or broadcast messages" on messages;
create policy "member read own or broadcast messages" on messages for select
to authenticated
using (
  receiver_st_id is null 
  or receiver_st_id = (select st_id from profiles where id = auth.uid())
  or sender_st_id = (select st_id from profiles where id = auth.uid())
);

drop policy if exists "member insert messages" on messages;
create policy "member insert messages" on messages for insert
to authenticated
with check (
  sender_st_id = (select st_id from profiles where id = auth.uid())
  and receiver_st_id is not null -- Members can only DM staff back, no broadcast
);

-- Enable Realtime for messages table
alter publication supabase_realtime add table messages;

-- 7. Tasks for Organizing Committee (OC)
create table if not exists tasks (
  id bigserial primary key,
  event_id varchar(50) references events(event_id) on delete cascade,
  st_id varchar(50) references members(st_id) on delete cascade,
  task_name text not null,
  deadline date,
  status varchar(50) default 'Pending' check (status in ('Pending', 'Completed')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table tasks enable row level security;

-- Policies for Tasks
drop policy if exists "public read tasks" on tasks;
create policy "public read tasks" on tasks for select to authenticated using (true);

drop policy if exists "oc president insert tasks" on tasks;
create policy "oc president insert tasks" on tasks for insert to authenticated
with check (
  public.is_staff()
  or (select st_id from profiles where id = auth.uid()) = (select oc_st_id from events where event_id = tasks.event_id)
);

drop policy if exists "oc president delete tasks" on tasks;
create policy "oc president delete tasks" on tasks for delete to authenticated
using (
  public.is_staff()
  or (select st_id from profiles where id = auth.uid()) = (select oc_st_id from events where event_id = tasks.event_id)
);

drop policy if exists "update tasks policy" on tasks;
create policy "update tasks policy" on tasks for update to authenticated
using (
  public.is_staff()
  or (select st_id from profiles where id = auth.uid()) = (select oc_st_id from events where event_id = tasks.event_id)
  or st_id = (select st_id from profiles where id = auth.uid())
)
with check (
  public.is_staff()
  or (select st_id from profiles where id = auth.uid()) = (select oc_st_id from events where event_id = tasks.event_id)
  or (
    st_id = (select st_id from profiles where id = auth.uid())
    and status in ('Pending', 'Completed')
  )
);

-- Enable Realtime for tasks table
alter publication supabase_realtime add table tasks;


ALTER TABLE members
ADD COLUMN IF NOT EXISTS member_function VARCHAR(100);