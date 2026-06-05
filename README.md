# Society Management System

A React + Supabase web app for managing society members, events, organizing committee assignments, and attendance records.

## Features

- Member directory with search, pagination, add, edit, and delete actions
- Event management with event dates and assigned OC members
- Attendance tracking per event with YES/NO status
- Organizing committee assignment by event, function, position, and application status
- Dashboard overview for members, events, committee records, and attendance totals
- Guest, member, editor, and admin views
- Supabase Auth email/password login for editor and admin users
- Admin-only registration invites for new editors/admins
- Supabase connection status indicator

## Tech Stack

- React 18
- Vite 5
- Supabase JavaScript Client v2
- Supabase PostgreSQL database

## Requirements

Install these before starting:

- Node.js 18 or newer
- npm
- A Supabase account and project

Check your installed versions:

```bash
node -v
npm -v
```

## Project Structure

```text
society-management/
+-- src/
|   +-- App.jsx
|   +-- App.css
|   +-- main.jsx
|   +-- supabaseClient.js
|   +-- components/
|   |   +-- Pagination.jsx
|   +-- pages/
|       +-- About.jsx
|       +-- Attendance.jsx
|       +-- Committee.jsx
|       +-- Dashboard.jsx
|       +-- Events.jsx
|       +-- Members.jsx
|       +-- Setup.jsx
+-- index.html
+-- package.json
+-- package-lock.json
+-- vite.config.js
+-- README.md
```

## Full Local Setup

### 1. Install Dependencies

From the project root, run:

```bash
npm install
```

### 2. Create a Supabase Project

1. Go to https://supabase.com.
2. Sign in or create an account.
3. Click `New Project`.
4. Choose an organization, project name, database password, and region.
5. Wait until the project is ready.

### 3. Create the Database Tables

Open your Supabase project, go to `SQL Editor`, create a new query, paste this SQL, and run it:

```sql
-- 1. Members
CREATE TABLE IF NOT EXISTS members (
  st_id       VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  level       INT,
  st_position VARCHAR(100),
  member_function VARCHAR(100)
);

ALTER TABLE members
ADD COLUMN IF NOT EXISTS member_function VARCHAR(100);

-- 2. Functions / departments / sub-teams
CREATE TABLE IF NOT EXISTS functions (
  id            BIGSERIAL PRIMARY KEY,
  function_name VARCHAR(100) UNIQUE NOT NULL
);

-- 3. Roles
CREATE TABLE IF NOT EXISTS roles (
  id        BIGSERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

-- 4. Events
CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR(50) PRIMARY KEY,
  name     VARCHAR(255) NOT NULL,
  date     DATE NOT NULL,
  oc_st_id VARCHAR(50) REFERENCES members(st_id) ON DELETE SET NULL
);

ALTER TABLE events
ADD COLUMN IF NOT EXISTS oc_st_id VARCHAR(50) REFERENCES members(st_id) ON DELETE SET NULL;

-- 5. Organizing Committee
CREATE TABLE IF NOT EXISTS oc (
  event_id     VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
  st_id        VARCHAR(50) REFERENCES members(st_id) ON DELETE CASCADE,
  function_id  BIGINT REFERENCES functions(id),
  oc_position  VARCHAR(100),
  apply_status VARCHAR(50) DEFAULT 'Pending',
  UNIQUE (event_id, st_id, function_id)
);

ALTER TABLE oc
ADD COLUMN IF NOT EXISTS event_id VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE;

ALTER TABLE oc
DROP COLUMN IF EXISTS role_id;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'oc'::regclass AND contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE oc DROP CONSTRAINT ' || quote_ident(pk_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oc_event_member_function_key'
  ) THEN
    ALTER TABLE oc
    ADD CONSTRAINT oc_event_member_function_key UNIQUE (event_id, st_id, function_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- 6. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  st_id    VARCHAR(50) REFERENCES members(st_id) ON DELETE CASCADE,
  event_id VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
  attend   VARCHAR(3) CHECK (attend IN ('YES','NO')) DEFAULT 'NO',
  PRIMARY KEY (st_id, event_id)
);

INSERT INTO roles (role_name) VALUES ('Admin'), ('Editor'), ('Member')
ON CONFLICT DO NOTHING;
```

### 4. Get Supabase API Credentials

In Supabase:

1. Open your project.
2. Go to `Project Settings`.
3. Go to `API`.
4. Copy the `Project URL`.
5. Copy the `anon public` key.

