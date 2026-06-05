import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";

const EMPTY_FORM = { st_id: "", name: "", level: "", st_position: "", member_function: "", email: "", mobile_number: "", profile_image_url: "", linkedin_url: "" };

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines.filter(r => r.length > 0 && r.some(cell => cell.trim() !== ""));
}

function mapHeaders(headers) {
  const mapping = { st_id: -1, name: -1, level: -1, st_position: -1, member_function: -1, email: -1, mobile_number: -1, profile_image_url: -1, linkedin_url: -1 };
  headers.forEach((h, index) => {
    const clean = h.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (["stid", "studentid", "id", "stno", "studentno", "regno", "registrationno"].includes(clean)) {
      if (mapping.st_id === -1) mapping.st_id = index;
    } else if (["name", "fullname", "studentname", "membername"].includes(clean)) {
      if (mapping.name === -1) mapping.name = index;
    } else if (["level", "year", "academicyear", "studyingyear"].includes(clean)) {
      if (mapping.level === -1) mapping.level = index;
    } else if (["position", "stposition", "studentposition", "role"].includes(clean)) {
      if (mapping.st_position === -1) mapping.st_position = index;
    } else if (["memberfunction", "function", "department", "subteam", "team", "memberdepartment"].includes(clean)) {
      if (mapping.member_function === -1) mapping.member_function = index;
    } else if (["email", "mail", "emailaddress"].includes(clean)) {
      if (mapping.email === -1) mapping.email = index;
    } else if (["mobile", "mobilenumber", "phone", "phonenumber", "tel", "contact", "contactnumber"].includes(clean)) {
      if (mapping.mobile_number === -1) mapping.mobile_number = index;
    } else if (["profileimage", "profileimageurl", "image", "imageurl", "photo", "photourl", "avatar"].includes(clean)) {
      if (mapping.profile_image_url === -1) mapping.profile_image_url = index;
    } else if (["linkedin", "linkedinurl", "linkedinprofile", "linkedinprofileurl"].includes(clean)) {
      if (mapping.linkedin_url === -1) mapping.linkedin_url = index;
    }
  });
  return mapping;
}

