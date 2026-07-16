import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function Letters({ session }) {
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({
    letter_show_name: true,
    letter_show_events: true,
    letter_show_details: true
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMember, setSelectedMember] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, settingsRes] = await Promise.all([
        supabase
          .from("letter_requests")
          .select("*, members(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["letter_show_name", "letter_show_events", "letter_show_details"])
      ]);

      if (reqRes.error) throw reqRes.error;
      setRequests(reqRes.data || []);

      if (settingsRes.data) {
        const config = {};
        settingsRes.data.forEach(item => {
          config[item.key] = item.value === "true";
        });
        setSettings(prev => ({ ...prev, ...config }));
      }
    } catch (err) {
      console.error("Error loading letters data:", err);
      setMsg({ type: "error", text: "Failed to load data: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSetting = async (key) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: newValue ? "true" : "false" })
        .eq("key", key);
      if (error) throw error;
    } catch (err) {
      console.error("Error toggling setting:", err);
      setMsg({ type: "error", text: "Failed to update configuration: " + err.message });
      // Revert local state
      setSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("letter_requests")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error("Error updating status:", err);
      setMsg({ type: "error", text: "Failed to update request status: " + err.message });
    }
  };

  const handleDeleteRequest = async (id) => {
    if (window.confirm("Are you sure you want to delete this request?")) {
      try {
        const { error } = await supabase
          .from("letter_requests")
          .delete()
          .eq("id", id);
        if (error) throw error;
        setRequests(prev => prev.filter(r => r.id !== id));
        setMsg({ type: "success", text: "Request deleted successfully." });
      } catch (err) {
        console.error("Error deleting request:", err);
        setMsg({ type: "error", text: "Failed to delete request: " + err.message });
      }
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  // Calculate status counts
  const countNotStarted = requests.filter(r => r.status === "not start").length;
  const countInProgress = requests.filter(r => r.status === "inprogress").length;
  const countDone = requests.filter(r => r.status === "done").length;
  const countRejected = requests.filter(r => r.status === "rejected").length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">📄</span> Appreciation Letters</h1>
        <p className="page-subtitle">Review appreciation letter requests and manage visibility settings</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 20 }}>{msg.text}</div>}

      {/* Settings Panel */}
      <div className="card mb-3" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">⚙️ Request Form Settings</span>
        </div>
        <p style={{ color: "var(--text2)", fontSize: "13px", marginBottom: "16px" }}>
          Toggle which input fields are visible to members when requesting appreciation letters on their profile page.
        </p>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={settings.letter_show_name}
              onChange={() => handleToggleSetting("letter_show_name")}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            Show "Name on Letter" Input
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={settings.letter_show_events}
              onChange={() => handleToggleSetting("letter_show_events")}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            Show "This Year's Events" Checkmarks
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={settings.letter_show_details}
              onChange={() => handleToggleSetting("letter_show_details")}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            Show "Additional Request Details" Textbox
          </label>
        </div>
      </div>

      {/* Status Counters */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Not Started</div>
          <div className="stat-value">{countNotStarted}</div>
          <div className="stat-sub">requests pending</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{countInProgress}</div>
          <div className="stat-sub">currently being prepared</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Done</div>
          <div className="stat-value">{countDone}</div>
          <div className="stat-sub">letters issued</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Rejected</div>
          <div className="stat-value">{countRejected}</div>
          <div className="stat-sub">requests rejected</div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span className="card-title">Review Requests</span>
          <div className="tabs" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${filterStatus === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("all")}>All ({requests.length})</button>
            <button className={`btn btn-sm ${filterStatus === "not start" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("not start")}>Not Started ({countNotStarted})</button>
            <button className={`btn btn-sm ${filterStatus === "inprogress" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("inprogress")}>In Progress ({countInProgress})</button>
            <button className={`btn btn-sm ${filterStatus === "done" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("done")}>Done ({countDone})</button>
            <button className={`btn btn-sm ${filterStatus === "rejected" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("rejected")}>Rejected ({countRejected})</button>
          </div>
        </div>

        {loading ? (
          <div className="loader"><div className="spinner" /></div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📄</div>
            <p>No letter requests found in this category.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member (Click to View)</th>
                  <th>Name on Letter</th>
                  <th>Events</th>
                  <th>Additional Details</th>
                  <th>Request Date</th>
                  <th>Status & Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(r => (
                  <tr key={r.id}>
                    <td onClick={() => setSelectedMember(r.members)} style={{ cursor: "pointer" }} title="Click to view member details">
                      <strong style={{ color: "var(--accent)", textDecoration: "underline" }}>{r.members?.name || "Unknown"}</strong>
                      <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>{r.st_id}</div>
                    </td>
                    <td>{r.name_on_letter || <span className="text-muted">—</span>}</td>
                    <td>
                      {r.selected_events && Array.isArray(r.selected_events) && r.selected_events.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {r.selected_events.map((eName, idx) => (
                            <span key={idx} className="badge badge-purple" style={{ fontSize: "11px", display: "inline-block", padding: "2px 6px" }}>
                              {eName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>
                      {r.additional_details || <span className="text-muted">—</span>}
                    </td>
                    <td className="mono" style={{ fontSize: "12px" }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span className={`badge ${r.status === "done" ? "badge-green" : r.status === "rejected" ? "badge-red" : r.status === "inprogress" ? "badge-purple" : "badge-amber"}`} style={{ textAlign: "center", textTransform: "uppercase", fontSize: "10px", padding: "4px 8px" }}>
                          {r.status === "not start" ? "not started" : r.status === "inprogress" ? "in progress" : r.status}
                        </span>
                        
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {r.status !== "not start" && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "4px 6px", fontSize: "11px", border: "1px solid var(--border)" }}
                              onClick={() => handleUpdateStatus(r.id, "not start")}
                            >
                              Reset
                            </button>
                          )}
                          {r.status === "not start" && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: "4px 6px", fontSize: "11px" }}
                              onClick={() => handleUpdateStatus(r.id, "inprogress")}
                            >
                              Start
                            </button>
                          )}
                          {r.status !== "done" && (
                            <button
                              className="btn btn-green btn-sm"
                              style={{ padding: "4px 6px", fontSize: "11px", color: "var(--green)", border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.12)" }}
                              onClick={() => handleUpdateStatus(r.id, "done")}
                            >
                              Done
                            </button>
                          )}
                          {r.status !== "rejected" && (
                            <button
                              className="btn btn-red btn-sm"
                              style={{ padding: "4px 6px", fontSize: "11px", color: "var(--red)", border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.12)" }}
                              onClick={() => handleUpdateStatus(r.id, "rejected")}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 6px", fontSize: "11px", color: "var(--red)", border: "1px solid var(--border)" }}
                            onClick={() => handleDeleteRequest(r.id)}
                            title="Delete Request"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member Details Modal Popup */}
      {selectedMember && (
        <div className="modal-overlay" style={{ zIndex: 120 }} onClick={() => setSelectedMember(null)}>
          <div className="modal" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Member Information</h2>
              <button className="modal-close" onClick={() => setSelectedMember(null)}>x</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              {selectedMember.profile_image_url ? (
                <img
                  src={selectedMember.profile_image_url}
                  alt={selectedMember.name}
                  style={{ width: "90px", height: "90px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--accent)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                />
              ) : (
                <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "var(--bg3)", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--text3)" }}>
                  👤
                </div>
              )}

              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>{selectedMember.name}</h3>
                <span className="badge badge-purple" style={{ marginTop: "4px" }}>{selectedMember.st_id}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg3)", padding: "16px", borderRadius: "var(--r)", border: "1px solid var(--border)", marginBottom: "20px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Level / Year:</span> <strong>{selectedMember.level ? `Year ${selectedMember.level}` : "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Position:</span> <strong>{selectedMember.st_position || "Regular Member"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Function:</span> <strong>{selectedMember.member_function || "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Email:</span> <strong>{selectedMember.email || "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Mobile:</span> <strong>{selectedMember.mobile_number || "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text3)" }}>LinkedIn:</span> 
                <strong>
                  {selectedMember.linkedin_url ? (
                    <a href={selectedMember.linkedin_url.trim().toLowerCase().startsWith("http") ? selectedMember.linkedin_url.trim() : "https://" + selectedMember.linkedin_url.trim()} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)", textDecoration: "none" }}>
                      View Profile ↗
                    </a>
                  ) : "—"}
                </strong>
              </div>
            </div>

            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => setSelectedMember(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
