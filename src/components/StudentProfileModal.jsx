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
        
        <div style={{ display: "flex", gap: "20px", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "20px", marginBottom: "20px" }}>
          <div style={{ flexShrink: 0 }}>
            {profileTarget.profile_image_url ? (
              <img 
                src={profileTarget.profile_image_url} 
                alt={profileTarget.name} 
                style={{ width: "90px", height: "90px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--accent)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(profileTarget.name);
                }}
              />
            ) : (
              <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "var(--bg3)", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--text3)" }}>
                👤
              </div>
            )}
          </div>
          
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <label>Full Name</label>
              <div style={{ fontSize: "20px", fontWeight: "800", marginTop: "4px", color: "var(--text)" }}>{profileTarget.name}</div>
              {profileTarget.st_position && (
                <span className="badge badge-purple" style={{ marginTop: "6px" }}>{profileTarget.st_position}</span>
              )}
              {profileTarget.member_function && (
                <span className="badge badge-gray" style={{ marginTop: "6px", marginLeft: "6px" }}>{profileTarget.member_function}</span>
              )}
            </div>
            <div style={{ textAlign: "right", minWidth: "120px" }}>
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
        </div>

        <div className="form-row" style={{ background: "var(--bg3)", padding: "12px 16px", borderRadius: "var(--r)", marginBottom: "12px", border: "1px solid var(--border)" }}>
          <div className="form-group">
            <label>Member Function</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profileTarget.member_function || <span className="text-muted">Not assigned</span>}
            </div>
          </div>
        </div>

        <div className="form-row form-row-3" style={{ background: "var(--bg3)", padding: "12px 16px", borderRadius: "var(--r)", marginBottom: "20px", border: "1px solid var(--border)" }}>
          <div className="form-group">
            <label>📧 Email Address</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profileTarget.email ? (
                <a href={`mailto:${profileTarget.email}`} style={{ color: "var(--accent2)", textDecoration: "none" }}>{profileTarget.email}</a>
              ) : (
                <span className="text-muted">Not provided</span>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>📞 Mobile Number</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profileTarget.mobile_number ? (
                <a href={`tel:${profileTarget.mobile_number}`} style={{ color: "var(--text)", textDecoration: "none" }}>{profileTarget.mobile_number}</a>
              ) : (
                <span className="text-muted">Not provided</span>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>🔗 LinkedIn Profile</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profileTarget.linkedin_url ? (
                <a href={profileTarget.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  View LinkedIn ↗
                </a>
              ) : (
                <span className="text-muted">Not provided</span>
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