### 5. Create Environment File

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Important:

- Restart the Vite dev server after changing `.env`.
- Do not commit `.env` to Git.
- `.env` is already listed in `.gitignore`.

### 6. Run the App

```bash
npm run dev
```

Open the local URL shown in the terminal. Vite usually uses:

```text
http://localhost:5173
```

If Supabase is configured correctly, the sidebar will show a live database connection.

### 3b. Enable Supabase Auth and RLS

After creating the base tables, run the extra SQL file in this repo:

```text
supabase-rls-auth.sql
```

This creates `profiles` and `access_invites`, enables Row Level Security on all app tables, allows public read access for guest/member views, and allows write access only for authenticated `admin` or `editor` users.

To create the first admin:

1. In Supabase, go to `Authentication` and create a user with your admin email/password.
2. Run this in SQL Editor, replacing the email:

```sql
update profiles
set role = 'admin', full_name = 'Main Admin'
where email = 'your-admin-email@example.com';
```

3. Log in from the app with that email/password.
4. Open `Access` and enable registration for each new editor/admin email.

## Login Details

| Role | Login method | Notes |
| --- | --- | --- |
| Guest | Default view | Can read public records |
| Member | Student ID only | No password; Student ID must exist in `members` |
| Editor | Email/password | Must be enabled by an admin invite before registration |
| Admin | Email/password | Can manage Access invites and all records |

## Recommended First Data Setup

After the database is ready:

1. Log in as admin.
2. Add members from the `Members` page.
3. Add functions such as `Logistics`, `Marketing`, `Finance`, or `Media` from the `Committee` page.
4. Create events from the `Events` page.
5. Click `Seed Att.` on an event to create attendance rows for all members.
6. Manage attendance from the `Attendance` page.
7. Add organizing committee assignments from the `Committee` page.

## Available Scripts

```bash
npm run dev
```

Starts the local development server.

```bash
npm run build
```

Creates a production build in the `dist` folder.

```bash
npm run preview
```

Serves the production build locally for preview.

## Production Build

Run:

```bash
npm run build
```

The compiled files will be created in:

```text
dist/
```

Preview the build:

```bash
npm run preview
```

## Deploy to Vercel

1. Push the project to GitHub.
2. Log in to https://vercel.com.
3. Click `Add New Project`.
4. Import the GitHub repository.
5. Add these environment variables in Vercel:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

6. Build command:

```bash
npm run build
```

7. Output directory:

```text
dist
```

8. Click `Deploy`.

## Database Tables

| Table | Purpose |
| --- | --- |
| `members` | Stores student/member records |
| `functions` | Stores committee functions or departments |
| `roles` | Stores role names |
| `events` | Stores society events |
| `oc` | Stores event-wise organizing committee assignments |
| `attendance` | Stores event attendance for each member |

## Security Notes

This app uses the Supabase anon key on the frontend, which is normal for Supabase apps. Security should be enforced with Row Level Security policies in Supabase.

Run `supabase-rls-auth.sql` before production use. Never expose the Supabase service role key in frontend code.

## Troubleshooting

### App Shows Not Connected

- Check that `.env` exists in the project root.
- Check that `VITE_SUPABASE_URL` is correct.
- Check that `VITE_SUPABASE_ANON_KEY` is correct.
- Restart the dev server after editing `.env`.
- Confirm the `members` table exists in Supabase.

### Blank Page or Build Error

Run:

```bash
npm install
npm run build
```

Then fix any error shown in the terminal.

### Member Login Fails

- Confirm the member ST ID exists in the `members` table.
- Enter the ST ID exactly as stored.
- Check Supabase table permissions if Row Level Security is enabled.

### Attendance Is Empty

- Create at least one event.
- Add members first.
- On the `Events` page, click `Seed Att.` for the event.
- Then open the `Attendance` page.

### Committee Function List Is Empty

- Log in as admin or editor.
- Open the `Committee` page.
- Click `+ Function`.
- Add functions such as `Logistics`, `Marketing`, or `Media`.

## Notes for Developers

- Supabase client configuration is in `src/supabaseClient.js`.
- Main app navigation and demo login logic are in `src/App.jsx`.
- Pages live in `src/pages`.
- Shared pagination lives in `src/components/Pagination.jsx`.
- The hidden setup guide component is in `src/pages/Setup.jsx`.
