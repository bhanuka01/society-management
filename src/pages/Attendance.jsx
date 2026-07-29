import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import EventSelect from "../components/EventSelect";

export default function Attendance({ isAdmin = false, session = { role: "guest", stId: "" } }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [attendanceCounts, setAttendanceCounts] = useState({ yes: 0, no: 0 });
  const [myPage, setMyPage] = useState(0);
  const [myTotal, setMyTotal] = useState(0);
  const [myCounts, setMyCounts] = useState({ yes: 0, no: 0 });

  const [adminTab, setAdminTab] = useState("members");

  // CSV attendance state
  const [csvFile, setCsvFile] = useState(null);
  const [csvRegistrations, setCsvRegistrations] = useState([]);
  const [csvTotal, setCsvTotal] = useState(0);
  const [csvPage, setCsvPage] = useState(0);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMsg, setCsvMsg] = useState(null);
  const [csvStats, setCsvStats] = useState({ total: 0, members: 0, nonMembers: 0, present: 0 });
  const [memberIds, setMemberIds] = useState(new Set());
  const [dbSetupRequired, setDbSetupRequired] = useState(false);

  // QR state
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrCountdown, setQrCountdown] = useState(60);
  const [liveScans, setLiveScans] = useState(0);

  // Parse CSV function
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
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++; // skip next char
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  // Fetch all member IDs to check membership offline
  useEffect(() => {
    supabase.from("members").select("st_id")
      .then(({ data, error }) => {
        if (!error && data) {
          const ids = new Set(data.map(m => m.st_id));
          setMemberIds(ids);
        }
      });
  }, []);

  const fetchCSVRegistrations = async () => {
    if (!selectedEvent) return;
    setCsvLoading(true);
    setDbSetupRequired(false);

    try {
      // 1. Fetch counts/stats
      const { data: statsData, error: statsError } = await supabase
        .from("event_registrations")
        .select("id, is_member, attend")
        .eq("event_id", selectedEvent);

      if (statsError) {
        if (statsError.code === '42P01') {
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

      // 2. Fetch paginated registrations
      const from = csvPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("event_registrations")
        .select("*", { count: "exact" })
        .eq("event_id", selectedEvent)
        .order("st_id")
        .range(from, to);

      if (csvSearch.trim()) {
        const q = csvSearch.trim();
        query = query.or(`st_id.ilike.%${q}%,name.ilike.%${q}%,attend.ilike.%${q}%`);
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
    if (adminTab === "csv" && selectedEvent) {
      fetchCSVRegistrations();
    }
  }, [selectedEvent, csvPage, csvSearch, adminTab]);

  // Token Generator
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
      const expiry = Math.floor(Date.now() / 60000);
      const hash = (expiry * 17 + 23).toString(16);
      const payload = { eventId: selectedEvent, exp: expiry, hash };
      setQrToken(btoa(JSON.stringify(payload)));
    };

    updateToken(); // Initial token
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

  // Live Scans Sync Effect
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

    fetchCount(); // Initial fetch
    const syncTimer = setInterval(fetchCount, 5000);

    return () => clearInterval(syncTimer);
  }, [showQR, selectedEvent]);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    setCsvMsg({ type: "info", text: `Selected: ${file.name}. Click "Import CSV" to process.` });
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

        // Find indices
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

          // Deduplicate inside the CSV to avoid Postgres UNIQUE constraint conflict errors
          if (seen.has(normalized)) continue;
          seen.add(normalized);

          let attendStatus = "NO";
          if (attendIdx !== -1 && row[attendIdx]) {
            const rawVal = row[attendIdx].trim().toUpperCase();
            if (rawVal.startsWith("Y") || rawVal.startsWith("P") || rawVal === "PRESENT" || rawVal === "YES") {
              attendStatus = "YES";
            }
          }

          // Determine is_member
          let isMember = false;
          for (let mId of memberIds) {
            if (mId.toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "") === normalized) {
              isMember = true;
              break;
            }
          }

          const degreeVal = degreeIdx !== -1 ? row[degreeIdx]?.trim() || null : null;
          const levelVal = levelIdx !== -1 ? row[levelIdx]?.trim() || null : null;

          registrationsToInsert.push({
            event_id: selectedEvent,
            st_id: stId,
            name: row[nameIdx].trim(),
            email: emailIdx !== -1 ? row[emailIdx]?.trim() || null : null,
            phone: phoneIdx !== -1 ? row[phoneIdx]?.trim() || null : null,
            degree_program: degreeVal,
            level: levelVal,
            attend: attendStatus,
            is_member: isMember
          });
        }

        if (registrationsToInsert.length === 0) {
          setCsvMsg({ type: "error", text: "No valid rows found in CSV." });
          setCsvLoading(false);
          return;
        }

        // Upsert to Supabase
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
          setCsvMsg({ type: "success", text: `Successfully imported ${registrationsToInsert.length} registrations.` });
          setCsvFile(null);
          const fileInput = document.getElementById("csv-file-input");
          if (fileInput) fileInput.value = "";
          fetchCSVRegistrations();
        }
        setCsvLoading(false);
      };

      reader.readAsText(csvFile);
    } catch (err) {
      console.error(err);
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
    link.setAttribute("href", url);
    link.setAttribute("download", "external_registration_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleCSVAttend = async (row) => {
    const newVal = row.attend === "YES" ? "NO" : "YES";
    setSaving(s => ({ ...s, [row.id]: true }));

    try {
      const { error } = await supabase
        .from("event_registrations")
        .update({ attend: newVal })
        .eq("id", row.id);

      if (error) throw error;

      if (row.is_member) {
        if (newVal === "YES") {
          await supabase.from("attendance").upsert({
            st_id: row.st_id,
            event_id: selectedEvent,
            attend: "YES"
          }, { onConflict: "st_id,event_id" });
        } else {
          await supabase.from("attendance")
            .update({ attend: "NO" })
            .eq("st_id", row.st_id)
            .eq("event_id", selectedEvent);
        }
      }

      setCsvRegistrations(prev => prev.map(r => r.id === row.id ? { ...r, attend: newVal } : r));
      setCsvStats(prev => ({
        ...prev,
        present: prev.present + (newVal === "YES" ? 1 : -1)
      }));
    } catch (err) {
      alert("Failed to toggle attendance: " + err.message);
    } finally {
      setSaving(s => ({ ...s, [row.id]: false }));
    }
  };

  const handleClearCSVRegistrations = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to delete ALL CSV registration and attendance records for this event? This action cannot be undone.")) return;

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
      setCsvMsg({ type: "success", text: "Successfully cleared registration list." });
    } catch (err) {
      setCsvMsg({ type: "error", text: err.message });
    } finally {
      setCsvLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedEvent) return;

    setCsvLoading(true);
    supabase.from("event_registrations")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("st_id")
      .then(({ data, error }) => {
        setCsvLoading(false);
        if (error) {
          alert("Failed to fetch records for export: " + error.message);
          return;
        }

        if (!data || data.length === 0) {
          alert("No records to export.");
          return;
        }

        const escape = (val) => {
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const header = ["Name", "Index Number", "Degree Program", "Level", "WhatsApp Number", "Attend"];
        const rows = data.map(r => [
          r.name,
          r.st_id,
          r.degree_program,
          r.level,
          r.phone,
          r.attend
        ]);

        const csvContent = [
          header.join(","),
          ...rows.map(row => row.map(escape).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_report_${selectedEvent}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  };

  useEffect(() => {
    supabase.from("events").select("*").order("date", { ascending: false })
      .then(({ data }) => {
        setEvents(data || []);
        if (data?.length) setSelectedEvent(data[0].event_id);
      });
  }, []);

  const [activeTodayEvents, setActiveTodayEvents] = useState([]);
  const [loadingActiveEvents, setLoadingActiveEvents] = useState(false);
  const [markingMap, setMarkingMap] = useState({});

  const fetchMyAttendance = () => {
    if (session.role !== "member" || !session.stId) {
      setMyAttendance([]);
      setMyTotal(0);
      setMyCounts({ yes: 0, no: 0 });
      return;
    }

    const from = myPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    Promise.all([
      supabase.from("attendance")
        .select("st_id, event_id, attend, events(name, date)", { count: "exact" })
        .eq("st_id", session.stId)
        .order("event_id")
        .range(from, to),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "YES"),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "NO"),
    ]).then(([records, yes, no]) => {
      setMyAttendance(records.data || []);
      setMyTotal(records.count || 0);
      setMyCounts({ yes: yes.count || 0, no: no.count || 0 });
    });
  };

  useEffect(() => {
    fetchMyAttendance();
  }, [session.role, session.stId, myPage]);

  const fetchActiveTodayEvents = async () => {
    if (session.role !== "member" || !session.stId) return;
    setLoadingActiveEvents(true);
    const todayStr = new Date().toLocaleDateString("sv-SE");

    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
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
  }, [session.role, session.stId]);

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

      if (startMin > endMin) { // overnight
        return currentMin >= startMin || currentMin <= endMin;
      }
      return currentMin >= startMin && currentMin <= endMin;
    } catch (e) {
      return true;
    }
  };

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
      alert("Failed to mark attendance: " + error.message);
    } else {
      fetchMyAttendance();
      fetchActiveTodayEvents();
    }
  };

  useEffect(() => {
    if (!selectedEvent) {
      setAttendance([]);
      setTotal(0);
      setAttendanceCounts({ yes: 0, no: 0 });
      return;
    }
    setLoading(true);
    setMsg(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from("attendance")
      .select("st_id, attend, members(name, level)", { count: "exact" })
      .eq("event_id", selectedEvent)
      .order("st_id")
      .range(from, to);

    const q = search.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,attend.ilike.%${q}%`);
    }

    Promise.all([
      query,
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "YES"),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "NO"),
    ]).then(([records, yes, no]) => {
      if (records.error) setMsg({ type: "error", text: records.error.message });
      else setAttendance(records.data || []);
      setTotal(records.count || 0);
      setAttendanceCounts({ yes: yes.count || 0, no: no.count || 0 });
      setLoading(false);
    });
  }, [selectedEvent, page, search]);

  const toggle = async (stId, currentVal) => {
    if (!isAdmin) return;
    const newVal = currentVal === "YES" ? "NO" : "YES";
    setSaving(s => ({ ...s, [stId]: true }));
    const { error } = await supabase.from("attendance")
      .update({ attend: newVal })
      .eq("st_id", stId)
      .eq("event_id", selectedEvent);
    if (!error) {
      setAttendance(prev => prev.map(a => a.st_id === stId ? { ...a, attend: newVal } : a));
      setMyAttendance(prev => prev.map(a => a.st_id === stId && a.event_id === selectedEvent ? { ...a, attend: newVal } : a));
      setAttendanceCounts(prev => ({
        yes: prev.yes + (newVal === "YES" ? 1 : -1),
        no: prev.no + (newVal === "NO" ? 1 : -1),
      }));
    }
    setSaving(s => ({ ...s, [stId]: false }));
  };

  const markAll = async (val) => {
    if (!isAdmin || !selectedEvent) return;
    setSaving({ _all: true });
    await supabase.from("attendance").update({ attend: val }).eq("event_id", selectedEvent);
    setAttendance(prev => prev.map(a => ({ ...a, attend: val })));
    setAttendanceCounts({ yes: val === "YES" ? total : 0, no: val === "NO" ? total : 0 });
    setSaving({});
    setMsg({ type: "success", text: `Marked all as ${val}.` });
    setTimeout(() => setMsg(null), 2000);
  };

  const addMemberToEvent = async () => {
    if (!isAdmin) return;
    const stId = prompt("Enter ST ID of member to add:");
    if (!stId) return;
    const { error } = await supabase.from("attendance").insert([{ st_id: stId.trim(), event_id: selectedEvent, attend: "NO" }]);
    if (error) alert(error.message);
    else {
      const { data, count } = await supabase.from("attendance")
        .select("st_id, attend, members(name, level)", { count: "exact" })
        .eq("event_id", selectedEvent)
        .order("st_id")
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      setAttendance(data || []);
      setTotal(count || 0);
    }
  };

  const yesCount = attendanceCounts.yes;
  const noCount = attendanceCounts.no;
  const pct = total ? Math.round((yesCount / total) * 100) : 0;
  const myYesCount = myCounts.yes;
  const myPct = myTotal ? Math.round((myYesCount / myTotal) * 100) : 0;

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);
  const visibleAttendance = viewMode === "mine"
    ? attendance.filter(a => a.st_id === session.stId)
    : attendance;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">check_circle</span></span> Attendance</h1>
        <p className="page-subtitle">{isAdmin ? "mark and track event attendance" : "watch attendance records without editing"}</p>
      </div>

      {session.role === "member" && activeTodayEvents.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: "2px solid var(--accent)", background: "var(--bg2)" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="card-title" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: "8px" }}>
              📢 Active Event Attendance
            </span>
            <span className="badge badge-green">Open</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            {activeTodayEvents.map(event => {
              const isPresent = event.myAttendanceStatus === "YES";
              const inTimeRange = isTimeWithinRange(event.time);

              return (
                <div key={event.event_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid var(--border)", lastChild: { border: 0 } }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{event.name}</h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text2)" }}>
                      🕒 Time: {event.time || "Not specified"}
                    </p>
                  </div>
                  <div>
                    {isPresent ? (
                      <span className="badge badge-green" style={{ fontSize: "13px", padding: "6px 12px" }}>✓ Present</span>
                    ) : !inTimeRange ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <button className="btn btn-ghost btn-sm" disabled style={{ cursor: "not-allowed", opacity: 0.6 }}>
                          Mark Present
                        </button>
                        <span style={{ fontSize: "10px", color: "var(--red)", fontWeight: "600" }}>Outside time window</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSelfMarkAttendance(event.event_id)}
                        disabled={markingMap[event.event_id]}
                      >
                        {markingMap[event.event_id] ? "Marking..." : "Mark Present"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {session.role === "member" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">My Attendance</span>
            <span className="badge badge-purple">{session.stId}</span>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
            <div className="stat-card green">
              <div className="stat-label">Present</div>
              <div className="stat-value">{myYesCount}</div>
              <div className="stat-sub">events attended</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Absent</div>
              <div className="stat-value">{myTotal - myYesCount}</div>
              <div className="stat-sub">events missed</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">Rate</div>
              <div className="stat-value">{myPct}%</div>
              <div className="stat-sub">of {myTotal} events</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {myAttendance.length === 0 ? (
                  <tr><td colSpan="3"><div className="empty-state"><div className="icon">*</div><p>No attendance records for your ST ID yet</p></div></td></tr>
                ) : myAttendance.map(a => (
                  <tr key={`${a.st_id}-${a.event_id}`}>
                    <td><strong>{a.events?.name || a.event_id}</strong></td>
                    <td className="mono">{a.events?.date || "-"}</td>
                    <td><span className={`badge ${a.attend === "YES" ? "badge-green" : "badge-red"}`}>{a.attend}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={myPage} total={myTotal} loading={false} onPageChange={setMyPage} />
          </div>
        </div>
      )}

      {session.role !== "member" && (
        events.length === 0 ? (
          <div className="card"><div className="empty-state"><div className="icon">*</div><p>Create an event first, then seed attendance.</p></div></div>
        ) : (
          <>
            <div className="card mb-3" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Event Attendance</span>
                {selectedEventInfo && <span className="badge badge-gray">{selectedEventInfo.date}</span>}
              </div>
              <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <EventSelect
                    events={events}
                    value={selectedEvent}
                    onChange={(id) => { setPage(0); setSelectedEvent(id); }}
                    placeholder="Search or select an event..."
                  />
                </div>
                {isAdmin && <button className="btn btn-ghost btn-sm" onClick={addMemberToEvent}>+ Add Member</button>}
              </div>
            </div>

            {/* Sub-tabs for members vs CSV registration */}
            {isAdmin && (
              <div className="auth-tabs" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={adminTab === "members" ? "active" : ""}
                  onClick={() => setAdminTab("members")}
                >
                  Society Member Database
                </button>
                <button
                  type="button"
                  className={adminTab === "csv" ? "active" : ""}
                  onClick={() => setAdminTab("csv")}
                >
                  External CSV Attendance
                </button>
              </div>
            )}

            {adminTab === "members" ? (
              <>
                {total > 0 && (
                  <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
                    <div className="stat-card green">
                      <div className="stat-label">Present</div>
                      <div className="stat-value">{yesCount}</div>
                      <div className="stat-sub">marked YES</div>
                    </div>
                    <div className="stat-card red">
                      <div className="stat-label">Absent</div>
                      <div className="stat-value">{noCount}</div>
                      <div className="stat-sub">marked NO</div>
                    </div>
                    <div className="stat-card gold">
                      <div className="stat-label">Attendance Rate</div>
                      <div className="stat-value">{pct}%</div>
                      <div className="stat-sub">of {total} members</div>
                    </div>
                  </div>
                )}

                {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

                <div className="toolbar">
                  <div className="search-input-wrap">
                    <span className="search-icon">?</span>
                    <input placeholder="Search by ID or status..." value={search} onChange={e => { setPage(0); setSearch(e.target.value); }} />
                  </div>
                  {isAdmin && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => markAll("YES")} disabled={saving._all}>All Present</button>
                      <button className="btn btn-danger btn-sm" onClick={() => markAll("NO")} disabled={saving._all}>All Absent</button>
                    </>
                  )}
                </div>

                {loading ? (
                  <div className="loader"><div className="spinner" /></div>
                ) : total === 0 ? (
                  <div className="card"><div className="empty-state"><div className="icon">*</div><p>No attendance records. Use "Seed Att." on the Events page first.</p></div></div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {isAdmin && <th>ST ID</th>}
                          <th>Name</th>
                          <th>Level</th>
                          <th>Status</th>
                          {isAdmin && <th>Toggle</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAttendance.map(a => (
                          <tr key={a.st_id}>
                            {isAdmin && <td className="mono">{a.st_id}</td>}
                            <td><strong>{a.members?.name || "-"}</strong></td>
                            <td>{a.members?.level ? <span className="badge badge-purple">Y{a.members.level}</span> : "-"}</td>
                            <td>
                              <span className={`badge ${a.attend === "YES" ? "badge-green" : "badge-red"}`}>
                                {a.attend}
                              </span>
                            </td>
                            {isAdmin && (
                              <td>
                                <button
                                  className={`btn btn-sm ${a.attend === "YES" ? "btn-danger" : "btn-success"}`}
                                  onClick={() => toggle(a.st_id, a.attend)}
                                  disabled={saving[a.st_id]}
                                >
                                  {saving[a.st_id] ? "..." : a.attend === "YES" ? "Mark Absent" : "Mark Present"}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
                  </div>
                )}
              </>
            ) : (
              /* CSV Registration Attendance panel */
              <>
                {dbSetupRequired ? (
                  <div className="card text-center" style={{ padding: "32px", border: "2px dashed var(--red)", background: "rgba(255, 77, 79, 0.05)" }}>
                    <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>Database Setup Required</h3>
                    <p style={{ color: "var(--text2)", fontSize: "14px", maxWidth: "500px", margin: "0 auto 20px" }}>
                      To use external CSV attendance, you need to set up the registration table in Supabase. Please copy and run the SQL migration in your Supabase SQL Editor.
                    </p>
                    <div style={{ textAlign: "left", background: "var(--bg3)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px", fontFamily: "monospace", overflowX: "auto", maxHeight: "150px", marginBottom: "20px" }}>
                      {`CREATE TABLE IF NOT EXISTS public.event_registrations (
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
);
-- See event-csv-attendance-setup.sql for the full schema and security functions.`}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Statistics Overview */}
                    <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
                      <div className="stat-card gold">
                        <div className="stat-label">Total Registered</div>
                        <div className="stat-value">{csvStats.total}</div>
                        <div className="stat-sub">students in CSV</div>
                      </div>
                      <div className="stat-card green">
                        <div className="stat-label">Present</div>
                        <div className="stat-value">{csvStats.present}</div>
                        <div className="stat-sub">marked YES</div>
                      </div>
                      <div className="stat-card red">
                        <div className="stat-label">Absent</div>
                        <div className="stat-value">{csvStats.total - csvStats.present}</div>
                        <div className="stat-sub">marked NO</div>
                      </div>
                      <div className="stat-card purple">
                        <div className="stat-label">Society Members</div>
                        <div className="stat-value">{csvStats.members}</div>
                        <div className="stat-sub">auto-linked</div>
                      </div>
                    </div>

                    {csvMsg && <div className={`alert alert-${csvMsg.type}`}>{csvMsg.text}</div>}

                    {/* Upload & Actions toolbar */}
                    <div className="card mb-3" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <span className="card-title">Manage External Registration CSV</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", padding: "8px 0" }}>
                        <div style={{ flex: 1, minWidth: "250px" }}>
                          <input
                            type="file"
                            accept=".csv"
                            id="csv-file-input"
                            onChange={handleCSVUpload}
                            style={{ display: "none" }}
                          />
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                            <label
                              htmlFor="csv-file-input"
                              className="btn btn-ghost btn-sm"
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", margin: 0 }}
                            >
                              📁 Select CSV File
                            </label>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={importCSVData}
                              disabled={!csvFile || csvLoading}
                            >
                              {csvLoading ? "Processing..." : "Import CSV"}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={downloadExternalRegistrationTemplate}
                              title="Download starter template CSV file for external registrations"
                            >
                              📄 Download Template CSV
                            </button>
                          </div>
                          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--text2)" }}>
                            {csvFile ? `Selected: ${csvFile.name}` : "Need a starter file? Download template CSV or upload external CSV containing Student ID & Name."}
                          </p>
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            className={`btn btn-sm ${showQR ? "btn-danger" : "btn-success"}`}
                            onClick={() => {
                              setShowQR(!showQR);
                              setQrCountdown(60);
                            }}
                            disabled={csvStats.total === 0}
                          >
                            {showQR ? "✕ Close QR Code" : "📢 Show Dynamic QR Code"}
                          </button>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleExportCSV}
                            disabled={csvStats.total === 0 || csvLoading}
                          >
                            📥 Export CSV Report
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={handleClearCSVRegistrations}
                            disabled={csvStats.total === 0 || csvLoading}
                          >
                            🗑️ Clear Data
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic QR Code Modal / Drawer */}
                    {showQR && (
                      <div className="card mb-3" style={{ marginBottom: 16, border: "2px solid var(--accent)", background: "var(--bg2)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", padding: "12px", alignItems: "center", justifyContent: "center" }}>

                          {/* QR Image */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "white", padding: "16px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                            {qrToken ? (
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                  `${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`
                                )}`}
                                alt="Scan Event Attendance"
                                style={{ width: "200px", height: "200px" }}
                              />
                            ) : (
                              <div style={{ width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "black" }}>
                                Generating QR...
                              </div>
                            )}

                            {/* Visual timer */}
                            <div style={{ color: "black", fontSize: "11px", fontWeight: "bold", marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#0062ff", animation: "ping 1s infinite" }} />
                              Rotation: {qrCountdown}s remaining
                            </div>
                          </div>

                          {/* QR Info and Details */}
                          <div style={{ flex: 1, minWidth: "250px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--accent)" }}>
                                Anti-Fraud Student Attendance QR
                              </h3>
                              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text2)", lineHeight: "1.5" }}>
                                This QR code encodes an encrypted time-block signature. Sharing links or photo scanning later is blocked since the token changes every 1 minute.
                              </p>
                            </div>

                            <div className="stat-card green" style={{ padding: "16px", width: "100%", maxWidth: "300px", background: "rgba(0,200,80,0.08)", border: "1px solid rgba(0,200,80,0.2)" }}>
                              <div className="stat-label" style={{ fontSize: "11px" }}>Live Scanned Count</div>
                              <div className="stat-value" style={{ fontSize: "28px" }}>{liveScans} / {csvStats.total}</div>
                              <div className="stat-sub">students marked Present</div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text2)" }}>Target Scan Link:</span>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                  readOnly
                                  value={`${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}`}
                                  style={{ flex: 1, fontSize: "11px", padding: "6px", background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px" }}
                                  onClick={(e) => e.target.select()}
                                />
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/scan-attendance?event_id=${selectedEvent}&token=${qrToken}`);
                                    alert("Scanned Link Copied!");
                                  }}
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Search Toolbar */}
                    <div className="toolbar">
                      <div className="search-input-wrap">
                        <span className="search-icon">?</span>
                        <input
                          placeholder="Search registrations by ID or Name..."
                          value={csvSearch}
                          onChange={e => { setCsvPage(0); setCsvSearch(e.target.value); }}
                        />
                      </div>
                    </div>

                    {/* CSV Table */}
                    {csvLoading ? (
                      <div className="loader"><div className="spinner" /></div>
                    ) : csvTotal === 0 ? (
                      <div className="card">
                        <div className="empty-state">
                          <div className="icon">📋</div>
                          <p>No registration records found for this event. Please select a CSV file and click "Import CSV" to start.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Index Number</th>
                              <th>Name</th>
                              <th>Degree Program</th>
                              <th>Level</th>
                              <th>WhatsApp Number</th>
                              <th>Society Member?</th>
                              <th>Status</th>
                              <th>Toggle Present</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvRegistrations.map(r => {
                              return (
                                <tr key={r.id}>
                                  <td className="mono">{r.st_id}</td>
                                  <td><strong>{r.name}</strong></td>
                                  <td>{r.degree_program || "-"}</td>
                                  <td>{r.level ? <span className="badge badge-purple">{r.level}</span> : "-"}</td>
                                  <td className="mono">{r.phone || "-"}</td>
                                  <td>
                                    {r.is_member ? (
                                      <span className="badge badge-green">✓ Member</span>
                                    ) : (
                                      <span className="badge badge-gray" style={{ opacity: 0.6 }}>✗ Non-Member</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${r.attend === "YES" ? "badge-green" : "badge-red"}`}>
                                      {r.attend === "YES" ? "Present" : "Absent"}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      className={`btn btn-sm ${r.attend === "YES" ? "btn-danger" : "btn-success"}`}
                                      onClick={() => handleToggleCSVAttend(r)}
                                      disabled={saving[r.id]}
                                    >
                                      {saving[r.id] ? "..." : r.attend === "YES" ? "Mark Absent" : "Mark Present"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <Pagination page={csvPage} total={csvTotal} loading={csvLoading} onPageChange={setCsvPage} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
