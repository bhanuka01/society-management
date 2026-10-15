import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";
import { StudentNameLink } from "../components/StudentProfileContext";
import PhoneContact from "../components/PhoneContact";
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  TrendingUp,
  SlidersHorizontal,
  Copy,
  Check,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  X,
  ExternalLink,
  Clock,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  Phone,
  Shield,
  Tag,
  Sparkles
} from "lucide-react";

const LinkedInIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.65 1.65 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.66 1.66 0 0 0 1.65-1.66 1.66 1.66 0 0 0-1.65-1.66Z" />
  </svg>
);

const EMPTY_FORM = {
  st_id: "",
  name: "",
  preferred_name: "",
  level: "",
  st_position: "",
  member_function: "",
  email: "",
  mobile_number: "",
  profile_image_url: "",
  linkedin_url: "",
  role: "member",
};

const getInitials = (name) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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
    } else if (char === "," && !inQuotes) {
      row.push("");
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
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
  return lines.filter((r) => r.length > 0 && r.some((cell) => cell.trim() !== ""));
}

function mapHeaders(headers) {
  const mapping = {
    st_id: -1,
    name: -1,
    preferred_name: -1,
    level: -1,
    st_position: -1,
    member_function: -1,
    email: -1,
    mobile_number: -1,
    profile_image_url: -1,
    linkedin_url: -1,
  };
  headers.forEach((h, index) => {
    const clean = h.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (["stid", "studentid", "id", "stno", "studentno", "regno", "registrationno"].includes(clean)) {
      if (mapping.st_id === -1) mapping.st_id = index;
    } else if (["preferredname", "callingname", "nickname", "preferred", "callname", "shortname"].includes(clean)) {
      if (mapping.preferred_name === -1) mapping.preferred_name = index;
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

export default function Members({ isAdmin = false, theme }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return (
        document.documentElement.getAttribute("data-theme") ||
        (document.documentElement.classList.contains("dark") ? "dark" : "light")
      );
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateTheme = () => {
      const active =
        document.documentElement.getAttribute("data-theme") ||
        (document.documentElement.classList.contains("dark") ? "dark" : "light");
      setCurrentTheme(active);
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme !== "light";

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
  const [viewFilter, setViewFilter] = useState("active"); // 'active' | 'alumni' | 'all' | 'pending'
  const [pendingCount, setPendingCount] = useState(0);
  const [copiedStId, setCopiedStId] = useState(null);

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
    preferred_name: true,
    photo: true,
    whatsapp: false,
    linkedin: true,
    position: false,
    function: false,
  });

  const loadPendingCount = async () => {
    try {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "rejected"]);
      setPendingCount(count || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEditPermissions = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "member_edit_name",
        "member_edit_preferred_name",
        "member_edit_photo",
        "member_edit_whatsapp",
        "member_edit_linkedin",
        "member_edit_position",
        "member_edit_function",
      ]);

    if (data) {
      const perms = {
        name: false,
        preferred_name: true,
        photo: true,
        whatsapp: false,
        linkedin: true,
        position: false,
        function: false,
      };
      data.forEach((item) => {
        if (item.key === "member_edit_name") perms.name = item.value === "true";
        if (item.key === "member_edit_preferred_name") perms.preferred_name = item.value === "true";
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
      setEditPermissions((prev) => ({ ...prev, [key]: checked }));
      setSettingsMsg({ type: "success", text: "Permission updated." });
    }
  };

  const toggleAllPermissions = async (enable) => {
    setSavingSettings(true);
    setSettingsMsg(null);
    const keys = ["name", "preferred_name", "photo", "whatsapp", "linkedin", "position", "function"];
    const rows = keys.map((k) => ({
      key: `member_edit_${k}`,
      value: enable ? "true" : "false",
    }));

    const { error } = await supabase
      .from("system_settings")
      .upsert(rows, { onConflict: "key" });

    setSavingSettings(false);
    if (error) {
      setSettingsMsg({ type: "error", text: "Failed to update permissions: " + error.message });
    } else {
      const nextPerms = {};
      keys.forEach((k) => {
        nextPerms[k] = enable;
      });
      setEditPermissions(nextPerms);
      setSettingsMsg({
        type: "success",
        text: enable ? "All permissions enabled." : "All permissions disabled.",
      });
    }
  };

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    loadPendingCount();

    if (viewFilter === "pending") {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, preferred_name, role, st_id, status, created_at, members(mobile_number, level, member_function, profile_image_url, preferred_name)"
        )
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false });

      if (error) {
        alert("Error fetching pending registrations: " + error.message);
        setMembers([]);
        setTotal(0);
      } else {
        const mappedData = (data || []).map((p) => ({
          st_id: p.st_id,
          name: p.preferred_name || p.members?.preferred_name || p.full_name,
          full_name: p.full_name,
          preferred_name: p.preferred_name || p.members?.preferred_name || "",
          email: p.email,
          role: p.role,
          level: p.members?.level || 1,
          mobile_number: p.members?.mobile_number || "",
          member_function: p.members?.member_function || "",
          profile_image_url: p.members?.profile_image_url || "",
          profile_id: p.id,
          status: p.status,
        }));

        const q = searchText.trim().toLowerCase();
        let filtered = mappedData;
        if (q) {
          filtered = mappedData.filter(
            (m) =>
              (m.st_id || "").toLowerCase().includes(q) ||
              (m.name || "").toLowerCase().includes(q) ||
              (m.full_name || "").toLowerCase().includes(q) ||
              (m.preferred_name || "").toLowerCase().includes(q) ||
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

    let query = supabase.from("members").select("*", { count: "exact" }).order("st_id").range(from, to);

    if (viewFilter === "active") query = query.lte("level", 4);
    else if (viewFilter === "alumni") query = query.gt("level", 4);

    const q = searchText.trim();
    if (q) {
      query = query.or(
        `st_id.ilike.%${q}%,name.ilike.%${q}%,preferred_name.ilike.%${q}%,st_position.ilike.%${q}%,member_function.ilike.%${q}%`
      );
    }

    const { data, count } = await query;
    setMembers(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    load(page, search);
    loadEditPermissions();
  }, [page, search, viewFilter]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModal(true);
    setMsg(null);
  };

  const openEdit = (m) => {
    setForm({
      st_id: m.st_id,
      name: m.name || "",
      preferred_name: m.preferred_name || "",
      level: m.level || "",
      st_position: m.st_position || "",
      member_function: m.member_function || "",
      email: m.email || "",
      mobile_number: m.mobile_number || "",
      profile_image_url: m.profile_image_url || "",
      linkedin_url: m.linkedin_url || "",
    });
    setEditTarget(m.st_id);
    setModal(true);
    setMsg(null);
  };

  const openEditPending = (m) => {
    setForm({
      st_id: m.st_id,
      name: m.full_name || m.name || "",
      preferred_name: m.preferred_name || "",
      level: m.level || "",
      st_position: "",
      member_function: "",
      email: m.email || "",
      mobile_number: m.mobile_number || "",
      profile_image_url: "",
      linkedin_url: "",
      role: m.role || "member",
    });
    setEditTarget(m.st_id);
    setEditProfileTarget({ profile_id: m.profile_id, role: m.role });
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => {
    setModal(false);
    setMsg(null);
    setEditProfileTarget(null);
  };

  const promoteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to promote all active members to the next academic level? Level 4 members will transition to Alumni (Level 5)."
      )
    )
      return;
    setLoading(true);
    const { data: activeMembers, error: fetchErr } = await supabase.from("members").select("*").lte("level", 4);
    if (fetchErr) {
      alert(fetchErr.message);
      setLoading(false);
      return;
    }
    if (!activeMembers || activeMembers.length === 0) {
      alert("No active members found to promote.");
      setLoading(false);
      return;
    }

    const updated = activeMembers.map((m) => ({ ...m, level: (parseInt(m.level) || 0) + 1 }));
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
          .select(
            "st_id, full_name, preferred_name, email, role, status, members(mobile_number, level, member_function, preferred_name)"
          )
          .in("status", ["pending", "rejected"])
          .order("created_at", { ascending: false });

        if (error) {
          alert("Failed to export pending members: " + error.message);
          return;
        }

        headers = ["ST ID", "Full Name", "Preferred Name", "Email", "Role", "Status", "Level", "Mobile Number", "Function"];
        exportData = (data || []).map((p) => [
          p.st_id || "",
          p.full_name || "",
          p.preferred_name || p.members?.preferred_name || "",
          p.email || "",
          p.role || "",
          p.status || "",
          p.members?.level || "",
          p.members?.mobile_number || "",
          p.members?.member_function || "",
        ]);
        fileName = `pending_members_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        let query = supabase.from("members").select("*").order("st_id");
        if (viewFilter === "active") query = query.lte("level", 4);
        else if (viewFilter === "alumni") query = query.gt("level", 4);

        const q = search.trim();
        if (q) {
          query = query.or(
            `st_id.ilike.%${q}%,name.ilike.%${q}%,preferred_name.ilike.%${q}%,st_position.ilike.%${q}%,member_function.ilike.%${q}%`
          );
        }

        const { data, error } = await query;
        if (error) {
          alert("Failed to export members: " + error.message);
          return;
        }

        headers = ["st_id", "name", "preferred_name", "email", "level", "st_position", "member_function", "mobile_number", "profile_image_url", "linkedin_url"];
        exportData = (data || []).map((m) => [
          m.st_id || "",
          m.name || "",
          m.preferred_name || "",
          m.email || "",
          m.level || "",
          m.st_position || "",
          m.member_function || "",
          m.mobile_number || "",
          m.profile_image_url || "",
          m.linkedin_url || "",
        ]);
        fileName = `members_${viewFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (!exportData || exportData.length === 0) {
        alert("No member records found to export.");
        return;
      }

      const csvRows = [
        headers.join(","),
        ...exportData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
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
    const headers = ["st_id", "name", "preferred_name", "email", "level", "st_position", "member_function", "mobile_number", "profile_image_url", "linkedin_url"];
    const rows = [
      ["SC/2022/12345", "Pathum Nissanka", "Pathum", "pathum@example.com", "2", "Member", "Logistics", "+94771234567", "https://example.com/avatar.jpg", "https://linkedin.com/in/pathum"],
      ["SC/2023/54321", "Jane Smith", "Jane", "jane.smith@example.com", "1", "Committee Member", "Marketing", "+94777654321", "https://example.com/jane.jpg", "https://linkedin.com/in/janesmith"],
    ];
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
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
        const preferred_name = mapping.preferred_name !== -1 ? row[mapping.preferred_name]?.trim() : "";
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
          preferred_name: preferred_name || null,
          email: email || null,
          level: level,
          st_position: st_position || null,
          member_function: member_function || null,
          mobile_number: mobile_number || null,
          profile_image_url: profile_image_url || null,
          linkedin_url: linkedin_url || null,
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
        errors,
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
      const existingSet = new Set(existing.map((m) => m.st_id));
      const toInsert = parsedData.validRows.filter((row) => !existingSet.has(row.st_id));
      const skippedCount = parsedData.validRows.length - toInsert.length;

      if (toInsert.length === 0) {
        setImportResult({
          success: 0,
          skipped: skippedCount,
          failed: 0,
          validationSkipped: parsedData.invalidRows.length,
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
        validationSkipped: parsedData.invalidRows.length,
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
        validationSkipped: parsedData.invalidRows.length,
      });
    }

    setImporting(false);
    load(page, search);
  };

  const openViewProfile = (stId) => {
    setProfileTarget(stId);
  };

  const handleCopyStId = (stId, e) => {
    if (e) e.stopPropagation();
    if (!stId) return;
    navigator.clipboard.writeText(stId);
    setCopiedStId(stId);
    setTimeout(() => setCopiedStId(null), 1800);
  };

  const handleSave = async () => {
    if (!form.st_id.trim() || !form.name.trim()) {
      setMsg({ type: "error", text: "ST ID and Name are required." });
      return;
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

        await supabase
          .from("profiles")
          .update({ st_id: null })
          .eq("id", editProfileTarget.profile_id);
      }

      const { error: memberErr } = await supabase
        .from("members")
        .update({
          st_id: finalStId,
          name: form.name.trim(),
          preferred_name: form.preferred_name?.trim() || null,
          email: form.email.trim() || null,
          level: form.level ? parseInt(form.level) : null,
          mobile_number: form.mobile_number.trim() || null,
        })
        .eq("st_id", editTarget);

      if (memberErr) {
        setMsg({ type: "error", text: "Error updating member: " + memberErr.message });
        setSaving(false);
        return;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          st_id: finalStId,
          full_name: form.name.trim(),
          preferred_name: form.preferred_name?.trim() || null,
          email: form.email.trim(),
          role: form.role,
        })
        .eq("id", editProfileTarget.profile_id);

      if (profileErr) {
        setMsg({ type: "error", text: "Error updating profile: " + profileErr.message });
        setSaving(false);
        return;
      }

      setSaving(false);
      setMsg({ type: "success", text: "Registration details updated." });
      load(page, search);
      setTimeout(() => {
        closeModal();
      }, 800);
      return;
    }

    const payload = {
      st_id: finalStId,
      name: form.name.trim(),
      preferred_name: form.preferred_name?.trim() || null,
      email: form.email.trim() || null,
      level: form.level ? parseInt(form.level) : null,
      st_position: form.st_position.trim() || null,
      member_function: form.member_function.trim() || null,
      mobile_number: form.mobile_number.trim() || null,
      profile_image_url: form.profile_image_url.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from("members").update(payload).eq("st_id", editTarget));
    } else {
      ({ error } = await supabase.from("members").insert([payload]));
    }
    setSaving(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
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
        member_function:
          m.role === "member"
            ? m.member_function && m.member_function !== "Pending Review"
              ? m.member_function
              : "General"
            : "Staff",
      })
      .eq("st_id", m.st_id);

    if (memberErr) {
      console.error("Error updating member details: ", memberErr.message);
    }

    alert(`Approved ${m.name} successfully!`);
    load(page, search);
  };

  const handleReject = async (m) => {
    if (!confirm(`Reject registration for ${m.name}? They will see a rejection notification when attempting to log in.`))
      return;
    setLoading(true);

    const { error } = await supabase.from("profiles").update({ status: "rejected" }).eq("id", m.profile_id);

    if (error) {
      alert("Error rejecting registration: " + error.message);
    } else {
      alert(`Rejected registration for ${m.name}.`);
    }
    load(page, search);
  };

  const handleDeletePending = async (m) => {
    if (!confirm(`Permanently delete registration and details for ${m.name} from the database? This cannot be undone.`))
      return;
    setLoading(true);

    const { error: profileErr } = await supabase.from("profiles").delete().eq("id", m.profile_id);

    if (profileErr) {
      alert("Error deleting profile: " + profileErr.message);
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from("members").delete().eq("st_id", m.st_id);

    if (memberErr) {
      console.error("Error deleting member row: ", memberErr.message);
    }

    alert(`Deleted registration for ${m.name} completely.`);
    load(page, search);
  };

  return (
    <div
      className={`min-h-screen font-inter-variable pb-20 transition-colors duration-150 ${
        isDark
          ? "bg-[#08090a] text-[#d0d6e0] selection:bg-[#e4f222]/20 selection:text-white"
          : "bg-[#f8fafc] text-gray-800 selection:bg-indigo-500/20 selection:text-indigo-900"
      }`}
    >
      {/* ── HIGH-DENSITY LINEAR STICKY CONTROL BAR ── */}
      <div
        className={`border-b sticky top-0 z-20 backdrop-blur-md transition-colors ${
          isDark
            ? "border-[#23252a] bg-[#0c0c0e]/95"
            : "border-gray-200 bg-white/95 shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          {/* Row 1: Title, Telemetry Chips & Action Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-[6px] border flex items-center justify-center flex-shrink-0 ${
                  isDark
                    ? "bg-[#161718] border-[#23252a]"
                    : "bg-indigo-50 border-indigo-100"
                }`}
              >
                <Users
                  className={`w-4 h-4 ${
                    isDark ? "text-[#e4f222]" : "text-indigo-600"
                  }`}
                />
              </div>
              <h1
                className={`text-[15px] sm:text-[16px] font-[590] tracking-[-0.018em] truncate ${
                  isDark ? "text-[#ffffff]" : "text-gray-900"
                }`}
              >
                Members Directory & Registry
              </h1>
              <div
                className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-[#8a8f98]"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <span>{total} in view</span>
                {pendingCount > 0 && (
                  <>
                    <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                    <span
                      className={`font-[590] ${
                        isDark ? "text-[#f59e0b]" : "text-amber-600"
                      }`}
                    >
                      {pendingCount} pending approvals
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Tools */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={exportMembersCSV}
                className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                    : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-sm"
                }`}
                title="Export members list to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setSettingsMsg(null);
                      loadEditPermissions();
                      setEditSettingsModal(true);
                    }}
                    className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      isDark
                        ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                        : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-sm"
                    }`}
                    title="Configure self-edit permissions for members"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Permissions</span>
                  </button>

                  <button
                    onClick={openImportCSV}
                    className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      isDark
                        ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                        : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-sm"
                    }`}
                    title="Import members from CSV"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Import</span>
                  </button>

                  <button
                    onClick={promoteAll}
                    className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      isDark
                        ? "bg-[#161718] hover:bg-[#23252a] text-[#818cf8] hover:text-white border-[#23252a]"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border-indigo-200 shadow-sm"
                    }`}
                    title="Promote all active members to next level"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Promote All</span>
                  </button>

                  {/* Primary Action Button */}
                  <button
                    onClick={openAdd}
                    className={`h-7 px-3 font-[510] tracking-[-0.011em] text-[12px] rounded-[6px] flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-all ${
                      isDark
                        ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Segmented View Navigation Tabs & Real-time Search */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t ${
              isDark ? "border-[#1a1b1e]" : "border-gray-100"
            }`}
          >
            {/* View Tabs */}
            <div
              className={`flex items-center p-0.5 rounded-[6px] border overflow-x-auto scrollbar-none max-w-full ${
                isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"
              }`}
            >
              {[
                { id: "active", label: "Active Members" },
                { id: "alumni", label: "Alumni (L5+)" },
                { id: "all", label: "All Members" },
                {
                  id: "pending",
                  label:
                    pendingCount > 0
                      ? `⏳ Pending Approvals (${pendingCount})`
                      : "Pending Approvals",
                  color: pendingCount > 0 ? (isDark ? "#f59e0b" : "#d97706") : null,
                },
              ].map((tab) => {
                const active = viewFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setPage(0);
                      setViewFilter(tab.id);
                    }}
                    className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      active
                        ? isDark
                          ? "bg-[#23252a] text-white"
                          : "bg-white text-gray-900 shadow-sm"
                        : isDark
                        ? "text-[#8a8f98] hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab.color && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: tab.color }}
                      />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                className={`absolute left-2.5 top-2 w-3.5 h-3.5 ${
                  isDark ? "text-[#62666d]" : "text-gray-400"
                }`}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setPage(0);
                  setSearch(e.target.value);
                }}
                placeholder="Search by ID, name, function..."
                className={`w-full rounded-[6px] pl-8 pr-7 py-1 text-[12px] transition-colors font-sans border ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:outline-none focus:border-[#d0d6e0]"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-sm"
                }`}
              />
              {search && (
                <button
                  onClick={() => {
                    setPage(0);
                    setSearch("");
                  }}
                  className={`absolute right-2 top-1.5 ${
                    isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Table / Ledger Container */}
        <div
          className={`rounded-[12px] overflow-hidden border ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-xl"
              : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          {loading ? (
            <div
              className={`flex flex-col items-center justify-center py-24 gap-3 ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              <div
                className={`w-6 h-6 border-2 rounded-full animate-spin ${
                  isDark
                    ? "border-[#23252a] border-t-[#e4f222]"
                    : "border-gray-200 border-t-indigo-600"
                }`}
              />
              <span className="text-[12px] font-berkeley-mono">Loading member records...</span>
            </div>
          ) : members.length === 0 ? (
            <div
              className={`p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-2 ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-[6px] border flex items-center justify-center ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-[#8a8f98]"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                <Users
                  className={`w-5 h-5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}
                />
              </div>
              <h3
                className={`text-[14px] font-[510] ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                No members found
              </h3>
              <p
                className={`text-[12px] leading-relaxed font-sans ${
                  isDark ? "text-[#8a8f98]" : "text-gray-600"
                }`}
              >
                {search
                  ? `No member records match "${search}". Try clearing search filters.`
                  : viewFilter === "pending"
                  ? "No registrations currently awaiting staff approval."
                  : "No registered members found in this view."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className={`border-b font-berkeley-mono text-[10px] uppercase tracking-wider ${
                      isDark
                        ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]"
                        : "border-gray-200 bg-gray-50/80 text-gray-500"
                    }`}
                  >
                    <th className="py-2.5 px-4 w-12 font-[510]">Profile</th>
                    <th className="py-2.5 px-4 font-[510]">Student ID</th>
                    <th className="py-2.5 px-4 font-[510]">Calling & Full Name</th>
                    {viewFilter === "pending" ? (
                      <>
                        <th className="py-2.5 px-4 font-[510]">Requested Role</th>
                        <th className="py-2.5 px-4 font-[510]">Contact</th>
                        <th className="py-2.5 px-4 font-[510]">Academic Year</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-4 font-[510]">Level</th>
                        <th className="py-2.5 px-4 font-[510]">Position & Function</th>
                        <th className="py-2.5 px-4 font-[510]">Contact & Links</th>
                      </>
                    )}
                    <th className="py-2.5 px-4 text-right font-[510]">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-100"}`}>
                  {members.map((m) => {
                    const isCopied = copiedStId === m.st_id;

                    return (
                      <tr
                        key={m.st_id}
                        className={`transition-colors group text-[12.5px] ${
                          isDark ? "hover:bg-[#161718]/40" : "hover:bg-gray-50/80"
                        }`}
                      >
                        {/* 1. Profile Picture / Avatar */}
                        <td className="py-3 px-4 align-middle">
                          <div
                            className={`w-8 h-8 rounded-[6px] overflow-hidden border flex items-center justify-center flex-shrink-0 ${
                              isDark
                                ? "bg-[#161718] border-[#23252a]"
                                : "bg-gray-100 border-gray-200"
                            }`}
                          >
                            {m.profile_image_url ? (
                              <img
                                src={m.profile_image_url}
                                alt={m.preferred_name || m.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span
                                className={`text-[11px] font-berkeley-mono font-[510] ${
                                  isDark ? "text-[#d0d6e0]" : "text-gray-700"
                                }`}
                              >
                                {getInitials(m.preferred_name || m.name)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Student ID with 1-click Copy */}
                        <td
                          className={`py-3 px-4 align-middle font-berkeley-mono text-[12px] ${
                            isDark ? "text-[#d0d6e0]" : "text-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{m.st_id}</span>
                            <button
                              onClick={(e) => handleCopyStId(m.st_id, e)}
                              className={`transition-colors ${
                                isDark
                                  ? "text-[#62666d] hover:text-white"
                                  : "text-gray-400 hover:text-gray-700"
                              }`}
                              title="Copy Student ID"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-[#27a644]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 3. Name (Calling Name / Full Name & Email) */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex flex-col">
                            <StudentNameLink
                              stId={m.st_id}
                              name={m.preferred_name || m.name}
                              className="!text-[13.5px]"
                            />
                            {m.email && (
                              <span
                                className={`text-[11px] truncate max-w-xs font-sans ${
                                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                                }`}
                              >
                                {m.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4/5/6. Role-specific columns */}
                        {viewFilter === "pending" ? (
                          <>
                            {/* Requested Role & Status */}
                            <td className="py-3 px-4 align-middle">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] border uppercase ${
                                    isDark
                                      ? "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/30"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  {m.role}
                                </span>
                                <span
                                  className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] border uppercase ${
                                    m.status === "rejected"
                                      ? isDark
                                        ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                                        : "bg-red-50 text-red-700 border-red-200"
                                      : isDark
                                      ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </div>
                            </td>

                            {/* Phone */}
                            <td className="py-3 px-4 align-middle font-berkeley-mono text-[11px]">
                              <PhoneContact phone={m.mobile_number} />
                            </td>

                            {/* Academic Year */}
                            <td className="py-3 px-4 align-middle">
                              <span
                                className={`font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[3px] border ${
                                  isDark
                                    ? "bg-[#161718] border-[#23252a] text-[#8a8f98]"
                                    : "bg-gray-100 border-gray-200 text-gray-700"
                                }`}
                              >
                                Year {m.level}
                              </span>
                            </td>

                            {/* Pending Actions */}
                            <td className="py-3 px-4 align-middle text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleApprove(m)}
                                  className={`h-6 px-2 rounded-[4px] border font-berkeley-mono text-[10px] font-[510] transition-colors flex items-center gap-1 ${
                                    isDark
                                      ? "bg-[#27a644]/10 hover:bg-[#27a644]/20 text-[#27a644] border-[#27a644]/30"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                  }`}
                                  title="Approve Member"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                {m.status === "pending" && (
                                  <button
                                    onClick={() => handleReject(m)}
                                    className={`h-6 px-2 rounded-[4px] border font-berkeley-mono text-[10px] transition-colors flex items-center gap-1 ${
                                      isDark
                                        ? "bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30"
                                        : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                                    }`}
                                    title="Reject Registration"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditPending(m)}
                                  className={`h-6 px-2 rounded-[4px] border font-berkeley-mono text-[10px] transition-colors ${
                                    isDark
                                      ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                                      : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-sm"
                                  }`}
                                  title="Edit details"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePending(m)}
                                  className={`p-1 rounded-[4px] transition-colors ${
                                    isDark
                                      ? "text-[#62666d] hover:text-[#eb5757] hover:bg-[#eb5757]/10"
                                      : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  }`}
                                  title="Permanently Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Academic Level */}
                            <td className="py-3 px-4 align-middle">
                              {m.level ? (
                                <span
                                  className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] border ${
                                    m.level > 4
                                      ? isDark
                                        ? "bg-[#161718] text-[#8a8f98] border-[#23252a]"
                                        : "bg-gray-100 text-gray-600 border-gray-200"
                                      : isDark
                                      ? "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/30"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  {m.level > 4 ? "ALUMNI" : `LEVEL ${m.level}`}
                                </span>
                              ) : (
                                <span
                                  className={`font-berkeley-mono text-[11px] ${
                                    isDark ? "text-[#62666d]" : "text-gray-400"
                                  }`}
                                >
                                  —
                                </span>
                              )}
                            </td>

                            {/* Position & Function */}
                            <td className="py-3 px-4 align-middle">
                              <div className="flex flex-col">
                                <span
                                  className={`font-[510] text-[12.5px] leading-tight ${
                                    isDark ? "text-white" : "text-gray-900"
                                  }`}
                                >
                                  {m.st_position || m.member_function || "General Member"}
                                </span>
                                {m.st_position && m.member_function && (
                                  <span
                                    className={`text-[11px] font-berkeley-mono ${
                                      isDark ? "text-[#8a8f98]" : "text-gray-500"
                                    }`}
                                  >
                                    {m.member_function}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Contact & Links */}
                            <td className="py-3 px-4 align-middle font-berkeley-mono text-[11px]">
                              <div className="flex items-center gap-2">
                                <PhoneContact phone={m.mobile_number} />
                                {m.linkedin_url && (
                                  <a
                                    href={m.linkedin_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`p-1 rounded-[3px] transition-colors ${
                                      isDark
                                        ? "text-[#8a8f98] hover:text-[#818cf8] hover:bg-[#161718]"
                                        : "text-gray-400 hover:text-indigo-600 hover:bg-gray-100"
                                    }`}
                                    title="Open LinkedIn Profile"
                                  >
                                    <LinkedInIcon className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Active Actions */}
                            <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {isAdmin ? (
                                  <>
                                    <button
                                      onClick={() => openEdit(m)}
                                      className={`p-1 rounded-[4px] border border-transparent transition-all ${
                                        isDark
                                          ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] hover:border-[#23252a]"
                                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100 hover:border-gray-200"
                                      }`}
                                      title="Edit Member"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(m.st_id)}
                                      className={`p-1 rounded-[4px] border border-transparent transition-all ${
                                        isDark
                                          ? "text-[#8a8f98] hover:text-[#eb5757] hover:bg-[#eb5757]/10 hover:border-[#eb5757]/30"
                                          : "text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                                      }`}
                                      title="Delete Member"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => openViewProfile(m.st_id)}
                                    className={`h-6 px-2.5 rounded-[4px] border font-berkeley-mono text-[11px] transition-colors flex items-center gap-1 ${
                                      isDark
                                        ? "bg-[#161718] hover:bg-[#23252a] text-[#d0d6e0] hover:text-white border-[#23252a]"
                                        : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-sm"
                                    }`}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Dossier</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Table Pagination ── */}
          <div
            className={`border-t px-4 py-2 ${
              isDark ? "border-[#23252a]" : "border-gray-200 bg-gray-50/50"
            }`}
          >
            <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MODAL 1: Add / Edit Member
         ═══════════════════════════════════════════════ */}
      {modal && (
        <div
          className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto ${
            isDark ? "bg-[#08090a]/80" : "bg-slate-900/40"
          }`}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className={`border rounded-[12px] w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]"
                : "bg-white border-gray-200 text-gray-800 shadow-xl"
            }`}
          >
            {/* Header */}
            <div
              className={`flex justify-between items-center pb-3 border-b ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users
                  className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`}
                />
                <h2
                  className={`text-[15px] font-[590] ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {editTarget ? `Edit Member: ${editTarget}` : "Add New Society Member"}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  isDark
                    ? "hover:bg-[#161718] text-[#8a8f98] hover:text-white"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {msg && (
              <div
                className={`p-3 rounded-[6px] text-[12px] font-berkeley-mono border ${
                  msg.type === "error"
                    ? isDark
                      ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                      : "bg-red-50 text-red-700 border-red-200"
                    : isDark
                    ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {msg.text}
              </div>
            )}

            {/* ST ID & Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Student ID (ST ID) *
                </label>
                <input
                  placeholder="e.g. SC/2022/12984"
                  value={form.st_id}
                  onChange={(e) => setForm({ ...form, st_id: e.target.value })}
                  disabled={!!editTarget && !editProfileTarget}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border disabled:opacity-40 font-berkeley-mono transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
                {form.st_id && !/^(?:SC\/)?\d{4}\/\d{5}$/i.test(form.st_id.trim()) && (
                  <span
                    className={`text-[11px] font-berkeley-mono mt-1 block ${
                      isDark ? "text-[#eb5757]" : "text-red-600"
                    }`}
                  >
                    Correct format: SC/2022/12984
                  </span>
                )}
              </div>
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Academic Level / Year
                </label>
                <input
                  type="number"
                  placeholder="1-6"
                  min="1"
                  max="6"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border font-berkeley-mono transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
              </div>
            </div>

            {/* Full Name & Preferred Calling Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Full Name *
                </label>
                <input
                  placeholder="Student full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Preferred / Calling Name
                </label>
                <input
                  placeholder="e.g. Pathum"
                  value={form.preferred_name}
                  onChange={(e) => setForm({ ...form, preferred_name: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label
                className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-600"
                }`}
              >
                Email Address
              </label>
              <input
                type="email"
                placeholder="student@ruh.ac.lk"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border transition-colors ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                    : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                }`}
              />
            </div>

            {/* Role selection for pending profiles OR Position/Function */}
            {editProfileTarget ? (
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Requested Role / Access Tier
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border font-berkeley-mono transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                >
                  <option value="member">Member</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                      isDark ? "text-[#8a8f98]" : "text-gray-600"
                    }`}
                  >
                    Student Position
                  </label>
                  <input
                    placeholder="e.g. President, Secretary..."
                    value={form.st_position}
                    onChange={(e) => setForm({ ...form, st_position: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                        : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                      isDark ? "text-[#8a8f98]" : "text-gray-600"
                    }`}
                  >
                    Member Function
                  </label>
                  <input
                    placeholder="e.g. Finance, Logistics, PR..."
                    value={form.member_function}
                    onChange={(e) => setForm({ ...form, member_function: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                        : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Contact & Social */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Mobile / WhatsApp Number
                </label>
                <input
                  placeholder="+94771234567"
                  value={form.mobile_number}
                  onChange={(e) => setForm({ ...form, mobile_number: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border font-berkeley-mono transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  LinkedIn Profile URL
                </label>
                <input
                  placeholder="https://linkedin.com/in/..."
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border font-berkeley-mono transition-colors ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                  }`}
                />
              </div>
            </div>

            {/* Avatar URL */}
            <div>
              <label
                className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-600"
                }`}
              >
                Profile Photo URL
              </label>
              <input
                placeholder="https://example.com/avatar.jpg"
                value={form.profile_image_url}
                onChange={(e) => setForm({ ...form, profile_image_url: e.target.value })}
                className={`w-full rounded-[6px] px-3 py-1.5 text-[13px] border font-berkeley-mono transition-colors ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-white focus:outline-none focus:border-[#d0d6e0]"
                    : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                }`}
              />
            </div>

            {/* Footer */}
            <div
              className={`flex justify-end gap-2 pt-3 border-t ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <button
                onClick={closeModal}
                className={`px-3.5 py-1.5 rounded-[6px] text-[12px] font-[510] border transition-colors ${
                  isDark
                    ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                    : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-300 shadow-sm"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] transition-all disabled:opacity-40 shadow-sm ${
                  isDark
                    ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {saving ? "Saving..." : editTarget ? "Update Member" : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL 2: CSV Importer
         ═══════════════════════════════════════════════ */}
      {csvModal && (
        <div
          className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto ${
            isDark ? "bg-[#08090a]/80" : "bg-slate-900/40"
          }`}
          onClick={(e) => e.target === e.currentTarget && !importing && closeCsvModal()}
        >
          <div
            className={`border rounded-[12px] w-full max-w-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]"
                : "bg-white border-gray-200 text-gray-800 shadow-xl"
            }`}
          >
            <div
              className={`flex justify-between items-center pb-3 border-b ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet
                  className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`}
                />
                <h2
                  className={`text-[15px] font-[590] ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Import Members via CSV
                </h2>
              </div>
              <button
                onClick={closeCsvModal}
                disabled={importing}
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  isDark
                    ? "hover:bg-[#161718] text-[#8a8f98] hover:text-white"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importResult ? (
              <div className="space-y-4">
                <div
                  className={`p-3 border rounded-[6px] text-[12px] font-berkeley-mono flex items-center gap-2 ${
                    isDark
                      ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Batch import finished successfully.</span>
                </div>

                <div
                  className={`border rounded-[6px] p-3 font-berkeley-mono text-[12px] space-y-1.5 ${
                    isDark
                      ? "bg-[#161718] border-[#23252a]"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                      Processed:
                    </span>
                    <strong className={isDark ? "text-white" : "text-gray-900"}>
                      {importResult.success} members
                    </strong>
                  </div>
                  {importResult.skipped > 0 && (
                    <div className="flex justify-between">
                      <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                        Skipped (Duplicates):
                      </span>
                      <strong className={isDark ? "text-[#f59e0b]" : "text-amber-600"}>
                        {importResult.skipped} members
                      </strong>
                    </div>
                  )}
                  {importResult.validationSkipped > 0 && (
                    <div className="flex justify-between">
                      <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                        Validation Failures:
                      </span>
                      <strong className={isDark ? "text-[#eb5757]" : "text-red-600"}>
                        {importResult.validationSkipped} rows
                      </strong>
                    </div>
                  )}
                  {importResult.failed > 0 && (
                    <div className="flex justify-between">
                      <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                        Database Errors:
                      </span>
                      <strong className={isDark ? "text-[#eb5757]" : "text-red-600"}>
                        {importResult.failed} records
                      </strong>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] shadow-sm ${
                      isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-indigo-600 text-white"
                    }`}
                    onClick={closeCsvModal}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : importing ? (
              <div className="py-8 text-center space-y-3">
                <div
                  className={`w-full rounded-full h-2 border overflow-hidden ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-200 border-gray-300"
                  }`}
                >
                  <div
                    className={`h-full transition-all duration-300 ${
                      isDark ? "bg-[#e4f222]" : "bg-indigo-600"
                    }`}
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div
                  className={`flex justify-between font-berkeley-mono text-[11px] ${
                    isDark ? "text-[#8a8f98]" : "text-gray-500"
                  }`}
                >
                  <span>Writing records to Supabase...</span>
                  <span>{importProgress}%</span>
                </div>
              </div>
            ) : parsedData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-berkeley-mono text-[11px] uppercase tracking-wider ${
                      isDark ? "text-[#8a8f98]" : "text-gray-500"
                    }`}
                  >
                    Header Field Mapping
                  </span>
                  <span
                    className={`font-berkeley-mono text-[11px] ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {parsedData.validRows.length} valid / {parsedData.rows.length} total rows
                  </span>
                </div>

                <div
                  className={`grid grid-cols-2 gap-2 p-3 rounded-[6px] border font-berkeley-mono text-[11px] ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div>
                    <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                      Student ID:{" "}
                    </span>
                    {parsedData.mapping.st_id !== -1 ? (
                      <span className={isDark ? "text-[#27a644]" : "text-emerald-600 font-semibold"}>
                        Mapped
                      </span>
                    ) : (
                      <span className={isDark ? "text-[#eb5757]" : "text-red-600 font-semibold"}>
                        Missing *
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                      Full Name:{" "}
                    </span>
                    {parsedData.mapping.name !== -1 ? (
                      <span className={isDark ? "text-[#27a644]" : "text-emerald-600 font-semibold"}>
                        Mapped
                      </span>
                    ) : (
                      <span className={isDark ? "text-[#eb5757]" : "text-red-600 font-semibold"}>
                        Missing *
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                      Level/Year:{" "}
                    </span>
                    {parsedData.mapping.level !== -1 ? (
                      <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>
                        Mapped
                      </span>
                    ) : (
                      <span className={isDark ? "text-[#62666d]" : "text-gray-400"}>Unset</span>
                    )}
                  </div>
                  <div>
                    <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>
                      Position:{" "}
                    </span>
                    {parsedData.mapping.st_position !== -1 ? (
                      <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>
                        Mapped
                      </span>
                    ) : (
                      <span className={isDark ? "text-[#62666d]" : "text-gray-400"}>Unset</span>
                    )}
                  </div>
                </div>

                {parsedData.mapping.st_id === -1 || parsedData.mapping.name === -1 ? (
                  <div
                    className={`p-3 border rounded-[6px] text-[12px] font-berkeley-mono ${
                      isDark
                        ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    Missing required columns. Please ensure your CSV includes headers for Student ID and Full Name.
                  </div>
                ) : (
                  <>
                    <div
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-[6px] border ${
                        isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <span
                        className={`font-berkeley-mono text-[11px] ${
                          isDark ? "text-[#8a8f98]" : "text-gray-600"
                        }`}
                      >
                        Duplicate Policy:
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDuplicateStrategy("upsert")}
                          className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[10.5px] border ${
                            duplicateStrategy === "upsert"
                              ? isDark
                                ? "bg-[#23252a] text-white border-[#383b3f]"
                                : "bg-white text-indigo-700 border-indigo-300 shadow-sm font-semibold"
                              : isDark
                              ? "bg-[#0f1011] text-[#8a8f98] border-[#23252a]"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          Upsert (Update)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuplicateStrategy("ignore")}
                          className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[10.5px] border ${
                            duplicateStrategy === "ignore"
                              ? isDark
                                ? "bg-[#23252a] text-white border-[#383b3f]"
                                : "bg-white text-indigo-700 border-indigo-300 shadow-sm font-semibold"
                              : isDark
                              ? "bg-[#0f1011] text-[#8a8f98] border-[#23252a]"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          Skip Duplicates
                        </button>
                      </div>
                    </div>

                    {parsedData.errors.length > 0 && (
                      <div
                        className={`p-3 border rounded-[6px] font-berkeley-mono text-[11px] max-h-28 overflow-y-auto space-y-1 ${
                          isDark
                            ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        <div className="font-[590]">Validation Warnings:</div>
                        {parsedData.errors.map((err, idx) => (
                          <div key={idx}>· {err}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div
                  className={`flex justify-end gap-2 pt-2 border-t ${
                    isDark ? "border-[#23252a]" : "border-gray-200"
                  }`}
                >
                  <button
                    className={`px-3.5 py-1.5 rounded-[6px] text-[12px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] text-[#8a8f98] hover:text-white border-[#23252a]"
                        : "bg-white text-gray-700 hover:text-gray-900 border-gray-300 shadow-sm"
                    }`}
                    onClick={() => setParsedData(null)}
                  >
                    Back
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] disabled:opacity-40 shadow-sm ${
                      isDark
                        ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                    disabled={
                      parsedData.mapping.st_id === -1 ||
                      parsedData.mapping.name === -1 ||
                      parsedData.validRows.length === 0
                    }
                    onClick={handleImportSubmit}
                  >
                    Import {parsedData.validRows.length} Members
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-[8px] p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? isDark
                        ? "border-[#e4f222] bg-[#e4f222]/5"
                        : "border-indigo-500 bg-indigo-50/50"
                      : isDark
                      ? "border-[#23252a] hover:border-[#383b3f] bg-[#161718]"
                      : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
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
                  <div
                    className={`w-10 h-10 rounded-[6px] border flex items-center justify-center mx-auto mb-2 ${
                      isDark
                        ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98]"
                        : "bg-white border-gray-200 text-gray-500 shadow-sm"
                    }`}
                  >
                    <Upload
                      className={`w-5 h-5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`}
                    />
                  </div>
                  <div
                    className={`text-[13px] font-[510] mb-1 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Drag & drop CSV file here, or click to browse
                  </div>
                  <div
                    className={`text-[11px] font-berkeley-mono ${
                      isDark ? "text-[#62666d]" : "text-gray-500"
                    }`}
                  >
                    Required: st_id, name. Optional: preferred_name, email, level, st_position, member_function, mobile_number, linkedin_url
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-berkeley-mono pt-1">
                  <span className={isDark ? "text-[#62666d]" : "text-gray-500"}>
                    Need reference format?
                  </span>
                  <button
                    className={`underline transition-colors ${
                      isDark
                        ? "text-[#d0d6e0] hover:text-[#e4f222]"
                        : "text-indigo-600 hover:text-indigo-700 font-medium"
                    }`}
                    onClick={downloadTemplate}
                  >
                    Download Template CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL 3: Self-Edit Permissions
         ═══════════════════════════════════════════════ */}
      {editSettingsModal && (
        <div
          className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto ${
            isDark ? "bg-[#08090a]/80" : "bg-slate-900/40"
          }`}
          onClick={(e) => e.target === e.currentTarget && setEditSettingsModal(false)}
        >
          <div
            className={`border rounded-[12px] w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]"
                : "bg-white border-gray-200 text-gray-800 shadow-xl"
            }`}
          >
            <div
              className={`flex justify-between items-center pb-3 border-b ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`}
                />
                <h2
                  className={`text-[15px] font-[590] ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Member Self-Edit Permissions
                </h2>
              </div>
              <button
                onClick={() => setEditSettingsModal(false)}
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-colors ${
                  isDark
                    ? "hover:bg-[#161718] text-[#8a8f98] hover:text-white"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p
              className={`text-[12px] leading-relaxed ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              Configure which profile fields members are allowed to modify directly from their My Credentials page.
            </p>

            {settingsMsg && (
              <div
                className={`p-2.5 rounded-[6px] text-[11px] font-berkeley-mono border ${
                  settingsMsg.type === "error"
                    ? isDark
                      ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                      : "bg-red-50 text-red-700 border-red-200"
                    : isDark
                    ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {settingsMsg.text}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                Quick Actions:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => toggleAllPermissions(true)}
                  className={`text-[11px] font-berkeley-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    isDark
                      ? "border-[#23252a] text-[#d0d6e0] hover:text-white hover:border-[#8a8f98] bg-[#161718]"
                      : "border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 bg-white"
                  }`}
                >
                  Enable All
                </button>
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => toggleAllPermissions(false)}
                  className={`text-[11px] font-berkeley-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    isDark
                      ? "border-[#23252a] text-[#8a8f98] hover:text-white hover:border-[#8a8f98] bg-[#161718]"
                      : "border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-400 bg-white"
                  }`}
                >
                  Disable All
                </button>
              </div>
            </div>

            <div
              className={`space-y-1 p-2 rounded-[8px] border ${
                isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
              }`}
            >
              {[
                { key: "name", label: "Full Name", desc: "Allow editing legal full name" },
                { key: "preferred_name", label: "Preferred Name", desc: "Allow editing calling name" },
                { key: "photo", label: "Profile Photo", desc: "Allow photo uploading/updating" },
                { key: "whatsapp", label: "WhatsApp / Mobile", desc: "Allow editing mobile phone" },
                { key: "linkedin", label: "LinkedIn URL", desc: "Allow linking professional profile" },
                { key: "position", label: "Student Position", desc: "Allow editing society role/title" },
                { key: "function", label: "Member Function", desc: "Allow editing team assignment" },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center justify-between p-2 rounded-[6px] transition-colors cursor-pointer border-b last:border-b-0 ${
                    isDark 
                      ? "border-[#23252a]/60 hover:bg-[#1f2125]" 
                      : "border-gray-200 hover:bg-gray-100/70"
                  }`}
                >
                  <div>
                    <span
                      className={`text-[12.5px] font-[510] block ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-[10.5px] block ${
                        isDark ? "text-[#8a8f98]" : "text-gray-500"
                      }`}
                    >
                      {item.desc}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!editPermissions[item.key]}
                    disabled={savingSettings}
                    onChange={(e) => togglePermission(item.key, e.target.checked)}
                    className={`w-4 h-4 rounded cursor-pointer ${
                      isDark ? "accent-[#e4f222]" : "accent-indigo-600"
                    }`}
                  />
                </label>
              ))}
            </div>

            <div
              className={`flex justify-end pt-2 border-t ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <button
                className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] shadow-sm ${
                  isDark
                    ? "bg-[#e4f222] text-[#08090a]"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                onClick={() => setEditSettingsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Profile Modal ── */}
      <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
    </div>
  );
}
