import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

const EMPTY = { event_id: "", name: "", date: "", oc_st_id: "", apply_start_date: "", apply_end_date: "" };
const APPLY_EMPTY = { function_id: "", oc_position: "" };

export default function Events({ isAdmin = false, session }) {
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [applyModal, setApplyModal] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyForm, setApplyForm] = useState(APPLY_EMPTY);
  const [functions, setFunctions] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

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
    setEvents(eventRes.data || []);
    setTotal(eventRes.count || 0);
    setMembers(memberRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(page, search); }, [page, search]);

  const openAdd = () => { setForm(EMPTY); setEditTarget(null); setModal(true); setMsg(null); };
  const openEdit = (e) => {
    setForm({ event_id: e.event_id, name: e.name, date: e.date, oc_st_id: e.oc_st_id || "", apply_start_date: e.apply_start_date || "", apply_end_date: e.apply_end_date || "" });
    setEditTarget(e.event_id);
    setModal(true);
    setMsg(null);
  };
  const closeModal = () => { setModal(false); setMsg(null); };

  const openApply = async (e) => {
    setApplyTarget(e);
    setApplyForm(APPLY_EMPTY);
    setApplyModal(true);
    setMsg(null);
    if (functions.length === 0) {
      const { data } = await supabase.from("functions").select("*").order("function_name");
      setFunctions(data || []);
    }
  };
  const closeApplyModal = () => { setApplyModal(false); setMsg(null); };

  const getMemberName = (stId) => members.find(m => m.st_id === stId)?.name || stId;

  const handleSave = async () => {
    if (!form.event_id.trim() || !form.name.trim() || !form.date) {
      setMsg({ type: "error", text: "Event ID, Name, and Date are required." });
      return;
    }
    setSaving(true);
    const payload = {
      event_id: form.event_id.trim(),
      name: form.name.trim(),
      date: form.date,
      oc_st_id: form.oc_st_id || null,
      apply_start_date: form.apply_start_date || null,
      apply_end_date: form.apply_end_date || null,
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from("events").update(payload).eq("event_id", editTarget));
    } else {
      ({ error } = await supabase.from("events").insert([payload]));
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
    setSaving(true);
    const payload = {
      event_id: applyTarget.event_id,
      st_id: session.stId,
      function_id: parseInt(applyForm.function_id),
      oc_position: applyForm.oc_position.trim() || null,
      apply_status: "Pending",
    };
    const { error } = await supabase.from("oc").insert([payload]);
    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: "Application submitted successfully." });
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

  const today = new Date().toISOString().split("T")[0];
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
        <h1 className="page-title"><span className="icon">*</span> Events</h1>
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
          <table>
            <thead>
              <tr><th>Event ID</th><th>Name</th><th>Date</th><th>OC</th><th>Status</th><th>Apply</th>{isAdmin && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6}><div className="empty-state"><div className="icon">*</div><p>No events found</p></div></td></tr>
              ) : events.map(e => (
                <tr key={e.event_id}>
                  <td className="mono">{e.event_id}</td>
                  <td><strong>{e.name}</strong></td>
                  <td className="mono">{e.date}</td>
                  <td>{e.oc_st_id ? <span className="badge badge-purple">{getMemberName(e.oc_st_id)}</span> : <span className="text-muted">-</span>}</td>
                  <td>{getDateBadge(e.date)}</td>
                  <td>
                    {isAccepting(e) && session?.stId ? (
                      <button className="btn btn-primary btn-sm" onClick={() => openApply(e)}>Apply for OC</button>
                    ) : <span className="text-muted text-sm">{e.apply_start_date ? "Closed" : "-"}</span>}
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-2">
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
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Apply Start Date</label>
                <input type="date" value={form.apply_start_date} onChange={e => setForm({ ...form, apply_start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Apply End Date</label>
                <input type="date" value={form.apply_end_date} onChange={e => setForm({ ...form, apply_end_date: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Assigned OC</label>
                <select value={form.oc_st_id} onChange={e => setForm({ ...form, oc_st_id: e.target.value })}>
                  <option value="">No OC assigned</option>
                  {members.map(m => <option key={m.st_id} value={m.st_id}>{m.st_id} - {m.name}</option>)}
                </select>
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

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Select Function *</label>
              <select value={applyForm.function_id} onChange={e => setApplyForm({ ...applyForm, function_id: e.target.value })}>
                <option value="">-- Choose a function --</option>
                {functions.map(f => <option key={f.id} value={f.id}>{f.function_name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Preferred Position (Optional)</label>
              <select value={applyForm.oc_position} onChange={e => setApplyForm({ ...applyForm, oc_position: e.target.value })}>
                <option value="">-- Choose preferred position --</option>
                <option value="OC President">OC President</option>
                <option value="OC Secretary">OC Secretary</option>
                <option value="Content & Communication">Content & Communication</option>
                <option value="Marketing">Marketing</option>
                <option value="Session Moderating">Session Moderating</option>
                <option value="Public Relations">Public Relations</option>
                <option value="Technical & Platform Management">Technical & Platform Management</option>
                <option value="Event & Logistics">Event & Logistics</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeApplyModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApplySave} disabled={saving}>
                {saving ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
