import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";
import EventSelect from "../components/EventSelect";
import CalEmbedModal from "../components/CalEmbedModal";

const EMPTY = { st_id: "", function_id: "", oc_position: "", apply_status: "Pending", interviewer_email: "" };
const STATUS_OPTS = ["Pending", "Invited", "Interview Scheduled", "Accept", "Reject"];
const INTERVIEWER_PAGE_SIZE = 5;

export default function Committee({ isAdmin = false, session }) {
  const [oc, setOc] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [functions, setFunctions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [fnModal, setFnModal] = useState(false);
  const [fnName, setFnName] = useState("");
  const [fnSaving, setFnSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ Accept: 0, Pending: 0, Invited: 0, Scheduled: 0, Reject: 0 });
  const [profileTarget, setProfileTarget] = useState(null);

  // Cal.com Embed Modal state
  const [calModal, setCalModal] = useState({ isOpen: false, row: null });
  const [customCalUrl, setCustomCalUrl] = useState("https://cal.com/adss-ruhuna/30min");
  const [emailSendingId, setEmailSendingId] = useState(null);

  // Interviewer Selection Invite Modal State
  const [inviteModal, setInviteModal] = useState({ isOpen: false, row: null });
  const [selectedInterviewerEmail, setSelectedInterviewerEmail] = useState("");
  const [customInterviewerEmail, setCustomInterviewerEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // Search & Pagination inside Invite Modal for Interviewers
  const [interviewerSearch, setInterviewerSearch] = useState("");
  const [interviewerPage, setInterviewerPage] = useState(0);

  // Helper to check if a row belongs to the current logged-in user
  const isOwnRow = (row) => {
    if (!session) return false;
    if (session.stId && row.st_id?.toUpperCase() === session.stId?.toUpperCase()) return true;
    if (session.email && row.members?.email?.toLowerCase() === session.email?.toLowerCase()) return true;
    return false;
  };

  const load = async () => {
    setLoading(true);
    const [eventRes, fRes, profileRes, memberRes] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: false }),
      supabase.from("functions").select("*").order("function_name"),
      supabase.from("profiles").select("id, email, full_name, role").in("role", ["admin", "editor"]).order("full_name"),
      supabase.from("members").select("name, email").not("email", "is", null).order("name"),
    ]);

    const nextEvents = eventRes.data || [];
    setEvents(nextEvents);
    setSelectedEvent(current => current || nextEvents[0]?.event_id || "");
    setFunctions(fRes.data || []);

    // Combine staff profiles and members into staffList dropdown
    const list = [];
    if (profileRes.data) {
      profileRes.data.forEach(p => {
        if (p.email) list.push({ name: p.full_name || p.email, email: p.email, role: p.role });
      });
    }
    if (memberRes.data) {
      memberRes.data.forEach(m => {
        if (m.email && !list.some(item => item.email.toLowerCase() === m.email.toLowerCase())) {
          list.push({ name: m.name || m.email, email: m.email, role: "member" });
        }
      });
    }
    setStaffList(list);
    setLoading(false);
  };

  const loadOc = async (eventId, pageToLoad = page, status = filterStatus, searchText = search) => {
    if (!eventId) {
      setOc([]);
      setTotal(0);
      setStatusCounts({ Accept: 0, Pending: 0, Invited: 0, Scheduled: 0, Reject: 0 });
      return;
    }

    setLoading(true);
    setMsg(null);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("oc")
      .select("*, members(name, email, st_id), functions(function_name)", { count: "exact" })
      .eq("event_id", eventId)
      .order("st_id")
      .range(from, to);

    if (status !== "All") {
      query = query.eq("apply_status", status);
    }

    const q = searchText.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,oc_position.ilike.%${q}%,apply_status.ilike.%${q}%`);
    }

    const [records, accept, pending, invited, scheduled, reject] = await Promise.all([
      query,
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Accept"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Pending"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Invited"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Interview Scheduled"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Reject"),
    ]);

    if (records.error) {
      setMsg({ type: "error", text: records.error.message });
    } else {
      let rawData = records.data || [];
      // Pin applicant's own application row at the top of the table
      rawData.sort((a, b) => {
        const aOwn = isOwnRow(a);
        const bOwn = isOwnRow(b);
        if (aOwn && !bOwn) return -1;
        if (!aOwn && bOwn) return 1;
        return 0;
      });
      setOc(rawData);
    }
    setTotal(records.count || 0);
    setStatusCounts({
      Accept: accept.count || 0,
      Pending: pending.count || 0,
      Invited: invited.count || 0,
      Scheduled: scheduled.count || 0,
      Reject: reject.count || 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    loadOc(selectedEvent, page, filterStatus, search);
  }, [selectedEvent, page, filterStatus, search]);

  const openAdd = () => {
    setForm({ ...EMPTY, interviewer_email: session?.email || "" });
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => { setModal(false); setMsg(null); };

  const handleSave = async () => {
    if (!selectedEvent) {
      setMsg({ type: "error", text: "Select an event first." }); return;
    }
    if (!form.st_id || !form.function_id) {
      setMsg({ type: "error", text: "Member and Function are required." }); return;
    }
    setSaving(true);
    const payload = {
      event_id: selectedEvent,
      st_id: form.st_id.trim(),
      function_id: parseInt(form.function_id),
      oc_position: form.oc_position.trim() || null,
      apply_status: form.apply_status,
      interviewer_email: form.interviewer_email.trim() || session?.email || null,
    };
    const { error } = await supabase.from("oc").insert([payload]);
    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: "OC record saved." });

    // Send application received email if candidate email exists
    const { data: member } = await supabase.from("members").select("email, name").eq("st_id", form.st_id.trim()).maybeSingle();
    if (member?.email) {
      triggerResendEmail({
        to: member.email,
        type: "APPLICATION_RECEIVED",
        data: {
          studentName: member.name,
          eventName: selectedEventInfo?.name || "Society Event",
          ocPosition: form.oc_position || "Committee Member"
        }
      });
    }

    loadOc(selectedEvent, page, filterStatus, search);
    setTimeout(closeModal, 700);
  };

  // Dispatch Email via Supabase Edge Function (Gmail SMTP or Resend)
  const triggerResendEmail = async (payload) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: payload
      });
      if (error) console.error("Edge function send-email error:", error);
      return data;
    } catch (err) {
      console.error("Failed to invoke send-email:", err);
    }
  };

  const updateStatus = async (o, status) => {
    setEmailSendingId(`${o.st_id}-${o.function_id}`);
    const { error } = await supabase.from("oc")
      .update({ apply_status: status })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      alert(error.message);
    } else {
      const recipientEmail = o.members?.email;
      const studentName = o.members?.name || "Applicant";
      const eventName = selectedEventInfo?.name || "Society Event";
      const position = o.oc_position || o.functions?.function_name || "Committee Member";

      if (recipientEmail) {
        if (status === "Accept") {
          await triggerResendEmail({
            to: recipientEmail,
            type: "STATUS_ACCEPTED",
            data: { studentName, eventName, ocPosition: position }
          });
        } else if (status === "Reject") {
          await triggerResendEmail({
            to: recipientEmail,
            type: "STATUS_REJECTED",
            data: { studentName, eventName, ocPosition: position }
          });
        }
      }
      loadOc(selectedEvent, page, filterStatus, search);
    }
    setEmailSendingId(null);
  };

  // Open Interviewer Dropdown Invite Modal
  const openInviteModal = (o) => {
    const defaultInterviewer = o.interviewer_email || session?.email || (staffList[0]?.email || "");
    setSelectedInterviewerEmail(defaultInterviewer);
    setCustomInterviewerEmail("");
    setInterviewerSearch("");
    setInterviewerPage(0);
    setInviteModal({ isOpen: true, row: o });
  };

  // Process sending interview invitation with selected interviewer B
  const sendInviteWithInterviewer = async () => {
    const o = inviteModal.row;
    if (!o) return;

    const finalInterviewerEmail = selectedInterviewerEmail === "custom" 
      ? customInterviewerEmail.trim() 
      : selectedInterviewerEmail.trim();

    if (!finalInterviewerEmail) {
      alert("Please select or enter a valid Interviewer email address.");
      return;
    }

    setInviteSending(true);
    setEmailSendingId(`${o.st_id}-${o.function_id}`);

    // Update status to 'Invited' and record chosen interviewer_email in DB
    const { error } = await supabase.from("oc")
      .update({
        apply_status: "Invited",
        interviewer_email: finalInterviewerEmail
      })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      alert(error.message);
    } else {
      const recipientEmail = o.members?.email;
      if (recipientEmail) {
        const studentName = o.members?.name || "Applicant";
        const eventName = selectedEventInfo?.name || "Society Event";
        const position = o.oc_position || o.functions?.function_name || "Committee Member";

        const bookingUrlObj = new URL(customCalUrl.startsWith("http") ? customCalUrl : `https://${customCalUrl}`);
        bookingUrlObj.searchParams.set("email", recipientEmail);
        bookingUrlObj.searchParams.set("name", studentName);
        bookingUrlObj.searchParams.set("st_id", o.st_id);
        // Cal.com native parameter for auto-adding guests/interviewers
        bookingUrlObj.searchParams.set("guests", finalInterviewerEmail);
        bookingUrlObj.searchParams.set("interviewer_email", finalInterviewerEmail);

        await triggerResendEmail({
          to: recipientEmail,
          type: "INTERVIEW_INVITE",
          data: {
            studentName,
            eventName,
            ocPosition: position,
            calLink: bookingUrlObj.toString()
          }
        });
        alert(`Interview invite email sent to candidate (${recipientEmail})!\nInterviewer set to: ${finalInterviewerEmail}`);
      } else {
        alert("Status updated to 'Invited'. Note: Candidate email was not found in profile.");
      }
      setInviteModal({ isOpen: false, row: null });
      loadOc(selectedEvent, page, filterStatus, search);
    }
    setInviteSending(false);
    setEmailSendingId(null);
  };

  const handleDelete = async (stId, functionId) => {
    if (!confirm("Remove this OC record?")) return;
    const { error } = await supabase.from("oc").delete().eq("event_id", selectedEvent).eq("st_id", stId).eq("function_id", functionId);
    if (error) alert(error.message);
    else loadOc(selectedEvent, page, filterStatus, search);
  };

  const addFunction = async () => {
    if (!fnName.trim()) return;
    setFnSaving(true);
    const { error } = await supabase.from("functions").insert([{ function_name: fnName.trim() }]);
    setFnSaving(false);
    if (error) alert(error.message);
    else { setFnName(""); load(); setFnModal(false); }
  };

  // High-contrast readable status badges
  const statusBadge = (s) => {
    if (s === "Accept") return <span className="badge" style={{ backgroundColor: "#16a34a", color: "#ffffff", fontWeight: "600", padding: "4px 10px" }}>Accepted</span>;
    if (s === "Reject") return <span className="badge" style={{ backgroundColor: "#dc2626", color: "#ffffff", fontWeight: "600", padding: "4px 10px" }}>Rejected</span>;
    if (s === "Invited") return <span className="badge" style={{ backgroundColor: "#2563eb", color: "#ffffff", fontWeight: "600", padding: "4px 10px" }}>Invited</span>;
    if (s === "Interview Scheduled") return <span className="badge" style={{ backgroundColor: "#9333ea", color: "#ffffff", fontWeight: "600", padding: "4px 10px" }}>Interview Scheduled</span>;
    return <span className="badge" style={{ backgroundColor: "#d97706", color: "#ffffff", fontWeight: "600", padding: "4px 10px" }}>Pending</span>;
  };

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);

  // Filter staffList for Invite Modal Search & Pagination
  const fullInterviewerOptions = [];

  // Add Logged-in User at top
  if (session?.email) {
    fullInterviewerOptions.push({
      name: session.name ? `Me (${session.name})` : "Me (Current User)",
      email: session.email,
      role: session.role || "staff",
      isSelf: true
    });
  }

  // Add staff members
  staffList.forEach(st => {
    if (!fullInterviewerOptions.some(item => item.email.toLowerCase() === st.email.toLowerCase())) {
      fullInterviewerOptions.push(st);
    }
  });

  // Filter by Search Query
  const filteredInterviewers = fullInterviewerOptions.filter(item => {
    const q = interviewerSearch.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q) || item.role.toLowerCase().includes(q);
  });

  const totalInterviewerPages = Math.ceil(filteredInterviewers.length / INTERVIEWER_PAGE_SIZE) || 1;
  const paginatedInterviewers = filteredInterviewers.slice(
    interviewerPage * INTERVIEWER_PAGE_SIZE,
    (interviewerPage + 1) * INTERVIEWER_PAGE_SIZE
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">diversity_3</span></span> Committee (OC)</h1>
        <p className="page-subtitle">{selectedEventInfo ? `${selectedEventInfo.name} - ${total} assignments` : "select an event to manage OC assignments"}</p>
      </div>

      {/* Dynamic Statistics Grid */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value">{statusCounts.Pending}</div></div>
        <div className="stat-card blue" style={{ borderColor: "#3b82f6" }}><div className="stat-label">Invited</div><div className="stat-value">{statusCounts.Invited}</div></div>
        <div className="stat-card purple" style={{ borderColor: "#8b5cf6" }}><div className="stat-label">Scheduled</div><div className="stat-value">{statusCounts.Scheduled}</div></div>
        <div className="stat-card green"><div className="stat-label">Accepted</div><div className="stat-value">{statusCounts.Accept}</div></div>
        <div className="stat-card red"><div className="stat-label">Rejected</div><div className="stat-value">{statusCounts.Reject}</div></div>
      </div>

      {events.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="icon">*</div><p>Create an event first, then add OC assignments.</p></div></div>
      ) : (
        <>
          <div className="card mb-3" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Event Committee</span>
              {selectedEventInfo && <span className="badge badge-gray">{selectedEventInfo.date}</span>}
            </div>
            <EventSelect
              events={events}
              value={selectedEvent}
              onChange={(id) => { setPage(0); setSelectedEvent(id); }}
              placeholder="Search or select an event..."
            />
          </div>

          <div className="toolbar" style={{ gap: "12px", alignItems: "center", marginBottom: "16px" }}>
            <div className="search-input-wrap" style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: "1rem" }}>🔍</span>
              <input
                placeholder="Search by ID, position, status..."
                value={search}
                onChange={e => { setPage(0); setSearch(e.target.value); }}
                style={{ paddingLeft: "36px", width: "100%" }}
              />
            </div>
            <select value={filterStatus} onChange={e => { setPage(0); setFilterStatus(e.target.value); }} style={{ width: 160 }}>
              <option value="All">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
            </select>
            {isAdmin && (
              <>
                <button className="btn btn-ghost" onClick={() => setFnModal(true)}>+ Function</button>
                <button className="btn btn-primary" onClick={openAdd}>+ Add OC</button>
              </>
            )}
          </div>

          {msg && !modal && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

          {loading ? (
            <div className="loader"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                    {isAdmin && <th style={{ textAlign: "left", padding: "12px" }}>ST ID</th>}
                    <th style={{ textAlign: "left", padding: "12px" }}>Name</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Function</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>OC Position</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Interview Status</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Assigned Interviewer</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Interview Slot</th>
                    {isAdmin && <th style={{ textAlign: "center", padding: "12px", minWidth: "220px" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {oc.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 8 : 6}><div className="empty-state"><div className="icon">*</div><p>No records found</p></div></td></tr>
                  ) : oc.map(o => {
                    const isProcessing = emailSendingId === `${o.st_id}-${o.function_id}`;
                    const own = isOwnRow(o);

                    // Privacy Control: Staff (isAdmin) or Applicant (own row) can view details
                    const canSeeDetails = isAdmin || own;

                    // Resolve Interviewer Name ONLY (do not display email)
                    const interviewerDisplayName = (() => {
                      if (!o.interviewer_email) return null;
                      const staffMatch = staffList.find(s => s.email?.toLowerCase() === o.interviewer_email?.toLowerCase());
                      return staffMatch?.name || o.interviewer_email.split("@")[0];
                    })();

                    return (
                      <tr
                        key={`${o.st_id}-${o.function_id}`}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          backgroundColor: own ? "rgba(59, 130, 246, 0.12)" : "transparent",
                          borderLeft: own ? "4px solid #3b82f6" : "none"
                        }}
                      >
                        {isAdmin && (
                          <td style={{ padding: "12px" }}>
                            <span style={{ fontFamily: "monospace", color: "#e2e8f0", fontWeight: "600", fontSize: "0.88rem" }}>
                              {o.st_id}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {isAdmin ? (
                              <strong
                                className="clickable-member"
                                onClick={() => setProfileTarget(o.st_id)}
                                style={{ cursor: "pointer", color: "#60a5fa", fontSize: "0.95rem", fontWeight: "600" }}
                              >
                                {o.members?.name || "-"}
                              </strong>
                            ) : (
                              <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>{o.members?.name || "-"}</strong>
                            )}
                            {own && (
                              <span className="badge" style={{ backgroundColor: "#3b82f6", color: "#ffffff", fontSize: "0.7rem", padding: "2px 6px" }}>
                                ⭐ Your Application
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px", color: "#e2e8f0", fontSize: "0.9rem" }}>{o.functions?.function_name || "-"}</td>
                        <td style={{ padding: "12px", color: "#e2e8f0", fontSize: "0.9rem", fontWeight: "500" }}>{o.oc_position || "-"}</td>
                        <td style={{ padding: "12px" }}>{statusBadge(o.apply_status)}</td>
                        
                        {/* Assigned Interviewer (Name ONLY, hidden for other members) */}
                        <td style={{ padding: "12px" }}>
                          {canSeeDetails ? (
                            interviewerDisplayName ? (
                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "rgba(59, 130, 246, 0.15)",
                                color: "#93c5fd",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: "500"
                              }}>
                                👤 <span>{interviewerDisplayName}</span>
                              </div>
                            ) : (
                              <span style={{
                                backgroundColor: "rgba(148, 163, 184, 0.1)",
                                color: "#cbd5e1",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "0.8rem"
                              }}>Unassigned</span>
                            )
                          ) : (
                            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>—</span>
                          )}
                        </td>

                        {/* Interview Slot (Visible to Editors/Admins or Applicant ONLY) */}
                        <td style={{ padding: "12px" }}>
                          {canSeeDetails ? (
                            o.interview_date ? (
                              <div>
                                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#34d399" }}>
                                  📅 {new Date(o.interview_date).toLocaleString()}
                                </div>
                                {o.interview_link && (
                                  <a href={o.interview_link} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#60a5fa", textDecoration: "underline" }}>
                                    🔗 Join Meeting
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span style={{
                                backgroundColor: "rgba(148, 163, 184, 0.1)",
                                color: "#cbd5e1",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "0.82rem"
                              }}>Not booked</span>
                            )
                          ) : (
                            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>—</span>
                          )}
                        </td>

                        {isAdmin && (
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                              {/* Send Cal.com Interview Invite */}
                              <button
                                className="btn btn-sm"
                                style={{ backgroundColor: "#0284c7", color: "#ffffff", fontWeight: "600", border: "none", padding: "4px 10px" }}
                                onClick={() => openInviteModal(o)}
                                disabled={isProcessing}
                                title="Select Interviewer and send Cal.com invitation email"
                              >
                                ✉️ Invite
                              </button>

                              {/* Open Cal.com Embed Modal */}
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ border: "1px solid #60a5fa", color: "#60a5fa", padding: "4px 10px" }}
                                onClick={() => setCalModal({ isOpen: true, row: o })}
                                title="Book via Cal.com Embed"
                              >
                                📅 Cal
                              </button>

                              {o.apply_status !== "Accept" && (
                                <button
                                  className="btn btn-success btn-sm"
                                  style={{ backgroundColor: "#16a34a", color: "#ffffff", border: "none", padding: "4px 10px" }}
                                  onClick={() => updateStatus(o, "Accept")}
                                  disabled={isProcessing}
                                >
                                  Accept
                                </button>
                              )}
                              {o.apply_status !== "Reject" && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ backgroundColor: "#dc2626", color: "#ffffff", border: "none", padding: "4px 10px" }}
                                  onClick={() => updateStatus(o, "Reject")}
                                  disabled={isProcessing}
                                >
                                  Reject
                                </button>
                              )}
                              <button className="btn btn-danger btn-sm" style={{ padding: "4px 8px" }} onClick={() => handleDelete(o.st_id, o.function_id)}>
                                Del
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Add OC Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add OC Assignment</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Member ST ID *</label>
                <input placeholder="Type member ST ID" value={form.st_id} onChange={e => setForm({ ...form, st_id: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label>Function *</label>
                <select value={form.function_id} onChange={e => setForm({ ...form, function_id: e.target.value })}>
                  <option value="">Select Function</option>
                  {functions.map(f => <option key={f.id} value={f.id}>{f.function_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Apply Status</label>
                <select value={form.apply_status} onChange={e => setForm({ ...form, apply_status: e.target.value })}>
                  {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>OC Position</label>
                <input placeholder="e.g. Head of Logistics" value={form.oc_position} onChange={e => setForm({ ...form, oc_position: e.target.value })} />
              </div>
            </div>

            {/* Select Interviewer B Dropdown */}
            <div className="form-group">
              <label>Assigned Interviewer</label>
              <select value={form.interviewer_email} onChange={e => setForm({ ...form, interviewer_email: e.target.value })}>
                <option value="">Select Staff Interviewer</option>
                {session?.email && <option value={session.email}>Me ({session.name || session.email}) [Current User]</option>}
                {staffList.map((st, idx) => (
                  <option key={`${st.email}-${idx}`} value={st.email}>
                    {st.name} ({st.email}) — [{st.role.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save & Send Email"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal with Search & Paginated Interviewer Picker (5 items/page) */}
      {inviteModal.isOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setInviteModal({ isOpen: false, row: null })}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">✉️ Invite Candidate to Interview</h2>
              <button className="modal-close" onClick={() => setInviteModal({ isOpen: false, row: null })}>x</button>
            </div>

            {/* Candidate Summary Box */}
            <div style={{ background: "var(--bg3)", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.9rem", border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 4px 0" }}><strong>Candidate:</strong> {inviteModal.row?.members?.name} ({inviteModal.row?.st_id})</p>
              <p style={{ margin: "0 0 4px 0" }}><strong>Email:</strong> {inviteModal.row?.members?.email || "No email"}</p>
              <p style={{ margin: 0 }}><strong>Position:</strong> {inviteModal.row?.oc_position || inviteModal.row?.functions?.function_name}</p>
            </div>

            {/* Searchable & Paginated Interviewer Picker */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontWeight: "600", color: "#60a5fa", margin: 0 }}>
                  👤 Select Interviewer (Receives Booking Copy)
                </label>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Showing {filteredInterviewers.length} staff
                </span>
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search interviewer by name or email..."
                value={interviewerSearch}
                onChange={e => {
                  setInterviewerSearch(e.target.value);
                  setInterviewerPage(0);
                }}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", marginBottom: "10px", fontSize: "0.88rem" }}
              />

              {/* Paginated List (5 items per page) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto" }}>
                {paginatedInterviewers.length === 0 ? (
                  <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", background: "var(--bg)", borderRadius: "6px" }}>
                    No interviewers found matching "{interviewerSearch}"
                  </div>
                ) : (
                  paginatedInterviewers.map((st, idx) => {
                    const isSelected = selectedInterviewerEmail === st.email;
                    return (
                      <div
                        key={`${st.email}-${idx}`}
                        onClick={() => setSelectedInterviewerEmail(st.email)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          backgroundColor: isSelected ? "rgba(2, 132, 199, 0.25)" : "var(--bg3)",
                          border: isSelected ? "1px solid #0284c7" : "1px solid rgba(255, 255, 255, 0.05)",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "1.1rem" }}>{st.isSelf ? "⭐" : "👤"}</span>
                          <div>
                            <div style={{ fontSize: "0.88rem", fontWeight: "600", color: isSelected ? "#38bdf8" : "#f8fafc" }}>
                              {st.name}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
                              {st.email}
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${st.role === "admin" ? "badge-red" : st.role === "editor" ? "badge-purple" : "badge-gray"}`} style={{ fontSize: "0.72rem" }}>
                          {st.isSelf ? "Me" : st.role ? st.role.toUpperCase() : "STAFF"}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* Custom Email Option */}
                <div
                  onClick={() => setSelectedInterviewerEmail("custom")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor: selectedInterviewerEmail === "custom" ? "rgba(2, 132, 199, 0.25)" : "var(--bg3)",
                    border: selectedInterviewerEmail === "custom" ? "1px solid #0284c7" : "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>✏️</span>
                  <div style={{ fontSize: "0.88rem", fontWeight: "600", color: selectedInterviewerEmail === "custom" ? "#38bdf8" : "#f8fafc" }}>
                    Enter Custom Email...
                  </div>
                </div>
              </div>

              {/* Pagination Controls for Interviewer Picker */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", padding: "0 4px" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setInterviewerPage(p => Math.max(0, p - 1))}
                  disabled={interviewerPage === 0}
                  style={{ padding: "3px 10px", fontSize: "0.8rem" }}
                >
                  ◀ Prev
                </button>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Page {interviewerPage + 1} of {totalInterviewerPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setInterviewerPage(p => Math.min(totalInterviewerPages - 1, p + 1))}
                  disabled={interviewerPage >= totalInterviewerPages - 1}
                  style={{ padding: "3px 10px", fontSize: "0.8rem" }}
                >
                  Next ▶
                </button>
              </div>
            </div>

            {/* Custom Email Input Box */}
            {selectedInterviewerEmail === "custom" && (
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Custom Interviewer Email *</label>
                <input
                  type="email"
                  placeholder="e.g. interviewer@domain.com"
                  value={customInterviewerEmail}
                  onChange={e => setCustomInterviewerEmail(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Cal.com Link Input */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label>Cal.com Link</label>
              <input
                value={customCalUrl}
                onChange={e => setCustomCalUrl(e.target.value)}
                placeholder="https://cal.com/adss-ruhuna/30min"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setInviteModal({ isOpen: false, row: null })}>Cancel</button>
              <button className="btn btn-primary" onClick={sendInviteWithInterviewer} disabled={inviteSending}>
                {inviteSending ? "Sending Invite..." : "✉️ Send Invitation Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Function Modal */}
      {fnModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFnModal(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Function</h2>
              <button className="modal-close" onClick={() => setFnModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>Function Name</label>
              <input placeholder="e.g. Logistics, Marketing..." value={fnName} onChange={e => setFnName(e.target.value)} autoFocus />
            </div>
            <div className="mb-3 mt-1" style={{ marginTop: 10 }}>
              <p className="text-sm text-muted">Existing: {functions.map(f => f.function_name).join(", ") || "None"}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFnModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addFunction} disabled={fnSaving}>{fnSaving ? "Adding..." : "Add Function"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cal.com Embed Modal */}
      <CalEmbedModal
        isOpen={calModal.isOpen}
        onClose={() => setCalModal({ isOpen: false, row: null })}
        calLink={customCalUrl}
        studentName={calModal.row?.members?.name}
        studentEmail={calModal.row?.members?.email}
        stId={calModal.row?.st_id}
        interviewerEmail={calModal.row?.interviewer_email || session?.email}
        eventName={selectedEventInfo?.name}
        position={calModal.row?.oc_position || calModal.row?.functions?.function_name}
      />

      <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
