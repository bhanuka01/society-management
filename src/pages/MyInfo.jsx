import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import PhoneContact from "../components/PhoneContact";

export default function MyInfo({ session }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ profile_image_url: "", linkedin_url: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "Please select a valid image file." });
        return;
      }
      setProfileImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openEditModal = () => {
    setEditForm({
      profile_image_url: profile.profile_image_url || "",
      linkedin_url: profile.linkedin_url || ""
    });
    setProfileImageFile(null);
    setPreviewUrl(null);
    setMsg(null);
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setProfileImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMsg(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      let finalImageUrl = editForm.profile_image_url.trim() || null;

      if (profileImageFile) {
        // Optimize the image to exactly 500x600 px
        const optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);

        // Upload to bucket
        const cleanStId = session.stId.replace(/\//g, "-");
        const fileName = `${cleanStId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("profile_images")
          .upload(fileName, optimizedFile, {
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          throw new Error("Failed to upload profile image: " + uploadError.message);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("profile_images")
          .getPublicUrl(fileName);

        finalImageUrl = urlData?.publicUrl || finalImageUrl;
      }

      const { error } = await supabase
        .from("members")
        .update({
          profile_image_url: finalImageUrl,
          linkedin_url: editForm.linkedin_url.trim() || null
        })
        .eq("st_id", session.stId);

      if (error) throw error;

      setProfile(prev => ({
        ...prev,
        profile_image_url: finalImageUrl,
        linkedin_url: editForm.linkedin_url.trim() || null
      }));

      setMsg({ type: "success", text: "Profile updated successfully!" });
      setTimeout(closeEditModal, 800);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!session.stId) return;

    const loadInfo = async () => {
      setLoading(true);
      try {
        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("st_id", session.stId)
          .maybeSingle();

        if (member) {
          const [ocRecords, attRecords] = await Promise.all([
            supabase
              .from("oc")
              .select("oc_position, apply_status, events(name, date), functions(function_name)")
              .eq("st_id", session.stId),
            supabase
              .from("attendance")
              .select("attend, events(name, date)")
              .eq("st_id", session.stId)
          ]);

          setProfile({
            ...member,
            oc: ocRecords.data || [],
            attendance: attRecords.data || []
          });
        }
      } catch (err) {
        console.error("Error loading info:", err);
      } finally {
        setLoading(false);
      }
    };

    loadInfo();
  }, [session.stId]);

  if (!session.stId) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <div className="empty-state">
          <div className="icon">👤</div>
          <p>This account is not linked to any student member record.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loader"><div className="spinner" /></div>;
  }

  if (!profile) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <div className="empty-state">
          <div className="icon">❓</div>
          <p>Student record ({session.stId}) could not be found in the database.</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalEvents = profile.attendance.length;
  const attendedEvents = profile.attendance.filter(a => a.attend === "YES").length;
  const absentEvents = totalEvents - attendedEvents;
  const attendanceRate = totalEvents ? Math.round((attendedEvents / totalEvents) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">👤</span> My Information</h1>
        <p className="page-subtitle">View your profile details, attendance records, and committee assignments</p>
      </div>

      <div className="card mb-3" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="card-title">Personal Profile</span>
          <div className="flex gap-2" style={{ alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={openEditModal}>
              ✏️ Edit Profile
            </button>
            <span className="badge badge-purple">{profile.st_id}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}>
            {profile.profile_image_url ? (
              <img
                src={profile.profile_image_url}
                alt={profile.name}
                style={{ width: "90px", height: "90px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--accent)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(profile.name);
                }}
              />
            ) : (
              <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "var(--bg3)", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "var(--text3)" }}>
                👤
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Full Name</label>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>
                  {profile.name}
                </div>
              </div>
              <div className="form-group" style={{ textAlign: "right" }}>
                <label>Academic Level</label>
                <div style={{ marginTop: 4 }}>
                  {profile.level ? (
                    <span className="badge badge-gray" style={{ fontSize: 13, padding: "4px 10px" }}>Year {profile.level}</span>
                  ) : (
                    <span className="text-muted">Not specified</span>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Student Position</label>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, color: "var(--text2)" }}>
                  {profile.st_position || "Regular Member"}
                </div>
              </div>
              <div className="form-group">
                <label>Member Function</label>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, color: "var(--text2)" }}>
                  {profile.member_function || "Not assigned"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact and links */}
        <div className="form-row form-row-3" style={{ background: "var(--bg3)", padding: "12px 16px", borderRadius: "var(--r)", marginTop: "20px", border: "1px solid var(--border)" }}>
          <div className="form-group">
            <label>📧 Email Address</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profile.email ? (
                <a href={`mailto:${profile.email}`} style={{ color: "var(--accent2)", textDecoration: "none" }}>{profile.email}</a>
              ) : (
                <span className="text-muted">Not provided</span>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>📞 Mobile Number</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              <PhoneContact phone={profile.mobile_number} />
            </div>
          </div>
          <div className="form-group">
            <label>🔗 LinkedIn Profile</label>
            <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>
              {profile.linkedin_url ? (
                <a href={profile.linkedin_url.trim().toLowerCase().startsWith("http") ? profile.linkedin_url.trim() : "https://" + profile.linkedin_url.trim()} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  View LinkedIn ↗
                </a>
              ) : (
                <span className="text-muted">Not provided</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
        <div className="stat-card green">
          <div className="stat-label">Present</div>
          <div className="stat-value">{attendedEvents}</div>
          <div className="stat-sub">events attended</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Absent</div>
          <div className="stat-value">{absentEvents}</div>
          <div className="stat-sub">events missed</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value">{attendanceRate}%</div>
          <div className="stat-sub">of {totalEvents} registered events</div>
        </div>
      </div>

      {/* Split lists: Attendance & OC */}
      <div className="grid-2">
        {/* Left Column: Attendance Details */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <span className="card-title">📅 Event Attendance History</span>
          </div>
          {profile.attendance.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              <div className="icon">📅</div>
              <p>No event attendance records on file</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.attendance.map((att, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{att.events?.name || "Unknown Event"}</strong>
                        <div style={{ fontSize: "11px", color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>
                          {att.events?.date}
                        </div>
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

        {/* Right Column: OC assignments */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <span className="card-title">🛠 Committee (OC) Assignments</span>
          </div>
          {profile.oc.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              <div className="icon">🛠</div>
              <p>No committee assignments on file</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event & Department</th>
                    <th>Role & Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.oc.map((o, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{o.events?.name || "Unknown Event"}</strong>
                        <div style={{ fontSize: "11px", color: "var(--accent2)", marginTop: 2 }}>
                          {o.functions?.function_name || "Unassigned Sub-team"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--text)" }}>{o.oc_position || "Member"}</div>
                        <div style={{ marginTop: 4 }}>
                          {o.apply_status === "Accept" ? (
                            <span className="badge badge-green" style={{ fontSize: "10px" }}>Accepted</span>
                          ) : o.apply_status === "Reject" ? (
                            <span className="badge badge-red" style={{ fontSize: "10px" }}>Rejected</span>
                          ) : (
                            <span className="badge badge-amber" style={{ fontSize: "10px" }}>Pending</span>
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

      {editModal && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && closeEditModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit Profile Details</h2>
              <button className="modal-close" onClick={closeEditModal}>x</button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label>Profile Image</label>
              <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)", marginTop: "6px" }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile Preview"
                    style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)", flexShrink: 0 }}
                  />
                ) : editForm.profile_image_url ? (
                  <img
                    src={editForm.profile_image_url}
                    alt="Current Profile"
                    style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "var(--bg)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "var(--text3)", flexShrink: 0 }}>
                    👤
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="profile-image-edit-upload"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <label
                    htmlFor="profile-image-edit-upload"
                    className="btn btn-ghost btn-sm"
                    style={{ cursor: "pointer", alignSelf: "flex-start", padding: "4px 12px", border: "1px solid var(--border)" }}
                  >
                    Upload New Photo
                  </label>
                  <span className="text-muted" style={{ fontSize: "11px" }}>
                    {profileImageFile ? `${profileImageFile.name.substring(0, 20)}${profileImageFile.name.length > 20 ? "..." : ""}` : "Using current photo (Auto-resized to 500x600 px)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>LinkedIn Profile URL</label>
              <input
                placeholder="e.g. https://linkedin.com/in/username"
                value={editForm.linkedin_url}
                onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
