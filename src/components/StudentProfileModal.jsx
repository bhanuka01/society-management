import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function StudentProfileModal({ stId, onClose }) {
  const [profileTarget, setProfileTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stId) return;
    let isMounted = true;
    
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data: member, error: memberErr } = await supabase
          .from("members")
          .select("*")
          .eq("st_id", stId)
          .maybeSingle();

        if (memberErr) throw memberErr;
        if (!member) {
          alert("Member profile not found.");
          onClose();
          return;
        }

        const { data: ocRecords, error: ocErr } = await supabase
          .from("oc")
          .select("oc_position, apply_status, events(name, date), functions(function_name)")
          .eq("st_id", stId);
        if (ocErr) throw ocErr;

        const { data: attRecords, error: attErr } = await supabase
          .from("attendance")
          .select("attend, events(name, date)")
          .eq("st_id", stId);
        if (attErr) throw attErr;

        if (isMounted) {
          setProfileTarget({
            ...member,
            oc: ocRecords || [],
            attendance: attRecords || []
          });
        }
      } catch (err) {
        if (isMounted) {
          alert("Error loading profile: " + err.message);
          onClose();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    loadProfile();
    return () => { isMounted = false; };
  }, [stId, onClose]);

  if (!stId) return null;

  if (loading || !profileTarget) {
    return (
      <div className="modal-overlay" style={{ zIndex: 110 }}>
        <div className="modal" style={{ maxWidth: "300px", textAlign: "center" }}>
          <div className="loader"><div className="spinner" /></div>
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: "650px", width: "95%" }}>
        <div className="modal-header">
          <h2 className="modal-title">Student Profile</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        
        <div className="form-row form-row-2" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
          <div>
            <label>Full Name</label>
            <div style={{ fontSize: "18px", fontWeight: "700", marginTop: "4px" }}>{profileTarget.name}</div>
            {profileTarget.st_position && (
              <span className="badge badge-purple" style={{ marginTop: "6px" }}>{profileTarget.st_position}</span>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <label>Student ID</label>
            <div className="mono" style={{ fontSize: "15px", marginTop: "4px", color: "var(--text)" }}>{profileTarget.st_id}</div>
            <div style={{ marginTop: "6px" }}>
              {profileTarget.level ? (
                <span className="badge badge-gray">Year {profileTarget.level}</span>
              ) : (
                <span className="text-muted">-</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", marginBottom: "10px", color: "var(--text2)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>
              📅 Attendance History ({profileTarget.attendance.length})
            </h3>
            {profileTarget.attendance.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px" }}><p className="text-muted text-sm">No attendance records found</p></div>
            ) : (
              <div style={{ maxHeight: "200px", overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <table className="csv-preview-table" style={{ border: "none" }}>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileTarget.attendance.map((att, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{att.events?.name || "Unknown Event"}</strong>
                          <div style={{ fontSize: "10px", color: "var(--text3)" }}>{att.events?.date}</div>
                        </td>
                        <td>
                          <span className={`badge ${att.attend === "YES" ? "badge-green" : "badge-red"}`}>
                            {att.attend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", marginBottom: "10px", color: "var(--text2)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>
              🛠 Organizing Committee ({profileTarget.oc.length})
            </h3>
            {profileTarget.oc.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px" }}><p className="text-muted text-sm">No OC assignments found</p></div>
            ) : (
              <div style={{ maxHeight: "200px", overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                <table className="csv-preview-table" style={{ border: "none" }}>
                  <thead>
                    <tr>
                      <th>Event & Function</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileTarget.oc.map((o, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{o.events?.name || "Unknown Event"}</strong>
                          <div style={{ fontSize: "11px", color: "var(--accent2)" }}>{o.functions?.function_name}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: "600" }}>{o.oc_position || "Member"}</div>
                          <div style={{ marginTop: "4px" }}>
                            {o.apply_status === "Accept" ? (
                              <span className="badge badge-green" style={{ fontSize: "9px", padding: "1px 6px" }}>Accepted</span>
                            ) : o.apply_status === "Reject" ? (
                              <span className="badge badge-red" style={{ fontSize: "9px", padding: "1px 6px" }}>Rejected</span>
                            ) : (
                              <span className="badge badge-amber" style={{ fontSize: "9px", padding: "1px 6px" }}>Pending</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
