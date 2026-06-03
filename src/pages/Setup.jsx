import { useState } from "react";

const SQL = `-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- 1. Members
CREATE TABLE IF NOT EXISTS members (
  st_id       VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE,
  level       INT,
  st_position VARCHAR(100)
);

-- If your members table already exists, run this once:
ALTER TABLE members
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;


-- 2. Functions (departments / sub-teams)
CREATE TABLE IF NOT EXISTS functions (
  id            BIGSERIAL PRIMARY KEY,
  function_name VARCHAR(100) UNIQUE NOT NULL
);

-- 3. Roles (system access levels)
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

-- If your events table already exists, run this once:
ALTER TABLE events
ADD COLUMN IF NOT EXISTS oc_st_id VARCHAR(50) REFERENCES members(st_id) ON DELETE SET NULL;

-- 5. Organizing Committee (per event task assignments)
CREATE TABLE IF NOT EXISTS oc (
  event_id     VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
  st_id        VARCHAR(50) REFERENCES members(st_id) ON DELETE CASCADE,
  function_id  BIGINT REFERENCES functions(id),
  oc_position  VARCHAR(100),
  apply_status VARCHAR(50) DEFAULT 'Pending',
  UNIQUE (event_id, st_id, function_id)
);

-- If your oc table already exists, run this once:
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

-- 7. Tasks for Organizing Committee
CREATE TABLE IF NOT EXISTS tasks (
  id           BIGSERIAL PRIMARY KEY,
  event_id     VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
  st_id        VARCHAR(50) REFERENCES members(st_id) ON DELETE CASCADE,
  task_name    TEXT NOT NULL,
  deadline     DATE,
  status       VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed some default roles
INSERT INTO roles (role_name) VALUES ('Admin'), ('Editor'), ('Member')
ON CONFLICT DO NOTHING;`;

const ENV = `VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

export default function Setup() {
  const [copied, setCopied] = useState({});

  const copy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [key]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 1800);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">⚙</span> Setup Guide</h1>
        <p className="page-subtitle">configure supabase, env vars, and deploy</p>
      </div>

      <div className="alert alert-info" style={{marginBottom:24}}>
        ℹ Follow these steps once to get your Society Management System fully live.
      </div>

      <div className="card">
        <div className="setup-step">
          <div className="step-num">1</div>
          <div className="step-content">
            <h3>Create a Supabase Project</h3>
            <p>Go to <strong>supabase.com</strong>, sign in, and click <em>New Project</em>. Choose a name (e.g. "society-db"), a strong database password, and the region closest to you. Wait ~2 min for provisioning.</p>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">2</div>
          <div className="step-content">
            <h3>Run the SQL Schema</h3>
            <p>In your project, go to <strong>SQL Editor → New Query</strong>, paste the script below, and click <em>Run</em>. It creates all 6 tables and prepares event-wise OC assignments.</p>
            <div style={{marginTop:10, position:"relative"}}>
              <div style={{position:"absolute", top:10, right:10, zIndex:2}}>
                <button className="copy-btn" onClick={() => copy("sql", SQL)}>
                  {copied.sql ? "✓ Copied!" : "Copy SQL"}
                </button>
              </div>
              <div className="sql-block">{SQL}</div>
            </div>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">3</div>
          <div className="step-content">
            <h3>Get Your API Credentials</h3>
            <p>In your Supabase project, go to <strong>Settings → API</strong>. Copy the <em>Project URL</em> and the <em>anon / public</em> key.</p>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">4</div>
          <div className="step-content">
            <h3>Configure Environment Variables</h3>
            <p>Create a file named <code>.env</code> in the root of your project (next to <code>package.json</code>), and paste your credentials:</p>
            <div style={{marginTop:10, position:"relative"}}>
              <div style={{position:"absolute", top:10, right:10}}>
                <button className="copy-btn" onClick={() => copy("env", ENV)}>
                  {copied.env ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <div className="sql-block">{ENV}</div>
            </div>
            <p style={{marginTop:8}}>Replace the placeholder values with your actual URL and key. <strong>Never commit this file to Git</strong> — add <code>.env</code> to your <code>.gitignore</code>.</p>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">5</div>
          <div className="step-content">
            <h3>Run Locally</h3>
            <p>Install dependencies and start the dev server:</p>
            <div className="sql-block">{`npm install\nnpm run dev`}</div>
            <p style={{marginTop:8}}>Open <strong>http://localhost:5173</strong> — the green "Supabase Live" dot in the sidebar confirms connection.</p>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">6</div>
          <div className="step-content">
            <h3>Deploy to Vercel (Free)</h3>
            <p>Push your project to a GitHub repo, then:</p>
            <ol style={{marginLeft:20, marginTop:8, lineHeight:2, color:"var(--text2)", fontSize:13}}>
              <li>Log in to <strong>vercel.com</strong> with GitHub.</li>
              <li>Click <strong>Add New Project</strong> → select your repo.</li>
              <li>Under <strong>Environment Variables</strong>, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
              <li>Click <strong>Deploy</strong>. Your app goes live at <code>your-society.vercel.app</code>.</li>
            </ol>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-num">7</div>
          <div className="step-content">
            <h3>Enable Auth + Row Level Security (RLS)</h3>
            <p>To restrict guest visibility of members and enable email-based registration, run the SQL script found in <code>supabase-rls-auth.sql</code> (located in the project root directory) in your Supabase SQL Editor. This script creates secure functions, database triggers to auto-create profiles, and configures all RLS policies.</p>
            <div className="sql-block" style={{marginTop:10}}>{`-- Open the 'supabase-rls-auth.sql' file in the project root,
-- copy its entire contents, paste in Supabase SQL Editor, and run.`}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><span className="card-title">Project File Structure</span></div>
        <div className="sql-block">{`society-management/
├── src/
│   ├── App.jsx              # App shell + sidebar navigation
│   ├── App.css              # Global styles
│   ├── main.jsx             # React entry point
│   ├── supabaseClient.js    # Supabase client (reads .env)
│   └── pages/
│       ├── Dashboard.jsx    # Stats overview
│       ├── Members.jsx      # CRUD for members
│       ├── Events.jsx       # CRUD for events
│       ├── Attendance.jsx   # Mark YES/NO per event
│       ├── Committee.jsx    # OC assignments + status
│       └── Setup.jsx        # This page
├── .env                     # ← your secrets (gitignored)
├── .gitignore
├── index.html
├── package.json
└── vite.config.js`}</div>
      </div>
    </div>
  );
}