export default function Members({ isAdmin = false }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [viewFilter, setViewFilter] = useState("active");

  // CSV Import State
  const [csvModal, setCsvModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState("upsert");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);

  // Member Profile State
  const [profileTarget, setProfileTarget] = useState(null);

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("members")
      .select("*", { count: "exact" })
      .order("st_id")
      .range(from, to);

    if (viewFilter === "active") query = query.lte("level", 4);
    else if (viewFilter === "alumni") query = query.gt("level", 4);

    const q = searchText.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,name.ilike.%${q}%,st_position.ilike.%${q}%`);
    }

    const { data, count } = await query;
    setMembers(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { load(page, search); }, [page, search, viewFilter]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setModal(true); setMsg(null); };
  const openEdit = (m) => {
    setForm({
      st_id: m.st_id,
      name: m.name,
      level: m.level || "",
      st_position: m.st_position || "",
      member_function: m.member_function || "",
      email: m.email || "",
      mobile_number: m.mobile_number || "",
      profile_image_url: m.profile_image_url || "",
      linkedin_url: m.linkedin_url || ""
    });
    setEditTarget(m.st_id);
    setModal(true);
    setMsg(null);
  };
  const closeModal = () => { setModal(false); setMsg(null); };

  const promoteAll = async () => {
    if (!confirm("Are you sure you want to promote all active members to the next level? Level 4 members will become Alumni (Level 5).")) return;
    setLoading(true);
    const { data: activeMembers, error: fetchErr } = await supabase.from("members").select("*").lte("level", 4);
    if (fetchErr) { alert(fetchErr.message); setLoading(false); return; }
    if (!activeMembers || activeMembers.length === 0) { alert("No active members found to promote."); setLoading(false); return; }
    
    const updated = activeMembers.map(m => ({ ...m, level: (parseInt(m.level) || 0) + 1 }));
    const { error: upsertErr } = await supabase.from("members").upsert(updated, { onConflict: "st_id" });
    
    if (upsertErr) alert(upsertErr.message);
    else alert(`Successfully promoted ${updated.length} members.`);
    
    load(page, search);
  };

  // CSV Import Handlers
  const openImportCSV = () => {
    setCsvModal(true);
    setParsedData(null);
    setDuplicateStrategy("upsert");
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
  };

  const closeCsvModal = () => {
    setCsvModal(false);
    setParsedData(null);
    setDuplicateStrategy("upsert");
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
  };

  const downloadTemplate = () => {
    const headers = ["st_id", "name", "email", "level", "st_position", "member_function", "mobile_number", "profile_image_url", "linkedin_url"];
    const rows = [
      ["2022/12345", "John Doe", "john.doe@example.com", "2", "Member", "Logistics", "+94771234567", "https://example.com/john.jpg", "https://linkedin.com/in/johndoe"],
      ["2023/54321", "Jane Smith", "jane.smith@example.com", "1", "Committee Member", "Marketing", "+94777654321", "https://example.com/jane.jpg", "https://linkedin.com/in/janesmith"]
    ];
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "member_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        alert("The CSV file must contain a header row and at least one data row.");
        return;
      }
      
      const headers = parsed[0];
      const rows = parsed.slice(1);
      const mapping = mapHeaders(headers);
      
      const validRows = [];
      const invalidRows = [];
      const errors = [];
      
      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const st_id = mapping.st_id !== -1 ? row[mapping.st_id]?.trim() : "";
        const name = mapping.name !== -1 ? row[mapping.name]?.trim() : "";
        const email = mapping.email !== -1 ? row[mapping.email]?.trim() : "";
        const levelRaw = mapping.level !== -1 ? row[mapping.level]?.trim() : "";
        const st_position = mapping.st_position !== -1 ? row[mapping.st_position]?.trim() : "";
        const member_function = mapping.member_function !== -1 ? row[mapping.member_function]?.trim() : "";
        const mobile_number = mapping.mobile_number !== -1 ? row[mapping.mobile_number]?.trim() : "";
        const profile_image_url = mapping.profile_image_url !== -1 ? row[mapping.profile_image_url]?.trim() : "";
        const linkedin_url = mapping.linkedin_url !== -1 ? row[mapping.linkedin_url]?.trim() : "";
        
        let rowValid = true;
        if (!st_id) {
          errors.push(`Row ${rowNum}: Student ID is missing.`);
          rowValid = false;
        }
        if (!name) {
          errors.push(`Row ${rowNum}: Full Name is missing.`);
          rowValid = false;
        }
        
        let level = null;
        if (levelRaw) {
          const parsedLevel = parseInt(levelRaw, 10);
          if (isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 6) {
            errors.push(`Row ${rowNum}: Level/Year "${levelRaw}" is invalid (must be 1-6). Set to empty.`);
            level = null;
          } else {
            level = parsedLevel;
          }
        }
        
        const payload = {
          st_id: st_id || "",
          name: name || "",
          email: email || null,
          level: level,
          st_position: st_position || null,
          member_function: member_function || null,
          mobile_number: mobile_number || null,
          profile_image_url: profile_image_url || null,
          linkedin_url: linkedin_url || null
        };
        
        if (rowValid) {
          validRows.push(payload);
        } else {
          invalidRows.push(payload);
        }
      });
      
      setParsedData({
        headers,
        rows,
        mapping,
        validRows,
        invalidRows,
        errors
      });
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!parsedData || parsedData.validRows.length === 0) return;
    
    setImporting(true);
    setImportProgress(10);
    
    const batchSize = 100;
    
    if (duplicateStrategy === "ignore") {
      const { data: existing, error: fetchErr } = await supabase.from("members").select("st_id");
      if (fetchErr) {
        alert("Error checking duplicates: " + fetchErr.message);
        setImporting(false);
        return;
      }
      const existingSet = new Set(existing.map(m => m.st_id));
      const toInsert = parsedData.validRows.filter(row => !existingSet.has(row.st_id));
      const skippedCount = parsedData.validRows.length - toInsert.length;
      
      if (toInsert.length === 0) {
        setImportResult({
          success: 0,
          skipped: skippedCount,
          failed: 0,
          validationSkipped: parsedData.invalidRows.length
        });
        setImporting(false);
        load(page, search);
        return;
      }
      
      let inserted = 0;
      let failed = 0;
      
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const chunk = toInsert.slice(i, i + batchSize);
        const { error: insertErr } = await supabase.from("members").insert(chunk);
        if (insertErr) {
          failed += chunk.length;
          console.error(insertErr);
        } else {
          inserted += chunk.length;
        }
        setImportProgress(Math.min(95, Math.round(((i + chunk.length) / toInsert.length) * 80) + 10));
      }
      
      setImportProgress(100);
      setImportResult({
        success: inserted,
        skipped: skippedCount,
        failed: failed,
        validationSkipped: parsedData.invalidRows.length
      });
    } else {
      // Upsert strategy
      const toUpsert = parsedData.validRows;
      let upserted = 0;
      let failed = 0;
      
      for (let i = 0; i < toUpsert.length; i += batchSize) {
        const chunk = toUpsert.slice(i, i + batchSize);
        const { error: upsertErr } = await supabase.from("members").upsert(chunk, { onConflict: "st_id" });
        if (upsertErr) {
          failed += chunk.length;
          console.error(upsertErr);
        } else {
          upserted += chunk.length;
        }
        setImportProgress(Math.min(100, Math.round(((i + chunk.length) / toUpsert.length) * 90) + 10));
      }
      
      setImportProgress(100);
      setImportResult({
        success: upserted,
        skipped: 0,
        failed: failed,
        validationSkipped: parsedData.invalidRows.length
      });
    }
    
    setImporting(false);
    load(page, search);
  };

  const openViewProfile = (stId) => {
    setProfileTarget(stId);
  };

  const handleSave = async () => {
    if (!form.st_id.trim() || !form.name.trim()) {
      setMsg({ type: "error", text: "ST ID and Name are required." }); return;
    }
    setSaving(true);
    const payload = { 
      st_id: form.st_id.trim(), 
      name: form.name.trim(), 
      email: form.email.trim() || null,
      level: form.level ? parseInt(form.level) : null, 
      st_position: form.st_position.trim() || null,
      member_function: form.member_function.trim() || null,
      mobile_number: form.mobile_number.trim() || null,
      profile_image_url: form.profile_image_url.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from("members").update(payload).eq("st_id", editTarget));
    } else {
      ({ error } = await supabase.from("members").insert([payload]));
    }
    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: editTarget ? "Member updated." : "Member added." });
    load(page, search);
    setTimeout(closeModal, 800);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete member ${id}? This will also remove their OC and attendance records.`)) return;
    const { error } = await supabase.from("members").delete().eq("st_id", id);
    if (error) alert(error.message);
    else load(page, search);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">*</span> Members</h1>
        <p className="page-subtitle">{total} registered students</p>
      </div>

      <div className="toolbar" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div className="search-input-wrap">
          <span className="search-icon">?</span>
          <input placeholder="Search by ID, name, position..." value={search} onChange={e => { setPage(0); setSearch(e.target.value); }} />
        </div>
        
        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>View:</label>
          <select 
            value={viewFilter} 
            onChange={e => { setPage(0); setViewFilter(e.target.value); }}
            style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
          >
            <option value="active">Active Members</option>
            <option value="alumni">Alumni (Level 5+)</option>
            <option value="all">All Members</option>
          </select>
        </div>

        {isAdmin && (
          <div className="flex gap-2" style={{ marginLeft: "auto", flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={openImportCSV}>Import CSV</button>
            <button className="btn btn-ghost" onClick={promoteAll} style={{ color: "var(--accent)" }}>Promote All</button>
            <button className="btn btn-primary" onClick={openAdd}>+ Add Member</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ST ID</th><th>Name</th><th>Email</th><th>Level</th><th>Position</th><th>Function</th>{isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6}><div className="empty-state"><div className="icon">*</div><p>No members found</p></div></td></tr>
              ) : members.map(m => (
                <tr key={m.st_id}>
                  <td className="mono">{m.st_id}</td>
                  <td>
                    <strong 
                      className="clickable-member" 
                      onClick={() => openViewProfile(m.st_id)}
                      style={{ cursor: "pointer", color: "var(--accent2)" }}
                    >
                      {m.name}
                    </strong>
                  </td>
                  <td>{m.email || <span className="text-muted">-</span>}</td>
                  <td>{m.level ? <span className="badge badge-purple">Year {m.level}</span> : <span className="text-muted">-</span>}</td>
                  <td>{m.st_position || <span className="text-muted">-</span>}</td>
                  <td>{m.member_function || <span className="text-muted">-</span>}</td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.st_id)}>Delete</button>
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
              <h2 className="modal-title">{editTarget ? "Edit Member" : "Add New Member"}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="form-row form-row-2">
              <div className="form-group">
                <label>ST ID *</label>
                <input placeholder="e.g. 2022/12984" value={form.st_id} onChange={e => setForm({...form, st_id: e.target.value})} disabled={!!editTarget} />
              </div>
              <div className="form-group">
                <label>Level / Year</label>
                <input type="number" placeholder="e.g. 2" min="1" max="6" value={form.level} onChange={e => setForm({...form, level: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input placeholder="Student full name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Student email address" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Student Position</label>
                <input placeholder="e.g. President, Secretary..." value={form.st_position} onChange={e => setForm({...form, st_position: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Member Function</label>
                <input placeholder="e.g. Logistics, Marketing, Finance..." value={form.member_function} onChange={e => setForm({...form, member_function: e.target.value})} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Mobile Number</label>
                <input placeholder="e.g. +94771234567" value={form.mobile_number} onChange={e => setForm({...form, mobile_number: e.target.value})} />
              </div>
              <div className="form-group">
                <label>LinkedIn Profile URL</label>
                <input placeholder="e.g. https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => setForm({...form, linkedin_url: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Profile Image URL</label>
                <input placeholder="e.g. https://example.com/avatar.jpg" value={form.profile_image_url} onChange={e => setForm({...form, profile_image_url: e.target.value})} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editTarget ? "Update Member" : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {csvModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !importing && closeCsvModal()}>
          <div className="modal" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h2 className="modal-title">Import Members from CSV</h2>
              <button className="modal-close" onClick={closeCsvModal} disabled={importing}>x</button>
            </div>

            {importResult ? (
              <div>
                <div className="alert alert-success">Import process finished!</div>
                <div className="about-list" style={{ marginBottom: "20px" }}>
                  <div>
                    <span>Successfully Processed</span>
                    <strong>{importResult.success} members</strong>
                  </div>
                  {importResult.skipped > 0 && (
                    <div>
                      <span>Skipped (Duplicates)</span>
                      <strong>{importResult.skipped} members</strong>
                    </div>
                  )}
                  {importResult.validationSkipped > 0 && (
                    <div>
                      <span>Skipped (Validation Failures)</span>
                      <strong>{importResult.validationSkipped} rows</strong>
                    </div>
                  )}
                  {importResult.failed > 0 && (
                    <div>
                      <span>Failed (Database Errors)</span>
                      <strong>{importResult.failed} members</strong>
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeCsvModal}>Done</button>
                </div>
              </div>
            ) : importing ? (
              <div className="csv-progress-wrap">
                <div className="csv-progress-bar">
                  <div className="csv-progress-fill" style={{ width: `${importProgress}%` }}></div>
                </div>
                <div className="csv-progress-text">
                  <span>Uploading to database...</span>
                  <span>{importProgress}%</span>
                </div>
              </div>
            ) : parsedData ? (
              <div>
                <div className="csv-preview-title">Header Mapping Status</div>
                <div className="csv-mapping-grid">
                  <div className="csv-mapping-item">
                    <span>Student ID *</span>
                    <strong>
                      {parsedData.mapping.st_id !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.st_id]}</span>
                      ) : (
                        <span className="badge badge-red">Missing</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Full Name *</span>
                    <strong>
                      {parsedData.mapping.name !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.name]}</span>
                      ) : (
                        <span className="badge badge-red">Missing</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Level</span>
                    <strong>
                      {parsedData.mapping.level !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.level]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Position</span>
                    <strong>
                      {parsedData.mapping.st_position !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.st_position]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Member Function</span>
                    <strong>
                      {parsedData.mapping.member_function !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.member_function]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Email</span>
                    <strong>
                      {parsedData.mapping.email !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.email]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Mobile Number</span>
                    <strong>
                      {parsedData.mapping.mobile_number !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.mobile_number]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>LinkedIn URL</span>
                    <strong>
                      {parsedData.mapping.linkedin_url !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.linkedin_url]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                  <div className="csv-mapping-item">
                    <span>Photo URL</span>
                    <strong>
                      {parsedData.mapping.profile_image_url !== -1 ? (
                        <span className="badge badge-purple">{parsedData.headers[parsedData.mapping.profile_image_url]}</span>
                      ) : (
                        <span className="badge badge-gray">Not Mapped</span>
                      )}
                    </strong>
                  </div>
                </div>

                {(parsedData.mapping.st_id === -1 || parsedData.mapping.name === -1) ? (
                  <div className="alert alert-error">
                    Missing required columns. Please upload a file containing headers for Student ID and Full Name.
                  </div>
                ) : (
                  <>
                    <div className="toggle-strategy">
                      <span className="toggle-strategy-label">Duplicate Policy:</span>
                      <div className="toggle-strategy-options">
                        <button
                          type="button"
                          className={`strategy-btn ${duplicateStrategy === "upsert" ? "active" : ""}`}
                          onClick={() => setDuplicateStrategy("upsert")}
                        >
                          Update Details (Upsert)
                        </button>
                        <button
                          type="button"
                          className={`strategy-btn ${duplicateStrategy === "ignore" ? "active" : ""}`}
                          onClick={() => setDuplicateStrategy("ignore")}
                        >
                          Ignore Duplicates
                        </button>
                      </div>
                    </div>

                    {parsedData.errors.length > 0 && (
                      <div className="csv-validation-box">
                        <div className="csv-validation-title">⚠️ Row Validation Warnings</div>
                        {parsedData.errors.map((err, idx) => (
                          <div key={idx} className="csv-validation-item">{err}</div>
                        ))}
                      </div>
                    )}

                    <div className="csv-preview-title">Preview (first 5 records)</div>
                    <div className="table-wrap" style={{ marginBottom: "20px" }}>
                      <table className="csv-preview-table" style={{ border: "none" }}>
                        <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Level</th>
                          <th>Position</th>
                          <th>Function</th>
                          <th>Mobile</th>
                          <th>LinkedIn</th>
                          <th>Photo URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.rows.slice(0, 5).map((row, idx) => {
                          const st_id = parsedData.mapping.st_id !== -1 ? row[parsedData.mapping.st_id] : "";
                          const name = parsedData.mapping.name !== -1 ? row[parsedData.mapping.name] : "";
                          const email = parsedData.mapping.email !== -1 ? row[parsedData.mapping.email] : "";
                          const level = parsedData.mapping.level !== -1 ? row[parsedData.mapping.level] : "";
                          const position = parsedData.mapping.st_position !== -1 ? row[parsedData.mapping.st_position] : "";
                          const memberFunction = parsedData.mapping.member_function !== -1 ? row[parsedData.mapping.member_function] : "";
                          const mobile = parsedData.mapping.mobile_number !== -1 ? row[parsedData.mapping.mobile_number] : "";
                          const linkedin = parsedData.mapping.linkedin_url !== -1 ? row[parsedData.mapping.linkedin_url] : "";
                          const photo = parsedData.mapping.profile_image_url !== -1 ? row[parsedData.mapping.profile_image_url] : "";
                          return (
                            <tr key={idx}>
                              <td className="mono">{st_id || <span className="text-red">Missing</span>}</td>
                              <td><strong>{name || <span className="text-red">Missing</span>}</strong></td>
                              <td>{email || "-"}</td>
                              <td>{level || "-"}</td>
                              <td>{position || "-"}</td>
                              <td>{memberFunction || "-"}</td>
                              <td>{mobile || "-"}</td>
                              <td style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={linkedin}>{linkedin || "-"}</td>
                              <td style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={photo}>{photo || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setParsedData(null)}>Back</button>
                  <button
                    className="btn btn-primary"
                    disabled={parsedData.mapping.st_id === -1 || parsedData.mapping.name === -1 || parsedData.validRows.length === 0}
                    onClick={handleImportSubmit}
                  >
                    Import {parsedData.validRows.length} Members
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`csv-dropzone ${dragOver ? "dragover" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById("csv-file-input").click()}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="csv-dropzone-icon">📥</div>
                  <div className="csv-dropzone-text">Drag & drop your CSV file here, or click to browse</div>
                  <div className="csv-dropzone-sub">Supported columns: st_id, name, email, level, st_position, member_function, mobile_number, profile_image_url, linkedin_url</div>
                </div>

                <div className="flex justify-between items-center" style={{ marginTop: "16px" }}>
                  <span className="text-muted text-sm">Need a starter file?</span>
                  <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                    ⬇️ Download Template CSV
                  </button>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={closeCsvModal}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
