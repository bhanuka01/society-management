import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";
import PhoneContact from "../components/PhoneContact";

const EMPTY_FORM = { st_id: "", name: "", level: "", st_position: "", member_function: "", email: "", mobile_number: "", profile_image_url: "", linkedin_url: "", role: "member" };

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
  const [editProfileTarget, setEditProfileTarget] = useState(null);

  // Member Self-Edit Settings State
  const [editSettingsModal, setEditSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [editPermissions, setEditPermissions] = useState({
    name: false,
    photo: true,
    whatsapp: false,
    linkedin: true,
    position: false,
    function: false
  });

  const loadEditPermissions = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "member_edit_name",
        "member_edit_photo",
        "member_edit_whatsapp",
        "member_edit_linkedin",
        "member_edit_position",
        "member_edit_function"
      ]);

    if (data) {
      const perms = {
        name: false,
        photo: true,
        whatsapp: false,
        linkedin: true,
        position: false,
        function: false
      };
      data.forEach(item => {
        if (item.key === "member_edit_name") perms.name = item.value === "true";
        if (item.key === "member_edit_photo") perms.photo = item.value === "true";
        if (item.key === "member_edit_whatsapp") perms.whatsapp = item.value === "true";
        if (item.key === "member_edit_linkedin") perms.linkedin = item.value === "true";
        if (item.key === "member_edit_position") perms.position = item.value === "true";
        if (item.key === "member_edit_function") perms.function = item.value === "true";
      });
      setEditPermissions(perms);
    }
  };

  const togglePermission = async (key, checked) => {
    setSavingSettings(true);
    setSettingsMsg(null);
    const dbKey = `member_edit_${key}`;
    const val = checked ? "true" : "false";

    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: dbKey, value: val }, { onConflict: "key" });

    setSavingSettings(false);
    if (error) {
      setSettingsMsg({ type: "error", text: "Failed to update permission: " + error.message });
    } else {
      setEditPermissions(prev => ({ ...prev, [key]: checked }));
      setSettingsMsg({ type: "success", text: `Permission updated.` });
    }
  };

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (viewFilter === "pending") {
      const { data, count, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, st_id, status, created_at, members(mobile_number, level, member_function)")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false });

      if (error) {
        alert("Error fetching pending registrations: " + error.message);
        setMembers([]);
        setTotal(0);
      } else {
        const mappedData = (data || []).map(p => ({
          st_id: p.st_id,
          name: p.full_name,
          email: p.email,
          role: p.role,
          level: p.members?.level || 1,
          mobile_number: p.members?.mobile_number || "",
          member_function: p.members?.member_function || "",
          profile_id: p.id,
          status: p.status
        }));

        const q = searchText.trim().toLowerCase();
        let filtered = mappedData;
        if (q) {
          filtered = mappedData.filter(m =>
            (m.st_id || "").toLowerCase().includes(q) ||
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q) ||
            (m.member_function || "").toLowerCase().includes(q)
          );
        }

        setMembers(filtered);
        setTotal(filtered.length);
      }
      setLoading(false);
      return;
    }

    let query = supabase
      .from("members")
      .select("*", { count: "exact" })
      .order("st_id")
      .range(from, to);

    if (viewFilter === "active") query = query.lte("level", 4);
    else if (viewFilter === "alumni") query = query.gt("level", 4);

    const q = searchText.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,name.ilike.%${q}%,st_position.ilike.%${q}%,member_function.ilike.%${q}%`);
    }

    const { data, count } = await query;
    setMembers(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { load(page, search); loadEditPermissions(); }, [page, search, viewFilter]);

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
  const openEditPending = (m) => {
    setForm({
      st_id: m.st_id,
      name: m.name,
      level: m.level || "",
      st_position: "",
      member_function: "",
      email: m.email || "",
      mobile_number: m.mobile_number || "",
      profile_image_url: "",
      linkedin_url: "",
      role: m.role || "member"
    });
    setEditTarget(m.st_id);
    setEditProfileTarget({ profile_id: m.profile_id, role: m.role });
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => { setModal(false); setMsg(null); setEditProfileTarget(null); };

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

  const exportMembersCSV = async () => {
    try {
      let exportData = [];
      let headers = [];
      let fileName = "";

      if (viewFilter === "pending") {
        const { data, error } = await supabase
          .from("profiles")
          .select("st_id, full_name, email, role, status, members(mobile_number, level, member_function)")
          .in("status", ["pending", "rejected"])
          .order("created_at", { ascending: false });

        if (error) {
          alert("Failed to export pending members: " + error.message);
          return;
        }

        headers = ["ST ID", "Full Name", "Email", "Role", "Status", "Level", "Mobile Number", "Function"];
        exportData = (data || []).map(p => [
          p.st_id || "",
          p.full_name || "",
          p.email || "",
          p.role || "",
          p.status || "",
          p.members?.level || "",
          p.members?.mobile_number || "",
          p.members?.member_function || ""
        ]);
        fileName = `pending_members_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        let query = supabase.from("members").select("*").order("st_id");
        if (viewFilter === "active") query = query.lte("level", 4);
        else if (viewFilter === "alumni") query = query.gt("level", 4);

        const q = search.trim();
        if (q) {
          query = query.or(`st_id.ilike.%${q}%,name.ilike.%${q}%,st_position.ilike.%${q}%,member_function.ilike.%${q}%`);
        }

        const { data, error } = await query;
        if (error) {
          alert("Failed to export members: " + error.message);
          return;
        }

        headers = ["st_id", "name", "email", "level", "st_position", "member_function", "mobile_number", "profile_image_url", "linkedin_url"];
        exportData = (data || []).map(m => [
          m.st_id || "",
          m.name || "",
          m.email || "",
          m.level || "",
          m.st_position || "",
          m.member_function || "",
          m.mobile_number || "",
          m.profile_image_url || "",
          m.linkedin_url || ""
        ]);
        fileName = `members_${viewFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (!exportData || exportData.length === 0) {
        alert("No member records found to export.");
        return;
      }

      const csvRows = [
        headers.join(","),
        ...exportData.map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        )
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Error exporting CSV: " + err.message);
    }
  };

  const downloadTemplate = () => {
    const headers = ["st_id", "name", "email", "level", "st_position", "member_function", "mobile_number", "profile_image_url", "linkedin_url"];
    const rows = [
      ["SC/2022/12345", "John Doe", "john.doe@example.com", "2", "Member", "Logistics", "+94771234567", "https://example.com/john.jpg", "https://linkedin.com/in/johndoe"],
      ["SC/2023/54321", "Jane Smith", "jane.smith@example.com", "1", "Committee Member", "Marketing", "+94777654321", "https://example.com/jane.jpg", "https://linkedin.com/in/janesmith"]
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
        let normalizedStId = st_id;
        if (!st_id) {
          errors.push(`Row ${rowNum}: Student ID is missing.`);
          rowValid = false;
        } else {
          if (/^\d{4}\/\d{5}$/.test(st_id)) {
            normalizedStId = "SC/" + st_id;
          } else if (/^sc\/\d{4}\/\d{5}$/i.test(st_id)) {
            normalizedStId = "SC/" + st_id.substring(3);
          } else {
            errors.push(`Row ${rowNum}: Student ID "${st_id}" is invalid. Correct format: SC/2022/12984`);
            rowValid = false;
          }
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
          st_id: normalizedStId || "",
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

    const rawStId = form.st_id.trim();
    let finalStId = "";
    if (/^\d{4}\/\d{5}$/.test(rawStId)) {
      finalStId = "SC/" + rawStId;
    } else if (/^sc\/\d{4}\/\d{5}$/i.test(rawStId)) {
      finalStId = "SC/" + rawStId.substring(3);
    } else {
      setMsg({ type: "error", text: "Invalid Student ID format. Correct format: SC/2022/12984" });
      return;
    }

    setSaving(true);

    if (editProfileTarget) {
      const stIdChanged = finalStId !== editTarget;

      if (stIdChanged) {
        // 1. Check if the new st_id is already in members
        const { data: exists } = await supabase
          .from("members")
          .select("st_id")
          .eq("st_id", finalStId)
          .maybeSingle();

        if (exists) {
          setMsg({ type: "error", text: `Student ID ${finalStId} is already in use.` });
          setSaving(false);
          return;
        }

        // 2. Set profile st_id to null first to bypass foreign key constraint
        await supabase
          .from("profiles")
          .update({ st_id: null })
          .eq("id", editProfileTarget.profile_id);
      }

      // 3. Update member details
      const { error: memberErr } = await supabase
        .from("members")
        .update({
          st_id: finalStId,
          name: form.name.trim(),
          email: form.email.trim() || null,
          level: form.level ? parseInt(form.level) : null,
          mobile_number: form.mobile_number.trim() || null
        })
        .eq("st_id", editTarget);

      if (memberErr) {
        setMsg({ type: "error", text: "Error updating member: " + memberErr.message });
        setSaving(false);
        return;
      }

      // 4. Update profile details
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          st_id: finalStId,
          full_name: form.name.trim(),
          email: form.email.trim(),
          role: form.role
        })
        .eq("id", editProfileTarget.profile_id);

      if (profileErr) {
        setMsg({ type: "error", text: "Error updating profile: " + profileErr.message });
        setSaving(false);
        return;
      }

      setSaving(false);
      setMsg({ type: "success", text: "Pending registration details updated." });
      load(page, search);
      setTimeout(() => { closeModal(); }, 800);
      return;
    }

    const payload = {
      st_id: finalStId,
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

  const handleApprove = async (m) => {
    if (!confirm(`Approve registration for ${m.name} as a ${m.role}?`)) return;
    setLoading(true);

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ status: "approved", role: m.role })
      .eq("id", m.profile_id);

    if (profileErr) {
      alert("Error approving profile: " + profileErr.message);
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase
      .from("members")
      .update({
        st_position: m.role === "member" ? "Member" : m.role === "editor" ? "Editor" : "Admin",
        member_function: m.role === "member" ? (m.member_function && m.member_function !== "Pending Review" ? m.member_function : "General") : "Staff"
      })
      .eq("st_id", m.st_id);

    if (memberErr) {
      console.error("Error updating member details: ", memberErr.message);
    }

    alert(`Approved ${m.name} successfully!`);
    load(page, search);
  };

  const handleReject = async (m) => {
    if (!confirm(`Reject registration for ${m.name}? They will see a rejection notification when attempting to log in.`)) return;
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" })
      .eq("id", m.profile_id);

    if (error) {
      alert("Error rejecting registration: " + error.message);
    } else {
      alert(`Rejected registration for ${m.name}.`);
    }
    load(page, search);
  };

  const handleDeletePending = async (m) => {
    if (!confirm(`Permanently delete registration and details for ${m.name} from the database? This cannot be undone.`)) return;
    setLoading(true);

    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", m.profile_id);

    if (profileErr) {
      alert("Error deleting profile: " + profileErr.message);
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase
      .from("members")
      .delete()
      .eq("st_id", m.st_id);

    if (memberErr) {
      console.error("Error deleting member row: ", memberErr.message);
    }

    alert(`Deleted registration for ${m.name} completely.`);
    load(page, search);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">groups</span></span> Members</h1>
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
            <option value="pending">Pending Approvals</option>
          </select>
        </div>

        <div className="flex gap-2" style={{ marginLeft: "auto", flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={exportMembersCSV} title="Export members list to CSV file">
            📥 Export CSV
          </button>
          {isAdmin && (
            <>
              <button className="btn btn-ghost" onClick={() => { setSettingsMsg(null); setEditSettingsModal(true); }}>⚙️ Edit Permissions</button>
              <button className="btn btn-ghost" onClick={openImportCSV}>Import CSV</button>
              <button className="btn btn-ghost" onClick={promoteAll} style={{ color: "var(--accent)" }}>Promote All</button>
              <button className="btn btn-primary" onClick={openAdd}>+ Add Member</button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>ST ID</th>}
                <th>Name & Email</th>
                {viewFilter === "pending" ? <th>Requested Role</th> : <th>Level</th>}
                {viewFilter === "pending" ? <th>Phone</th> : <th>Position & Function</th>}
                {viewFilter === "pending" && <th>Year</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={viewFilter === "pending" ? (isAdmin ? 6 : 5) : (isAdmin ? 5 : 4)}><div className="empty-state"><div className="icon">*</div><p>No members found</p></div></td></tr>
              ) : members.map(m => (
                <tr key={m.st_id}>
                  {isAdmin && <td className="mono">{m.st_id}</td>}
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {viewFilter === "pending" ? (
                        <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text)" }}>
                          {m.name}
                        </span>
                      ) : (
                        <span
                          className="clickable-member"
                          onClick={() => openViewProfile(m.st_id)}
                          style={{ cursor: "pointer", color: "var(--accent2)", fontWeight: 600, fontSize: "12px" }}
                        >
                          {m.name}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "var(--text3)", wordBreak: "break-all" }}>
                        {m.email || "-"}
                      </span>
                    </div>
                  </td>
                  {viewFilter === "pending" ? (
                    <>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span className="badge badge-purple">{m.role}</span>
                          <span className="badge" style={{
                            backgroundColor: m.status === "rejected" ? "rgba(220, 38, 38, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: m.status === "rejected" ? "var(--red)" : "var(--amber)",
                            border: m.status === "rejected" ? "1px solid rgba(220, 38, 38, 0.2)" : "1px solid rgba(245, 158, 11, 0.2)"
                          }}>
                            {m.status === "rejected" ? "Rejected" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td><PhoneContact phone={m.mobile_number} /></td>
                      <td><span className="badge badge-purple">Year {m.level}</span></td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--green)" }} onClick={() => handleApprove(m)}>Approve</button>
                          {m.status === "pending" && (
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--amber)" }} onClick={() => handleReject(m)}>Reject</button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditPending(m)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeletePending(m)}>Delete</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{m.level ? <span className="badge badge-purple">Year {m.level}</span> : <span className="text-muted">-</span>}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text)" }}>
                            {m.st_position || m.member_function || "-"}
                          </span>
                          {m.st_position && m.member_function && (
                            <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                              {m.member_function}
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.st_id)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </>
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
                <input placeholder="e.g. SC/2022/12984" value={form.st_id} onChange={e => setForm({ ...form, st_id: e.target.value })} disabled={!!editTarget && !editProfileTarget} />
                {form.st_id && !/^(?:SC\/)?\d{4}\/\d{5}$/i.test(form.st_id.trim()) && (
                  <span style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "4px", display: "block" }}>
                    Invalid Student ID format. Correct format: SC/2022/12984
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Level / Year</label>
                <input type="number" placeholder="e.g. 2" min="1" max="6" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input placeholder="Student full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Student email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            {editProfileTarget ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Requested Role / Access Level</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="member">Member</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Student Position</label>
                    <input placeholder="e.g. President, Secretary..." value={form.st_position} onChange={e => setForm({ ...form, st_position: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Member Function</label>
                    <input placeholder="e.g. Logistics, Marketing, Finance..." value={form.member_function} onChange={e => setForm({ ...form, member_function: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Mobile Number</label>
                <input placeholder="e.g. +94771234567" value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>LinkedIn Profile URL</label>
                <input placeholder="e.g. https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Profile Image URL</label>
                <input placeholder="e.g. https://example.com/avatar.jpg" value={form.profile_image_url} onChange={e => setForm({ ...form, profile_image_url: e.target.value })} />
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

      {editSettingsModal && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && setEditSettingsModal(false)}>
          <div className="modal" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <h2 className="modal-title">⚙️ Member Profile Self-Edit Permissions</h2>
              <button className="modal-close" onClick={() => setEditSettingsModal(false)}>x</button>
            </div>

            <p className="text-muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
              Toggle switch buttons to allow or restrict members from editing their own profile fields.
            </p>

            {settingsMsg && <div className={`alert alert-${settingsMsg.type}`} style={{ marginBottom: "16px" }}>{settingsMsg.text}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg3)", padding: "16px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>

              {/* Field 1: Name */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>Full Name</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to edit their own full name</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.name}
                    disabled={savingSettings}
                    onChange={e => togglePermission("name", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.name ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.name ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.name ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

              {/* Field 2: Photo */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>Profile Photo</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to upload/change profile photo</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.photo}
                    disabled={savingSettings}
                    onChange={e => togglePermission("photo", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.photo ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.photo ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.photo ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

              {/* Field 3: WhatsApp Number */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>WhatsApp / Mobile Number</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to edit their phone number</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.whatsapp}
                    disabled={savingSettings}
                    onChange={e => togglePermission("whatsapp", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.whatsapp ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.whatsapp ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.whatsapp ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

              {/* Field 4: LinkedIn Link */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>LinkedIn Link</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to update LinkedIn profile link</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.linkedin}
                    disabled={savingSettings}
                    onChange={e => togglePermission("linkedin", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.linkedin ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.linkedin ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.linkedin ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

              {/* Field 5: Position */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>Position</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to edit student position</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.position}
                    disabled={savingSettings}
                    onChange={e => togglePermission("position", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.position ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.position ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.position ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

              {/* Field 6: Function Name */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>Function Name</strong>
                  <span className="text-muted" style={{ fontSize: "12px" }}>Allow members to edit member function name</span>
                </div>
                <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={editPermissions.function}
                    disabled={savingSettings}
                    onChange={e => togglePermission("function", e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className={`slider round ${editPermissions.function ? "active" : ""}`} style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: editPermissions.function ? "var(--accent)" : "#ccc",
                    transition: ".3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: editPermissions.function ? "24px" : "3px", bottom: "3px",
                      backgroundColor: "white", transition: ".3s", borderRadius: "50%"
                    }} />
                  </span>
                </label>
              </div>

            </div>

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn btn-primary" onClick={() => setEditSettingsModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
