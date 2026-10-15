import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import EventSelect from "../components/EventSelect";
import { StudentNameLink } from "../components/StudentProfileContext";
import GatePassScannerModal from "../components/GatePassScannerModal";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Users,
  QrCode,
  Upload,
  Download,
  Search,
  X,
  Copy,
  Trash2,
  Clock,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Plus,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  SlidersHorizontal,
  Info,
  Camera
} from "lucide-react";

const PAGE_SIZE = 10;

export default function Attendance({
  isAdmin = false,
  session = { role: "guest", stId: "" },
  role = "guest",
  onNavigate,
  theme
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") || 
             document.documentElement.getAttribute("data-theme") === "dark" 
             ? "dark" : "light";
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
    const observer = new MutationObserver(() => {
      const isDocDark = document.documentElement.classList.contains("dark") || 
                        document.documentElement.getAttribute("data-theme") === "dark";
      setCurrentTheme(isDocDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme === "dark";

  const isStaff = isAdmin || role === "admin" || role === "editor" || session?.role === "admin" || session?.role === "editor";
  const hasStId = Boolean(session?.stId);

  // Perspective tab:
  // For staff: "members" | "csv" | "my"
  // For non-staff members: "my" | "live"
  const [activeTab, setActiveTab] = useState(isStaff ? "members" : "my");

  // Events & selection
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [eventsLoading, setEventsLoading] = useState(true);

  // Society Members Attendance State
  const [attendance, setAttendance] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "YES" | "NO"
  const [levelFilter, setLevelFilter] = useState("all"); // "all" | "1" | "2" | "3" | "4"
  const [attendanceCounts, setAttendanceCounts] = useState({ yes: 0, no: 0, total: 0 });
  const [allSocietyMembers, setAllSocietyMembers] = useState([]);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStIdInput, setAddStIdInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addModalMsg, setAddModalMsg] = useState(null);

  // Gate Pass Camera Scanner State
  const [showGatePassScanner, setShowGatePassScanner] = useState(false);

  // Bulk confirmation state
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: "all_yes" | "all_no" | "clear_csv", title: "", message: "", onConfirm: () => {} }

  // Personal "My Attendance" State
  const [myAttendance, setMyAttendance] = useState([]);
  const [myPage, setMyPage] = useState(0);
  const [myTotal, setMyTotal] = useState(0);
  const [myCounts, setMyCounts] = useState({ yes: 0, no: 0 });
  const [mySearch, setMySearch] = useState("");
  const [myLoading, setMyLoading] = useState(false);

  // Live Self-Attendance (Today's active events)
  const [activeTodayEvents, setActiveTodayEvents] = useState([]);
  const [loadingActiveEvents, setLoadingActiveEvents] = useState(false);
  const [markingMap, setMarkingMap] = useState({});

  // External CSV Registration State
  const [csvFile, setCsvFile] = useState(null);
  const [csvRegistrations, setCsvRegistrations] = useState([]);
  const [csvTotal, setCsvTotal] = useState(0);
  const [csvPage, setCsvPage] = useState(0);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvStatusFilter, setCsvStatusFilter] = useState("all"); // "all" | "YES" | "NO"
  const [csvMemberFilter, setCsvMemberFilter] = useState("all"); // "all" | "members" | "non_members"
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMsg, setCsvMsg] = useState(null);
  const [csvStats, setCsvStats] = useState({ total: 0, members: 0, nonMembers: 0, present: 0 });
  const [memberIds, setMemberIds] = useState(new Set());
  const [dbSetupRequired, setDbSetupRequired] = useState(false);

  // Dynamic QR Code State
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrCountdown, setQrCountdown] = useState(60);
  const [liveScans, setLiveScans] = useState(0);
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Toast / Status Message
  const [notification, setNotification] = useState(null);

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  // CSV Parser
  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") lines.push(row);
    return lines;
  };

  // Fetch Member IDs and full profiles for fast offline lookup & instant photo display
  useEffect(() => {
    supabase
      .from("members")
      .select("st_id, name, preferred_name, level, st_position, member_function, email, mobile_number, profile_image_url, linkedin_url")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) {
          setAllSocietyMembers(data);
          const ids = new Set(data.map(m => m.st_id));
          setMemberIds(ids);
        }
      });
  }, []);

  // Fetch Events
  useEffect(() => {
    setEventsLoading(true);
    supabase.from("events")
      .select("event_id, name, date, time, self_attendance_enabled")
      .order("date", { ascending: false })
      .then(({ data }) => {
        const evs = data || [];
        setEvents(evs);
        if (evs.length && !selectedEvent) {
          setSelectedEvent(evs[0].event_id);
        }
        setEventsLoading(false);
      });
  }, []);

  // Selected Event Object
  const selectedEventInfo = useMemo(() => {
    return events.find(e => e.event_id === selectedEvent);
  }, [events, selectedEvent]);

  // Today string
  const todayStr = useMemo(() => new Date().toLocaleDateString("sv-SE"), []);

  // Event status calculation
  const selectedEventStatus = useMemo(() => {
    if (!selectedEventInfo?.date) return null;
    if (selectedEventInfo.date > todayStr) return { 
      label: "Upcoming", 
      color: isDark ? "text-[#818cf8]" : "text-indigo-600", 
      bg: isDark ? "bg-[#818cf8]/10" : "bg-indigo-50", 
      border: isDark ? "border-[#818cf8]/25" : "border-indigo-200" 
    };
    if (selectedEventInfo.date === todayStr) return { 
      label: "Today", 
      color: isDark ? "text-[#27a644]" : "text-emerald-600", 
      bg: isDark ? "bg-[#27a644]/10" : "bg-emerald-50", 
      border: isDark ? "border-[#27a644]/30" : "border-emerald-200", 
      pulse: true 
    };
    return { 
      label: "Completed", 
      color: isDark ? "text-[#8a8f98]" : "text-gray-600", 
      bg: isDark ? "bg-[#161718]" : "bg-gray-100", 
      border: isDark ? "border-[#23252a]" : "border-gray-200" 
    };
  }, [selectedEventInfo, todayStr, isDark]);

  // Time range check
  const isTimeWithinRange = (timeStr) => {
    if (!timeStr) return true;
    try {
      const cleanStr = timeStr.toLowerCase().replace(/\s+/g, ' ');
      const parts = cleanStr.split(/[-–—]| to /);
      if (parts.length !== 2) return true;

      const parseTime = (str) => {
        const match = str.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const startMin = parseTime(parts[0].trim());
      const endMin = parseTime(parts[1].trim());
      if (startMin === null || endMin === null) return true;

      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (startMin > endMin) return currentMin >= startMin || currentMin <= endMin;
      return currentMin >= startMin && currentMin <= endMin;
    } catch {
      return true;
    }
  };

  // ──────────────────────────────────────────────
  // 1. FETCH SOCIETY MEMBERS ATTENDANCE
  // ──────────────────────────────────────────────
  const fetchSocietyAttendance = async () => {
    if (!selectedEvent) {
      setAttendance([]);
      setTotal(0);
      setAttendanceCounts({ yes: 0, no: 0, total: 0 });
      return;
    }
    setLoading(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Base query
      let selectStr = "st_id, attend, members(name, level)";
      if (levelFilter !== "all") {
        selectStr = "st_id, attend, members!inner(name, level)";
      }

      let query = supabase
        .from("attendance")
        .select(selectStr, { count: "exact" })
        .eq("event_id", selectedEvent)
        .order("st_id")
        .range(from, to);

      if (levelFilter !== "all") {
        query = query.eq("members.level", parseInt(levelFilter, 10));
      }

      if (statusFilter !== "all") {
        query = query.eq("attend", statusFilter);
      }

      const q = search.trim();
      if (q) {
        query = query.or(`st_id.ilike.%${q}%,attend.ilike.%${q}%`);
      }

      const [recordsRes, yesRes, noRes, totalRes] = await Promise.all([
        query,
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "YES"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "NO"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent)
      ]);

      if (recordsRes.error) {
        console.error("Attendance query error:", recordsRes.error);
        showNotification("error", recordsRes.error.message);
      } else {
        setAttendance(recordsRes.data || []);
        setTotal(recordsRes.count || 0);
      }

      setAttendanceCounts({
        yes: yesRes.count || 0,
        no: noRes.count || 0,
        total: totalRes.count || 0
      });
    } catch (err) {
      console.error(err);
      showNotification("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "members") {
      fetchSocietyAttendance();
    }
  }, [selectedEvent, page, search, statusFilter, levelFilter, activeTab]);

  // Toggle single member attendance (Syncs both attendance table and event_registrations)
  const toggleAttendance = async (stId, currentVal) => {
    if (!isStaff) return;
    const newVal = currentVal === "YES" ? "NO" : "YES";
    setSaving(s => ({ ...s, [stId]: true }));

    const { error } = await supabase
      .from("attendance")
      .update({ attend: newVal })
      .eq("st_id", stId)
      .eq("event_id", selectedEvent);

    if (error) {
      showNotification("error", "Failed to update attendance: " + error.message);
    } else {
      setAttendance(prev => prev.map(a => a.st_id === stId ? { ...a, attend: newVal } : a));
      setAttendanceCounts(prev => ({
        ...prev,
        yes: prev.yes + (newVal === "YES" ? 1 : -1),
        no: prev.no + (newVal === "NO" ? 1 : -1)
      }));

      // SYNC TO CSV REGISTRATIONS ROSTER AS WELL
      const norm = stId.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "");
      const scVariant = `SC/${norm}`;
      supabase
        .from("event_registrations")
        .update({ attend: newVal, is_member: true })
        .eq("event_id", selectedEvent)
        .or(`st_id.ilike.${stId},st_id.ilike.${norm},st_id.ilike.${scVariant}`)
        .then(({ error: csvErr }) => {
          if (!csvErr) {
            setCsvRegistrations(prev => prev.map(r => {
              const rNorm = r.st_id?.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "");
              if (rNorm === norm || r.st_id === stId) {
                return { ...r, attend: newVal, is_member: true };
              }
              return r;
            }));
            setCsvStats(prev => ({
              ...prev,
              present: Math.max(0, prev.present + (newVal === "YES" ? 1 : -1))
            }));
          }
        });
    }
    setSaving(s => ({ ...s, [stId]: false }));
  };

  // Bulk mark all (Syncs both attendance table and event_registrations)
  const handleMarkAll = async (val) => {
    if (!isStaff || !selectedEvent) return;
    setSaving({ _all: true });

    const { error } = await supabase
      .from("attendance")
      .update({ attend: val })
      .eq("event_id", selectedEvent);

    if (error) {
      showNotification("error", "Bulk update failed: " + error.message);
    } else {
      setAttendance(prev => prev.map(a => ({ ...a, attend: val })));
      setAttendanceCounts(prev => ({
        ...prev,
        yes: val === "YES" ? prev.total : 0,
        no: val === "NO" ? prev.total : 0
      }));

      // Also sync all is_member rows in event_registrations
      supabase
        .from("event_registrations")
        .update({ attend: val })
        .eq("event_id", selectedEvent)
        .eq("is_member", true)
        .then(() => {
          setCsvRegistrations(prev => prev.map(r => r.is_member ? { ...r, attend: val } : r));
        });

      showNotification("success", `Marked all attendees as ${val === "YES" ? "Present" : "Absent"}.`);
    }
    setSaving({});
    setConfirmDialog(null);
  };

  // Add Member manually
  const handleAddMember = async (e) => {
    if (e) e.preventDefault();
    if (!isStaff || !selectedEvent) return;
    const stId = addStIdInput.trim();
    if (!stId) {
      setAddModalMsg({ type: "error", text: "Please enter a valid Student ID." });
      return;
    }

    setAddLoading(true);
    setAddModalMsg(null);

    const { error } = await supabase
      .from("attendance")
      .insert([{ st_id: stId, event_id: selectedEvent, attend: "NO" }]);

    setAddLoading(false);
    if (error) {
      if (error.code === "23505") {
        setAddModalMsg({ type: "error", text: "This student is already in the attendance list for this event." });
      } else {
        setAddModalMsg({ type: "error", text: error.message });
      }
    } else {
      showNotification("success", `Added ${stId} to attendance roster.`);
      setAddStIdInput("");
      setShowAddModal(false);
      fetchSocietyAttendance();
    }
  };

  // Export Society Member Attendance CSV
  const handleExportSocietyMembersCSV = async () => {
    if (!selectedEvent) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("st_id, attend, members(name, level)")
        .eq("event_id", selectedEvent)
        .order("st_id");

      if (error) throw error;
      if (!data || data.length === 0) {
        showNotification("error", "No attendance records found to export.");
        setLoading(false);
        return;
      }

      const escape = (val) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const header = ["Student ID", "Full Name", "Level", "Attendance Status"];
      const rows = data.map(r => [
        r.st_id,
        r.members?.name || "-",
        r.members?.level ? `Year ${r.members.level}` : "-",
        r.attend === "YES" ? "Present" : "Absent"
      ]);

      const csvContent = [header.join(","), ...rows.map(row => row.map(escape).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_society_${selectedEvent}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("success", "Exported attendance report.");
    } catch (err) {
      showNotification("error", "Export failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // 2. FETCH EXTERNAL CSV REGISTRATIONS
  // ──────────────────────────────────────────────
  const fetchCSVRegistrations = async () => {
    if (!selectedEvent) return;
    setCsvLoading(true);
    setDbSetupRequired(false);

    try {
      // 1. Fetch counts
      const { data: statsData, error: statsError } = await supabase
        .from("event_registrations")
        .select("id, is_member, attend")
        .eq("event_id", selectedEvent);

      if (statsError) {
        if (statsError.code === "42P01") {
          setDbSetupRequired(true);
          setCsvLoading(false);
          return;
        }
        throw statsError;
      }

      const stats = { total: 0, members: 0, nonMembers: 0, present: 0 };
      statsData?.forEach(r => {
        stats.total++;
        if (r.is_member) stats.members++;
        else stats.nonMembers++;
        if (r.attend === "YES") stats.present++;
      });
      setCsvStats(stats);
      setLiveScans(stats.present);

      // 2. Fetch paginated
      const from = csvPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("event_registrations")
        .select("*", { count: "exact" })
        .eq("event_id", selectedEvent)
        .order("st_id")
        .range(from, to);

      if (csvStatusFilter !== "all") {
        query = query.eq("attend", csvStatusFilter);
      }

      if (csvMemberFilter === "members") {
        query = query.eq("is_member", true);
      } else if (csvMemberFilter === "non_members") {
        query = query.eq("is_member", false);
      }

      const q = csvSearch.trim();
      if (q) {
        query = query.or(`st_id.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setCsvRegistrations(data || []);
      setCsvTotal(count || 0);
    } catch (err) {
      console.error("Error fetching CSV registrations:", err);
      setCsvMsg({ type: "error", text: err.message });
    } finally {
      setCsvLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "csv" && selectedEvent) {
      fetchCSVRegistrations();
    }
  }, [selectedEvent, csvPage, csvSearch, csvStatusFilter, csvMemberFilter, activeTab]);

  // Dynamic QR Token Generator
  const generateToken = () => {
    const expiry = Math.floor(Date.now() / 60000);
    const hash = (expiry * 17 + 23).toString(16);
    const payload = { eventId: selectedEvent, exp: expiry, hash };
    return btoa(JSON.stringify(payload));
  };

  // QR Countdown Effect
  useEffect(() => {
    if (!showQR || !selectedEvent) return;

    const updateToken = () => {
      setQrToken(generateToken());
    };

    updateToken();
    const initialSecs = 60 - new Date().getSeconds();
    setQrCountdown(initialSecs);

    const timer = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          updateToken();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showQR, selectedEvent]);

  // Live Scans Sync
  useEffect(() => {
    if (!showQR || !selectedEvent) return;

    const fetchCount = () => {
      supabase.from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEvent)
        .eq("attend", "YES")
        .then(({ count }) => {
          if (count !== undefined) setLiveScans(count);
        });
    };

    fetchCount();
    const syncTimer = setInterval(fetchCount, 5000);
    return () => clearInterval(syncTimer);
  }, [showQR, selectedEvent]);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    showNotification("info", `Selected: ${file.name}. Ready to import.`);
  };

  const importCSVData = async () => {
    if (!csvFile || !selectedEvent) return;
    setCsvLoading(true);
    setCsvMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          setCsvMsg({ type: "error", text: "The CSV file is empty or has no header." });
          setCsvLoading(false);
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const stIdIdx = headers.findIndex(h => h.includes("index") || h.includes("student") || h.includes("st") || h.includes("id") || h.includes("reg"));
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("full"));
        const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const phoneIdx = headers.findIndex(h => (h.includes("phone") || h.includes("mobile") || h.includes("contact") || h.includes("whatsapp") || h.includes("number")) && !h.includes("index") && !h.includes("student") && !h.includes("st id") && !h.includes("reg"));
        const degreeIdx = headers.findIndex(h => h.includes("degree") || h.includes("program") || h.includes("course"));
        const levelIdx = headers.findIndex(h => h.includes("level") || h.includes("year"));
        const attendIdx = headers.findIndex(h => h.includes("attend") || h.includes("present") || h.includes("status"));

        if (stIdIdx === -1 || nameIdx === -1) {
          setCsvMsg({ type: "error", text: "Could not find 'Index Number/Student ID' and 'Name' columns in CSV headers." });
          setCsvLoading(false);
          return;
        }

        const registrationsToInsert = [];
        const seen = new Set();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length <= Math.max(stIdIdx, nameIdx) || !row[stIdIdx]?.trim()) continue;

          const stId = row[stIdIdx].trim();
          const normalized = stId.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "");

          if (seen.has(normalized)) continue;
          seen.add(normalized);

          let attendStatus = "NO";
          if (attendIdx !== -1 && row[attendIdx]) {
            const rawVal = row[attendIdx].trim().toUpperCase();
            if (rawVal.startsWith("Y") || rawVal.startsWith("P") || rawVal === "PRESENT" || rawVal === "YES") {
              attendStatus = "YES";
            }
          }

          let isMember = false;
          for (let mId of memberIds) {
            if (mId.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") === normalized) {
              isMember = true;
              break;
            }
          }

          registrationsToInsert.push({
            event_id: selectedEvent,
            st_id: stId,
            name: row[nameIdx].trim(),
            email: emailIdx !== -1 ? row[emailIdx]?.trim() || null : null,
            phone: phoneIdx !== -1 ? row[phoneIdx]?.trim() || null : null,
            degree_program: degreeIdx !== -1 ? row[degreeIdx]?.trim() || null : null,
            level: levelIdx !== -1 ? row[levelIdx]?.trim() || null : null,
            attend: attendStatus,
            is_member: isMember
          });
        }

        if (registrationsToInsert.length === 0) {
          setCsvMsg({ type: "error", text: "No valid registration rows found in CSV." });
          setCsvLoading(false);
          return;
        }

        const { error } = await supabase
          .from("event_registrations")
          .upsert(registrationsToInsert, { onConflict: "event_id,st_id" });

        if (error) {
          if (error.code === '42P01') {
            setDbSetupRequired(true);
            setCsvMsg({ type: "error", text: "Database table does not exist. Please run the SQL migration." });
          } else {
            setCsvMsg({ type: "error", text: error.message });
          }
        } else {
          // If any imported society members are already marked 'YES', sync them to attendance table
          const presentMembers = registrationsToInsert.filter(r => r.is_member && r.attend === "YES");
          if (presentMembers.length > 0) {
            const attendanceRows = presentMembers.map(pm => {
              const pmNorm = pm.st_id ? pm.st_id.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") : "";
              const matched = allSocietyMembers.find(m => 
                m.st_id?.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") === pmNorm
              );
              return {
                st_id: matched ? matched.st_id : pm.st_id,
                event_id: selectedEvent,
                attend: "YES"
              };
            });
            await supabase.from("attendance").upsert(attendanceRows, { onConflict: "st_id,event_id" });
            fetchSocietyAttendance();
          }

          showNotification("success", `Successfully imported ${registrationsToInsert.length} registrations.`);
          setCsvFile(null);
          const fileInput = document.getElementById("csv-file-input");
          if (fileInput) fileInput.value = "";
          fetchCSVRegistrations();
        }
        setCsvLoading(false);
      };
      reader.readAsText(csvFile);
    } catch (err) {
      setCsvMsg({ type: "error", text: "Failed to read CSV: " + err.message });
      setCsvLoading(false);
    }
  };

  const downloadExternalRegistrationTemplate = () => {
    const headers = ["Student ID", "Full Name", "Phone", "Degree", "Level"];
    const sampleRows = [
      ["SC/2022/12345", "John Doe", "+94771234567", "Computer Science", "Year 4"],
      ["SC/2023/54321", "Jane Smith", "0777654321", "Physical Science", "Year 1"]
    ];
    const csvContent = [
      headers.join(","),
      ...sampleRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "external_registration_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle CSV registration attendance (Syncs with attendance table if member)
  const handleToggleCSVAttend = async (row) => {
    const newVal = row.attend === "YES" ? "NO" : "YES";
    setSaving(s => ({ ...s, [row.id]: true }));

    try {
      // Robust normalized check if student is a society member
      const rowNorm = row.st_id ? row.st_id.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") : "";
      const matchedMember = allSocietyMembers.find(m => 
        m.st_id?.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") === rowNorm
      );
      const isMember = Boolean(row.is_member || matchedMember);
      const officialStId = matchedMember ? matchedMember.st_id : row.st_id;

      // 1. Update event_registrations table
      const { error } = await supabase
        .from("event_registrations")
        .update({ attend: newVal, is_member: isMember })
        .eq("id", row.id);

      if (error) throw error;

      // 2. If student is a society member, synchronize to attendance table
      if (isMember) {
        if (newVal === "YES") {
          await supabase.from("attendance").upsert({
            st_id: officialStId,
            event_id: selectedEvent,
            attend: "YES"
          }, { onConflict: "st_id,event_id" });
        } else {
          await supabase.from("attendance")
            .update({ attend: "NO" })
            .eq("event_id", selectedEvent)
            .or(`st_id.ilike.${officialStId},st_id.ilike.${row.st_id}`);
        }

        // Keep local attendance state in memory in sync
        setAttendance(prev => prev.map(a => {
          const aNorm = a.st_id?.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "");
          if (aNorm === rowNorm || a.st_id === officialStId || a.st_id === row.st_id) {
            return { ...a, attend: newVal };
          }
          return a;
        }));
        setAttendanceCounts(prev => ({
          ...prev,
          yes: prev.yes + (newVal === "YES" ? 1 : -1),
          no: prev.no + (newVal === "NO" ? 1 : -1)
        }));
      }

      setCsvRegistrations(prev => prev.map(r => r.id === row.id ? { ...r, attend: newVal, is_member: isMember } : r));
      setCsvStats(prev => ({
        ...prev,
        present: Math.max(0, prev.present + (newVal === "YES" ? 1 : -1))
      }));
    } catch (err) {
      showNotification("error", "Toggle failed: " + err.message);
    } finally {
      setSaving(s => ({ ...s, [row.id]: false }));
    }
  };

  const handleClearCSVRegistrations = async () => {
    if (!selectedEvent) return;
    setCsvLoading(true);
    try {
      const { error } = await supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", selectedEvent);

      if (error) throw error;

      setCsvRegistrations([]);
      setCsvTotal(0);
      setCsvStats({ total: 0, members: 0, nonMembers: 0, present: 0 });
      showNotification("success", "Cleared all CSV registration records for this event.");
    } catch (err) {
      showNotification("error", err.message);
    } finally {
      setCsvLoading(false);
      setConfirmDialog(null);
    }
  };

  const handleExportCSVReport = () => {
    if (!selectedEvent) return;
    setCsvLoading(true);
    supabase.from("event_registrations")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("st_id")
      .then(({ data, error }) => {
        setCsvLoading(false);
        if (error) {
          showNotification("error", "Failed to export: " + error.message);
          return;
        }
        if (!data || data.length === 0) {
          showNotification("error", "No records to export.");
          return;
        }

        const escape = (val) => {
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const header = ["Name", "Index Number", "Degree Program", "Level", "WhatsApp Number", "Attendance Status", "Society Member"];
        const rows = data.map(r => [
          r.name,
          r.st_id,
          r.degree_program,
          r.level,
          r.phone,
          r.attend === "YES" ? "Present" : "Absent",
          r.is_member ? "Yes" : "No"
        ]);

        const csvContent = [header.join(","), ...rows.map(row => row.map(escape).join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `attendance_report_${selectedEvent}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification("success", "Exported CSV attendance report.");
      });
  };

  // ──────────────────────────────────────────────
  // 3. PERSONAL "MY ATTENDANCE"
  // ──────────────────────────────────────────────
  const fetchMyAttendance = async () => {
    if (!hasStId) {
      setMyAttendance([]);
      setMyTotal(0);
      setMyCounts({ yes: 0, no: 0 });
      return;
    }
    setMyLoading(true);

    try {
      const from = myPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("attendance")
        .select("st_id, event_id, attend, events(name, date, time)", { count: "exact" })
        .eq("st_id", session.stId)
        .order("event_id", { ascending: false })
        .range(from, to);

      const [recordsRes, yesRes, noRes] = await Promise.all([
        query,
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "YES"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "NO")
      ]);

      setMyAttendance(recordsRes.data || []);
      setMyTotal(recordsRes.count || 0);
      setMyCounts({ yes: yesRes.count || 0, no: noRes.count || 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setMyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "my" && hasStId) {
      fetchMyAttendance();
    }
  }, [session?.stId, myPage, activeTab]);

  // ──────────────────────────────────────────────
  // 4. LIVE ACTIVE EVENT CHECK-IN (TODAY)
  // ──────────────────────────────────────────────
  const fetchActiveTodayEvents = async () => {
    if (!hasStId) return;
    setLoadingActiveEvents(true);

    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("event_id, name, date, time, self_attendance_enabled")
      .eq("date", todayStr)
      .eq("self_attendance_enabled", true);

    if (!eventsError && eventsData?.length) {
      const eventIds = eventsData.map(e => e.event_id);
      const { data: attData } = await supabase
        .from("attendance")
        .select("event_id, attend")
        .eq("st_id", session.stId)
        .in("event_id", eventIds);

      const attMap = {};
      attData?.forEach(a => {
        attMap[a.event_id] = a.attend;
      });

      const combined = eventsData.map(e => ({
        ...e,
        myAttendanceStatus: attMap[e.event_id] || "NO"
      }));
      setActiveTodayEvents(combined);
    } else {
      setActiveTodayEvents([]);
    }
    setLoadingActiveEvents(false);
  };

  useEffect(() => {
    fetchActiveTodayEvents();
  }, [session?.stId, todayStr]);

  const handleSelfMarkAttendance = async (eventId) => {
    if (!session.stId) return;
    setMarkingMap(prev => ({ ...prev, [eventId]: true }));

    const { error } = await supabase
      .from("attendance")
      .upsert({
        st_id: session.stId,
        event_id: eventId,
        attend: "YES"
      }, { onConflict: "st_id,event_id" });

    setMarkingMap(prev => ({ ...prev, [eventId]: false }));

    if (error) {
      showNotification("error", "Check-in failed: " + error.message);
    } else {
      showNotification("success", "✓ Attendance marked successfully!");
      fetchMyAttendance();
      fetchActiveTodayEvents();
    }
  };

  // Math percentages
  const pct = attendanceCounts.total ? Math.round((attendanceCounts.yes / attendanceCounts.total) * 100) : 0;
  const myTotalEvents = myCounts.yes + myCounts.no;
  const myPct = myTotalEvents ? Math.round((myCounts.yes / myTotalEvents) * 100) : 0;

  // Filtered personal records for search
  const filteredMyAttendance = useMemo(() => {
    if (!mySearch.trim()) return myAttendance;
    const q = mySearch.toLowerCase();
    return myAttendance.filter(a => {
      const name = (a.events?.name || a.event_id || "").toLowerCase();
      const status = (a.attend || "").toLowerCase();
      return name.includes(q) || status.includes(q);
    });
  }, [myAttendance, mySearch]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-white text-gray-800"} font-inter-variable pb-24 selection:bg-[#e4f222]/20 selection:text-white`}>
      {/* ── TOAST NOTIFICATION ── */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[6px] ${
          isDark ? "bg-[#0f1011] border-[#23252a] text-white" : "bg-white border-gray-200 text-gray-900 shadow-lg"
        } border animate-in slide-in-from-bottom-2 duration-150`}>
          {notification.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#27a644]" />}
          {notification.type === "error" && <XCircle className="w-4 h-4 text-[#eb5757]" />}
          {notification.type === "info" && <Info className="w-4 h-4 text-[#818cf8]" />}
          <span className="text-[12.5px] font-[510] tracking-[-0.011em]">{notification.text}</span>
        </div>
      )}

      {/* ── HIGH-DENSITY LINEAR STICKY CONTROL BAR ── */}
      <div className={`border-b ${isDark ? "border-[#23252a] bg-[#0c0c0e]/95" : "border-gray-200 bg-white/95"} backdrop-blur-md sticky top-0 z-30`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          {/* Top Row: Title, Role Badge, Primary Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border flex items-center justify-center flex-shrink-0`}>
                <CalendarCheck className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className={`text-[15px] sm:text-[16px] font-[590] tracking-[-0.018em] ${isDark ? "text-[#ffffff]" : "text-gray-900"} truncate`}>
                    Attendance Terminal
                  </h1>
                  <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[4px] ${
                    isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
                  } border font-berkeley-mono text-[9px] uppercase tracking-wider`}>
                    {isStaff ? "Staff Hub" : "Member"}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Right: Event Selector Dropdown & Scan Gate Pass CTA */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(activeTab === "members" || activeTab === "csv") && (
                <div className="w-36 sm:w-60">
                  <EventSelect
                    events={events}
                    value={selectedEvent}
                    theme={currentTheme}
                    onChange={(id) => {
                      setPage(0);
                      setCsvPage(0);
                      setSelectedEvent(id);
                    }}
                    placeholder="Select event..."
                  />
                </div>
              )}

              {isStaff && (
                <button
                  onClick={() => setShowGatePassScanner(true)}
                  disabled={!selectedEvent}
                  className={`h-8 px-2.5 sm:px-3 ${
                    isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                  } hover:brightness-105 active:scale-[0.98] disabled:opacity-40 font-[590] text-[12px] rounded-[6px] flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-all`}
                  title="Scan Member Gate Pass QR with Camera"
                >
                  <Camera className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                  <span className="hidden sm:inline">Scan Gate Pass</span>
                  <span className="sm:hidden">Scan Pass</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile-only Quick Scan Action Bar */}
          {isStaff && (
            <div className={`sm:hidden pt-2 border-t ${isDark ? "border-[#1a1b1e]" : "border-gray-100"}`}>
              <button
                onClick={() => setShowGatePassScanner(true)}
                disabled={!selectedEvent}
                className={`w-full h-8.5 ${
                  isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                } hover:brightness-105 active:scale-[0.98] disabled:opacity-40 font-[590] text-[12px] rounded-[6px] flex items-center justify-center gap-1.5 shadow-sm`}
              >
                <Camera className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                <span>Scan Member Gate Pass (Camera)</span>
              </button>
            </div>
          )}

          {/* Perspective Navigation Pills */}
          <div className={`flex items-center justify-between gap-2 mt-2 pt-2 border-t ${isDark ? "border-[#1a1b1e]" : "border-gray-100"} overflow-x-auto scrollbar-none`}>
            <div className={`flex items-center p-0.5 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border flex-shrink-0`}>
              {isStaff ? (
                <>
                  <button
                    onClick={() => setActiveTab("members")}
                    className={`px-3 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      activeTab === "members" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900")
                    }`}
                  >
                    <Users className={`w-3.5 h-3.5 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
                    <span>Society Members</span>
                    {attendanceCounts.total > 0 && (
                      <span className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>({attendanceCounts.total})</span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab("csv")}
                    className={`px-3 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      activeTab === "csv" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900")
                    }`}
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 ${isDark ? "text-[#02b8cc]" : "text-teal-600"}`} />
                    <span>External / CSV</span>
                    {csvStats.total > 0 && (
                      <span className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>({csvStats.total})</span>
                    )}
                  </button>

                  {hasStId && (
                    <button
                      onClick={() => setActiveTab("my")}
                      className={`px-3 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                        activeTab === "my" 
                          ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                          : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900")
                      }`}
                    >
                      <UserCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
                      <span>My Records</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab("my")}
                    className={`px-3 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      activeTab === "my" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900")
                    }`}
                  >
                    <UserCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
                    <span>My Attendance Record</span>
                  </button>
                  {activeTodayEvents.length > 0 && (
                    <button
                      onClick={() => setActiveTab("live")}
                      className={`px-3 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                        activeTab === "live" 
                          ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                          : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900")
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} animate-pulse`} />
                      <span>Live Check-in</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Quick Live Event Alert Chip */}
            {activeTodayEvents.length > 0 && (
              <div className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-[4px] ${
                isDark ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              } border text-[11px] font-[510]`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} animate-pulse`} />
                <span>Active Event Today: {activeTodayEvents[0].name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── 1. ACTIVE TODAY EVENT BEACON (MEMBER CHECK-IN) ── */}
        {hasStId && activeTodayEvents.length > 0 && (
          <div className={`${
            isDark ? "bg-[#0f1011] border-[#27a644]/40" : "bg-emerald-50/40 border-emerald-200"
          } border rounded-[12px] p-4 sm:p-5 relative overflow-hidden shadow-sm`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-[8px] ${
                  isDark ? "bg-[#27a644]/10 border-[#27a644]/30" : "bg-emerald-100 border-emerald-200"
                } border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Clock className={`w-4 h-4 ${isDark ? "text-[#27a644]" : "text-emerald-700"} animate-pulse`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] ${
                      isDark ? "bg-[#27a644]/15 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-100 border-emerald-200 text-emerald-800"
                    } border font-berkeley-mono text-[10px] uppercase font-[510]`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-600"} animate-pulse`} />
                      Live Check-in Open
                    </span>
                    <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Today</span>
                  </div>
                  <h3 className={`text-[15px] font-[590] ${isDark ? "text-white" : "text-gray-900"} mt-1`}>
                    {activeTodayEvents[0].name}
                  </h3>
                  <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5`}>
                    Scheduled Time: <span className={`${isDark ? "text-[#d0d6e0]" : "text-gray-800 font-medium"} font-berkeley-mono`}>{activeTodayEvents[0].time || "All Day"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {activeTodayEvents.map(event => {
                  const isPresent = event.myAttendanceStatus === "YES";
                  const inTimeRange = isTimeWithinRange(event.time);

                  if (isPresent) {
                    return (
                      <div key={event.event_id} className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] ${
                        isDark ? "bg-[#27a644]/15 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-100 border-emerald-200 text-emerald-800 font-medium"
                      } border font-berkeley-mono text-[12px] font-[510]`}>
                        <Check className="w-4 h-4" />
                        <span>Present Checked In</span>
                      </div>
                    );
                  }

                  if (!inTimeRange) {
                    return (
                      <div key={event.event_id} className="flex flex-col items-end">
                        <button disabled className={`px-3 py-1.5 rounded-[6px] ${
                          isDark ? "bg-[#161718] border-[#23252a] text-[#62666d]" : "bg-gray-100 border-gray-200 text-gray-400"
                        } border text-[12px] font-[510] cursor-not-allowed`}>
                          Outside Time Window
                        </button>
                        <span className={`text-[10px] ${isDark ? "text-[#eb5757]" : "text-red-500"} font-berkeley-mono mt-0.5`}>Check-in closed</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={event.event_id}
                      onClick={() => handleSelfMarkAttendance(event.event_id)}
                      disabled={markingMap[event.event_id]}
                      className={`px-4 py-2 ${
                        isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                      } hover:brightness-105 active:scale-[0.98] font-[510] text-[13px] rounded-[6px] flex items-center gap-2 transition-all flex-shrink-0 shadow-sm`}
                    >
                      {markingMap[event.event_id] ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Marking...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark My Attendance Present</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* VIEW 1: SOCIETY MEMBERS ATTENDANCE (STAFF)   */}
        {/* ────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <div className="space-y-4">
            {/* Event Context & Telemetry Card */}
            {selectedEventInfo && (
              <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-4 sm:p-5`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Event Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {selectedEventStatus && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] border ${selectedEventStatus.bg} ${selectedEventStatus.border} ${selectedEventStatus.color}`}>
                          {selectedEventStatus.pulse && <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} animate-pulse`} />}
                          {selectedEventStatus.label}
                        </span>
                      )}
                      <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                        {selectedEventInfo.date} {selectedEventInfo.time ? `· ${selectedEventInfo.time}` : ""}
                      </span>
                    </div>
                    <h2 className={`text-[17px] font-[590] ${isDark ? "text-white" : "text-gray-900"} tracking-[-0.018em] truncate`}>
                      {selectedEventInfo.name}
                    </h2>
                  </div>

                  {/* Right: Telemetry Counter Strip */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    <div className={`px-3 py-1.5 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border`}>
                      <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Present</div>
                      <div className="text-[16px] font-berkeley-mono font-[590] text-[#27a644]">
                        {attendanceCounts.yes}
                      </div>
                    </div>

                    <div className={`px-3 py-1.5 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border`}>
                      <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Absent</div>
                      <div className="text-[16px] font-berkeley-mono font-[590] text-[#eb5757]">
                        {attendanceCounts.no}
                      </div>
                    </div>

                    <div className={`px-3 py-1.5 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border`}>
                      <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Rate</div>
                      <div className={`text-[16px] font-berkeley-mono font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                        {pct}%
                      </div>
                    </div>

                    <div className={`px-3 py-1.5 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border`}>
                      <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Enrolled</div>
                      <div className={`text-[16px] font-berkeley-mono font-[590] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"}`}>
                        {attendanceCounts.total}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linear Hairline Progress Bar */}
                <div className="w-full mt-4">
                  <div className={`w-full h-1.5 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} rounded-full overflow-hidden border`}>
                    <div
                      className="h-full bg-[#27a644] transition-all duration-300"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filter & Action Toolbar */}
            <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-3 space-y-3`}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setPage(0); setSearch(e.target.value); }}
                    placeholder="Search by Student ID or Name..."
                    className={`w-full ${
                      isDark 
                        ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    } border rounded-[6px] pl-8 pr-7 py-1.5 text-[12px] transition-colors focus:outline-none`}
                  />
                  {search && (
                    <button
                      onClick={() => { setPage(0); setSearch(""); }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Actions: Add Member, Export, Bulk Mark, Scan */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isStaff && (
                    <>
                      <button
                        onClick={() => setShowGatePassScanner(true)}
                        disabled={!selectedEvent}
                        className={`h-7 px-2.5 ${
                          isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                        } hover:brightness-105 active:scale-[0.98] disabled:opacity-40 font-[590] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-all shadow-sm`}
                        title="Scan Member Gate Pass QR Code"
                      >
                        <Camera className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                        <span>Scan Gate Pass</span>
                      </button>

                      <button
                        onClick={() => setShowAddModal(true)}
                        className={`h-7 px-2.5 ${
                          isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#ffffff]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors`}
                      >
                        <Plus className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                        <span>Add Member</span>
                      </button>

                      <button
                        onClick={handleExportSocietyMembersCSV}
                        disabled={loading || total === 0}
                        className={`h-7 px-2.5 ${
                          isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#d0d6e0]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors disabled:opacity-40`}
                        title="Download Attendance CSV"
                      >
                        <Download className={`w-3.5 h-3.5 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`} />
                        <span>Export CSV</span>
                      </button>

                      <button
                        onClick={() => setConfirmDialog({
                          type: "all_yes",
                          title: "Mark All Attendees as Present?",
                          message: `Are you sure you want to mark all ${attendanceCounts.total} members as YES for ${selectedEventInfo?.name || "this event"}?`,
                          onConfirm: () => handleMarkAll("YES")
                        })}
                        disabled={saving._all || total === 0}
                        className={`h-7 px-2.5 ${
                          isDark ? "bg-[#27a644]/10 hover:bg-[#27a644]/20 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors disabled:opacity-40`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>All Present</span>
                      </button>

                      <button
                        onClick={() => setConfirmDialog({
                          type: "all_no",
                          title: "Mark All Attendees as Absent?",
                          message: `Are you sure you want to mark all ${attendanceCounts.total} members as NO for ${selectedEventInfo?.name || "this event"}?`,
                          onConfirm: () => handleMarkAll("NO")
                        })}
                        disabled={saving._all || total === 0}
                        className={`h-7 px-2.5 ${
                          isDark ? "bg-[#eb5757]/10 hover:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors disabled:opacity-40`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>All Absent</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status and Batch Level Filters */}
              <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t ${
                isDark ? "border-[#1a1b1e]" : "border-gray-100"
              }`}>
                {/* Status Segment */}
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} mr-1`}>Status:</span>
                  {[
                    { id: "all", label: "All" },
                    { id: "YES", label: "Present" },
                    { id: "NO", label: "Absent" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setPage(0); setStatusFilter(tab.id); }}
                      className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors ${
                        statusFilter === tab.id
                          ? isDark ? "bg-[#23252a] text-white" : "bg-gray-900 text-white font-semibold shadow-xs"
                          : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Academic Level Filter */}
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} mr-1`}>Level:</span>
                  {["all", "1", "2", "3", "4"].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => { setPage(0); setLevelFilter(lvl); }}
                      className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors ${
                        levelFilter === lvl
                          ? isDark ? "bg-[#23252a] text-white" : "bg-gray-900 text-white font-semibold shadow-xs"
                          : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {lvl === "all" ? "All Years" : `Y${lvl}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Attendance Roster Display */}
            {loading ? (
              <div className={`flex flex-col items-center justify-center py-20 gap-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <span className="text-[12px] font-berkeley-mono">Loading roster...</span>
              </div>
            ) : total === 0 ? (
              <div className={`${
                isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
              } border rounded-[12px] p-12 text-center flex flex-col items-center justify-center space-y-3`}>
                <div className={`w-10 h-10 rounded-[6px] ${
                  isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-500"
                } border flex items-center justify-center`}>
                  <Users className={`w-5 h-5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                </div>
                <h3 className={`text-[14px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>No attendance records found</h3>
                <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} max-w-sm`}>
                  {search
                    ? `No matching records for "${search}". Try adjusting your filters.`
                    : "No members enrolled for this event yet. Use '+ Add Member' or go to Events to seed."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Table View (>= 640px) */}
                <div className={`hidden sm:block ${
                  isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
                } border rounded-[12px] overflow-hidden`}>
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className={`border-b ${
                        isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]" : "border-gray-200 bg-gray-50/80 text-gray-500"
                      } font-berkeley-mono text-[11px]`}>
                        <th className="py-2.5 px-4 font-normal">STUDENT ID</th>
                        <th className="py-2.5 px-4 font-normal">STUDENT NAME</th>
                        <th className="py-2.5 px-4 font-normal">LEVEL</th>
                        <th className="py-2.5 px-4 font-normal">STATUS</th>
                        {isStaff && <th className="py-2.5 px-4 font-normal text-right">TOGGLE</th>}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? "divide-[#23252a]/40" : "divide-gray-100"}`}>
                      {attendance.map(a => {
                        const isPresent = a.attend === "YES";
                        return (
                          <tr key={a.st_id} className={`hover:${isDark ? "bg-[#161718]/40" : "bg-gray-50/80"} transition-colors`}>
                            <td className={`py-2.5 px-4 font-berkeley-mono ${isDark ? "text-[#ffffff]" : "text-gray-900 font-medium"}`}>
                              <StudentNameLink stId={a.st_id} name={a.st_id} showIcon={false} size="sm" />
                            </td>
                            <td className={`py-2.5 px-4 ${isDark ? "text-[#d0d6e0]" : "text-gray-800"}`}>
                              <StudentNameLink stId={a.st_id} name={a.members?.name || "-"} />
                            </td>
                            <td className="py-2.5 px-4">
                              {a.members?.level ? (
                                <span className={`inline-flex px-1.5 py-0.5 rounded-[4px] ${
                                  isDark ? "bg-[#161718] border-[#23252a] text-[#818cf8]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
                                } border font-berkeley-mono text-[10px]`}>
                                  Y{a.members.level}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border ${
                                  isPresent
                                    ? isDark
                                      ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : isDark
                                      ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                      : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              >
                                {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {isPresent ? "Present" : "Absent"}
                              </span>
                            </td>
                            {isStaff && (
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => toggleAttendance(a.st_id, a.attend)}
                                  disabled={saving[a.st_id]}
                                  className={`h-6 px-2.5 rounded-[6px] font-berkeley-mono text-[11px] font-[510] transition-colors border ${
                                    isPresent
                                      ? isDark
                                        ? "bg-[#eb5757]/10 hover:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]"
                                        : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                                      : isDark
                                        ? "bg-[#27a644]/10 hover:bg-[#27a644]/20 border-[#27a644]/30 text-[#27a644]"
                                        : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                                  }`}
                                >
                                  {saving[a.st_id] ? "..." : isPresent ? "Mark Absent" : "Mark Present"}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Quick Gate Scanner Card */}
                {isStaff && (
                  <div className={`sm:hidden ${
                    isDark
                      ? "bg-[#0f1011] border-[#e4f222]/30 shadow-[0_2px_12px_rgba(228,242,34,0.06)]"
                      : "bg-indigo-50/50 border-indigo-200 shadow-xs"
                  } border rounded-[10px] p-3 flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-[6px] ${
                        isDark ? "bg-[#e4f222]/10 border-[#e4f222]/30" : "bg-indigo-100 border-indigo-200"
                      } border flex items-center justify-center`}>
                        <Camera className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                      </div>
                      <div>
                        <div className={`text-[12.5px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>Gate Pass Scanner</div>
                        <div className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Instant camera check-in</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowGatePassScanner(true)}
                      disabled={!selectedEvent}
                      className={`px-3 py-1.5 ${
                        isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                      } hover:brightness-105 active:scale-[0.98] disabled:opacity-40 font-[590] text-[12px] rounded-[6px] flex items-center gap-1.5 shadow-sm`}
                    >
                      <Camera className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                      <span>Scan Pass</span>
                    </button>
                  </div>
                )}

                {/* Mobile Responsive Card List (< 640px) */}
                <div className="sm:hidden flex flex-col gap-2.5">
                  {attendance.map(a => {
                    const isPresent = a.attend === "YES";
                    return (
                      <div
                        key={a.st_id}
                        className={`${
                          isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"
                        } border rounded-[10px] p-3.5 flex flex-col gap-2.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className={`text-[13.5px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                              <StudentNameLink stId={a.st_id} name={a.members?.name || a.st_id} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>{a.st_id}</span>
                              {a.members?.level && (
                                <span className={`px-1.5 py-0.2 rounded-[3px] ${
                                  isDark ? "bg-[#161718] border-[#23252a] text-[#818cf8]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
                                } border font-berkeley-mono text-[9px]`}>
                                  Year {a.members.level}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border ${
                              isPresent
                                ? isDark
                                  ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : isDark
                                  ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                  : "bg-red-50 border-red-200 text-red-700"
                            }`}
                          >
                            {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {isPresent ? "Present" : "Absent"}
                          </span>
                        </div>

                        {isStaff && (
                          <button
                            onClick={() => toggleAttendance(a.st_id, a.attend)}
                            disabled={saving[a.st_id]}
                            className={`w-full min-h-[44px] px-3 rounded-[6px] font-berkeley-mono text-[12px] font-[510] flex items-center justify-center gap-2 transition-all border ${
                              isPresent
                                ? isDark
                                  ? "bg-[#eb5757]/10 active:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]"
                                  : "bg-red-50 active:bg-red-100 border-red-200 text-red-700"
                                : isDark
                                  ? "bg-[#27a644]/10 active:bg-[#27a644]/20 border-[#27a644]/30 text-[#27a644]"
                                  : "bg-emerald-50 active:bg-emerald-100 border-emerald-200 text-emerald-700"
                            }`}
                          >
                            {saving[a.st_id] ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isPresent ? (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span>Switch to Absent</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Mark Present</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                <div className={`flex items-center justify-between px-2 py-2 font-berkeley-mono text-[11px] ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}>
                  <span>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      className={`p-1.5 rounded-[4px] ${
                        isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                      } border disabled:opacity-30`}
                      title="Previous"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className={`px-2 font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                      Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                    </span>
                    <button
                      disabled={page + 1 >= Math.ceil(total / PAGE_SIZE)}
                      onClick={() => setPage(p => p + 1)}
                      className={`p-1.5 rounded-[4px] ${
                        isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                      } border disabled:opacity-30`}
                      title="Next"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* VIEW 2: EXTERNAL CSV REGISTRATIONS (STAFF)   */}
        {/* ────────────────────────────────────────────── */}
        {activeTab === "csv" && (
          <div className="space-y-4">
            {dbSetupRequired ? (
              <div className={`${
                isDark ? "bg-[#0f1011] border-[#eb5757]/40" : "bg-red-50/50 border-red-200 shadow-sm"
              } border rounded-[12px] p-6 text-center space-y-3`}>
                <AlertTriangle className={`w-8 h-8 ${isDark ? "text-[#eb5757]" : "text-red-500"} mx-auto`} />
                <h3 className={`text-[15px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>Database Table Required</h3>
                <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} max-w-md mx-auto`}>
                  The `event_registrations` table is not initialized in Supabase. Run the SQL schema to enable CSV imports and dynamic anti-fraud QR check-ins.
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS public.event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(50) REFERENCES public.events(event_id) ON DELETE CASCADE,
  st_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  degree_program VARCHAR(255),
  level VARCHAR(50),
  attend VARCHAR(10) DEFAULT 'NO',
  is_member BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, st_id)
);`);
                    showNotification("success", "SQL copied to clipboard!");
                  }}
                  className={`px-3 py-1.5 ${
                    isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#ffffff]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                  } border font-berkeley-mono text-[11px] rounded-[6px] inline-flex items-center gap-1.5`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Migration</span>
                </button>
              </div>
            ) : (
              <>
                {/* CSV Stat Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[10px] p-3.5`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Total In CSV</div>
                    <div className={`text-[20px] font-berkeley-mono font-[590] ${isDark ? "text-white" : "text-gray-900"} mt-0.5`}>
                      {csvStats.total}
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>registered attendees</div>
                  </div>

                  <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[10px] p-3.5`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#27a644]" : "text-emerald-600"} uppercase`}>Present</div>
                    <div className={`text-[20px] font-berkeley-mono font-[590] ${isDark ? "text-[#27a644]" : "text-emerald-600"} mt-0.5`}>
                      {csvStats.present}
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>scanned / checked in</div>
                  </div>

                  <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[10px] p-3.5`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#eb5757]" : "text-red-600"} uppercase`}>Absent</div>
                    <div className={`text-[20px] font-berkeley-mono font-[590] ${isDark ? "text-[#eb5757]" : "text-red-600"} mt-0.5`}>
                      {csvStats.total - csvStats.present}
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>unverified</div>
                  </div>

                  <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[10px] p-3.5`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#818cf8]" : "text-indigo-600"} uppercase`}>Society Members</div>
                    <div className={`text-[20px] font-berkeley-mono font-[590] ${isDark ? "text-[#818cf8]" : "text-indigo-600"} mt-0.5`}>
                      {csvStats.members}
                    </div>
                    <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>auto-matched</div>
                  </div>
                </div>

                {/* CSV Management Card */}
                <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-4 space-y-3`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* File Upload Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        accept=".csv"
                        id="csv-file-input"
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="csv-file-input"
                        className={`h-8 px-3 rounded-[6px] ${
                          isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#ffffff]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                        } border font-[510] text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors`}
                      >
                        <Upload className={`w-3.5 h-3.5 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`} />
                        <span>{csvFile ? csvFile.name : "Select CSV File"}</span>
                      </label>

                      <button
                        onClick={importCSVData}
                        disabled={!csvFile || csvLoading}
                        className={`h-8 px-3.5 ${
                          isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                        } hover:brightness-105 disabled:opacity-40 font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-all shadow-sm`}
                      >
                        {csvLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Import CSV</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={downloadExternalRegistrationTemplate}
                        className={`h-8 px-2.5 ${
                          isDark ? "bg-transparent hover:bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900 shadow-xs"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors`}
                        title="Download Starter CSV Template"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Template CSV</span>
                      </button>
                    </div>

                    {/* QR Code, Scanner & Export Tools */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setShowGatePassScanner(true)}
                        disabled={!selectedEvent}
                        className={`h-8 px-3 rounded-[6px] ${
                          isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                        } hover:brightness-105 active:scale-[0.98] disabled:opacity-40 font-[590] text-[12px] flex items-center gap-1.5 transition-all shadow-sm`}
                        title="Scan Gate Pass QR with Camera"
                      >
                        <Camera className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                        <span>Scan Gate Pass</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowQR(!showQR);
                          setQrCountdown(60);
                        }}
                        disabled={csvStats.total === 0}
                        className={`h-8 px-3 rounded-[6px] font-[510] text-[12px] flex items-center gap-1.5 transition-colors border ${
                          showQR
                            ? isDark
                              ? "bg-[#eb5757]/15 border-[#eb5757]/30 text-[#eb5757]"
                              : "bg-red-50 border-red-200 text-red-700"
                            : isDark
                              ? "bg-[#27a644]/15 hover:bg-[#27a644]/25 border-[#27a644]/30 text-[#27a644]"
                              : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                        } disabled:opacity-40`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{showQR ? "Close QR" : "Show Dynamic QR"}</span>
                      </button>

                      <button
                        onClick={handleExportCSVReport}
                        disabled={csvStats.total === 0 || csvLoading}
                        className={`h-8 px-3 ${
                          isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#d0d6e0]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors disabled:opacity-40`}
                      >
                        <Download className={`w-3.5 h-3.5 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`} />
                        <span>Export Report</span>
                      </button>

                      <button
                        onClick={() => setConfirmDialog({
                          type: "clear_csv",
                          title: "Delete All Registration Records?",
                          message: `Are you sure you want to delete ALL ${csvStats.total} external registration and attendance records for this event? This cannot be undone.`,
                          onConfirm: handleClearCSVRegistrations
                        })}
                        disabled={csvStats.total === 0 || csvLoading}
                        className={`h-8 px-2.5 ${
                          isDark ? "bg-[#eb5757]/10 hover:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                        } border font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 transition-colors disabled:opacity-40`}
                        title="Clear CSV records for event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dynamic QR Drawer */}
                {showQR && (
                  <div className={`${
                    isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
                  } border rounded-[12px] p-5 relative overflow-hidden`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      {/* Left: QR Display */}
                      <div className="flex flex-col items-center p-4 bg-white rounded-[10px] shadow-lg border border-gray-100">
                        {qrToken ? (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              `${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`
                            )}`}
                            alt="Scan Event Attendance"
                            className="w-44 h-44"
                          />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center text-black text-xs font-berkeley-mono">
                            Generating signature...
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center gap-1.5 font-berkeley-mono text-[11px] font-[590] text-[#08090a]">
                          <span className="w-2 h-2 rounded-full bg-[#0062ff] animate-ping" />
                          <span>Rotates in: {qrCountdown}s</span>
                        </div>
                      </div>

                      {/* Right: Security & Telemetry Details */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#27a644]" : "text-emerald-600 font-semibold"}`}>
                              Anti-Fraud Verification
                            </span>
                            <h3 className={`text-[16px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>Dynamic Rotating QR</h3>
                          </div>

                          <button
                            onClick={() => setIsProjectorMode(true)}
                            className={`px-3 py-1.5 ${
                              isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-white" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800 shadow-xs"
                            } border font-berkeley-mono text-[11px] rounded-[6px] flex items-center gap-1.5 transition-colors`}
                          >
                            <Maximize2 className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                            <span>Projector Kiosk Mode</span>
                          </button>
                        </div>

                        <p className={`text-[12.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
                          This QR code embeds an encrypted time-block signature. Links expire every 60 seconds to prevent absent students from sharing photos of the QR code remotely.
                        </p>

                        <div className={`p-3 ${
                          isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
                        } border rounded-[8px] flex items-center justify-between`}>
                          <div>
                            <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Live Checked In</div>
                            <div className={`text-[18px] font-berkeley-mono font-[590] ${isDark ? "text-[#27a644]" : "text-emerald-600"}`}>
                              {liveScans} / {csvStats.total}
                            </div>
                          </div>
                          <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>Auto-syncs every 5s</span>
                        </div>

                        {/* Copy Link */}
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={`${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`}
                            className={`flex-1 px-2.5 py-1.5 ${
                              isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"
                            } border rounded-[6px] text-[11px] font-berkeley-mono truncate`}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className={`h-7 px-3 ${
                              isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#ffffff]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                            } border font-berkeley-mono text-[11px] rounded-[6px] flex items-center gap-1.5 transition-colors flex-shrink-0`}
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#27a644]" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CSV Search & Filter Strip */}
                <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-3 space-y-2`}>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                      <input
                        type="text"
                        value={csvSearch}
                        onChange={e => { setCsvPage(0); setCsvSearch(e.target.value); }}
                        placeholder="Search registrations by Name, ID, or WhatsApp..."
                        className={`w-full ${
                          isDark
                            ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#d0d6e0]"
                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        } border rounded-[6px] pl-8 pr-7 py-1.5 text-[12px] focus:outline-none transition-colors`}
                      />
                      {csvSearch && (
                        <button
                          onClick={() => { setCsvPage(0); setCsvSearch(""); }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>Filter:</span>
                      {[
                        { id: "all", label: "All" },
                        { id: "YES", label: "Present" },
                        { id: "NO", label: "Absent" }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setCsvPage(0); setCsvStatusFilter(t.id); }}
                          className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors ${
                            csvStatusFilter === t.id
                              ? isDark ? "bg-[#23252a] text-white" : "bg-gray-900 text-white font-semibold shadow-xs"
                              : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}

                      <span className={`${isDark ? "text-[#383b3f]" : "text-gray-300"} mx-1`}>|</span>

                      {[
                        { id: "all", label: "All Types" },
                        { id: "members", label: "Members" },
                        { id: "non_members", label: "Non-Members" }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setCsvPage(0); setCsvMemberFilter(t.id); }}
                          className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors ${
                            csvMemberFilter === t.id
                              ? isDark ? "bg-[#23252a] text-white" : "bg-gray-900 text-white font-semibold shadow-xs"
                              : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CSV Table / Card Display */}
                {csvLoading ? (
                  <div className={`flex flex-col items-center justify-center py-20 gap-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                    <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                    <span className="text-[12px] font-berkeley-mono">Loading registrations...</span>
                  </div>
                ) : csvTotal === 0 ? (
                  <div className={`${
                    isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
                  } border rounded-[12px] p-12 text-center flex flex-col items-center justify-center space-y-3`}>
                    <FileSpreadsheet className={`w-8 h-8 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                    <h3 className={`text-[14px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>No registration records found</h3>
                    <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} max-w-sm`}>
                      {csvSearch
                        ? `No records matching "${csvSearch}".`
                        : "Upload a registration CSV or import student attendees."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Desktop Table View */}
                    <div className={`hidden sm:block ${
                      isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
                    } border rounded-[12px] overflow-hidden`}>
                      <table className="w-full text-left text-[12.5px]">
                        <thead>
                          <tr className={`border-b ${
                            isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]" : "border-gray-200 bg-gray-50/80 text-gray-500"
                          } font-berkeley-mono text-[11px]`}>
                            <th className="py-2.5 px-4 font-normal">INDEX NO</th>
                            <th className="py-2.5 px-4 font-normal">NAME</th>
                            <th className="py-2.5 px-4 font-normal">PROGRAM & LEVEL</th>
                            <th className="py-2.5 px-4 font-normal">WHATSAPP</th>
                            <th className="py-2.5 px-4 font-normal">MEMBER</th>
                            <th className="py-2.5 px-4 font-normal">STATUS</th>
                            <th className="py-2.5 px-4 font-normal text-right">TOGGLE</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? "divide-[#23252a]/40" : "divide-gray-100"}`}>
                          {csvRegistrations.map(r => {
                            const isPresent = r.attend === "YES";
                            return (
                              <tr key={r.id} className={`hover:${isDark ? "bg-[#161718]/40" : "bg-gray-50/80"} transition-colors`}>
                                <td className={`py-2.5 px-4 font-berkeley-mono ${isDark ? "text-white" : "text-gray-900 font-medium"}`}>
                                  <StudentNameLink stId={r.st_id} name={r.st_id} showIcon={false} size="sm" />
                                </td>
                                <td className={`py-2.5 px-4 ${isDark ? "text-[#d0d6e0]" : "text-gray-800"} font-[510]`}>
                                  <StudentNameLink stId={r.st_id} name={r.name} />
                                </td>
                                <td className={`py-2.5 px-4 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                                  <div className="truncate max-w-[180px]">{r.degree_program || "-"}</div>
                                  {r.level && <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`}>{r.level}</div>}
                                </td>
                                <td className={`py-2.5 px-4 font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                                  {r.phone ? (
                                    <a
                                      href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 hover:text-[#27a644] transition-colors"
                                    >
                                      <span>{r.phone}</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : "-"}
                                </td>
                                <td className="py-2.5 px-4">
                                  {r.is_member ? (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] ${
                                      isDark ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    } border font-berkeley-mono text-[10px]`}>
                                      ✓ Member
                                    </span>
                                  ) : (
                                    <span className={`inline-flex px-1.5 py-0.5 rounded-[4px] ${
                                      isDark ? "bg-[#161718] border-[#23252a] text-[#62666d]" : "bg-gray-100 border-gray-200 text-gray-600"
                                    } border font-berkeley-mono text-[10px]`}>
                                      Guest
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border ${
                                      isPresent
                                        ? isDark
                                          ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : isDark
                                          ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                          : "bg-red-50 border-red-200 text-red-700"
                                    }`}
                                  >
                                    {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {isPresent ? "Present" : "Absent"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <button
                                    onClick={() => handleToggleCSVAttend(r)}
                                    disabled={saving[r.id]}
                                    className={`h-6 px-2.5 rounded-[6px] font-berkeley-mono text-[11px] font-[510] transition-colors border ${
                                      isPresent
                                        ? isDark
                                          ? "bg-[#eb5757]/10 hover:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]"
                                          : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                                        : isDark
                                          ? "bg-[#27a644]/10 hover:bg-[#27a644]/20 border-[#27a644]/30 text-[#27a644]"
                                          : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                                    }`}
                                  >
                                    {saving[r.id] ? "..." : isPresent ? "Mark Absent" : "Mark Present"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="sm:hidden flex flex-col gap-2.5">
                      {csvRegistrations.map(r => {
                        const isPresent = r.attend === "YES";
                        return (
                          <div
                            key={r.id}
                            className={`${
                              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"
                            } border rounded-[10px] p-3.5 flex flex-col gap-2.5`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className={`text-[13.5px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                                  <StudentNameLink stId={r.st_id} name={r.name} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>{r.st_id}</span>
                                  {r.is_member && (
                                    <span className={`px-1.5 py-0.2 rounded-[3px] ${
                                      isDark ? "bg-[#27a644]/10 border-[#27a644]/20 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    } border font-berkeley-mono text-[9px]`}>
                                      Member
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border ${
                                  isPresent
                                    ? isDark
                                      ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : isDark
                                      ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                      : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              >
                                {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {isPresent ? "Present" : "Absent"}
                              </span>
                            </div>

                            {/* Additional metadata row */}
                            {(r.degree_program || r.level || r.phone) && (
                              <div className={`pt-2 border-t ${
                                isDark ? "border-[#1a1b1e] text-[#8a8f98]" : "border-gray-100 text-gray-600"
                              } text-[11px] flex items-center justify-between gap-2`}>
                                <span className="truncate">{r.degree_program || r.level || "-"}</span>
                                {r.phone && (
                                  <a
                                    href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-berkeley-mono text-[#27a644] flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => handleToggleCSVAttend(r)}
                              disabled={saving[r.id]}
                              className={`w-full min-h-[44px] px-3 rounded-[6px] font-berkeley-mono text-[12px] font-[510] flex items-center justify-center gap-2 transition-all border ${
                                isPresent
                                  ? isDark
                                    ? "bg-[#eb5757]/10 active:bg-[#eb5757]/20 border-[#eb5757]/30 text-[#eb5757]"
                                    : "bg-red-50 active:bg-red-100 border-red-200 text-red-700"
                                  : isDark
                                    ? "bg-[#27a644]/10 active:bg-[#27a644]/20 border-[#27a644]/30 text-[#27a644]"
                                    : "bg-emerald-50 active:bg-emerald-100 border-emerald-200 text-emerald-700"
                              }`}
                            >
                              {saving[r.id] ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : isPresent ? (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  <span>Mark Absent</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Mark Present</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    <div className={`flex items-center justify-between px-2 py-2 font-berkeley-mono text-[11px] ${
                      isDark ? "text-[#8a8f98]" : "text-gray-500"
                    }`}>
                      <span>
                        Showing {csvPage * PAGE_SIZE + 1}–{Math.min((csvPage + 1) * PAGE_SIZE, csvTotal)} of {csvTotal}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={csvPage <= 0}
                          onClick={() => setCsvPage(p => Math.max(0, p - 1))}
                          className={`p-1.5 rounded-[4px] ${
                            isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                          } border disabled:opacity-30`}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className={`px-2 font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                          Page {csvPage + 1} of {Math.max(1, Math.ceil(csvTotal / PAGE_SIZE))}
                        </span>
                        <button
                          disabled={csvPage + 1 >= Math.ceil(csvTotal / PAGE_SIZE)}
                          onClick={() => setCsvPage(p => p + 1)}
                          className={`p-1.5 rounded-[4px] ${
                            isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                          } border disabled:opacity-30`}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* VIEW 3: PERSONAL "MY ATTENDANCE"            */}
        {/* ────────────────────────────────────────────── */}
        {(activeTab === "my" || activeTab === "live") && (
          <div className="space-y-4">
            {/* Student ID Banner & Performance Metrics */}
            <div className={`${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
            } border rounded-[12px] p-5`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider ${
                    isDark ? "text-[#8a8f98]" : "text-gray-500"
                  }`}>
                    Member Attendance Record
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h2 className={`text-[17px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>{session.name || "Member"}</h2>
                    <span className={`font-berkeley-mono text-[11px] ${
                      isDark ? "text-[#e4f222] bg-[#161718] border-[#23252a]" : "text-indigo-600 bg-indigo-50 border-indigo-200 font-medium"
                    } border px-2 py-0.5 rounded-[4px]`}>
                      {session.stId}
                    </span>
                  </div>
                </div>

                {/* 3 Metric Pills */}
                <div className="flex items-center gap-3">
                  <div className={`px-3.5 py-2 rounded-[6px] ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200 shadow-xs"
                  } border`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Attended</div>
                    <div className={`text-[18px] font-berkeley-mono font-[590] ${isDark ? "text-[#27a644]" : "text-emerald-600"} mt-0.5`}>{myCounts.yes}</div>
                  </div>

                  <div className={`px-3.5 py-2 rounded-[6px] ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200 shadow-xs"
                  } border`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Missed</div>
                    <div className={`text-[18px] font-berkeley-mono font-[590] ${isDark ? "text-[#eb5757]" : "text-red-600"} mt-0.5`}>{myCounts.no}</div>
                  </div>

                  <div className={`px-3.5 py-2 rounded-[6px] ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200 shadow-xs"
                  } border`}>
                    <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>Rate</div>
                    <div className={`text-[18px] font-berkeley-mono font-[590] ${isDark ? "text-white" : "text-gray-900"} mt-0.5`}>{myPct}%</div>
                  </div>
                </div>
              </div>

              {/* Attendance Progress Track */}
              <div className="w-full mt-4">
                <div className={`w-full h-1.5 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} rounded-full overflow-hidden border`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      myPct >= 75 ? "bg-[#27a644]" : myPct >= 50 ? "bg-[#eab308]" : "bg-[#eb5757]"
                    }`}
                    style={{ width: `${Math.min(myPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Search Filter Strip */}
            <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-3 flex items-center justify-between`}>
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                <input
                  type="text"
                  value={mySearch}
                  onChange={e => setMySearch(e.target.value)}
                  placeholder="Filter by event name or status..."
                  className={`w-full ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#d0d6e0]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  } border rounded-[6px] pl-8 pr-7 py-1.5 text-[12px] focus:outline-none transition-colors`}
                />
                {mySearch && (
                  <button
                    onClick={() => setMySearch("")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                {myTotal} Total Events Recorded
              </span>
            </div>

            {/* Attendance History Table & Cards */}
            {myLoading ? (
              <div className={`flex flex-col items-center justify-center py-20 gap-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <span className="text-[12px] font-berkeley-mono">Loading history...</span>
              </div>
            ) : filteredMyAttendance.length === 0 ? (
              <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-12 text-center space-y-3`}>
                <CheckCircle2 className={`w-8 h-8 ${isDark ? "text-[#62666d]" : "text-gray-400"} mx-auto`} />
                <h3 className={`text-[14px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>No attendance history found</h3>
                <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} max-w-sm mx-auto`}>
                  {mySearch
                    ? `No events matching "${mySearch}".`
                    : "No attendance entries found for your Student ID yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop View */}
                <div className={`hidden sm:block ${
                  isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
                } border rounded-[12px] overflow-hidden`}>
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className={`border-b ${
                        isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]" : "border-gray-200 bg-gray-50/80 text-gray-500"
                      } font-berkeley-mono text-[11px]`}>
                        <th className="py-2.5 px-4 font-normal">EVENT</th>
                        <th className="py-2.5 px-4 font-normal">EVENT DATE</th>
                        <th className="py-2.5 px-4 font-normal">SCHEDULED TIME</th>
                        <th className="py-2.5 px-4 font-normal text-right">MY STATUS</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? "divide-[#23252a]/40" : "divide-gray-100"}`}>
                      {filteredMyAttendance.map(a => {
                        const isPresent = a.attend === "YES";
                        return (
                          <tr key={a.event_id} className={`hover:${isDark ? "bg-[#161718]/40" : "bg-gray-50/80"} transition-colors`}>
                            <td className={`py-2.5 px-4 font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                              {a.events?.name || a.event_id}
                            </td>
                            <td className={`py-2.5 px-4 font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                              {a.events?.date || "-"}
                            </td>
                            <td className={`py-2.5 px-4 font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                              {a.events?.time || "Standard"}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border ${
                                  isPresent
                                    ? isDark
                                      ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : isDark
                                      ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                      : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              >
                                {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {isPresent ? "Attended" : "Absent"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden flex flex-col gap-2.5">
                  {filteredMyAttendance.map(a => {
                    const isPresent = a.attend === "YES";
                    return (
                      <div
                        key={a.event_id}
                        className={`${
                          isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"
                        } border rounded-[10px] p-3.5 flex items-center justify-between gap-3`}
                      >
                        <div className="min-w-0">
                          <h4 className={`text-[13.5px] font-[510] ${isDark ? "text-white" : "text-gray-900"} truncate`}>
                            {a.events?.name || a.event_id}
                          </h4>
                          <div className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5`}>
                            {a.events?.date || "-"} {a.events?.time ? `· ${a.events.time}` : ""}
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10.5px] font-[510] border flex-shrink-0 ${
                            isPresent
                              ? isDark
                                ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : isDark
                                ? "bg-[#eb5757]/10 border-[#eb5757]/25 text-[#eb5757]"
                                : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                          {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isPresent ? "Present" : "Absent"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className={`flex items-center justify-between px-2 py-2 font-berkeley-mono text-[11px] ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}>
                  <span>
                    Showing {myPage * PAGE_SIZE + 1}–{Math.min((myPage + 1) * PAGE_SIZE, myTotal)} of {myTotal}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={myPage <= 0}
                      onClick={() => setMyPage(p => Math.max(0, p - 1))}
                      className={`p-1.5 rounded-[4px] ${
                        isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                      } border disabled:opacity-30`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className={`px-2 font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                      Page {myPage + 1} of {Math.max(1, Math.ceil(myTotal / PAGE_SIZE))}
                    </span>
                    <button
                      disabled={myPage + 1 >= Math.ceil(myTotal / PAGE_SIZE)}
                      onClick={() => setMyPage(p => p + 1)}
                      className={`p-1.5 rounded-[4px] ${
                        isDark ? "hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-100 border-gray-200 text-gray-700"
                      } border disabled:opacity-30`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* MODAL 1: ADD MEMBER TO EVENT ATTENDANCE       */}
      {/* ────────────────────────────────────────────── */}
      {showAddModal && (
        <div className={`fixed inset-0 z-50 ${isDark ? "bg-black/75" : "bg-black/40"} backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100`}>
          <div className={`${
            isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"
          } border rounded-[12px] p-6 max-w-md w-full space-y-4`}>
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-100"} pb-3`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-[4px] ${
                  isDark ? "bg-[#161718] border-[#23252a]" : "bg-indigo-50 border-indigo-200"
                } border flex items-center justify-center`}>
                  <Plus className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>Enroll Member</h3>
                  <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    Event: {selectedEventInfo?.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setAddModalMsg(null); }}
                className={`${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-600"} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addModalMsg && (
              <div className="p-2.5 bg-[#eb5757]/10 border border-[#eb5757]/20 rounded-[6px] text-[#eb5757] text-[12px]">
                {addModalMsg.text}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"} uppercase`}>
                  Student ID (ST ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SC/2022/12345"
                  value={addStIdInput}
                  onChange={e => setAddStIdInput(e.target.value)}
                  autoFocus
                  className={`w-full mt-1.5 px-3 py-2 ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] focus:border-[#d0d6e0] text-white placeholder-[#62666d]"
                      : "bg-white border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 placeholder-gray-400"
                  } border rounded-[6px] text-[13px] outline-none font-berkeley-mono`}
                />
              </div>

              {/* Member Quick Match Dropdown */}
              {addStIdInput.trim().length >= 2 && (
                <div className={`max-h-36 overflow-y-auto ${
                  isDark ? "bg-[#161718] border-[#23252a] divide-[#23252a]/40" : "bg-gray-50 border-gray-200 divide-gray-100"
                } border rounded-[6px] divide-y`}>
                  {allSocietyMembers
                    .filter(m =>
                      m.st_id.toLowerCase().includes(addStIdInput.toLowerCase()) ||
                      m.name.toLowerCase().includes(addStIdInput.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(m => (
                      <button
                        key={m.st_id}
                        type="button"
                        onClick={() => setAddStIdInput(m.st_id)}
                        className={`w-full px-3 py-2 text-left ${
                          isDark ? "hover:bg-[#23252a] text-white" : "hover:bg-gray-100 text-gray-900"
                        } transition-colors flex items-center justify-between text-[12px]`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className={`font-berkeley-mono text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>{m.st_id}</span>
                      </button>
                    ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddModalMsg(null); }}
                  className={`px-3.5 py-1.5 ${
                    isDark ? "bg-transparent hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                  } border font-[510] text-[12px] rounded-[6px]`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className={`px-4 py-1.5 ${
                    isDark ? "bg-[#e4f222] text-[#08090a]" : "bg-gray-900 text-white hover:bg-black"
                  } hover:brightness-105 disabled:opacity-50 font-[510] text-[12px] rounded-[6px] flex items-center gap-1.5 shadow-sm`}
                >
                  {addLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Enroll Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* MODAL 2: CONFIRMATION ACTION DIALOG           */}
      {/* ────────────────────────────────────────────── */}
      {confirmDialog && (
        <div className={`fixed inset-0 z-50 ${isDark ? "bg-black/75" : "bg-black/40"} backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100`}>
          <div className={`${
            isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"
          } border rounded-[12px] p-6 max-w-sm w-full space-y-3`}>
            <div className="w-9 h-9 rounded-[8px] bg-[#eb5757]/10 border border-[#eb5757]/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#eb5757]" />
            </div>
            <h3 className={`text-[14.5px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>{confirmDialog.title}</h3>
            <p className={`text-[12.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className={`px-3 py-1.5 ${
                  isDark ? "bg-transparent hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"
                } border font-[510] text-[12px] rounded-[6px]`}
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-3.5 py-1.5 bg-[#eb5757] hover:bg-[#eb5757]/90 text-white font-[510] text-[12px] rounded-[6px] shadow-sm"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* MODAL 3: AUDITORIUM PROJECTOR KIOSK MODE     */}
      {/* ────────────────────────────────────────────── */}
      {isProjectorMode && (
        <div className="fixed inset-0 z-50 bg-[#08090a] text-white flex flex-col items-center justify-between p-8 selection:bg-[#e4f222]/30">
          {/* Top Kiosk Bar */}
          <div className="w-full flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-3">
              <img src="/logo_trans_light.png" alt="Logo" className="h-9 w-auto" />
              <div>
                <span className="text-[11px] font-berkeley-mono uppercase tracking-widest text-[#27a644]">
                  Live Attendance Check-in
                </span>
                <h2 className="text-[20px] font-[590] text-white leading-tight">
                  {selectedEventInfo?.name}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setIsProjectorMode(false)}
              className="px-3 py-1.5 bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-white font-berkeley-mono text-[12px] rounded-[6px] flex items-center gap-1.5"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Exit Projector View</span>
            </button>
          </div>

          {/* Main Giant QR & Instructions */}
          <div className="flex flex-col items-center justify-center space-y-6 my-auto">
            <div className="p-6 bg-white rounded-[16px] shadow-2xl flex flex-col items-center">
              {qrToken && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`
                  )}`}
                  alt="Scan QR"
                  className="w-72 h-72"
                />
              )}
              <div className="mt-3 flex items-center gap-2 text-[#08090a] font-berkeley-mono text-[12px] font-[590]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0062ff] animate-ping" />
                <span>Next token rotation in: {qrCountdown}s</span>
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="flex items-center gap-6 text-[13px] text-[#8a8f98] font-berkeley-mono">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#161718] border border-[#23252a] flex items-center justify-center text-white text-[11px]">1</span>
                <span>Open phone camera</span>
              </div>
              <span className="text-[#383b3f]">→</span>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#161718] border border-[#23252a] flex items-center justify-center text-white text-[11px]">2</span>
                <span>Scan dynamic QR</span>
              </div>
              <span className="text-[#383b3f]">→</span>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#27a644] text-[11px]">3</span>
                <span>Enter ID & Check In</span>
              </div>
            </div>

            {/* Live Count Big Badge */}
            <div className="px-6 py-3 rounded-[12px] bg-[#161718] border border-[#23252a] flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#27a644] animate-pulse" />
              <span className="text-[13px] text-[#8a8f98]">Live Attendees Verified:</span>
              <span className="text-[22px] font-berkeley-mono font-[590] text-[#27a644]">
                {liveScans} / {csvStats.total}
              </span>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="text-[11px] font-berkeley-mono text-[#62666d]">
            Actuarial & Data Science Society · Dynamic Time-Block Verification Active
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* MODAL 4: CAMERA GATE PASS SCANNER MODAL      */}
      {/* ────────────────────────────────────────────── */}
      <GatePassScannerModal
        isOpen={showGatePassScanner}
        onClose={() => setShowGatePassScanner(false)}
        eventId={selectedEvent}
        eventName={selectedEventInfo?.name}
        societyMembers={allSocietyMembers}
        theme={currentTheme}
        onAttendanceUpdated={() => {
          fetchSocietyAttendance();
          fetchCSVRegistrations();
        }}
      />
    </div>
  );
}
