import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";

const EMPTY = { st_id: "", function_id: "", oc_position: "", apply_status: "Pending" };
const STATUS_OPTS = ["Pending", "Accept", "Reject"];

export default function Committee({ isAdmin = false }) {
  const [oc, setOc] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [functions, setFunctions] = useState([]);
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
  const [statusCounts, setStatusCounts] = useState({ Accept: 0, Pending: 0, Reject: 0 });
  const [profileTarget, setProfileTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const [eventRes, fRes] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: false }),
      supabase.from("functions").select("*").order("function_name"),
    ]);
    const nextEvents = eventRes.data || [];
    setEvents(nextEvents);
    setSelectedEvent(current => current || nextEvents[0]?.event_id || "");
    setFunctions(fRes.data || []);
    setLoading(false);
  };

  const loadOc = async (eventId, pageToLoad = page, status = filterStatus, searchText = search) => {
    if (!eventId) {
      setOc([]);
      setTotal(0);
      setStatusCounts({ Accept: 0, Pending: 0, Reject: 0 });
      return;
    }

    setLoading(true);
    setMsg(null);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("oc")
      .select("*, members(name), functions(function_name)", { count: "exact" })
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

    const [records, accept, pending, reject] = await Promise.all([
      query,
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Accept"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Pending"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Reject"),
    ]);

    if (records.error) setMsg({ type: "error", text: records.error.message });
    else setOc(records.data || []);
    setTotal(records.count || 0);
    setStatusCounts({
      Accept: accept.count || 0,
      Pending: pending.count || 0,
      Reject: reject.count || 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    loadOc(selectedEvent, page, filterStatus, search);
  }, [selectedEvent, page, filterStatus, search]);

  const openAdd = () => { setForm(EMPTY); setModal(true); setMsg(null); };
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
    };
    const { error } = await supabase.from("oc").insert([payload]);
    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: "OC record saved." });
    loadOc(selectedEvent, page, filterStatus, search);
    setTimeout(closeModal, 700);
  };

  const updateStatus = async (stId, functionId, status) => {
    const { error } = await supabase.from("oc").update({ apply_status: status }).eq("event_id", selectedEvent).eq("st_id", stId).eq("function_id", functionId);
    if (error) alert(error.message);
    else loadOc(selectedEvent, page, filterStatus, search);
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

  const statusBadge = (s) => {
    if (s === "Accept") return <span className="badge badge-green">Accept</span>;
    if (s === "Reject") return <span className="badge badge-red">Reject</span>;
    return <span className="badge badge-amber">Pending</span>;
  };

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">diversity_3</span></span> Committee (OC)</h1>
        <p className="page-subtitle">{selectedEventInfo ? `${selectedEventInfo.name} - ${total} assignments` : "select an event to manage OC assignments"}</p>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)", marginBottom:16}}>
        <div className="stat-card green"><div className="stat-label">Accepted</div><div className="stat-value">{statusCounts.Accept}</div></div>
        <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value">{statusCounts.Pending}</div></div>
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
        <select value={selectedEvent} onChange={e => { setPage(0); setSelectedEvent(e.target.value); }} style={{ width: "100%" }}>
          {events.map(e => (
            <option key={e.event_id} value={e.event_id}>{e.name} - {e.date} ({e.event_id})</option>
          ))}
        </select>
      </div>

      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="search-icon">?</span>
          <input placeholder="Search by ID, position, status..." value={search} onChange={e => { setPage(0); setSearch(e.target.value); }} />
        </div>
        <select value={filterStatus} onChange={e => { setPage(0); setFilterStatus(e.target.value); }} style={{width:140}}>
          <option value="All">All Status</option>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ST ID</th>}
                <th>Name</th>
                <th>Function</th>
                <th>OC Position</th>
                <th>Apply Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {oc.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 4}><div className="empty-state"><div className="icon">*</div><p>No records found</p></div></td></tr>
              ) : oc.map(o => (
                <tr key={`${o.st_id}-${o.function_id}`}>
                  {isAdmin && <td className="mono">{o.st_id}</td>}
                  <td>
                    {isAdmin ? (
                      <strong 
                        className="clickable-member" 
                        onClick={() => setProfileTarget(o.st_id)}
                        style={{ cursor: "pointer", color: "var(--accent2)" }}
                      >
                        {o.members?.name || "-"}
                      </strong>
                    ) : (
                      <strong>{o.members?.name || "-"}</strong>
                    )}
                  </td>
                  <td>{o.functions?.function_name || "-"}</td>
                  <td>{o.oc_position || "-"}</td>
                  <td>{statusBadge(o.apply_status)}</td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-2">
                        {o.apply_status !== "Accept" && (
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(o.st_id, o.function_id, "Accept")}>Accept</button>
                        )}
                        {o.apply_status !== "Reject" && (
                          <button className="btn btn-danger btn-sm" onClick={() => updateStatus(o.st_id, o.function_id, "Reject")}>Reject</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.st_id, o.function_id)}>Del</button>
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
      </>
      )}

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
                <input placeholder="Type member ST ID" value={form.st_id} onChange={e => setForm({...form, st_id: e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label>Function *</label>
                <select value={form.function_id} onChange={e => setForm({...form, function_id: e.target.value})}>
                  <option value="">Select Function</option>
                  {functions.map(f => <option key={f.id} value={f.id}>{f.function_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Apply Status</label>
                <select value={form.apply_status} onChange={e => setForm({...form, apply_status: e.target.value})}>
                  {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>OC Position</label>
                <input placeholder="e.g. Head of Logistics" value={form.oc_position} onChange={e => setForm({...form, oc_position: e.target.value})} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {fnModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFnModal(false)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-header">
              <h2 className="modal-title">Add Function</h2>
              <button className="modal-close" onClick={() => setFnModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>Function Name</label>
              <input placeholder="e.g. Logistics, Marketing..." value={fnName} onChange={e => setFnName(e.target.value)} autoFocus />
            </div>
            <div className="mb-3 mt-1" style={{marginTop:10}}>
              <p className="text-sm text-muted">Existing: {functions.map(f => f.function_name).join(", ") || "None"}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFnModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addFunction} disabled={fnSaving}>{fnSaving ? "Adding..." : "Add Function"}</button>
            </div>
          </div>
        </div>
      )}

      <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
