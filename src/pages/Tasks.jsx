import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const EMPTY_FORM = { st_id: "", task_name: "", deadline: "" };

export default function Tasks({ isAdmin = false, session }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [tasks, setTasks] = useState([]);
  const [ocMembers, setOcMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    if (!session?.stId && !isAdmin) {
      setEvents([]);
      setSelectedEvent("");
      setTasks([]);
      setOcMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let query = supabase.from("events").select("*");

    if (!isAdmin && session?.stId) {
      const { data: memberOc } = await supabase
        .from("oc")
        .select("event_id")
        .eq("st_id", session.stId)
        .eq("apply_status", "Accept");

      const acceptedEventIds = memberOc?.map(o => o.event_id) || [];

      if (acceptedEventIds.length > 0) {
        query = query.or(`oc_st_id.eq.${session.stId},event_id.in.(${acceptedEventIds.map(id => `"${id}"`).join(",")})`);
      } else {
        query = query.eq("oc_st_id", session.stId);
      }
    }

    const { data, error } = await query.order("date", { ascending: false });

    if (error) {
      console.error("Error loading events:", error);
      setLoading(false);
    } else {
      setEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEvent(data[0].event_id);
      } else {
        setSelectedEvent("");
        setTasks([]);
        setOcMembers([]);
        setLoading(false);
      }
    }
  };

  const loadTasksAndOc = async (eventId) => {
    if (!eventId) {
      setTasks([]);
      setOcMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);

    const selectedEventInfo = events.find(e => e.event_id === eventId);
    const isOcPresident = selectedEventInfo && selectedEventInfo.oc_st_id === session?.stId;
    const canManage = isOcPresident || isAdmin;

    let tasksQuery = supabase
      .from("tasks")
      .select("*, members(name)")
      .eq("event_id", eventId);

    if (!canManage && session?.stId) {
      tasksQuery = tasksQuery.eq("st_id", session.stId);
    }

    const [tasksRes, ocRes] = await Promise.all([
      tasksQuery.order("created_at", { ascending: false }),
      supabase
        .from("oc")
        .select("st_id, oc_position, members(name), functions(function_name)")
        .eq("event_id", eventId)
        .eq("apply_status", "Accept")
        .order("st_id")
    ]);

    if (tasksRes.error) {
      console.error("Error loading tasks:", tasksRes.error);
    } else {
      setTasks(tasksRes.data || []);
    }

    if (ocRes.error) {
      console.error("Error loading OC members:", ocRes.error);
    } else {
      setOcMembers(ocRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, [session, isAdmin]);

  useEffect(() => {
    if (selectedEvent) {
      loadTasksAndOc(selectedEvent);
    }
  }, [selectedEvent, events]);

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);
  const isOcPresident = selectedEventInfo && selectedEventInfo.oc_st_id === session?.stId;
  const canManage = isOcPresident || isAdmin;

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => {
    setModal(false);
    setMsg(null);
  };

  const handleSave = async () => {
    if (!selectedEvent) {
      setMsg({ type: "error", text: "Select an event first." });
      return;
    }
    if (!form.st_id) {
      setMsg({ type: "error", text: "Please select an assignee." });
      return;
    }
    if (!form.task_name.trim()) {
      setMsg({ type: "error", text: "Task details are required." });
      return;
    }

    setSaving(true);
    const payload = {
      event_id: selectedEvent,
      st_id: form.st_id,
      task_name: form.task_name.trim(),
      deadline: form.deadline || null,
      status: "Pending"
    };

    const { error } = await supabase.from("tasks").insert([payload]);
    setSaving(false);

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Task created successfully." });
      loadTasksAndOc(selectedEvent);
      setTimeout(closeModal, 800);
    }
  };

  const handleComplete = async (taskId) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "Completed" })
      .eq("id", taskId);

    if (error) {
      alert(error.message);
    } else {
      loadTasksAndOc(selectedEvent);
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      alert(error.message);
    } else {
      loadTasksAndOc(selectedEvent);
    }
  };

  // Stats calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "Completed").length;
  const pendingTasks = totalTasks - completedTasks;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">✓</span> Committee Tasks</h1>
        <p className="page-subtitle">
          {selectedEventInfo
            ? `Tasks for "${selectedEventInfo.name}"`
            : "Assign and track responsibilities for event organizing committees"}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">📅</div>
            <p>Create an event first to manage OC tasks.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-3" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Select Event</span>
              {selectedEventInfo && (
                <span className="badge badge-purple">
                  OC President: {selectedEventInfo.oc_st_id || "Unassigned"}
                </span>
              )}
            </div>
            <select
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
              style={{ width: "100%" }}
            >
              {events.map(e => (
                <option key={e.event_id} value={e.event_id}>
                  {e.name} - {e.date}
                </option>
              ))}
            </select>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Total Tasks</div>
              <div className="stat-value">{totalTasks}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Completed</div>
              <div className="stat-value">{completedTasks}</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Pending</div>
              <div className="stat-value">{pendingTasks}</div>
            </div>
          </div>

          <div className="toolbar">
            <div className="toolbar-left">
              {canManage && (
                <button className="btn btn-primary" onClick={openAddModal}>
                  + Add OC Task
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loader">
              <div className="spinner" />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task Details</th>
                    <th>Assigned To</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="empty-state">
                          <div className="icon">✓</div>
                          <p>No tasks assigned for this event committee yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tasks.map(t => {
                      const isAssignee = t.st_id === session?.stId;
                      return (
                        <tr key={t.id}>
                          <td>
                            <span
                              style={{
                                textDecoration: t.status === "Completed" ? "line-through" : "none",
                                opacity: t.status === "Completed" ? 0.6 : 1,
                                fontWeight: 500
                              }}
                            >
                              {t.task_name}
                            </span>
                          </td>
                          <td>
                            <strong className="mono">{t.st_id}</strong>
                            <div style={{ fontSize: "12px", color: "var(--text2)" }}>
                              {t.members?.name || "Unknown Member"}
                            </div>
                          </td>
                          <td className="mono">{t.deadline || "No deadline"}</td>
                          <td>
                            {t.status === "Completed" ? (
                              <span className="badge badge-green">Completed</span>
                            ) : (
                              <span className="badge badge-amber">Pending</span>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {t.status === "Pending" && isAssignee && (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleComplete(t.id)}
                                >
                                  Done
                                </button>
                              )}
                              {canManage && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(t.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Create OC Task</h2>
              <button className="modal-close" onClick={closeModal}>
                x
              </button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Assign to OC Member *</label>
              {ocMembers.length === 0 ? (
                <div style={{ color: "var(--text-danger)", fontSize: "14px", marginTop: "5px" }}>
                  ⚠️ No accepted OC members found for this event. Add and accept them in the Committee tab first.
                </div>
              ) : (
                <select
                  value={form.st_id}
                  onChange={e => setForm({ ...form, st_id: e.target.value })}
                >
                  <option value="">-- Select Member --</option>
                  {ocMembers.map(m => (
                    <option key={m.st_id} value={m.st_id}>
                      {m.members?.name || m.st_id} ({m.oc_position || "Member"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Task Description / Name *</label>
              <textarea
                placeholder="What needs to be done?"
                rows="3"
                value={form.task_name}
                onChange={e => setForm({ ...form, task_name: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Deadline Date</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || ocMembers.length === 0}
              >
                {saving ? "Saving..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
