import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

const STANDARD_OC_POSITIONS = [
  "OC President",
  "OC Secretary",
  "Content & Communication",
  "Marketing",
  "Session Moderating",
  "Public Relations",
  "Technical & Platform Management",
  "Event & Logistics"
];

const parsePositionsList = (val) => {
  if (!val) return STANDARD_OC_POSITIONS;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return val.split(",").map(p => p.trim()).filter(Boolean);
  }
  return STANDARD_OC_POSITIONS;
};

const EMPTY = { 
  event_id: "", 
  name: "", 
  date: "", 
  oc_st_id: "", 
  apply_start_date: "", 
  apply_end_date: "", 
  description: "", 
  time: "", 
  tally_link: "", 
  flyer_url: "", 
  is_public: true, 
  self_attendance_enabled: false,
  available_oc_positions: STANDARD_OC_POSITIONS
};
const APPLY_EMPTY = { function_id: "", selected_positions: [], member_function_name: "" };

export default function Events({ isAdmin = false, session }) {
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerPreview, setFlyerPreview] = useState(null);
  const [applyModal, setApplyModal] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyForm, setApplyForm] = useState(APPLY_EMPTY);
  const [functions, setFunctions] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [myAttendanceMap, setMyAttendanceMap] = useState({});
  const [markingMap, setMarkingMap] = useState({});
  const [eventOcMembers, setEventOcMembers] = useState([]);
  const [existingApp, setExistingApp] = useState(null);
  const [customPosInput, setCustomPosInput] = useState("");

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let eventQuery = supabase
      .from("events")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .range(from, to);

    const q = searchText.trim();
    if (q) {
      eventQuery = eventQuery.or(`event_id.ilike.%${q}%,name.ilike.%${q}%,oc_st_id.ilike.%${q}%`);
    }

    const [eventRes, memberRes] = await Promise.all([
      eventQuery,
      supabase.from("members").select("st_id, name").lte("level", 4).order("name"),
    ]);
    const eventsData = eventRes.data || [];
    setEvents(eventsData);
    setTotal(eventRes.count || 0);
    setMembers(memberRes.data || []);

    if (session?.stId && eventsData.length > 0) {
      const eventIds = eventsData.map(e => e.event_id);
      const { data: attData } = await supabase
        .from("attendance")
        .select("event_id, attend")
        .eq("st_id", session.stId)
        .in("event_id", eventIds);
      const attMap = {};
      attData?.forEach(a => {
        attMap[a.event_id] = a.attend;
      });
      setMyAttendanceMap(attMap);
    } else {
      setMyAttendanceMap({});
    }
    setLoading(false);
  };

  useEffect(() => { load(page, search); }, [page, search]);

  const openAdd = () => { setForm(EMPTY); setEditTarget(null); setEventOcMembers([]); setModal(true); setMsg(null); setCustomPosInput(""); };
  const openEdit = async (e) => {
    setForm({ 
      event_id: e.event_id, 
      name: e.name, 
      date: e.date, 
      oc_st_id: e.oc_st_id || "", 
      apply_start_date: e.apply_start_date || "", 
      apply_end_date: e.apply_end_date || "",
      description: e.description || "",
      time: e.time || "",
      tally_link: e.tally_link || "",
      flyer_url: e.flyer_url || "",
      is_public: e.is_public !== false,
      self_attendance_enabled: e.self_attendance_enabled === true,
      available_oc_positions: parsePositionsList(e.available_oc_positions)
    });
    setEditTarget(e.event_id);
    setModal(true);
    setMsg(null);
    setCustomPosInput("");
    setFlyerFile(null);
    setFlyerPreview(null);
    setEventOcMembers([]);
    try {
      const { data, error } = await supabase
        .from("oc")
        .select("st_id, members(name)")
        .eq("event_id", e.event_id)
        .eq("apply_status", "Accept");
      if (error) throw error;
      if (data) {
        setEventOcMembers(data.map(d => ({
          st_id: d.st_id,
          name: d.members?.name || d.st_id
        })));
      }
    } catch (err) {
      console.error("Error loading event OC members:", err);
    }
  };
  const closeModal = () => { 
    setModal(false); 
    setMsg(null); 
    setFlyerFile(null);
    if (flyerPreview) {
      URL.revokeObjectURL(flyerPreview);
      setFlyerPreview(null);
    }
  };
  const handleFlyerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "Please select a valid image file." });
        return;
      }
      setFlyerFile(file);
      setFlyerPreview(URL.createObjectURL(file));
    }
  };

  const openApply = async (e) => {
    setApplyTarget(e);
    setApplyForm(APPLY_EMPTY);
    setExistingApp(null);
    setApplyModal(true);
    setMsg(null);

    if (session?.stId) {
      try {
        // Fetch user's member_function from members table
        const { data: member, error: memberErr } = await supabase
          .from("members")
          .select("member_function")
          .eq("st_id", session.stId)
          .maybeSingle();

        if (memberErr) throw memberErr;

        const memberFunc = member?.member_function || "General";

        // Fetch functions to find a match or insert if not exists
        let allFuncs = functions;
        if (allFuncs.length === 0) {
          const { data, error: funcErr } = await supabase.from("functions").select("*").order("function_name");
          if (funcErr) throw funcErr;
          allFuncs = data || [];
          setFunctions(allFuncs);
        }

        let matchedFunc = allFuncs.find(
          f => f.function_name.trim().toLowerCase() === memberFunc.trim().toLowerCase()
        );

        if (!matchedFunc && memberFunc.trim()) {
          // Create function dynamically if not found
          const { data: newFunc, error: insertErr } = await supabase
            .from("functions")
            .insert([{ function_name: memberFunc.trim() }])
            .select()
            .maybeSingle();

          if (insertErr) throw insertErr;
          if (newFunc) {
            matchedFunc = newFunc;
            setFunctions(prev => [...prev, newFunc].sort((a, b) => a.function_name.localeCompare(b.function_name)));
          }
        }

        // Check if member already applied for this event
        const { data: existingData } = await supabase
          .from("oc")
          .select("*, functions(function_name)")
          .eq("event_id", e.event_id)
          .eq("st_id", session.stId)
          .maybeSingle();

        let selectedPos = [];
        if (existingData) {
          setExistingApp(existingData);
          if (existingData.oc_position) {
            selectedPos = existingData.oc_position.split(",").map(p => p.trim()).filter(Boolean);
          }
        }

        setApplyForm(prev => ({
          ...prev,
          function_id: matchedFunc ? matchedFunc.id.toString() : (existingData?.function_id?.toString() || prev.function_id),
          member_function_name: matchedFunc ? matchedFunc.function_name : (existingData?.functions?.function_name || memberFunc),
          selected_positions: selectedPos
        }));

      } catch (err) {
        console.error("Error in openApply:", err);
        setMsg({ type: "error", text: "Failed to load member profile: " + err.message });
      }
    }
  };
  const closeApplyModal = () => { setApplyModal(false); setMsg(null); setExistingApp(null); };

  const getMemberName = (stId) => members.find(m => m.st_id === stId)?.name || stId;

  const handleSave = async () => {
    if (!form.event_id.trim() || !form.name.trim() || !form.date) {
      setMsg({ type: "error", text: "Event ID, Name, and Date are required." });
      return;
    }
    setSaving(true);
    
    let flyerUrl = form.flyer_url || null;
    if (flyerFile) {
      try {
        const optimizedFile = await resizeImage(flyerFile, 800, 1000, 0.85);
        const cleanEventId = form.event_id.trim().replace(/\//g, "-");
        const fileName = `flyer_${cleanEventId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("event_flyers")
          .upload(fileName, optimizedFile, {
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          throw new Error("Failed to upload flyer: " + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from("event_flyers")
          .getPublicUrl(fileName);

        flyerUrl = urlData?.publicUrl;
      } catch (imgErr) {
        setMsg({ type: "error", text: imgErr.message });
        setSaving(false);
        return;
      }
    }

    const payload = {
      event_id: form.event_id.trim(),
      name: form.name.trim(),
      date: form.date,
      oc_st_id: form.oc_st_id || null,
      apply_start_date: form.apply_start_date || null,
      apply_end_date: form.apply_end_date || null,
      description: form.description || null,
      time: form.time || null,
      tally_link: form.tally_link || null,
      flyer_url: flyerUrl,
      is_public: form.is_public !== false,
      self_attendance_enabled: form.self_attendance_enabled === true,
      available_oc_positions: Array.isArray(form.available_oc_positions)
        ? JSON.stringify(form.available_oc_positions)
        : form.available_oc_positions || null
    };

    let error;
    if (editTarget) {
      ({ error } = await supabase.from("events").update(payload).eq("event_id", editTarget));
    } else {
      ({ error } = await supabase.from("events").insert([payload]));
    }

    if (error && error.message && error.message.includes("available_oc_positions")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.available_oc_positions;
      if (editTarget) {
        ({ error } = await supabase.from("events").update(fallbackPayload).eq("event_id", editTarget));
      } else {
        ({ error } = await supabase.from("events").insert([fallbackPayload]));
      }
      if (!error) {
        setSaving(false);
        setMsg({
          type: "success",
          text: (editTarget ? "Event updated." : "Event created.") + " (Note: Please run 'available-oc-positions-setup.sql' in Supabase SQL Editor)."
        });
        load(page, search);
        setTimeout(closeModal, 1500);
        return;
      }
    }

    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: editTarget ? "Event updated." : "Event created." });
    load(page, search);
    setTimeout(closeModal, 800);
  };

  const handleApplySave = async () => {
    if (!applyForm.function_id) {
      setMsg({ type: "error", text: "Function is required." });
      return;
    }
    if (!applyForm.selected_positions || applyForm.selected_positions.length === 0) {
      setMsg({ type: "error", text: "Please select at least one preferred position." });
      return;
    }
    setSaving(true);
    const positionStr = applyForm.selected_positions.join(", ");
    
    let error;
    if (existingApp) {
      ({ error } = await supabase
        .from("oc")
        .update({ oc_position: positionStr })
        .eq("event_id", applyTarget.event_id)
        .eq("st_id", session.stId));
    } else {
      const payload = {
        event_id: applyTarget.event_id,
        st_id: session.stId,
        function_id: parseInt(applyForm.function_id),
        oc_position: positionStr,
        apply_status: "Pending",
      };
      ({ error } = await supabase.from("oc").insert([payload]));
    }

    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ 
      type: "success", 
      text: existingApp ? "Application choices updated successfully." : "Application submitted successfully." 
    });
    setTimeout(closeApplyModal, 1500);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete event "${id}"? This will remove all attendance records for it.`)) return;
    const { error } = await supabase.from("events").delete().eq("event_id", id);
    if (error) alert(error.message);
    else load(page, search);
  };

  const seedAttendance = async (eventId) => {
    const { data: membersData } = await supabase.from("members").select("st_id").lte("level", 4);
    if (!membersData?.length) { alert("No members to seed attendance for."); return; }
    const rows = membersData.map(m => ({ st_id: m.st_id, event_id: eventId, attend: "NO" }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "st_id,event_id" });
    if (error) alert(error.message);
    else alert(`Seeded attendance for ${membersData.length} members.`);
  };

  const isTimeWithinRange = (timeStr) => {
    if (!timeStr) return true;
    try {
      const cleanStr = timeStr.toLowerCase().replace(/\s+/g, ' ');
      const parts = cleanStr.split(/[-–—]| to /);
      if (parts.length !== 2) return true;
      
      const parseTime = (str) => {
        const match = str.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const startMin = parseTime(parts[0].trim());
      const endMin = parseTime(parts[1].trim());

      if (startMin === null || endMin === null) return true;

      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      if (startMin > endMin) { // overnight
        return currentMin >= startMin || currentMin <= endMin;
      }
      return currentMin >= startMin && currentMin <= endMin;
    } catch (e) {
      return true; 
    }
  };

  const toggleSelfAttendance = async (eventId, currentVal) => {
    const newVal = !currentVal;
    const { error } = await supabase
      .from("events")
      .update({ self_attendance_enabled: newVal })
      .eq("event_id", eventId);
    if (error) {
      alert("Failed to toggle self-attendance: " + error.message);
    } else {
      load(page, search);
    }
  };

  const handleSelfMarkAttendance = async (eventId) => {
    if (!session?.stId) return;
    setMarkingMap(prev => ({ ...prev, [eventId]: true }));
    const { error } = await supabase
      .from("attendance")
      .upsert({ st_id: session.stId, event_id: eventId, attend: "YES" }, { onConflict: "st_id,event_id" });
    setMarkingMap(prev => ({ ...prev, [eventId]: false }));
    if (error) {
      alert("Failed to mark attendance: " + error.message);
    } else {
      load(page, search);
    }
  };

  const today = new Date().toLocaleDateString("sv-SE");
  const getDateBadge = (date) => {
    if (date > today) return <span className="badge badge-green">Upcoming</span>;
    if (date === today) return <span className="badge badge-amber">Today</span>;
    return <span className="badge badge-gray">Past</span>;
  };

  const isAccepting = (e) => {
    if (!e.apply_start_date || !e.apply_end_date) return false;
    return today >= e.apply_start_date && today <= e.apply_end_date;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">event</span></span> Events</h1>
        <p className="page-subtitle">{total} events registered</p>
      </div>

      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="search-icon">?</span>
          <input placeholder="Search events or OC..." value={search} onChange={e => { setPage(0); setSearch(e.target.value); }} />
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Create Event</button>}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table-fit table-cards">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Name</th>
                <th>Date</th>
                <th>OC</th>
                <th>Status</th>
                {session?.role && session.role !== "guest" && <th>Self-Attendance</th>}
                <th>Apply</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : (session?.role && session.role !== "guest" ? 7 : 6)}>
                    <div className="empty-state"><div className="icon">*</div><p>No events found</p></div>
                  </td>
                </tr>
              ) : events.map(e => (
                <tr key={e.event_id}>
                  <td className={`mono col-secondary ${!isAdmin ? "hide-member-mobile" : ""}`}>{e.event_id}</td>
                  <td className="col-name">
                    <strong>{e.name}</strong>
                    {e.is_public !== false ? (
                      <span className={`badge badge-green ${!isAdmin ? "hide-member-mobile" : ""}`} style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 6px", verticalAlign: "middle" }}>🌐 Public</span>
                    ) : (
                      <span className={`badge badge-gray ${!isAdmin ? "hide-member-mobile" : ""}`} style={{ marginLeft: "8px", fontSize: "10px", padding: "2px 6px", verticalAlign: "middle" }}>🔒 Private</span>
                    )}
                  </td>
                  <td className="mono">{e.date}</td>
                  <td>{e.oc_st_id ? <span className="badge badge-purple">{getMemberName(e.oc_st_id)}</span> : <span className="text-muted">-</span>}</td>
                  <td>{getDateBadge(e.date)}</td>
                  {session?.role && session.role !== "guest" && (
                    <td>
                      {isAdmin ? (
                        <button
                          className={`btn btn-sm ${e.self_attendance_enabled ? "btn-success" : "btn-ghost"}`}
                          onClick={() => toggleSelfAttendance(e.event_id, e.self_attendance_enabled)}
                          style={{ minWidth: "90px" }}
                        >
                          {e.self_attendance_enabled ? "🟢 Enabled" : "⚪ Disabled"}
                        </button>
                      ) : (
                        e.date === today ? (
                          e.self_attendance_enabled ? (
                            myAttendanceMap[e.event_id] === "YES" ? (
                              <span className="badge badge-green">✓ Present</span>
                            ) : isTimeWithinRange(e.time) ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSelfMarkAttendance(e.event_id)}
                                disabled={markingMap[e.event_id]}
                              >
                                {markingMap[e.event_id] ? "..." : "Mark Present"}
                              </button>
                            ) : (
                              <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px", alignItems: "center", verticalAlign: "middle" }}>
                                <button className="btn btn-ghost btn-sm" disabled style={{ cursor: "not-allowed", padding: "2px 6px", fontSize: "11px" }}>Mark Present</button>
                                <span style={{ fontSize: "9px", color: "var(--red)", fontWeight: "600" }}>Outside Time</span>
                              </div>
                            )
                          ) : (
                            <span className="text-muted">Disabled</span>
                          )
                        ) : (
                          <span className="text-muted">-</span>
                        )
                      )}
                    </td>
                  )}
                  <td>
                    {isAccepting(e) && session?.stId ? (
                      <button className="btn btn-primary btn-sm" onClick={() => openApply(e)}>Apply for OC</button>
                    ) : <span className="text-muted text-sm">{e.apply_start_date ? "Closed" : "-"}</span>}
                  </td>
                  {isAdmin && (
                    <td className="col-action col-action-full">
                      <div className="gap-2" style={{ display: "flex", flexWrap: "wrap" }}>
                        <a href={`/event?id=${e.event_id}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Preview</a>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Edit</button>
                        <button className="btn btn-success btn-sm" title="Seed attendance for all members" onClick={() => seedAttendance(e.event_id)}>Seed Att.</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.event_id)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editTarget ? "Edit Event" : "Create Event"}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Event ID *</label>
                <input placeholder="e.g. 20261" value={form.event_id} onChange={e => setForm({ ...form, event_id: e.target.value })} disabled={!!editTarget} />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Event Name *</label>
                <input placeholder="Name of the event" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: "15px" }}>
              <div className="form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                <input 
                  type="checkbox" 
                  id="event-is-public"
                  checked={form.is_public !== false} 
                  onChange={e => setForm({ ...form, is_public: e.target.checked })} 
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#0062ff", margin: 0 }}
                />
                <label htmlFor="event-is-public" style={{ margin: 0, cursor: "pointer", fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>
                  Show Event on Public Main Page & Public Event Page
                </label>
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: "15px" }}>
              <div className="form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                <input 
                  type="checkbox" 
                  id="event-self-attendance"
                  checked={form.self_attendance_enabled === true} 
                  onChange={e => setForm({ ...form, self_attendance_enabled: e.target.checked })} 
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#0062ff", margin: 0 }}
                />
                <label htmlFor="event-self-attendance" style={{ margin: 0, cursor: "pointer", fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>
                  Allow Members to Mark Own Attendance (Self-Attendance)
                </label>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Event Time (e.g. 10:00 AM - 12:30 PM)</label>
                <input placeholder="e.g. 10:00 AM - 1:00 PM" value={form.time || ""} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tally.so Embed Link or Form ID</label>
                <input placeholder="e.g. mBQKkN or full URL" value={form.tally_link || ""} onChange={e => setForm({ ...form, tally_link: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Event Description</label>
                <textarea 
                  placeholder="Describe the event, topics, guest speakers..." 
                  value={form.description || ""} 
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", height: "80px", background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px" }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Event Flyer Image</label>
                <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                  {flyerPreview || form.flyer_url ? (
                    <img
                      src={flyerPreview || form.flyer_url}
                      alt="Flyer Preview"
                      style={{ width: "60px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--border)", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: "60px", height: "80px", borderRadius: "4px", background: "var(--bg)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--text3)", flexShrink: 0 }}>
                      🖼️
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="event-flyer-upload"
                      onChange={handleFlyerChange}
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="event-flyer-upload"
                      className="btn btn-ghost btn-sm"
                      style={{ cursor: "pointer", alignSelf: "flex-start", padding: "4px 12px", border: "1px solid var(--border)" }}
                    >
                      Choose Flyer
                    </label>
                    <span className="text-muted" style={{ fontSize: "11px" }}>
                      {flyerFile ? `${flyerFile.name.substring(0, 20)}${flyerFile.name.length > 20 ? "..." : ""}` : "No flyer uploaded"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Or External Flyer Image URL</label>
                <input placeholder="https://example.com/flyer.jpg" value={form.flyer_url || ""} onChange={e => setForm({ ...form, flyer_url: e.target.value })} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Apply Start Date (for OC Applications)</label>
                <input type="date" value={form.apply_start_date} onChange={e => setForm({ ...form, apply_start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Apply End Date (for OC Applications)</label>
                <input type="date" value={form.apply_end_date} onChange={e => setForm({ ...form, apply_end_date: e.target.value })} />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: "15px" }}>
              <div className="form-group" style={{ background: "var(--bg3)", padding: "14px", borderRadius: "var(--r)", border: "1px solid var(--border)", width: "100%" }}>
                <label style={{ fontWeight: "600", fontSize: "13px", marginBottom: "4px", display: "block" }}>
                  Available OC Preferred Positions for Applicants
                </label>
                <span className="text-muted" style={{ fontSize: "11px", display: "block", marginBottom: "10px" }}>
                  Select which positions applicants can choose for this event:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                  {STANDARD_OC_POSITIONS.map(pos => {
                    const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                    const isSelected = currentArr.includes(pos);
                    return (
                      <button
                        key={pos}
                        type="button"
                        className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-ghost"}`}
                        style={{ borderRadius: "20px", fontSize: "12px", padding: "4px 12px" }}
                        onClick={() => {
                          const nextArr = isSelected
                            ? currentArr.filter(p => p !== pos)
                            : [...currentArr, pos];
                          setForm({ ...form, available_oc_positions: nextArr });
                        }}
                      >
                        {isSelected ? "✓ " : "+ "}{pos}
                      </button>
                    );
                  })}
                  {Array.isArray(form.available_oc_positions) && form.available_oc_positions.filter(p => !STANDARD_OC_POSITIONS.includes(p)).map(customPos => (
                    <button
                      key={customPos}
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ borderRadius: "20px", fontSize: "12px", padding: "4px 12px" }}
                      onClick={() => {
                        const nextArr = form.available_oc_positions.filter(p => p !== customPos);
                        setForm({ ...form, available_oc_positions: nextArr });
                      }}
                    >
                      ✓ {customPos} ✕
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    placeholder="Add custom position (e.g. Design Lead)..."
                    value={customPosInput}
                    onChange={e => setCustomPosInput(e.target.value)}
                    style={{ fontSize: "12px", padding: "6px 10px", flexGrow: 1 }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customPosInput.trim()) {
                          const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                          if (!currentArr.includes(customPosInput.trim())) {
                            setForm({ ...form, available_oc_positions: [...currentArr, customPosInput.trim()] });
                          }
                          setCustomPosInput("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (customPosInput.trim()) {
                        const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                        if (!currentArr.includes(customPosInput.trim())) {
                          setForm({ ...form, available_oc_positions: [...currentArr, customPosInput.trim()] });
                        }
                        setCustomPosInput("");
                      }
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Assigned OC Lead</label>
                <select value={form.oc_st_id} onChange={e => setForm({ ...form, oc_st_id: e.target.value })}>
                  <option value="">No OC assigned</option>
                  {(() => {
                    const options = [...eventOcMembers];
                    if (form.oc_st_id && !options.some(o => o.st_id === form.oc_st_id)) {
                      options.push({
                        st_id: form.oc_st_id,
                        name: getMemberName(form.oc_st_id)
                      });
                    }
                    return options.map(m => (
                      <option key={m.st_id} value={m.st_id}>{m.st_id} - {m.name}</option>
                    ));
                  })()}
                </select>
                <span className="text-muted" style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>
                  {editTarget 
                    ? "Only accepted committee members for this event are shown. Manage them in the Committee tab."
                    : "Create the event first, then add and accept committee members to assign an OC Lead."}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editTarget ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {applyModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeApplyModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Apply for OC - {applyTarget?.name}</h2>
              <button className="modal-close" onClick={closeApplyModal}>x</button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            {existingApp && (
              <div style={{
                padding: "12px 14px",
                background: existingApp.apply_status === "Accept" ? "rgba(34, 197, 94, 0.15)" : existingApp.apply_status === "Reject" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                border: `1px solid ${existingApp.apply_status === "Accept" ? "#22c55e" : existingApp.apply_status === "Reject" ? "#ef4444" : "#f59e0b"}`,
                borderRadius: "var(--r)",
                marginBottom: 15
              }}>
                <div style={{ fontWeight: "600", fontSize: "13px", color: existingApp.apply_status === "Accept" ? "#4ade80" : existingApp.apply_status === "Reject" ? "#f87171" : "#fbbf24", marginBottom: "4px" }}>
                  {existingApp.apply_status === "Accept" ? "✓ Application Accepted" : existingApp.apply_status === "Reject" ? "✕ Application Rejected" : "⏳ Application Submitted (Pending)"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text)" }}>
                  {existingApp.apply_status === "Pending" 
                    ? "You have already applied for this event. Members can only apply once per event, but you can update your preferred positions below."
                    : `Your application has been processed (Status: ${existingApp.apply_status}).`}
                </div>
              </div>
            )}

            {applyForm.member_function_name ? (
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label>Your Function (Auto-detected)</label>
                <div style={{ padding: "10px 14px", background: "var(--bg3)", borderRadius: "var(--r)", border: "1px solid var(--border)", fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>
                  💼 {applyForm.member_function_name}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 15, fontSize: "13px", color: "var(--text-muted)", padding: "10px 14px", background: "var(--bg3)", borderRadius: "var(--r)", border: "1px dashed var(--border)" }}>
                ⏳ Resolving your member function...
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label style={{ fontWeight: "600", fontSize: "13px", marginBottom: "4px", display: "block" }}>
                Preferred Positions (Select 1 or more) *
              </label>
              <span className="text-muted" style={{ fontSize: "11px", display: "block", marginBottom: "8px" }}>
                Select one or multiple preferred positions offered for this event:
              </span>

              {(() => {
                const available = parsePositionsList(applyTarget?.available_oc_positions);
                const selected = applyForm.selected_positions || [];
                const isLocked = existingApp && existingApp.apply_status !== "Pending";

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {available.map(pos => {
                      const checked = selected.includes(pos);
                      return (
                        <label
                          key={pos}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px 12px",
                            background: checked ? "rgba(0, 98, 255, 0.12)" : "var(--bg3)",
                            border: `1px solid ${checked ? "#0062ff" : "var(--border)"}`,
                            borderRadius: "var(--r)",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            transition: "all 0.15s ease",
                            opacity: isLocked && !checked ? 0.6 : 1
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLocked}
                            onChange={() => {
                              if (isLocked) return;
                              const nextSelected = checked
                                ? selected.filter(p => p !== pos)
                                : [...selected, pos];
                              setApplyForm({ ...applyForm, selected_positions: nextSelected });
                            }}
                            style={{ width: "16px", height: "16px", accentColor: "#0062ff", cursor: isLocked ? "not-allowed" : "pointer" }}
                          />
                          <span style={{ fontSize: "13px", fontWeight: checked ? "600" : "400", color: "var(--text)" }}>
                            {pos}
                          </span>
                        </label>
                      );
                    })}
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                      Selected ({selected.length}): <strong style={{ color: "var(--text)" }}>{selected.length > 0 ? selected.join(", ") : "None"}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeApplyModal}>Cancel</button>
              {(!existingApp || existingApp.apply_status === "Pending") && (
                <button className="btn btn-primary" onClick={handleApplySave} disabled={saving || !applyForm.function_id}>
                  {saving ? "Submitting..." : existingApp ? "Update Application" : "Submit Application"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
