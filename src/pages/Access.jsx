import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const EMPTY = { email: "", role: "editor" };

export default function Access({ role = "guest", session = {} }) {
  const [invites, setInvites] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regEnabled, setRegEnabled] = useState(true);
  const [updatingReg, setUpdatingReg] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [updatingAutoApprove, setUpdatingAutoApprove] = useState(false);

  const load = async () => {
    setLoading(true);
    const [inviteRes, profileRes, settingsRes] = await Promise.all([
      supabase.from("access_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, role, created_at").in("role", ["admin", "editor"]).order("created_at", { ascending: false }),
      supabase.from("system_settings").select("key, value").in("key", ["registration_enabled", "registration_auto_approve"])
    ]);
    if (inviteRes.error) setMsg({ type: "error", text: inviteRes.error.message });
    else setInvites(inviteRes.data || []);
    setProfiles(profileRes.data || []);
    if (settingsRes.data) {
      const regEnabledSetting = settingsRes.data.find(s => s.key === "registration_enabled");
      const autoApproveSetting = settingsRes.data.find(s => s.key === "registration_auto_approve");
      setRegEnabled(regEnabledSetting ? regEnabledSetting.value === "true" : true);
      setAutoApprove(autoApproveSetting ? autoApproveSetting.value === "true" : false);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createInvite = async () => {
    setMsg(null);
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setMsg({ type: "error", text: "Email is required." });
      return;
    }
    setSaving(true);

    // Check if the user is already registered in the profiles table
    const { data: existingProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("email", email)
      .maybeSingle();

    if (profileErr) {
      setSaving(false);
      setMsg({ type: "error", text: profileErr.message });
      return;
    }

    if (existingProfile) {
      if (confirm(`User with email "${email}" is already registered as a ${existingProfile.role}. Do you want to promote them to ${form.role} directly?`)) {
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ role: form.role })
          .eq("id", existingProfile.id);

        setSaving(false);
        if (updateErr) {
          setMsg({ type: "error", text: updateErr.message });
          return;
        }
        setForm(EMPTY);
        setMsg({ type: "success", text: `User "${email}" promoted to ${form.role} successfully!` });
        load();
        return;
      } else {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from("access_invites")
      .upsert({ email, role: form.role, created_by: session.userId, used_at: null }, { onConflict: "email,role" });
    setSaving(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setForm(EMPTY);
    setMsg({ type: "success", text: "Registration enabled for this email." });
    load();
  };


  const toggleRegistration = async (checked) => {
    setUpdatingReg(true);
    setMsg(null);
    const val = checked ? "true" : "false";
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "registration_enabled", value: val }, { onConflict: "key" });

    setUpdatingReg(false);
    if (error) {
      setMsg({ type: "error", text: "Failed to update registration setting: " + error.message });
    } else {
      setRegEnabled(checked);
      setMsg({ type: "success", text: `General registration has been turned ${checked ? "ON" : "OFF"}.` });
    }
  };

  const toggleAutoApprove = async (checked) => {
    setUpdatingAutoApprove(true);
    setMsg(null);
    const val = checked ? "true" : "false";
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "registration_auto_approve", value: val }, { onConflict: "key" });

    setUpdatingAutoApprove(false);
    if (error) {
      setMsg({ type: "error", text: "Failed to update auto-approve setting: " + error.message });
    } else {
      setAutoApprove(checked);
      setMsg({ type: "success", text: `Auto-approve registrations has been turned ${checked ? "ON" : "OFF"}.` });
    }
  };


  const revokeInvite = async (id) => {
    if (!confirm("Revoke this registration access?")) return;
    const { error } = await supabase.from("access_invites").delete().eq("id", id);
    if (error) setMsg({ type: "error", text: error.message });
    else load();
  };

  const removeEditorAccess = async (id) => {
    if (!confirm("Are you sure you want to remove editor access for this user? They will be demoted to a regular member.")) return;
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role: "member" })
      .eq("id", id);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Editor access removed successfully." });
      load();
    }
  };


  if (role !== "admin") {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="icon">*</div>
          <p>Only admins can manage registration access.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">admin_panel_settings</span></span> Access</h1>
        <p className="page-subtitle">enable registration for new admins and editors</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: 16, border: "1px solid rgba(0, 98, 255, 0.15)", background: "rgba(0, 98, 255, 0.03)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>General Member Registration</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                Enable or disable new user signups from the public landing page.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: regEnabled ? "var(--green)" : "var(--text-secondary)" }}>
                {regEnabled ? "Active (ON)" : "Disabled (OFF)"}
              </span>
              <label className="switch" style={{ position: "relative", display: "inline-block", width: "50px", height: "26px" }}>
                <input 
                  type="checkbox" 
                  checked={regEnabled} 
                  disabled={updatingReg}
                  onChange={e => toggleRegistration(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: "absolute",
                  cursor: "pointer",
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: regEnabled ? "#0062ff" : "#ccc",
                  transition: ".4s",
                  borderRadius: "34px",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  <span style={{
                    position: "absolute",
                    content: '""',
                    height: "20px", width: "20px",
                    left: regEnabled ? "26px" : "3px",
                    bottom: "2px",
                    backgroundColor: "white",
                    transition: ".4s",
                    borderRadius: "50%",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }} />
                </span>
              </label>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed rgba(0, 98, 255, 0.15)", margin: 0 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Auto-Approve Registrations</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                Enable to automatically approve new members upon registration. If disabled, they must be manually approved by staff.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: autoApprove ? "var(--green)" : "var(--text-secondary)" }}>
                {autoApprove ? "Active (ON)" : "Disabled (OFF)"}
              </span>
              <label className="switch" style={{ position: "relative", display: "inline-block", width: "50px", height: "26px" }}>
                <input 
                  type="checkbox" 
                  checked={autoApprove} 
                  disabled={updatingAutoApprove}
                  onChange={e => toggleAutoApprove(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: "absolute",
                  cursor: "pointer",
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: autoApprove ? "#0062ff" : "#ccc",
                  transition: ".4s",
                  borderRadius: "34px",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  <span style={{
                    position: "absolute",
                    content: '""',
                    height: "20px", width: "20px",
                    left: autoApprove ? "26px" : "3px",
                    bottom: "2px",
                    backgroundColor: "white",
                    transition: ".4s",
                    borderRadius: "50%",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }} />
                </span>
              </label>
            </div>
          </div>

        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Add Staff Member (Invite or Promote)</span>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="person@example.com" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group access-action">
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={createInvite} disabled={saving}>
              {saving ? "Saving..." : "Add Staff User"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Registration Invites</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {invites.length === 0 ? (
                    <tr><td colSpan="4"><div className="empty-state"><p>No invites yet</p></div></td></tr>
                  ) : invites.map(invite => (
                    <tr key={invite.id}>
                      <td>{invite.email}</td>
                      <td><span className="badge badge-purple">{invite.role}</span></td>
                      <td>{invite.used_at ? <span className="badge badge-green">Used</span> : <span className="badge badge-amber">Open</span>}</td>
                      <td>
                        {!invite.used_at && (
                          <button className="btn btn-danger btn-sm" onClick={() => revokeInvite(invite.id)}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Current Staff Users</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
                <tbody>
                  {profiles.length === 0 ? (
                    <tr><td colSpan="4"><div className="empty-state"><p>No staff users found</p></div></td></tr>
                  ) : profiles.map(profile => (
                    <tr key={profile.id}>
                      <td><strong>{profile.full_name || "-"}</strong></td>
                      <td>{profile.email}</td>
                      <td><span className="badge badge-purple">{profile.role}</span></td>
                      <td>
                        {profile.role === "editor" && (
                          <button className="btn btn-danger btn-sm" onClick={() => removeEditorAccess(profile.id)}>Remove Access</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
