import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import PhoneContact from "../components/PhoneContact";

export default function MyInfo({ session }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    profile_image_url: "",
    mobile_number: "",
    linkedin_url: "",
    st_position: "",
    member_function: ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestModal, setRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ name_on_letter: "", selected_events: [], additional_details: "" });
  const [settings, setSettings] = useState({
    letter_show_name: true,
    letter_show_events: true,
    letter_show_details: true,
    member_edit_name: false,
    member_edit_photo: true,
    member_edit_whatsapp: false,
    member_edit_linkedin: true,
    member_edit_position: false,
    member_edit_function: false
  });
  const [thisYearEvents, setThisYearEvents] = useState([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);

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
      name: profile?.name || "",
      profile_image_url: profile?.profile_image_url || "",
      mobile_number: profile?.mobile_number || "",
      linkedin_url: profile?.linkedin_url || "",
      st_position: profile?.st_position || "",
      member_function: profile?.member_function || ""
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
      const updates = {};
      const profileUpdates = {};

      if (settings.member_edit_name) {
        if (!editForm.name.trim()) {
          throw new Error("Full Name cannot be empty.");
        }
        updates.name = editForm.name.trim();
        profileUpdates.full_name = editForm.name.trim();
      }

      if (settings.member_edit_photo) {
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

        updates.profile_image_url = finalImageUrl;
      }

      if (settings.member_edit_whatsapp) {
        updates.mobile_number = editForm.mobile_number.trim() || null;
      }

      if (settings.member_edit_linkedin) {
        updates.linkedin_url = editForm.linkedin_url.trim() || null;
      }

      if (settings.member_edit_position) {
        updates.st_position = editForm.st_position.trim() || null;
      }

      if (settings.member_edit_function) {
        updates.member_function = editForm.member_function.trim() || null;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No editable fields are enabled by the administrator.");
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("st_id", session.stId);

      if (error) throw error;

      if (profileUpdates.full_name) {
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("st_id", session.stId);
      }

      setProfile(prev => ({
        ...prev,
        ...updates
      }));

      setMsg({ type: "success", text: "Profile updated successfully!" });
      setTimeout(closeEditModal, 800);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("letter_requests")
        .select("*")
        .eq("st_id", session.stId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("Error loading letter requests:", err);
    }
  };

  const loadSettingsAndEvents = async () => {
    try {
      const [settingsRes, eventsRes] = await Promise.all([
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", [
            "letter_show_name", "letter_show_events", "letter_show_details",
            "member_edit_name", "member_edit_photo", "member_edit_whatsapp",
            "member_edit_linkedin", "member_edit_position", "member_edit_function"
          ]),
        supabase
          .from("events")
          .select("event_id, name, date")
          .gte("date", `${new Date().getFullYear()}-01-01`)
          .lte("date", `${new Date().getFullYear()}-12-31`)
          .order("date", { ascending: false })
      ]);

      if (settingsRes.data) {
        const config = {};
        settingsRes.data.forEach(item => {
          config[item.key] = item.value === "true";
        });
        setSettings(prev => ({ ...prev, ...config }));
      }

      if (eventsRes.data) {
        setThisYearEvents(eventsRes.data);
      }
    } catch (err) {
      console.error("Error loading settings/events:", err);
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

    Promise.all([loadInfo(), loadRequests(), loadSettingsAndEvents()]);
  }, [session.stId]);

  const openRequestModal = () => {
    setRequestForm({
      name_on_letter: profile?.name || "",
      selected_events: [],
      additional_details: ""
    });
    setMsg(null);
    setRequestModal(true);
  };

  const closeRequestModal = () => {
    setRequestModal(false);
    setMsg(null);
  };

  const handleSubmitRequest = async () => {
    setSubmittingRequest(true);
    setMsg(null);
    try {
      const payload = {
        st_id: session.stId,
        name_on_letter: settings.letter_show_name ? requestForm.name_on_letter.trim() : null,
        selected_events: settings.letter_show_events ? requestForm.selected_events : [],
        additional_details: settings.letter_show_details ? requestForm.additional_details.trim() : null,
        status: "not start"
      };

      const { error } = await supabase.from("letter_requests").insert(payload);
      if (error) throw error;
      
      setMsg({ type: "success", text: "Appreciation letter request submitted successfully!" });
      await loadRequests();
      setTimeout(closeRequestModal, 800);
    } catch (err) {
      console.error("Error submitting letter request:", err);
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmittingRequest(false);
    }
  };

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
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">person</span></span> My Information</h1>
        <p className="page-subtitle">View your profile details, attendance records, and committee assignments</p>
      </div>

      <div className="card mb-3" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="card-title">Personal Profile</span>
          <div className="gap-2" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={openEditModal}>
              ✏️ Edit Profile
            </button>
            <button className="btn btn-ghost btn-sm" onClick={openRequestModal} style={{ color: "var(--accent)" }}>
              📄 Request Letter
            </button>
          </div>
        </div>

        <div className="profile-card-body">
          {/* Top section: Avatar and Primary Details */}
          <div className="profile-header-main">
            <div className="profile-avatar-container">
              {profile.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile.name}
                  className="profile-avatar-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(profile.name);
                  }}
                />
              ) : (
                <div className="profile-avatar-placeholder">👤</div>
              )}
            </div>

            <div className="profile-title-container">
              <h2 className="profile-name-heading">{profile.name}</h2>
              <div className="profile-badges-row">
                <span className="badge badge-purple">{profile.st_id}</span>
                {profile.level && (
                  <span className="badge badge-gray">Year {profile.level}</span>
                )}
              </div>
              <div className="profile-position-sub">{profile.st_position || "Regular Member"}</div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="profile-details-grid">
            <div className="profile-detail-item">
              <span className="profile-detail-label">Member Function</span>
              <span className="profile-detail-value">{profile.member_function || "Not assigned"}</span>
            </div>
            <div className="profile-detail-item">
              <span className="profile-detail-label">📧 Email Address</span>
              <span className="profile-detail-value" style={{ overflowWrap: "break-word", wordBreak: "break-all" }}>
                {profile.email ? (
                  <a href={`mailto:${profile.email}`}>{profile.email}</a>
                ) : (
                  <span className="text-muted">Not provided</span>
                )}
              </span>
            </div>
            <div className="profile-detail-item">
              <span className="profile-detail-label">📞 Mobile Number</span>
              <span className="profile-detail-value">
                <PhoneContact phone={profile.mobile_number} />
              </span>
            </div>
            <div className="profile-detail-item">
              <span className="profile-detail-label">🔗 LinkedIn Profile</span>
              <span className="profile-detail-value">
                {profile.linkedin_url ? (
                  <a href={profile.linkedin_url.trim().toLowerCase().startsWith("http") ? profile.linkedin_url.trim() : "https://" + profile.linkedin_url.trim()} target="_blank" rel="noopener noreferrer" className="linkedin-link">
                    View LinkedIn ↗
                  </a>
                ) : (
                  <span className="text-muted">Not provided</span>
                )}
              </span>
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
              <table className="table-fit">
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
              <table className="table-fit">
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

            {!settings.member_edit_name &&
             !settings.member_edit_photo &&
             !settings.member_edit_whatsapp &&
             !settings.member_edit_linkedin &&
             !settings.member_edit_position &&
             !settings.member_edit_function ? (
              <div className="alert alert-error" style={{ marginBottom: 20 }}>
                Profile field editing is currently disabled by the society administrator.
              </div>
            ) : (
              <>
                {settings.member_edit_name && (
                  <div className="form-group" style={{ marginBottom: 15 }}>
                    <label>Full Name</label>
                    <input
                      placeholder="Enter full name"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>
                )}

                {settings.member_edit_photo && (
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
                )}

                {settings.member_edit_whatsapp && (
                  <div className="form-group" style={{ marginBottom: 15 }}>
                    <label>WhatsApp / Mobile Number</label>
                    <input
                      placeholder="e.g. +94771234567"
                      value={editForm.mobile_number}
                      onChange={e => setEditForm({ ...editForm, mobile_number: e.target.value })}
                    />
                  </div>
                )}

                {settings.member_edit_linkedin && (
                  <div className="form-group" style={{ marginBottom: 15 }}>
                    <label>LinkedIn Profile URL</label>
                    <input
                      placeholder="e.g. https://linkedin.com/in/username"
                      value={editForm.linkedin_url}
                      onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                    />
                  </div>
                )}

                {settings.member_edit_position && (
                  <div className="form-group" style={{ marginBottom: 15 }}>
                    <label>Position</label>
                    <input
                      placeholder="e.g. Committee Member"
                      value={editForm.st_position}
                      onChange={e => setEditForm({ ...editForm, st_position: e.target.value })}
                    />
                  </div>
                )}

                {settings.member_edit_function && (
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label>Function Name</label>
                    <select
                      value={editForm.member_function}
                      onChange={e => setEditForm({ ...editForm, member_function: e.target.value })}
                    >
                      <option value="">Select Function</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operation & Academic Management">Operation & Academic Management</option>
                      <option value="Personal Development">Personal Development</option>
                      <option value="Public Relations">Public Relations</option>
                      <option value="Research & Analyst">Research & Analyst</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveProfile}
                disabled={saving || (!settings.member_edit_name && !settings.member_edit_photo && !settings.member_edit_whatsapp && !settings.member_edit_linkedin && !settings.member_edit_position && !settings.member_edit_function)}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Appreciation Letter Requests History */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-header">
          <span className="card-title">📄 Appreciation Letter Requests History</span>
        </div>
        {requests.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px 10px" }}>
            <div className="icon">📄</div>
            <p>No letter requests submitted yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name on Letter</th>
                  <th>Events Included</th>
                  <th>Additional Info</th>
                  <th>Request Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name_on_letter || <span className="text-muted">—</span>}</td>
                    <td>
                      {r.selected_events && Array.isArray(r.selected_events) && r.selected_events.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {r.selected_events.map((e, idx) => (
                            <span key={idx} className="badge badge-purple" style={{ fontSize: "10px", padding: "2px 6px" }}>{e}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{r.additional_details || <span className="text-muted">—</span>}</td>
                    <td className="mono">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${r.status === "done" ? "badge-green" : r.status === "inprogress" ? "badge-purple" : "badge-amber"}`} style={{ textTransform: "uppercase", fontSize: "10px" }}>
                        {r.status === "not start" ? "not started" : r.status === "inprogress" ? "in progress" : r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Appreciation Letter Modal */}
      {requestModal && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && closeRequestModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Request Appreciation Letter</h2>
              <button className="modal-close" onClick={closeRequestModal}>x</button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <p style={{ color: "var(--text2)", fontSize: "12px", marginBottom: "15px" }}>
              Submit a request for an official appreciation letter documenting your contributions for this year.
            </p>

            {settings.letter_show_name && (
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label>Name on Letter</label>
                <input
                  placeholder="Enter the name as it should appear on the certificate/letter"
                  value={requestForm.name_on_letter}
                  onChange={e => setRequestForm({ ...requestForm, name_on_letter: e.target.value })}
                  required
                />
              </div>
            )}

            {settings.letter_show_events && (
              <div className="form-group" style={{ marginBottom: 15 }}>
                <label>Select This Year's Events (Which you participated/organized)</label>
                {thisYearEvents.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: "12px" }}>No events found for this year.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", border: "1px solid var(--border)", padding: "10px", borderRadius: "var(--r)", background: "var(--bg3)", marginTop: "6px" }}>
                    {thisYearEvents.map(e => (
                      <label key={e.event_id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="checkbox"
                          checked={requestForm.selected_events.includes(e.name)}
                          onChange={(evt) => {
                            const name = e.name;
                            if (evt.target.checked) {
                              setRequestForm(prev => ({ ...prev, selected_events: [...prev.selected_events, name] }));
                            } else {
                              setRequestForm(prev => ({ ...prev, selected_events: prev.selected_events.filter(n => n !== name) }));
                            }
                          }}
                          style={{ width: "14px", height: "14px", cursor: "pointer" }}
                        />
                        <span>{e.name}</span> <span className="text-muted" style={{ fontSize: "11px" }}>({e.date})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {settings.letter_show_details && (
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Additional Request Details</label>
                <textarea
                  placeholder="Describe your specific contributions, departments, roles, or special requests..."
                  rows={4}
                  value={requestForm.additional_details}
                  onChange={e => setRequestForm({ ...requestForm, additional_details: e.target.value })}
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeRequestModal} disabled={submittingRequest}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitRequest} disabled={submittingRequest}>
                {submittingRequest ? "Submitting..." : "Submit Request"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
