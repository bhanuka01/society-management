<![CDATA[<div align="center">

# ADSS Ruhuna — Society Management System

**Actuarial & Data Science Society, University of Ruhuna**

A modern, full-featured web application for managing society members, events, committees, attendance, notices, and more — built with React, Supabase, and Tailwind CSS.

[![Live Demo](https://img.shields.io/badge/Live-adssruhuna.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://adssruhuna.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-CDN-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](#progressive-web-app)

</div>

---

## ✨ Features

| Category | Highlights |
| --- | --- |
| **Member Management** | Search, paginate, add, edit, delete members; profile images; phone contacts |
| **Events** | Create / manage events with dates, OC assignments, event flyers, and a public event page |
| **Attendance** | Per-event attendance (YES / NO); seed attendance rows; QR-based scan attendance |
| **Committee** | Assign members to organizing committees by event, function, position & application status |
| **Notices** | Create and publish society notices; public notice board view |
| **OC Tasks** | Track organizing committee task assignments |
| **Letter Requests** | Members can request letters; admins manage and respond |
| **Messages** | Internal messaging system for society communication |
| **Dashboard** | Overview cards for members, events, committee records, and attendance totals |
| **Authentication** | Email / password login (Supabase Auth); guest, member, editor & admin roles |
| **Access Control** | Admin-only registration invites; Row Level Security on all tables |
| **PWA Support** | Installable as a mobile / desktop app with offline Service Worker caching |
| **Dark Mode** | Default dark theme with Indigo / Zinc design system |

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5 |
| Styling | Tailwind CSS (Play CDN), Inter font, Material Symbols icons |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Deployment | Vercel |
| PWA | Service Worker + Web App Manifest |
| Markdown | `marked` library for rich text rendering |

---

## 📁 Project Structure

```text
society-management/
├── public/
│   ├── icons/                    # PWA icons (192×192, 512×512, maskable)
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker
│   ├── logo.png                  # Favicon & logos
│   ├── logo_dark.png
│   ├── logo_light.png
│   ├── logo_trans_dark.png
│   └── logo_trans_light.png
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Root component, routing, auth, sidebar
│   ├── App.css                   # Global styles
│   ├── supabaseClient.js         # Supabase client init
│   ├── components/
│   │   ├── Pagination.jsx        # Shared pagination control
│   │   ├── PhoneContact.jsx      # Phone contact display
│   │   └── StudentProfileModal.jsx # Student profile modal
│   ├── pages/
│   │   ├── About.jsx             # Society details page
│   │   ├── Access.jsx            # Admin invite / access management
│   │   ├── Attendance.jsx        # Event attendance tracking
│   │   ├── Committee.jsx         # Organizing committee management
│   │   ├── Dashboard.jsx         # Overview dashboard
│   │   ├── Events.jsx            # Event CRUD
│   │   ├── Landing.jsx           # Public landing page
│   │   ├── Letters.jsx           # Letter request system
│   │   ├── Members.jsx           # Member directory
│   │   ├── Messages.jsx          # Internal messaging
│   │   ├── MyInfo.jsx            # Member self-service profile
│   │   ├── Notices.jsx           # Notice management
│   │   ├── PublicEvent.jsx       # Public event display
│   │   ├── PublicNotice.jsx      # Public notice board
│   │   ├── ScanAttendance.jsx    # QR scan attendance
│   │   ├── Setup.jsx             # DB setup guide (hidden)
│   │   └── Tasks.jsx             # OC task tracking
│   └── utils/
│       └── imageOptimizer.js     # Client-side image resizing
├── *.sql                         # Database migration scripts
├── index.html                    # HTML entry with Tailwind config
├── package.json
├── vite.config.js
├── vercel.json                   # SPA rewrite rules
└── .env                          # Supabase credentials (git-ignored)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- A **Supabase** account and project → [supabase.com](https://supabase.com)

```bash
node -v   # verify >= 18
npm -v
```

### 1 — Clone & Install

```bash
git clone https://github.com/<your-username>/society-management.git
cd society-management
npm install
```

### 2 — Create a Supabase Project

1. Sign in at [supabase.com](https://supabase.com).
2. Click **New Project** → choose an organization, name, database password, and region.
3. Wait for the project to finish provisioning.

### 3 — Set Up the Database

Open your Supabase project → **SQL Editor** → **New Query**, then paste and run the following SQL:

<details>
<summary><strong>Click to expand — Core tables SQL</strong></summary>

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

-- 2. Functions (departments / sub-teams)
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
ADD COLUMN IF NOT EXISTS oc_st_id VARCHAR(50)
  REFERENCES members(st_id) ON DELETE SET NULL;

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
ADD COLUMN IF NOT EXISTS event_id VARCHAR(50)
  REFERENCES events(event_id) ON DELETE CASCADE;

ALTER TABLE oc DROP COLUMN IF EXISTS role_id;

DO $$
DECLARE pk_name text;
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
    SELECT 1 FROM pg_constraint
    WHERE conname = 'oc_event_member_function_key'
  ) THEN
    ALTER TABLE oc
    ADD CONSTRAINT oc_event_member_function_key
      UNIQUE (event_id, st_id, function_id);
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

-- 7. Seed default roles
INSERT INTO roles (role_name) VALUES ('Admin'), ('Editor'), ('Member')
ON CONFLICT DO NOTHING;
```

</details>

Next, run the additional SQL scripts from the repo in **SQL Editor** (in this order):

| Script | Purpose |
| --- | --- |
| `supabase-rls-auth.sql` | Creates `profiles` & `access_invites` tables, enables RLS on all tables |
| `registration-review-setup.sql` | Registration review workflow |
| `event-csv-attendance-setup.sql` | CSV attendance import support |
| `event_flyers.sql` | Event flyer image support |
| `notices-setup.sql` | Notices table |
| `letter-requests-setup.sql` | Letter request system |
| `self-attendance-setup.sql` | Self-service attendance |
| `public-events-setup.sql` | Public events configuration |
| `profile_images.sql` | Profile image storage |
| `fix-profiles-rls.sql` | Profiles RLS patch |
| `migrate-member-id-to-sc.sql` | Member ID migration |

### 4 — Configure Environment Variables

1. In Supabase → **Project Settings** → **API** → copy the **Project URL** and **anon public** key.
2. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Important:** Restart the dev server after changing `.env`. The file is already git-ignored.

### 5 — Create the First Admin

1. In Supabase → **Authentication** → create a user with your admin email / password.
2. Run this in SQL Editor (replace the email):

```sql
UPDATE profiles
SET role = 'admin', full_name = 'Main Admin'
WHERE email = 'your-admin-email@example.com';
```

3. Log in from the app → open **Access** → enable registration for new editors / admins.

### 6 — Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). If Supabase is configured correctly the sidebar will show a live connection indicator.

---

## 🔐 Roles & Permissions

| Role | Login Method | Capabilities |
| --- | --- | --- |
| **Guest** | Default (no login) | View public records, landing page, public events & notices |
| **Member** | Student ID | View personal info, attendance, notices — no edit access |
| **Editor** | Email / Password | Add & edit members, events, attendance, committees |
| **Admin** | Email / Password | Full control — manage Access invites, all records, settings |

> Editors and admins must be pre-approved via an admin invite before they can register.

---

## 📋 Recommended First Data Setup

After the database is ready and you're logged in as admin:

1. **Members** — Add members from the Members page.
2. **Functions** — Add departments (`Logistics`, `Marketing`, `Finance`, `Media`, etc.) from the Committee page.
3. **Events** — Create events from the Events page.
4. **Attendance** — Click **Seed Att.** on an event to create attendance rows for all members.
5. **Attendance** — Manage attendance from the Attendance page.
6. **Committee** — Add organizing committee assignments from the Committee page.

---

## 📦 Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |

---

## 🚢 Deploy to Vercel

1. Push the repo to GitHub.
2. Log in at [vercel.com](https://vercel.com) → **Add New Project** → import the repository.
3. Add environment variables:

   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Build command: `npm run build` · Output directory: `dist`
5. Click **Deploy**.

The included `vercel.json` already configures SPA rewrites.

---

## 📱 Progressive Web App

The app ships as an installable PWA:

- **Service Worker** (`public/sw.js`) — caches static assets for offline use.
- **Web App Manifest** (`public/manifest.json`) — enables "Add to Home Screen" on mobile and desktop.
- Supports iOS, Android, and Windows PWA installations.

---

## 🗄 Database Tables

| Table | Purpose |
| --- | --- |
| `members` | Student / member records |
| `functions` | Committee functions or departments |
| `roles` | Role names (Admin, Editor, Member) |
| `events` | Society events |
| `oc` | Event-wise organizing committee assignments |
| `attendance` | Per-event attendance records |
| `profiles` | Auth user profiles with roles |
| `access_invites` | Admin-managed registration invites |

---

## 🔒 Security Notes

- The Supabase **anon key** is used on the frontend — this is expected. All security is enforced via **Row Level Security (RLS)** policies in Supabase.
- Run `supabase-rls-auth.sql` **before production use**.
- **Never** expose the Supabase **service role key** in frontend code.

---

## 🐛 Troubleshooting

<details>
<summary><strong>App shows "Not Connected"</strong></summary>

- Verify `.env` exists in the project root.
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct.
- Restart the dev server after editing `.env`.
- Confirm the `members` table exists in Supabase.

</details>

<details>
<summary><strong>Blank page or build error</strong></summary>

```bash
npm install
npm run build
```

Fix any errors shown in the terminal output.

</details>

<details>
<summary><strong>Member login fails</strong></summary>

- Confirm the Student ID exists in the `members` table.
- Enter the ID exactly as stored (case-sensitive).
- Check Supabase table permissions if RLS is enabled.

</details>

<details>
<summary><strong>Attendance page is empty</strong></summary>

1. Create at least one event.
2. Add members first.
3. On the Events page, click **Seed Att.** for the event.
4. Then open the Attendance page.

</details>

<details>
<summary><strong>Committee function list is empty</strong></summary>

1. Log in as admin or editor.
2. Open the Committee page → click **+ Function**.
3. Add functions such as `Logistics`, `Marketing`, or `Media`.

</details>

---

## 🧑‍💻 Developer Notes

| File | Purpose |
| --- | --- |
| `src/supabaseClient.js` | Supabase client initialization |
| `src/App.jsx` | Root component — navigation, auth flow, sidebar |
| `src/pages/` | All page-level components (17 pages) |
| `src/components/` | Shared UI components (Pagination, PhoneContact, StudentProfileModal) |
| `src/utils/imageOptimizer.js` | Client-side image resizing before upload |
| `index.html` | Tailwind config, fonts, OG meta, PWA registration |

---

<div align="center">

**ADSS Ruhuna** · University of Ruhuna · Built with ❤️ using React & Supabase

</div>
]]>
