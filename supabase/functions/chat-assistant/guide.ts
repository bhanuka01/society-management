export const guideContent = `# Application User & Administration Guide

> **System Name:** ADSS Society Management Portal  
> **Tech Stack:** React (Vite) + Supabase (PostgreSQL + Auth + Storage)  
> **Audience:** End-users, Editors, Admins, and Gemini AI Support Assistants

---

## 1. System Overview

The **ADSS Society Management Portal** is a full-featured web application designed to manage an academic society's membership, events, attendance, internal communications, and administrative workflows. It is built on React with a Supabase backend and enforces role-based access control (RBAC) at both the application and database (Row-Level Security) level.

### Core Modules

| Module | Navigation Label | Description |
| :--- | :--- | :--- |
| Dashboard | Dashboard | Admin/Editor overview with stats, charts, and recent activity |
| Notices | Notices | Publish and read society announcements (public & internal) |
| My Info | My Info | Member's personal profile, events attended, and letter requests |
| Attendance | Attendance | Event-based attendance tracking with QR scanning & CSV data |
| Members | Members | Full member directory with bulk CSV import/export |
| Committee (OC) | Committee | Organizing committee application management |
| OC Tasks | OC Tasks | Task assignment and tracking for OC members |
| Events | Events | Event creation, management, and public listing |
| Messages | Messages | Real-time direct messages and broadcast announcements |
| Letter Requests | Letter Requests | Staff certification letter workflow for members |
| Access | Access | Admin-only: user role invitations and registration control |
| Society Details | Society Details | Static info page + issue/feedback submission form |

### Public Routes (No Login Required)

| URL Path | Description |
| :--- | :--- |
| \`/\` | Landing page with society introduction and login/register |
| \`/event?id=<event_id>\` | Public event detail page with flyer and apply link |
| \`/notice?id=<notice_id>\` | Public notice detail page |
| \`/scan-attendance?event_id=<id>&token=<token>\` | QR-based self-attendance check-in page |
| \`/login\` | Redirects to landing and auto-opens the login modal |

---

## 2. User Roles & Authorization Matrix

The system defines **four roles**. Three are authenticated (\`member\`, \`editor\`, \`admin\`) and one is unauthenticated (\`guest\`).

| Role | Description | Default Landing Page |
| :--- | :--- | :--- |
| **Guest** | Unauthenticated visitor. Can only view the landing page, public events, and public notices. | Landing Page |
| **Member** | Registered society member linked to a Student ID. Can view personal data and interact with limited features. | Attendance Page |
| **Editor** | Staff/organizing member with content management permissions. Can manage members, events, attendance, and more. | Members Page |
| **Admin** | Full system administrator. Has all Editor permissions plus user access control. | Dashboard |

### Detailed Permission Matrix

| Feature / Action | Guest | Member | Editor | Admin |
| :--- | :---: | :---: | :---: | :---: |
| View public landing page & events | YES | YES | YES | YES |
| View public notices | YES | YES | YES | YES |
| Login / Register | YES | YES | YES | YES |
| View own attendance history | NO | YES | YES | YES |
| Self-check-in via QR (if enabled) | NO | YES | YES | YES |
| View personal profile (My Info) | NO | YES | YES | YES |
| Edit own profile (photo, LinkedIn, etc.) | NO | YES* | YES | YES |
| Submit letter requests | NO | YES | YES | YES |
| View received messages / Broadcasts | NO | YES | YES | YES |
| Reply to messages (DM to staff) | NO | YES | YES | YES |
| Apply to OC for an event | NO | YES | YES | YES |
| View member directory | NO | NO | YES | YES |
| Add / Edit / Delete members | NO | NO | YES | YES |
| Bulk import members via CSV | NO | NO | YES | YES |
| Create / Edit / Delete events | NO | NO | YES | YES |
| Mark member attendance | NO | NO | YES | YES |
| View full attendance records | NO | NO | YES | YES |
| Generate & display QR attendance | NO | NO | YES | YES |
| Upload CSV registrations | NO | NO | YES | YES |
| Export attendance CSV | NO | NO | YES | YES |
| Manage OC applications | NO | NO | YES | YES |
| Create / Assign OC tasks | NO | NO | YES | YES |
| Create / Edit notices | NO | NO | YES | YES |
| Send broadcast messages | NO | NO | YES | YES |
| Manage letter requests | NO | NO | YES | YES |
| View Dashboard (stats & charts) | NO | NO | YES | YES |
| Approve / Reject registrations | NO | NO | YES | YES |
| Delete member profiles | NO | NO | YES | YES |
| Invite staff (editor/admin) | NO | NO | NO | YES |
| Promote existing user's role | NO | NO | NO | YES |
| Toggle registration open/closed | NO | NO | NO | YES |
| Toggle auto-approve registrations | NO | NO | NO | YES |
| Configure member self-edit permissions | NO | NO | YES | YES |
| Access the "Access" control panel | NO | NO | NO | YES |
| Use "View as Member" mode | NO | NO | YES | YES |

> **Note on Member Self-Edit:** Member self-edit permissions for specific fields (name, photo, WhatsApp, LinkedIn, position, function) are individually configurable by staff via \`system_settings\`. By default, members can edit their photo and LinkedIn URL only.

### Registration & Approval Flow

\`\`\`
New User Registers
       |
       +-- Email found in \`members\` table?
       |         YES --> Auto-approved, linked to existing member record
       |         NO  --> Check registration settings:
       |                   +-- registration_enabled = false --> BLOCKED (unless invited staff)
       |                   +-- auto_approve = true --> Approved immediately
       |                   +-- auto_approve = false --> Status = "pending" (staff must approve)
       |
       +-- Role = editor/admin?
                 YES --> Must have an active invite in \`access_invites\` table
                 NO  --> General member registration (subject to toggle above)
\`\`\`

Pending accounts see a **"Registration Pending"** screen after login. Staff can approve or reject them from the Members page.

---

## 3. Database Schema Reference

### Key Tables

#### \`members\`
Stores the master list of society members.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`st_id\` | VARCHAR(50) PK | Student ID in format SC/YYYY/NNNNN |
| \`name\` | VARCHAR(255) | Full name |
| \`level\` | INTEGER | Academic year (1-4). Level >4 = alumni/inactive |
| \`st_position\` | VARCHAR(255) | Role/position within the society |
| \`member_function\` | VARCHAR(100) | Sub-team (e.g., Finance, Marketing) |
| \`email\` | VARCHAR(255) | Email address (unique) |
| \`mobile_number\` | VARCHAR(50) | WhatsApp/mobile contact |
| \`profile_image_url\` | TEXT | URL to Supabase Storage profile photo |
| \`linkedin_url\` | TEXT | LinkedIn profile URL |

#### \`profiles\`
Auth-linked user accounts (one per Supabase auth user).

| Column | Type | Description |
| :--- | :--- | :--- |
| \`id\` | UUID PK | Matches auth.users.id |
| \`email\` | TEXT | Login email |
| \`full_name\` | TEXT | Display name |
| \`role\` | TEXT | member, editor, or admin |
| \`st_id\` | VARCHAR(50) | FK to members.st_id |
| \`status\` | TEXT | pending, approved, or rejected |

#### \`events\`
Society event records.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`event_id\` | VARCHAR(50) PK | Unique event identifier |
| \`name\` | TEXT | Event name |
| \`date\` | DATE | Event date |
| \`time\` | TEXT | Event time |
| \`description\` | TEXT | Full event description |
| \`oc_st_id\` | VARCHAR(50) | FK to OC President's student ID |
| \`tally_link\` | TEXT | External registration form link |
| \`flyer_url\` | TEXT | Event flyer image URL |
| \`is_public\` | BOOLEAN | Whether visible on public listing |
| \`apply_start_date\` | DATE | OC application open date |
| \`apply_end_date\` | DATE | OC application close date |
| \`self_attendance_enabled\` | BOOLEAN | Allows members to self-check-in via QR |

#### \`attendance\`
Tracks member attendance per event.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`st_id\` | VARCHAR(50) | FK to members.st_id |
| \`event_id\` | VARCHAR(50) | FK to events.event_id |
| \`attend\` | VARCHAR(10) | YES or NO |

Composite PK: (st_id, event_id) -- prevents duplicate records.

#### \`event_registrations\`
External (non-member) event registration data, typically from CSV import.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`event_id\` | VARCHAR(50) | FK to events |
| \`st_id\` | VARCHAR(50) | Registrant student ID |
| \`name\` | VARCHAR(255) | Registrant name |
| \`email\` | VARCHAR(255) | Email |
| \`phone\` | VARCHAR(50) | Phone |
| \`degree_program\` | VARCHAR(255) | Degree programme |
| \`level\` | VARCHAR(50) | Academic year |
| \`attend\` | VARCHAR(10) | YES or NO (set on scan) |
| \`is_member\` | BOOLEAN | Whether registrant is a society member |

#### \`oc\` (Organizing Committee)
OC applications for each event.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`st_id\` | VARCHAR(50) | Applicant's student ID |
| \`event_id\` | VARCHAR(50) | FK to events |
| \`function_id\` | FK | Society function/sub-team |
| \`oc_position\` | TEXT | Specific role applied for |
| \`apply_status\` | VARCHAR(50) | Pending, Accept, or Reject |

#### \`notices\`
Society announcements.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`id\` | VARCHAR(100) PK | Unique notice ID |
| \`title\` | TEXT | Notice title |
| \`content\` | TEXT | Markdown-formatted content |
| \`is_public\` | BOOLEAN | Whether visible to public/guests |

#### \`messages\`
Real-time direct messages and broadcast announcements.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`sender_st_id\` | VARCHAR(50) | Sender's student ID |
| \`receiver_st_id\` | VARCHAR(50) | Recipient's student ID. NULL = broadcast to all |
| \`content\` | TEXT | Message body |
| \`read\` | BOOLEAN | Read status |

#### \`tasks\`
OC task assignments per event.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`event_id\` | VARCHAR(50) | FK to events |
| \`st_id\` | VARCHAR(50) | Assigned member's student ID |
| \`task_name\` | TEXT | Task description |
| \`deadline\` | DATE | Due date |
| \`status\` | VARCHAR(50) | Pending or Completed |

#### \`letter_requests\`
Member certification letter workflow.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`st_id\` | VARCHAR(50) | Requesting member |
| \`name_on_letter\` | TEXT | Name to print on the letter |
| \`selected_events\` | TEXT[] | Events to mention |
| \`additional_details\` | TEXT | Extra notes from member |
| \`status\` | TEXT | not start, inprogress, done, or rejected |

#### \`access_invites\`
Pre-authorized staff invitation tokens.

| Column | Type | Description |
| :--- | :--- | :--- |
| \`email\` | TEXT | Invited email address |
| \`role\` | TEXT | editor or admin |
| \`used_at\` | TIMESTAMPTZ | Timestamp when the invite was consumed |

#### \`system_settings\`
Key-value configuration store (admin-controlled).

| Key | Default | Description |
| :--- | :--- | :--- |
| \`registration_enabled\` | true | Allow/block new registrations |
| \`registration_auto_approve\` | false | Auto-approve new member registrations |
| \`member_edit_name\` | false | Allow members to edit their name |
| \`member_edit_photo\` | true | Allow members to edit their profile photo |
| \`member_edit_whatsapp\` | false | Allow members to edit their phone number |
| \`member_edit_linkedin\` | true | Allow members to edit their LinkedIn URL |
| \`member_edit_position\` | false | Allow members to edit their position |
| \`member_edit_function\` | false | Allow members to edit their sub-team |
| \`letter_show_name\` | true | Include member name on letters |
| \`letter_show_events\` | true | Include events list on letters |
| \`letter_show_details\` | true | Include additional details on letters |

---

## 4. Step-by-Step UI Workflows

### A. Logging In & Registering

#### Login
1. Navigate to the portal URL. The landing page appears.
2. Click the **"Login"** button in the top-right of the landing page.
3. In the modal, ensure the **"Login"** tab is selected.
4. Select your role (Member / Editor / Admin) from the dropdown.
5. Enter your **email address** and **password**.
6. Click **"Login"**. You will be redirected to your role's home page.

#### Register as a New Member
1. Click **"Register"** on the landing page (only available when registration is open).
2. In the modal, select the **"Register"** tab.
3. Select **Role: Member**.
4. Fill in your **Full Name**.
5. (Optional) Upload a **Profile Picture** -- it is automatically resized to 500x600 px.
6. Enter your **Student ID** (format: \`SC/YYYY/NNNNN\`, e.g., \`SC/2022/12984\`).
7. Select your **Year/Level** (Year 1-4).
8. Enter your **Phone Number**.
9. Select your **Member Function** (Finance, Marketing, Operations, etc.).
10. Enter your **email** and create a **password**.
11. Click **"Register"**.
    - If your email is already in the members database: auto-approved.
    - If new to the system: your account will be "Pending" review by staff.

#### Register as Editor/Admin (Invite-Only)
1. An Admin must first create an invite for your email in the **Access** page.
2. Go to the portal, open the Register modal, select **Role: Editor** (or **Admin**).
3. Enter your Full Name, email, and password. No Student ID is required.
4. Click **"Register"**. The invite is consumed and you are auto-approved.

---

### B. Dashboard (Admin & Editor Only)

The Dashboard is the home page for Admins and Editors and shows a real-time overview.

**What you see:**
- **Total Members** -- count of active members (level 1-4).
- **Total Events** -- count of all events.
- **OC Members** -- number of OC applicants for the latest event.
- **Attendance** -- number of members who attended the latest event.
- **Active Letter Requests** -- pending letter requests (Admin only).
- **Recent Members** -- last 5 approved members.
- **Recent Events** -- last 5 events listed.
- **Attendance Chart** -- line chart showing YES attendance counts for the last 5 events.

Click any stat card or recent item to navigate directly to that module.

---

### C. Managing Members (Editor & Admin)

**Path:** Sidebar > Members

#### Viewing the Member List
1. Navigate to **Members** from the sidebar.
2. The list shows all active members. Use the search bar to filter by name, Student ID, or email.
3. Use the filter tabs (**Active** / **Alumni** / **Pending Review**) to switch between member groups:
   - **Active** = members with academic level 1-4.
   - **Alumni** = members with level > 4.
   - **Pending Review** = newly registered users awaiting staff approval.

#### Viewing a Member Profile
1. Click on any member row/card to open the **Student Profile Modal**.
2. The modal displays: photo, name, Student ID, level, position, function, email, LinkedIn, and phone.
3. From the modal, staff can edit or delete the member.

#### Adding a Single Member
1. Click the **"Add Member"** button (top-right).
2. Fill in the form fields:
   - **Student ID** (required, format: \`SC/YYYY/NNNNN\`)
   - **Full Name** (required)
   - **Academic Level** (1-6 or more for alumni)
   - **Position** (e.g., Member, President, Secretary)
   - **Function/Sub-team** (e.g., Finance, Marketing)
   - **Email**, **Phone**, **LinkedIn**, **Profile Image URL**
3. Click **"Save"**. The member is added to the database.

#### Editing a Member
1. Find the member in the list and click their row.
2. In the profile modal, click the **Edit** (pencil) icon.
3. Modify the required fields.
4. Click **"Save Changes"**.

#### Deleting a Member
1. Open the member's profile modal.
2. Click the **Delete** (trash) icon.
3. Confirm the deletion in the prompt. This removes the member and cascades to linked records.

#### Bulk Import via CSV
1. Click the **"Import CSV"** button.
2. Drag and drop a \`.csv\` file or click to browse.
3. The system auto-detects column headers. Supported column names:
   - \`st_id\` / \`studentid\` / \`id\`
   - \`name\` / \`fullname\`
   - \`level\` / \`year\`
   - \`position\` / \`stposition\`
   - \`function\` / \`memberfunction\` / \`department\`
   - \`email\`, \`mobile\` / \`phone\`, \`profileimage\`, \`linkedin\`
4. A preview of parsed data is shown. Select a **duplicate strategy**:
   - **Upsert (Update if exists)** -- updates existing records by Student ID.
   - **Skip duplicates** -- ignores rows where Student ID already exists.
5. Click **"Import"** to begin. A progress bar tracks the import.
6. Results show counts: Inserted, Updated, Skipped, Errors.

#### Approving / Rejecting Pending Registrations
1. Switch to the **"Pending Review"** filter tab on the Members page.
2. Pending users appear with a \`Pending\` badge.
3. Click the member to open the profile modal.
4. Click **Approve** or **Reject**.
   - Approve: sets \`profiles.status = 'approved'\`, member gains portal access.
   - Reject: sets \`profiles.status = 'rejected'\`, member sees rejection screen on next login.

#### Configuring Member Self-Edit Permissions
1. Click the **"Edit Settings"** (gear icon) button on the Members page.
2. Toggle which fields members are allowed to edit: Name, Profile Photo, WhatsApp Number, LinkedIn URL, Position, Function.
3. Save. Changes take effect immediately in \`system_settings\`.

---

### D. Managing Events (Editor & Admin)

**Path:** Sidebar > Events

#### Viewing Events
1. Navigate to **Events** from the sidebar.
2. A paginated list of all events is displayed, ordered by most recent date.
3. Use the search bar to find events by name, event ID, or OC President's Student ID.
4. For **members**: a badge shows their personal attendance status (YES/NO) for each event.

#### Creating a New Event
1. Click **"Add Event"**.
2. Fill in the form:
   - **Event ID** (required, unique identifier, e.g., \`EVENT-2024-01\`)
   - **Event Name** (required)
   - **Date** and **Time**
   - **OC President** -- select from the member dropdown
   - **OC Apply Start/End Dates** -- window when members can apply to the OC
   - **Description** -- full event description
   - **Tally/Registration Link** -- external form link for non-member registration
   - **Event Flyer** -- upload an image (auto-optimized)
   - **Is Public** -- whether to show on the public events page
   - **Self-Attendance Enabled** -- allow members to self-check-in via QR code
3. Click **"Save"**. The event is created.

#### Editing an Event
1. Click the **Edit** (pencil) icon on any event row.
2. Modify fields as needed and click **"Save"**.

#### Deleting an Event
1. Click the **Delete** (trash) icon on the event row.
2. Confirm. Cascades to delete linked attendance, OC records, and tasks.

#### Applying to OC (All Authenticated Users)
1. Click the **"Apply to OC"** button on any event card.
2. Select your preferred **Function** (sub-team) and enter your desired **OC Position**.
3. Click **"Submit Application"**. Status is set to Pending.

---

### E. Attendance Tracking (Editor & Admin)

**Path:** Sidebar > Attendance

The Attendance page has two tabs: **Members** (society members) and **CSV Registrations** (external registrants).

#### Viewing Member Attendance
1. Select an event from the **Event dropdown**.
2. The list of all members appears with their attendance status (YES / NO).
3. Use the search bar to filter by name or Student ID.
4. Counts for present and absent members are shown at the top.

#### Marking Attendance Manually
1. Select the event from the dropdown.
2. Find the member in the list.
3. Click the **toggle** next to a member's name to switch their attendance between YES and NO.
4. Changes are saved immediately to the database.

#### Generating a QR Code for Self-Attendance
> Requires: \`self_attendance_enabled = true\` for the event (set in Event Edit form).

1. Select the event.
2. Click **"Show QR Code"**.
3. A QR code is generated with a **time-limited token** (refreshes every 60 seconds).
4. Display the QR code on a projector or screen at the venue.
5. Members scan the QR with their phones, opening the \`/scan-attendance\` page.
6. Members enter their Student ID on the scan page and confirm check-in.
7. The live scan count updates in real-time on the coordinator's screen.

#### Uploading CSV Registrations (for External Attendees)
1. Select the event from the dropdown.
2. Click the **"CSV Registrations"** tab.
3. Upload a \`.csv\` file of registrations (e.g., exported from Tally.so).
4. The system parses and stores records in \`event_registrations\`.
5. Registered attendees appear in a searchable list with their attendance status.

#### Scanning Attendance from CSV Registration List
1. In the CSV Registrations tab, share the scan URL with a volunteer.
2. The volunteer opens the URL on a device at the event entrance.
3. Attendees enter their Student ID on the scan page.
4. The system looks up \`event_registrations\`:
   - **Found record**: marks \`attend = 'YES'\`.
   - **Not found**: creates an on-the-spot registration and marks present.
5. If the scanned person is a society member, attendance is also recorded in the main \`attendance\` table automatically.

#### Exporting Attendance as CSV
1. In the CSV Registrations tab, click **"Export CSV"**.
2. A \`.csv\` file is downloaded with all registered attendees, their attendance status (YES/NO), membership status, and contact info.

---

### F. Organizing Committee (OC) Management

**Path:** Sidebar > Committee

#### Reviewing OC Applications (Editor & Admin)
1. Navigate to **Committee** from the sidebar.
2. Select the event from the event dropdown.
3. Applications are listed with status badges: **Pending** / **Accept** / **Reject**.
4. Use the filter buttons to sort by status.
5. Click on an applicant to view their profile.
6. Click **Accept** or **Reject** on an application row to update its status.

#### Managing OC Functions (Sub-teams)
1. On the Committee page, click **"Manage Functions"**.
2. Enter a new function name and click **"Add Function"**.
3. Functions appear as options when members apply to the OC.

#### Assigning Tasks to OC Members

**Path:** Sidebar > OC Tasks

1. Navigate to **OC Tasks** from the sidebar.
2. Select the event. Only events where you are the OC President (or you are staff) are shown.
3. Click **"Add Task"**:
   - Select the **OC member** to assign the task to.
   - Enter the **task name/description**.
   - Set a **deadline date**.
   - Click **"Save"**.
4. OC members can mark their own assigned tasks as **Completed**.
5. OC Presidents and staff can delete tasks.

---

### G. Notices Management (Editor & Admin)

**Path:** Sidebar > Notices

#### Creating a Notice
1. Navigate to **Notices**.
2. Click **"Add Notice"**.
3. Fill in:
   - **Notice ID** (unique identifier)
   - **Title**
   - **Content** -- supports full Markdown formatting (bold, lists, links, headings, etc.)
   - **Is Public** -- if checked, visible to guests on the public notices page
4. Click **"Save"**.

#### Editing/Deleting a Notice
1. Find the notice in the list.
2. Click the **Edit** icon to modify, or **Delete** to remove it.

#### Copying a Public Notice Link
1. On any public notice row, click the **Copy Link** icon.
2. The link (\`/notice?id=<id>\`) is copied to clipboard for external sharing.

#### Reading a Notice (All Roles)
1. Click on any notice card/row.
2. A modal opens displaying the full rendered Markdown content.

---

### H. Messages & Announcements

**Path:** Sidebar > Messages

#### Sending a Broadcast Announcement (Editor & Admin)
1. Navigate to **Messages**.
2. Select **"Announcements (All)"** from the channel list.
3. Type your message in the text box at the bottom.
4. Press **Enter** or click **Send**. All society members receive the broadcast.

#### Sending a Direct Message to a Member (Editor & Admin)
1. In **Messages**, search for a member by name using the search bar.
2. Click on the member's name to open the chat.
3. Type your message and press **Enter** or click **Send**.

#### Replying to Staff (Member)
1. Navigate to **Messages**.
2. Click on any channel (Announcements or a specific staff chat).
3. Type your reply and click **Send**.

> **Note:** Members can only DM staff who have previously messaged them. Members cannot initiate new conversations with other members.

---

### I. Letter Requests

**Member submits from:** Sidebar > My Info > Letter Requests section  
**Staff manages from:** Sidebar > Letter Requests

#### Submitting a Letter Request (Member)
1. Navigate to **My Info**.
2. Scroll to the **"Letter Requests"** section.
3. Click **"Request a Letter"**.
4. Fill in:
   - **Name on Letter** -- how your name should appear.
   - **Events to Include** -- select events you attended this year.
   - **Additional Details** -- any extra information.
5. Click **"Submit Request"**. Status is set to \`not start\`.

#### Managing Letter Requests (Editor & Admin)
1. Navigate to **Letter Requests** from the sidebar.
2. The list shows all requests with status badges.
3. Filter by: All / Not Started / In Progress / Done / Rejected.
4. Click on a request to view member details.
5. Update the status using the status action buttons:
   - **Not Started** > **In Progress** > **Done**
   - Or mark as **Rejected**.
6. Configure what appears on generated letters using toggle switches at the top:
   - Show Name / Show Events / Show Additional Details.

---

### J. Access Control (Admin Only)

**Path:** Sidebar > Access

#### Inviting a New Staff Member
1. Navigate to **Access** (visible only to Admins).
2. In the "Invite Staff" section, enter the person's **email address**.
3. Select the **role**: \`Editor\` or \`Admin\`.
4. Click **"Create Invite"**.
5. The invite is stored. The person can now register at the portal using that email and the corresponding role.

#### Promoting an Existing User
1. On the Access page, enter the email of an **already-registered** user.
2. Select the target role and click **"Create Invite"**.
3. A prompt asks: "User is already registered as [role]. Promote to [new role]?"
4. Click OK. The user's role is updated immediately without re-registration.

#### Revoking a Staff Invite
1. In the "Pending Invites" list, click **Delete** on any unused invite.
2. The invite is removed and can no longer be used.

#### Controlling Registration Settings
Located on the **Access** page under **System Settings**:

- **Registration Toggle** -- enable/disable the public registration form.
  - ON: Anyone can register as a new member.
  - OFF: Only staff with pre-existing invites can register. Members with matching emails can still sign up.
- **Auto-Approve Toggle** -- enable/disable automatic approval of new registrations.
  - ON: New member registrations are approved instantly.
  - OFF: New registrations go into "Pending" status and must be manually approved.

#### Viewing Current Staff List
The Access page shows all users with \`editor\` or \`admin\` roles including their email, full name, role, and registration date.

---

### K. My Info (Personal Profile)

**Path:** Sidebar > My Info (only visible if you have a linked Student ID)

#### Viewing Your Profile
1. Navigate to **My Info**.
2. Your full profile is displayed: photo, name, Student ID, level, position, function, email, WhatsApp, LinkedIn.
3. Your **full attendance history** (all events, YES/NO) is shown below.
4. Your **submitted letter requests** and their statuses are listed.

#### Editing Your Profile
1. Click the **"Edit Profile"** button.
2. Depending on fields enabled by staff, you can update:
   - **Profile Photo** -- upload a new image (auto-resized to 500x600 px).
   - **LinkedIn URL** -- your LinkedIn profile link.
   - **WhatsApp Number** -- your mobile number.
   - **Name**, **Position**, **Function** -- if allowed by staff.
3. Click **"Save"**. Changes reflect immediately in your profile and the members directory.

---

### L. Society Details / About Page

**Path:** Sidebar > Society Details (or landing page for guests)

- Displays general information about the ADSS society.
- Contains a **contact/feedback form** accessible to all users (including guests).
- Submitting the form sends an email to the society contact address via Web3Forms API.
- The form automatically includes your name, email, Student ID, and role for context.

---

## 5. QR Attendance Deep Dive

The QR-based attendance system uses **time-limited tokens** to ensure security.

### How QR Tokens Work
- A token is generated as a Base64-encoded JSON object: \`{ eventId, exp, hash }\`.
- \`exp\` = current minute block (\`Math.floor(Date.now() / 60000)\`).
- \`hash\` = a numeric signature: \`(exp * 17 + 23).toString(16)\`.
- Tokens are valid within a **2-minute window** to account for clock drift.
- The QR code **auto-refreshes every 60 seconds** on the coordinator's screen.

### Scan Attendance Page (\`/scan-attendance\`)
1. Page loads and validates the URL's \`event_id\` and \`token\` parameters.
2. If the token is valid and not expired, the event name is displayed.
3. The attendee enters their **Student ID** and clicks **"Search"**.
4. The system checks \`event_registrations\` via the \`search_registration_by_id\` SQL function (normalizes the \`SC/\` prefix for consistent matching).
5. If found in pre-registration list: name and status shown; click **"Confirm Attendance"**.
6. If not found (on-the-spot attendee): a short form appears to capture Name, Degree, Level, and Phone.
7. On confirm, the \`record_csv_scan_attendance\` SQL function runs:
   - Updates \`event_registrations.attend = 'YES'\` (or inserts a new row).
   - If the person is a society member, also upserts \`attendance\` table with \`attend = 'YES'\`.

---

## 6. Common Troubleshooting & FAQ

**"Registration is currently closed"**
An admin has toggled \`registration_enabled = false\`. Contact your society administrator to enable registration or request direct access.

**"Registration Pending" screen after login**
Your account is awaiting staff approval. An Admin or Editor must approve it from Members > Pending Review. Click "Refresh Status" to check.

**"Registration Rejected" screen**
Your registration request was rejected. Contact the society administrators if you believe this was in error.

**Cannot edit profile fields**
The society staff has restricted editing for that field. Only fields enabled in \`system_settings\` are editable by members. Contact an Editor or Admin to update restricted fields.

**QR Code says "Token Expired"**
The QR code has refreshed. Ask the coordinator to show the latest QR code and scan again.

**Cannot find an event in the Attendance page**
Ensure you have selected the correct event from the event dropdown. Events are listed in reverse chronological order (most recent first).

**CSV Import fails**
- Ensure your CSV has recognizable column headers (see Section 4C for accepted header names).
- Ensure Student IDs are in the correct format (\`SC/YYYY/NNNNN\` or \`YYYY/NNNNN\`).
- Check for empty rows or malformed data in the file.

**"View as Member" mode**
Editors and Admins can click the **"View as Member"** toggle at the top of the app to simulate the member experience. This hides admin-only navigation and shows the attendance page. Click again to exit.

---

## 7. Technology & Infrastructure Notes

| Component | Technology |
| :--- | :--- |
| Frontend Framework | React 18 (Vite) |
| CSS | Vanilla CSS with CSS variables (dark/light theme support) |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email + password) |
| File Storage | Supabase Storage (profile_images bucket, event flyers) |
| Real-time | Supabase Realtime (messages and tasks tables) |
| Deployment | Vercel (vercel.json configured) |
| Markdown Rendering | \`marked\` library (notices content) |
| Image Optimization | Custom resizeImage utility (canvas-based, target 500x600 px) |
| Email (Contact Form) | Web3Forms API |

### Row-Level Security (RLS) Helper Functions

| Function | Returns | Description |
| :--- | :--- | :--- |
| \`current_app_role()\` | TEXT | Returns member, editor, admin, or guest |
| \`is_staff()\` | BOOLEAN | True if role is editor or admin |
| \`is_admin()\` | BOOLEAN | True if role is admin only |
| \`can_register_staff(email, role)\` | BOOLEAN | Checks for an unused invite in access_invites |
| \`get_member_by_email(email)\` | TABLE | Returns st_id and name for a pre-registered member email |
| \`search_registration_by_id(event_id, st_id)\` | TABLE | Normalized Student ID lookup in event_registrations |
| \`record_csv_scan_attendance(...)\` | JSONB | Records attendance from QR scan, updates both tables |

---

*This guide was auto-generated by scanning the ADSS Society Management source code, SQL migration files, and React page components. For the most up-to-date information, refer to the source code in the \`src/\` directory.*
`;
