import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import DatePicker from "../components/DatePicker";
import {
  Calendar,
  Clock,
  Plus,
  Users,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  Lock,
  Edit3,
  Trash2,
  QrCode,
  Search,
  X,
  Copy,
  AlertCircle,
  UserCheck,
  Radio,
  Sparkles,
  ChevronRight,
  Eye,
  ShieldAlert
} from "lucide-react";
import { StudentNameLink } from "../components/StudentProfileContext";


const STANDARD_OC_POSITIONS = [
  "OC President",
  "OC Secretary",
  "Content & Communication",
  "Marketing",
  "Session Moderating",
  "Public Relations",
  "Technical & Platform Management",
  "Event & Logistics"
];

const parsePositionsList = (val) => {
  if (!val) return STANDARD_OC_POSITIONS;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return val.split(",").map(p => p.trim()).filter(Boolean);
  }
  return STANDARD_OC_POSITIONS;
};

const EMPTY = { 
  event_id: "", 
  name: "", 
  date: "", 
  oc_st_id: "", 
  apply_start_date: "", 
  apply_end_date: "", 
  description: "", 
  time: "", 
  tally_link: "", 
  flyer_url: "", 
  is_public: true, 
  self_attendance_enabled: false,
  available_oc_positions: STANDARD_OC_POSITIONS
};
const APPLY_EMPTY = { function_id: "", selected_positions: [], member_function_name: "" };

export default function Events({ isAdmin = false, session, theme }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || 
             (document.documentElement.classList.contains("dark") ? "dark" : "light");
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
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "upcoming", "ongoing", "past"
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerPreview, setFlyerPreview] = useState(null);
  const [applyModal, setApplyModal] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyForm, setApplyForm] = useState(APPLY_EMPTY);
  const [functions, setFunctions] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [myAttendanceMap, setMyAttendanceMap] = useState({});
  const [markingMap, setMarkingMap] = useState({});
  const [eventOcMembers, setEventOcMembers] = useState([]);
  const [existingApp, setExistingApp] = useState(null);
  const [customPosInput, setCustomPosInput] = useState("");
  const [ocCountsMap, setOcCountsMap] = useState({});
  const [attendanceCountMap, setAttendanceCountMap] = useState({});
  const [copiedEventId, setCopiedEventId] = useState(null);

  const today = new Date().toLocaleDateString("sv-SE");

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let eventQuery = supabase
      .from("events")
      .select("event_id, name, date, time, oc_st_id, apply_start_date, apply_end_date, description, tally_link, flyer_url, is_public, self_attendance_enabled, available_oc_positions", { count: "exact" })
      .order("date", { ascending: false })
      .range(from, to);

    const q = searchText.trim();
    if (q) {
      eventQuery = eventQuery.or(`event_id.ilike.%${q}%,name.ilike.%${q}%,oc_st_id.ilike.%${q}%`);
    }

    const [eventRes, memberRes] = await Promise.all([
      eventQuery,
      supabase.from("members").select("st_id, name").lte("level", 4).order("name"),
    ]);
    const eventsData = eventRes.data || [];
    setEvents(eventsData);
    setTotal(eventRes.count || 0);
    setMembers(memberRes.data || []);

    if (eventsData.length > 0) {
      const eventIds = eventsData.map(e => e.event_id);
      
      const promises = [];
      
      // User attendance
      if (session?.stId) {
        promises.push(
          supabase
            .from("attendance")
            .select("event_id, attend")
            .eq("st_id", session.stId)
            .in("event_id", eventIds)
        );
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // Accepted OC Counts
      promises.push(
        supabase
          .from("oc")
          .select("event_id, apply_status, st_id")
          .in("event_id", eventIds)
      );

      // Attendance Counts
      promises.push(
        supabase
          .from("attendance")
          .select("event_id")
          .eq("attend", "YES")
          .in("event_id", eventIds)
      );

      const [attRes, ocRes, attCountsRes] = await Promise.all(promises);

      // Map user attendance
      const attMap = {};
      attRes.data?.forEach(a => {
        attMap[a.event_id] = a.attend;
      });
      setMyAttendanceMap(attMap);

      // Map OC Counts & user applications
      const ocMap = {};
      ocRes.data?.forEach(o => {
        if (o.apply_status === "Accept") {
          ocMap[o.event_id] = (ocMap[o.event_id] || 0) + 1;
        }
      });
      setOcCountsMap(ocMap);

      // Map Total Attendance Counts
      const attCountMap = {};
      attCountsRes.data?.forEach(a => {
        attCountMap[a.event_id] = (attCountMap[a.event_id] || 0) + 1;
      });
      setAttendanceCountMap(attCountMap);
    } else {
      setMyAttendanceMap({});
      setOcCountsMap({});
      setAttendanceCountMap({});
    }
    setLoading(false);
  };

  useEffect(() => { load(page, search); }, [page, search]);

  const openAdd = () => { 
    setForm(EMPTY); 
    setEditTarget(null); 
    setEventOcMembers([]); 
    setModal(true); 
    setMsg(null); 
    setCustomPosInput(""); 
  };
  
  const openEdit = async (e) => {
    setForm({ 
      event_id: e.event_id, 
      name: e.name, 
      date: e.date, 
      oc_st_id: e.oc_st_id || "", 
      apply_start_date: e.apply_start_date || "", 
      apply_end_date: e.apply_end_date || "",
      description: e.description || "",
      time: e.time || "",
      tally_link: e.tally_link || "",
      flyer_url: e.flyer_url || "",
      is_public: e.is_public !== false,
      self_attendance_enabled: e.self_attendance_enabled === true,
      available_oc_positions: parsePositionsList(e.available_oc_positions)
    });
    setEditTarget(e.event_id);
    setModal(true);
    setMsg(null);
    setCustomPosInput("");
    setFlyerFile(null);
    setFlyerPreview(null);
    setEventOcMembers([]);
    try {
      const { data, error } = await supabase
        .from("oc")
        .select("st_id, members(name)")
        .eq("event_id", e.event_id)
        .eq("apply_status", "Accept");
      if (error) throw error;
      if (data) {
        setEventOcMembers(data.map(d => ({
          st_id: d.st_id,
          name: d.members?.name || d.st_id
        })));
      }
    } catch (err) {
      console.error("Error loading event OC members:", err);
    }
  };

  const closeModal = () => { 
    setModal(false); 
    setMsg(null); 
    setFlyerFile(null);
    if (flyerPreview) {
      URL.revokeObjectURL(flyerPreview);
      setFlyerPreview(null);
    }
  };

  const handleFlyerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "Please select a valid image file." });
        return;
      }
      setFlyerFile(file);
      setFlyerPreview(URL.createObjectURL(file));
    }
  };

  const openApply = async (e) => {
    setApplyTarget(e);
    setApplyForm(APPLY_EMPTY);
    setExistingApp(null);
    setApplyModal(true);
    setMsg(null);

    if (session?.stId) {
      try {
        const { data: member, error: memberErr } = await supabase
          .from("members")
          .select("member_function")
          .eq("st_id", session.stId)
          .maybeSingle();

        if (memberErr) throw memberErr;

        const memberFunc = member?.member_function || "General";

        let allFuncs = functions;
        if (allFuncs.length === 0) {
          const { data, error: funcErr } = await supabase.from("functions").select("*").order("function_name");
          if (funcErr) throw funcErr;
          allFuncs = data || [];
          setFunctions(allFuncs);
        }

        let matchedFunc = allFuncs.find(
          f => f.function_name.trim().toLowerCase() === memberFunc.trim().toLowerCase()
        );

        if (!matchedFunc && memberFunc.trim()) {
          const { data: newFunc, error: insertErr } = await supabase
            .from("functions")
            .insert([{ function_name: memberFunc.trim() }])
            .select()
            .maybeSingle();

          if (insertErr) throw insertErr;
          if (newFunc) {
            matchedFunc = newFunc;
            setFunctions(prev => [...prev, newFunc].sort((a, b) => a.function_name.localeCompare(b.function_name)));
          }
        }

        const { data: existingData } = await supabase
          .from("oc")
          .select("*, functions(function_name)")
          .eq("event_id", e.event_id)
          .eq("st_id", session.stId)
          .maybeSingle();

        let selectedPos = [];
        if (existingData) {
          setExistingApp(existingData);
          if (existingData.oc_position) {
            selectedPos = existingData.oc_position.split(",").map(p => p.trim()).filter(Boolean);
          }
        }

        setApplyForm(prev => ({
          ...prev,
          function_id: matchedFunc ? matchedFunc.id.toString() : (existingData?.function_id?.toString() || prev.function_id),
          member_function_name: matchedFunc ? matchedFunc.function_name : (existingData?.functions?.function_name || memberFunc),
          selected_positions: selectedPos
        }));

      } catch (err) {
        console.error("Error in openApply:", err);
        setMsg({ type: "error", text: "Failed to load member profile: " + err.message });
      }
    }
  };

  const closeApplyModal = () => { setApplyModal(false); setMsg(null); setExistingApp(null); };

  const getMemberName = (stId) => members.find(m => m.st_id === stId)?.name || stId;

  const handleSave = async () => {
    if (!form.event_id.trim() || !form.name.trim() || !form.date) {
      setMsg({ type: "error", text: "Event ID, Name, and Date are required." });
      return;
    }
    setSaving(true);
    
    let flyerUrl = form.flyer_url || null;
    if (flyerFile) {
      try {
        const optimizedFile = await resizeImage(flyerFile, 800, 1000, 0.85);
        const cleanEventId = form.event_id.trim().replace(/\//g, "-");
        const fileName = `flyer_${cleanEventId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("event_flyers")
          .upload(fileName, optimizedFile, {
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          throw new Error("Failed to upload flyer: " + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from("event_flyers")
          .getPublicUrl(fileName);

        flyerUrl = urlData?.publicUrl;
      } catch (imgErr) {
        setMsg({ type: "error", text: imgErr.message });
        setSaving(false);
        return;
      }
    }

    const payload = {
      event_id: form.event_id.trim(),
      name: form.name.trim(),
      date: form.date,
      oc_st_id: form.oc_st_id || null,
      apply_start_date: form.apply_start_date || null,
      apply_end_date: form.apply_end_date || null,
      description: form.description || null,
      time: form.time || null,
      tally_link: form.tally_link || null,
      flyer_url: flyerUrl,
      is_public: form.is_public !== false,
      self_attendance_enabled: form.self_attendance_enabled === true,
      available_oc_positions: Array.isArray(form.available_oc_positions)
        ? JSON.stringify(form.available_oc_positions)
        : form.available_oc_positions || null
    };

    let error;
    if (editTarget) {
      ({ error } = await supabase.from("events").update(payload).eq("event_id", editTarget));
    } else {
      ({ error } = await supabase.from("events").insert([payload]));
    }

    if (error && error.message && error.message.includes("available_oc_positions")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.available_oc_positions;
      if (editTarget) {
        ({ error } = await supabase.from("events").update(fallbackPayload).eq("event_id", editTarget));
      } else {
        ({ error } = await supabase.from("events").insert([fallbackPayload]));
      }
      if (!error) {
        setSaving(false);
        setMsg({
          type: "success",
          text: (editTarget ? "Event updated." : "Event created.") + " (Note: Please run 'available-oc-positions-setup.sql' in Supabase SQL Editor)."
        });
        load(page, search);
        setTimeout(closeModal, 1500);
        return;
      }
    }

    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: editTarget ? "Event updated." : "Event created." });
    load(page, search);
    setTimeout(closeModal, 800);
  };

  const handleApplySave = async () => {
    if (!applyForm.function_id) {
      setMsg({ type: "error", text: "Function is required." });
      return;
    }
    if (!applyForm.selected_positions || applyForm.selected_positions.length === 0) {
      setMsg({ type: "error", text: "Please select at least one preferred position." });
      return;
    }
    setSaving(true);
    const positionStr = applyForm.selected_positions.join(", ");
    
    let error;
    if (existingApp) {
      ({ error } = await supabase
        .from("oc")
        .update({ oc_position: positionStr })
        .eq("event_id", applyTarget.event_id)
        .eq("st_id", session.stId));
    } else {
      const payload = {
        event_id: applyTarget.event_id,
        st_id: session.stId,
        function_id: parseInt(applyForm.function_id),
        oc_position: positionStr,
        apply_status: "Pending",
      };
      ({ error } = await supabase.from("oc").insert([payload]));
    }

    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ 
      type: "success", 
      text: existingApp ? "Application choices updated successfully." : "Application submitted successfully." 
    });
    setTimeout(closeApplyModal, 1200);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete event "${id}"? This will remove all associated records.`)) return;
    const { error } = await supabase.from("events").delete().eq("event_id", id);
    if (error) alert(error.message);
    else load(page, search);
  };

  const seedAttendance = async (eventId) => {
    const { data: membersData } = await supabase.from("members").select("st_id").lte("level", 4);
    if (!membersData?.length) { alert("No members found to seed attendance for."); return; }
    const rows = membersData.map(m => ({ st_id: m.st_id, event_id: eventId, attend: "NO" }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "st_id,event_id" });
    if (error) alert(error.message);
    else alert(`Seeded attendance for ${membersData.length} members.`);
  };

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

  const toggleSelfAttendance = async (eventId, currentVal) => {
    const newVal = !currentVal;
    const { error } = await supabase
      .from("events")
      .update({ self_attendance_enabled: newVal })
      .eq("event_id", eventId);
    if (error) {
      alert("Failed to toggle self-attendance: " + error.message);
    } else {
      load(page, search);
    }
  };

  const handleSelfMarkAttendance = async (eventId) => {
    if (!session?.stId) return;
    setMarkingMap(prev => ({ ...prev, [eventId]: true }));
    const { error } = await supabase
      .from("attendance")
      .upsert({ st_id: session.stId, event_id: eventId, attend: "YES" }, { onConflict: "st_id,event_id" });
    setMarkingMap(prev => ({ ...prev, [eventId]: false }));
    if (error) {
      alert("Failed to mark attendance: " + error.message);
    } else {
      load(page, search);
    }
  };

  const handleCopyEventLink = (eventId) => {
    const url = `${window.location.origin}/event?id=${encodeURIComponent(eventId)}`;
    navigator.clipboard.writeText(url);
    setCopiedEventId(eventId);
    setTimeout(() => setCopiedEventId(null), 1800);
  };

  const getStatusInfo = (date) => {
    if (date > today) {
      return { 
        type: "upcoming", 
        label: "Upcoming", 
        color: isDark ? "#818cf8" : "#4f46e5",
        bg: isDark ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.1)", 
        border: isDark ? "rgba(99, 102, 241, 0.25)" : "rgba(99, 102, 241, 0.3)" 
      };
    }
    if (date === today) {
      return { 
        type: "ongoing", 
        label: "Ongoing", 
        color: isDark ? "#27a644" : "#16a34a",
        bg: isDark ? "rgba(39, 166, 68, 0.08)" : "rgba(22, 163, 74, 0.1)", 
        border: isDark ? "rgba(39, 166, 68, 0.3)" : "rgba(22, 163, 74, 0.3)", 
        pulse: true 
      };
    }
    return { 
      type: "past", 
      label: "Completed", 
      color: isDark ? "#8a8f98" : "#6b7280",
      bg: isDark ? "#161718" : "#f3f4f6", 
      border: isDark ? "#23252a" : "#e5e7eb" 
    };
  };

  const isAccepting = (e) => {
    if (!e.apply_start_date || !e.apply_end_date) return false;
    return today >= e.apply_start_date && today <= e.apply_end_date;
  };

  // Filter events according to status tab
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const status = getStatusInfo(e.date).type;
      if (statusFilter === "upcoming") return status === "upcoming";
      if (statusFilter === "ongoing") return status === "ongoing";
      if (statusFilter === "past") return status === "past";
      return true;
    });
  }, [events, statusFilter, today, isDark]);

  // Telemetry summary counts
  const telemetry = useMemo(() => {
    let upcoming = 0;
    let ongoing = 0;
    let past = 0;
    events.forEach(e => {
      if (e.date > today) upcoming++;
      else if (e.date === today) ongoing++;
      else past++;
    });
    return { upcoming, ongoing, past };
  }, [events, today]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-white text-gray-800"} font-inter-variable pb-20 selection:bg-[#e4f222]/20 selection:text-white`}>
      {/* ── HIGH-DENSITY LINEAR STICKY CONTROL BAR ── */}
      <div className={`border-b ${isDark ? "border-[#23252a] bg-[#0c0c0e]/95" : "border-gray-200 bg-white/95"} backdrop-blur-md sticky top-0 z-20`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          {/* Row 1: Title, Telemetry & Create Action */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border flex items-center justify-center flex-shrink-0`}>
                <Calendar className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
              </div>
              <h1 className={`text-[15px] sm:text-[16px] font-[590] tracking-[-0.018em] ${isDark ? "text-[#ffffff]" : "text-gray-900"} truncate`}>
                Events & Initiatives
              </h1>
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] ${
                isDark ? "bg-[#161718] border border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border border-gray-200 text-gray-600"
              }`}>
                <span>{total} total</span>
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className={isDark ? "text-[#818cf8]" : "text-indigo-600 font-medium"}>{telemetry.upcoming} upcoming</span>
                {telemetry.ongoing > 0 && (
                  <>
                    <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                    <span className={`${isDark ? "text-emerald-400" : "text-emerald-600"} font-[590]`}>{telemetry.ongoing} ongoing</span>
                  </>
                )}
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className={isDark ? "text-[#62666d]" : "text-gray-400"}>{telemetry.past} completed</span>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={openAdd}
                className={`h-7 px-3 ${
                  isDark ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                } font-[510] tracking-[-0.011em] text-[12px] rounded-[6px] flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-all`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Event</span>
              </button>
            )}
          </div>

          {/* Row 2: Status Filter Tabs & Search Bar */}
          <div className={`flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t ${isDark ? "border-[#1a1b1e]" : "border-gray-100"}`}>
            {/* Status Segment Pills */}
            <div className={`flex items-center p-0.5 rounded-[6px] ${isDark ? "bg-[#161718] border border-[#23252a]" : "bg-gray-100 border border-gray-200"}`}>
              {[
                { id: "all", label: "All Events" },
                { id: "upcoming", label: "Upcoming" },
                { id: "ongoing", label: "Ongoing", pulse: telemetry.ongoing > 0 },
                { id: "past", label: "Past" },
              ].map(tab => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                      active 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900")
                    }`}
                  >
                    {tab.pulse && <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} animate-pulse`} />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className={`absolute left-2.5 top-2 w-3.5 h-3.5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                value={search}
                onChange={e => { setPage(0); setSearch(e.target.value); }}
                placeholder="Search events or OC lead..."
                className={`w-full ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#d0d6e0]" 
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                } border rounded-[6px] pl-8 pr-7 py-1 text-[12px] transition-colors font-sans focus:outline-none`}
              />
              {search && (
                <button
                  onClick={() => { setPage(0); setSearch(""); }}
                  className={`absolute right-2 top-1.5 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className={`flex flex-col items-center justify-center py-24 gap-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
            <div className={`w-6 h-6 border-2 ${isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"} rounded-full animate-spin`} />
            <span className="text-[12px] font-berkeley-mono">Loading events & telemetry...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[12px] p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-12 space-y-3`}>
            <div className={`w-10 h-10 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-500"} border flex items-center justify-center`}>
              <Calendar className={`w-5 h-5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
            </div>
            <h3 className={`text-[14px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>No events found</h3>
            <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} leading-relaxed`}>
              {search 
                ? `No event matching "${search}". Try clearing search filters.` 
                : `There are currently no ${statusFilter !== 'all' ? statusFilter : ''} events registered in the system.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredEvents.map(e => {
              const statusInfo = getStatusInfo(e.date);
              const isPast = statusInfo.type === "past";
              const userAttended = myAttendanceMap[e.event_id] === "YES";
              const acceptingApps = isAccepting(e);

              return (
                <div 
                  key={e.event_id} 
                  className={`${
                    isDark 
                      ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" 
                      : "bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow"
                  } border rounded-[12px] p-5 flex flex-col transition-all group`}
                >
                  {/* Card Header: Badges & Actions */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Status Tag */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] tracking-wider border"
                        style={{
                          color: statusInfo.color,
                          backgroundColor: statusInfo.bg,
                          borderColor: statusInfo.border
                        }}
                      >
                        {statusInfo.pulse && <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} animate-pulse`} />}
                        {statusInfo.label}
                      </span>

                      {/* Public / Private Tag */}
                      {e.is_public !== false ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] border ${
                          isDark 
                            ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          <Globe className="w-2.5 h-2.5" /> PUBLIC
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] border ${
                          isDark 
                            ? "bg-[#161718] text-[#8a8f98] border-[#23252a]" 
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}>
                          <Lock className="w-2.5 h-2.5" /> INTERNAL
                        </span>
                      )}

                      {/* Event ID Tag */}
                      <span className={`font-berkeley-mono text-[10px] ${
                        isDark 
                          ? "text-[#62666d] bg-[#161718] border-[#23252a]" 
                          : "text-gray-500 bg-gray-50 border-gray-200"
                      } border px-1.5 py-0.5 rounded-[4px]`}>
                        #{e.event_id}
                      </span>

                      {/* Admin Self-Attendance Toggle */}
                      {isAdmin && (
                        <button
                          onClick={() => toggleSelfAttendance(e.event_id, e.self_attendance_enabled)}
                          className={`font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors flex items-center gap-1 ${
                            e.self_attendance_enabled 
                              ? (isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                              : (isDark ? "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:text-white" : "bg-gray-100 text-gray-500 border-gray-200 hover:text-gray-900")
                          }`}
                          title="Toggle member self-attendance"
                        >
                          <span>Self-Att:</span>
                          <span className="font-[590]">{e.self_attendance_enabled ? "ON" : "OFF"}</span>
                        </button>
                      )}
                    </div>

                    {/* Admin Action Buttons */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openEdit(e)} 
                          className={`p-1 rounded-[4px] border transition-all ${
                            isDark 
                              ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] border-transparent hover:border-[#23252a]" 
                              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 border-transparent hover:border-gray-200"
                          }`}
                          title="Edit Event"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(e.event_id)} 
                          className={`p-1 rounded-[4px] border transition-all ${
                            isDark 
                              ? "text-[#8a8f98] hover:text-[#eb5757] hover:bg-[#eb5757]/10 border-transparent hover:border-[#eb5757]/30" 
                              : "text-gray-500 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-200"
                          }`}
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Event Title & Date Row */}
                  <div className="mb-3">
                    <h3 className={`text-[16px] font-[590] tracking-[-0.015em] ${isDark ? "text-[#ffffff]" : "text-gray-900"} mb-1 leading-snug`}>
                      {e.name}
                    </h3>
                    <div className={`flex items-center gap-3 font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} flex-wrap`}>
                      <span className={`flex items-center gap-1 ${isDark ? "text-[#d0d6e0]" : "text-gray-800"}`}>
                        <Calendar className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                        {e.date}
                      </span>
                      {e.time && (
                        <span className="flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                          {e.time}
                        </span>
                      )}
                      {acceptingApps && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[3px] text-[10px] border ${
                          isDark 
                            ? "bg-[#6366f1]/10 border-[#6366f1]/30 text-[#818cf8]" 
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"
                        }`}>
                          Applications Open
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flyer & Description Preview */}
                  <div className="flex gap-3 mb-4 items-start">
                    {e.flyer_url && (
                      <div className={`w-16 h-20 rounded-[6px] overflow-hidden ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border flex-shrink-0`}>
                        <img src={e.flyer_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {e.description ? (
                        <p className={`text-[12.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} line-clamp-3 leading-relaxed`}>
                          {e.description}
                        </p>
                      ) : (
                        <p className={`text-[12px] ${isDark ? "text-[#62666d]" : "text-gray-400"} italic`}>
                          No detailed description provided for this event.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Precision Event Intel Box ── */}
                  <div className={`${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50/80 border-gray-200"} rounded-[6px] border p-3 mb-4 space-y-2`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {/* OC Lead */}
                      <div>
                        <span className={`font-berkeley-mono text-[9px] uppercase tracking-wider ${isDark ? "text-[#62666d]" : "text-gray-400"} block`}>
                          OC Lead
                        </span>
                        <div className="truncate block">
                          {e.oc_st_id ? (
                            <StudentNameLink
                              stId={e.oc_st_id}
                              name={getMemberName(e.oc_st_id)}
                              size="sm"
                              className="!text-[12px]"
                            />
                          ) : (
                            <span className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Committee */}
                      <div>
                        <span className={`font-berkeley-mono text-[9px] uppercase tracking-wider ${isDark ? "text-[#62666d]" : "text-gray-400"} block`}>
                          Committee (OC)
                        </span>
                        <span className={`text-[12px] font-berkeley-mono ${isDark ? "text-[#d0d6e0]" : "text-gray-800"} block`}>
                          {ocCountsMap[e.event_id] !== undefined ? `${ocCountsMap[e.event_id]} Members` : "Pending Setup"}
                        </span>
                      </div>

                      {/* Attendance Telemetry */}
                      <div>
                        <span className={`font-berkeley-mono text-[9px] uppercase tracking-wider ${isDark ? "text-[#62666d]" : "text-gray-400"} block`}>
                          Attendance
                        </span>
                        <span className={`text-[12px] font-berkeley-mono ${isDark ? "text-[#d0d6e0]" : "text-gray-800"} block`}>
                          {attendanceCountMap[e.event_id] !== undefined 
                            ? `${attendanceCountMap[e.event_id]} Checked-in` 
                            : isPast ? "Completed" : "Scheduled"}
                        </span>
                      </div>
                    </div>

                    {/* Member Attendance / Application Status Flag */}
                    {session?.stId && userAttended && (
                      <div className={`pt-1.5 border-t ${isDark ? "border-[#23252a] text-[#27a644]" : "border-gray-200 text-emerald-600"} flex items-center justify-between text-[11px] font-berkeley-mono`}>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Attendance: Present</span>
                        </span>
                        <span className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>Recorded in Registry</span>
                      </div>
                    )}
                  </div>

                  {/* ── Action Toolbar Footer ── */}
                  <div className={`mt-auto pt-3 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} flex items-center justify-between gap-2 flex-wrap`}>
                    <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                      {/* Primary Application / OC Management Action */}
                      {acceptingApps && session?.stId ? (
                        <button 
                          onClick={() => openApply(e)}
                          className={`h-8 px-3 rounded-[6px] ${
                            isDark ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                          } font-berkeley-mono text-[11px] font-[510] transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm`}
                        >
                          <Users className="w-3 h-3" />
                          <span>Apply for OC</span>
                        </button>
                      ) : isAdmin ? (
                        <button 
                          onClick={() => openEdit(e)}
                          className={`h-8 px-3 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-all flex items-center gap-1.5 flex-shrink-0 ${
                            isDark 
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#d0d6e0] hover:text-white border-[#23252a]" 
                              : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          <span>{ocCountsMap[e.event_id] ? "Manage OC" : "Form OC"}</span>
                        </button>
                      ) : null}

                      {/* Admin Seed Attendance */}
                      {isAdmin && (
                        <button 
                          onClick={() => seedAttendance(e.event_id)}
                          className={`h-8 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] transition-all flex items-center gap-1 ${
                            isDark 
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]" 
                              : "bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                          title="Seed attendance ledger"
                        >
                          <QrCode className="w-3 h-3" />
                          <span className="hidden sm:inline">Seed Ledger</span>
                        </button>
                      )}

                      {/* Member Self Attendance Trigger */}
                      {session?.role && session.role !== "guest" && e.date === today && e.self_attendance_enabled && (
                        userAttended ? (
                          <span className={`h-8 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] flex items-center gap-1 ${
                            isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>
                            <Check className="w-3 h-3" />
                            <span>Present</span>
                          </span>
                        ) : isTimeWithinRange(e.time) ? (
                          <button
                            onClick={() => handleSelfMarkAttendance(e.event_id)}
                            disabled={markingMap[e.event_id]}
                            className={`h-8 px-3 rounded-[6px] ${
                              isDark ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                            } font-berkeley-mono text-[11px] font-[510] transition-all flex items-center gap-1 shadow-sm`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{markingMap[e.event_id] ? "Marking..." : "Mark Present"}</span>
                          </button>
                        ) : (
                          <span className={`h-8 px-2 rounded-[6px] border font-berkeley-mono text-[10px] flex items-center ${
                            isDark ? "bg-[#161718] border-[#23252a] text-[#62666d]" : "bg-gray-100 border-gray-200 text-gray-500"
                          }`}>
                            Outside Window
                          </span>
                        )
                      )}
                    </div>

                    {/* Secondary Actions: Public Link & Copy Link */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyEventLink(e.event_id)}
                        className={`h-8 px-2 rounded-[6px] border font-berkeley-mono text-[11px] transition-all flex items-center gap-1 ${
                          isDark 
                            ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]" 
                            : "bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-200 shadow-xs"
                        }`}
                        title="Copy event public link"
                      >
                        {copiedEventId === e.event_id ? (
                          <Check className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">
                          {copiedEventId === e.event_id ? "Copied" : "Link"}
                        </span>
                      </button>

                      <a 
                        href={`/event?id=${encodeURIComponent(e.event_id)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`h-8 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] transition-all flex items-center gap-1 ${
                          isDark 
                            ? "bg-[#161718] hover:bg-[#23252a] text-[#d0d6e0] hover:text-white border-[#23252a]" 
                            : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{e.is_public !== false ? "Public View" : "Preview"}</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        <div className={`mt-8 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} pt-4`}>
          <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MODAL 1: Create / Edit Event (Linear Midnight)
         ═══════════════════════════════════════════════ */}
      {modal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div className={`${
            isDark ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]" : "bg-white border-gray-200 text-gray-800"
          } border rounded-[12px] w-full max-w-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className={`flex justify-between items-center pb-3 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <h2 className={`text-[15px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                  {editTarget ? `Edit Event: #${editTarget}` : "Create New Event"}
                </h2>
              </div>
              <button 
                onClick={closeModal}
                className={`w-7 h-7 rounded-[4px] ${isDark ? "hover:bg-[#161718] text-[#8a8f98] hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"} flex items-center justify-center transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {msg && (
              <div className={`p-3 rounded-[6px] text-[12px] border font-berkeley-mono ${
                msg.type === "error" 
                  ? (isDark ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30" : "bg-red-50 text-red-700 border-red-200") 
                  : (isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30" : "bg-emerald-50 text-emerald-700 border-emerald-200")
              }`}>
                {msg.text}
              </div>
            )}

            {/* Event ID & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  Event ID *
                </label>
                <input 
                  placeholder="e.g. 20261" 
                  value={form.event_id} 
                  onChange={e => setForm({ ...form, event_id: e.target.value })} 
                  disabled={!!editTarget}
                  className={`w-full ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  } border rounded-[6px] px-3 py-1.5 text-[13px] focus:outline-none disabled:opacity-40 font-berkeley-mono`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  Date *
                </label>
                <DatePicker
                  value={form.date}
                  onChange={v => setForm({ ...form, date: v })}
                  placeholder="Select date"
                />
              </div>
            </div>

            {/* Event Name */}
            <div>
              <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                Event Name *
              </label>
              <input 
                placeholder="Title of the event" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })}
                className={`w-full ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                } border rounded-[6px] px-3 py-1.5 text-[13px] focus:outline-none`}
              />
            </div>

            {/* Toggles: Public & Self-Attendance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-2.5 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} p-3 rounded-[6px] border cursor-pointer select-none`}>
                <input 
                  type="checkbox" 
                  checked={form.is_public !== false} 
                  onChange={e => setForm({ ...form, is_public: e.target.checked })} 
                  className={`w-4 h-4 rounded ${isDark ? "accent-[#e4f222]" : "accent-indigo-600"}`}
                />
                <div>
                  <span className={`text-[12px] font-[510] ${isDark ? "text-white" : "text-gray-900"} block`}>
                    Public Visibility
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} block`}>
                    Display on the public website showcase
                  </span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} p-3 rounded-[6px] border cursor-pointer select-none`}>
                <input 
                  type="checkbox" 
                  checked={form.self_attendance_enabled === true} 
                  onChange={e => setForm({ ...form, self_attendance_enabled: e.target.checked })} 
                  className={`w-4 h-4 rounded ${isDark ? "accent-[#e4f222]" : "accent-indigo-600"}`}
                />
                <div>
                  <span className={`text-[12px] font-[510] ${isDark ? "text-white" : "text-gray-900"} block`}>
                    Self-Attendance
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} block`}>
                    Allow members to check in themselves
                  </span>
                </div>
              </label>
            </div>

            {/* Time & Tally Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  Event Time Window
                </label>
                <input 
                  placeholder="e.g. 10:00 AM - 1:00 PM" 
                  value={form.time || ""} 
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className={`w-full ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  } border rounded-[6px] px-3 py-1.5 text-[13px] focus:outline-none font-berkeley-mono`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  Tally.so Form ID / URL
                </label>
                <input 
                  placeholder="e.g. mBQKkN" 
                  value={form.tally_link || ""} 
                  onChange={e => setForm({ ...form, tally_link: e.target.value })}
                  className={`w-full ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  } border rounded-[6px] px-3 py-1.5 text-[13px] focus:outline-none font-berkeley-mono`}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                Event Description
              </label>
              <textarea 
                placeholder="Describe agenda, keynote speakers, venue..." 
                value={form.description || ""} 
                onChange={e => setForm({ ...form, description: e.target.value })}
                className={`w-full h-20 ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                } border rounded-[6px] p-2.5 text-[13px] focus:outline-none resize-none`}
              />
            </div>

            {/* Flyer Upload */}
            <div>
              <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                Flyer Image
              </label>
              <div className={`flex items-center gap-3 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} p-3 rounded-[6px] border`}>
                {flyerPreview || form.flyer_url ? (
                  <img
                    src={flyerPreview || form.flyer_url}
                    alt="Flyer Preview"
                    className={`w-14 h-16 object-cover rounded-[4px] border ${isDark ? "border-[#23252a]" : "border-gray-200"} flex-shrink-0`}
                  />
                ) : (
                  <div className={`w-14 h-16 rounded-[4px] ${isDark ? "bg-[#0f1011] border-[#23252a] text-[#62666d]" : "bg-gray-100 border-gray-300 text-gray-400"} border border-dashed flex items-center justify-center text-xs flex-shrink-0 font-berkeley-mono`}>
                    NO FLYER
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="event-flyer-upload"
                    onChange={handleFlyerChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="event-flyer-upload"
                    className={`cursor-pointer ${
                      isDark 
                        ? "bg-[#23252a] hover:bg-[#383b3f] text-white border-[#383b3f]" 
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-300"
                    } px-2.5 py-1 rounded-[4px] text-[11px] font-berkeley-mono self-start transition-colors border`}
                  >
                    Select Image File
                  </label>
                  <span className={`${isDark ? "text-[#62666d]" : "text-gray-500"} text-[11px] truncate max-w-[240px] font-berkeley-mono`}>
                    {flyerFile ? flyerFile.name : form.flyer_url ? "Existing flyer retained" : "JPEG/PNG format supported"}
                  </span>
                </div>
              </div>
            </div>

            {/* OC Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  OC Application Start Date
                </label>
                <DatePicker
                  value={form.apply_start_date}
                  onChange={v => setForm({ ...form, apply_start_date: v })}
                  placeholder="Application start"
                />
              </div>
              <div>
                <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                  OC Application End Date
                </label>
                <DatePicker
                  value={form.apply_end_date}
                  onChange={v => setForm({ ...form, apply_end_date: v })}
                  placeholder="Application deadline"
                />
              </div>
            </div>

            {/* Available OC Positions */}
            <div className={`${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} p-3.5 rounded-[6px] border space-y-2.5`}>
              <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                Available Positions for Member Applications
              </label>
              <div className="flex flex-wrap gap-1">
                {STANDARD_OC_POSITIONS.map(pos => {
                  const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                  const isSelected = currentArr.includes(pos);
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => {
                        const nextArr = isSelected
                          ? currentArr.filter(p => p !== pos)
                          : [...currentArr, pos];
                        setForm({ ...form, available_oc_positions: nextArr });
                      }}
                      className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] transition-colors border ${
                        isSelected 
                          ? (isDark ? "bg-[#23252a] text-white border-[#383b3f]" : "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium") 
                          : (isDark ? "bg-[#0f1011] text-[#8a8f98] border-[#23252a] hover:text-white" : "bg-white text-gray-600 border-gray-200 hover:text-gray-900")
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}{pos}
                    </button>
                  );
                })}
                {Array.isArray(form.available_oc_positions) && form.available_oc_positions.filter(p => !STANDARD_OC_POSITIONS.includes(p)).map(customPos => (
                  <button
                    key={customPos}
                    type="button"
                    onClick={() => {
                      const nextArr = form.available_oc_positions.filter(p => p !== customPos);
                      setForm({ ...form, available_oc_positions: nextArr });
                    }}
                    className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] border ${
                      isDark ? "bg-[#23252a] text-white border-[#383b3f]" : "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium"
                    }`}
                  >
                    ✓ {customPos} ✕
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add custom position tag..."
                  value={customPosInput}
                  onChange={e => setCustomPosInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (customPosInput.trim()) {
                        const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                        if (!currentArr.includes(customPosInput.trim())) {
                          setForm({ ...form, available_oc_positions: [...currentArr, customPosInput.trim()] });
                        }
                        setCustomPosInput("");
                      }
                    }
                  }}
                  className={`flex-1 ${
                    isDark ? "bg-[#0f1011] border-[#23252a] text-white" : "bg-white border-gray-300 text-gray-900"
                  } border rounded-[4px] px-2.5 py-1 text-[11px] focus:outline-none font-berkeley-mono`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customPosInput.trim()) {
                      const currentArr = Array.isArray(form.available_oc_positions) ? form.available_oc_positions : STANDARD_OC_POSITIONS;
                      if (!currentArr.includes(customPosInput.trim())) {
                        setForm({ ...form, available_oc_positions: [...currentArr, customPosInput.trim()] });
                      }
                      setCustomPosInput("");
                    }
                  }}
                  className={`px-3 py-1 ${
                    isDark ? "bg-[#23252a] hover:bg-[#383b3f] text-white border-[#383b3f]" : "bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-300"
                  } font-berkeley-mono text-[11px] rounded-[4px] border transition-colors`}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* OC Lead Selector */}
            <div>
              <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                Assigned OC President / Lead
              </label>
              <select 
                value={form.oc_st_id} 
                onChange={e => setForm({ ...form, oc_st_id: e.target.value })}
                className={`w-full ${
                  isDark ? "bg-[#161718] border-[#23252a] text-white" : "bg-white border-gray-300 text-gray-900"
                } border rounded-[6px] px-3 py-1.5 text-[13px] focus:outline-none font-berkeley-mono`}
              >
                <option value="">No OC assigned</option>
                {(() => {
                  const options = [...eventOcMembers];
                  if (form.oc_st_id && !options.some(o => o.st_id === form.oc_st_id)) {
                    options.push({
                      st_id: form.oc_st_id,
                      name: getMemberName(form.oc_st_id)
                    });
                  }
                  return options.map(m => (
                    <option key={m.st_id} value={m.st_id}>{m.st_id} — {m.name}</option>
                  ));
                })()}
              </select>
            </div>

            {/* Modal Actions Footer */}
            <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <button 
                onClick={closeModal}
                className={`px-3.5 py-1.5 rounded-[6px] text-[12px] font-[510] border transition-colors ${
                  isDark 
                    ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]" 
                    : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-300"
                }`}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] transition-all disabled:opacity-40 shadow-sm ${
                  isDark ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                }`}
              >
                {saving ? "Saving..." : editTarget ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODAL 2: Apply for Organizing Committee (OC)
         ═══════════════════════════════════════════════ */}
      {applyModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && closeApplyModal()}
        >
          <div className={`${
            isDark ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]" : "bg-white border-gray-200 text-gray-800"
          } border rounded-[12px] w-full max-w-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden my-auto`}>
            {/* Modal Header */}
            <div className={`flex justify-between items-center px-5 py-3.5 border-b flex-shrink-0 ${
              isDark ? "border-[#23252a] bg-[#0f1011]" : "border-gray-200 bg-white"
            }`}>
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                  <h2 className={`text-[15px] font-[590] ${isDark ? "text-white" : "text-gray-900"} truncate`}>
                    Apply for Organizing Committee
                  </h2>
                </div>
                <p className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} truncate mt-0.5`}>
                  Event: {applyTarget?.name} (#{applyTarget?.event_id})
                </p>
              </div>
              <button 
                onClick={closeApplyModal}
                className={`w-7 h-7 rounded-[4px] ${
                  isDark ? "hover:bg-[#161718] text-[#8a8f98] hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                } flex items-center justify-center transition-colors flex-shrink-0`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {msg && (
                <div className={`p-3 rounded-[6px] text-[12px] font-berkeley-mono border ${
                  msg.type === "error" 
                    ? (isDark ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30" : "bg-red-50 text-red-700 border-red-200") 
                    : (isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                }`}>
                  {msg.text}
                </div>
              )}

              {existingApp && (
                <div className={`p-3 rounded-[6px] border text-[12px] font-berkeley-mono ${
                  existingApp.apply_status === "Accept" 
                    ? (isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700") 
                    : existingApp.apply_status === "Reject" 
                    ? (isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700") 
                    : (isDark ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]" : "bg-amber-50 border-amber-200 text-amber-700")
                }`}>
                  <div className="font-[590] mb-0.5">
                    {existingApp.apply_status === "Accept" ? "✓ Application Accepted" : existingApp.apply_status === "Reject" ? "✕ Application Rejected" : "⏳ Application Under Review"}
                  </div>
                  <div className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    {existingApp.apply_status === "Pending" 
                      ? "You may modify your position preferences before review." 
                      : `Status recorded as: ${existingApp.apply_status}`}
                  </div>
                </div>
              )}

              {applyForm.member_function_name && (
                <div className={`${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} px-3.5 py-2 rounded-[6px] border flex items-center justify-between`}>
                  <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    Assigned Function
                  </span>
                  <span className={`text-[12px] font-berkeley-mono ${isDark ? "text-white" : "text-gray-900"} font-[510]`}>
                    {applyForm.member_function_name}
                  </span>
                </div>
              )}

              {/* Positions Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    Preferred Roles <span className={isDark ? "text-[#eb5757]" : "text-red-600"}>*</span>
                  </label>
                  <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                    {(applyForm.selected_positions || []).length} selected
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {(() => {
                    const available = parsePositionsList(applyTarget?.available_oc_positions);
                    const selected = applyForm.selected_positions || [];
                    const isLocked = existingApp && existingApp.apply_status !== "Pending";

                    if (available.length === 0) {
                      return (
                        <div className={`col-span-2 text-center py-6 text-[12px] ${isDark ? "text-[#62666d] bg-[#161718] border-[#23252a]" : "text-gray-500 bg-gray-50 border-gray-200"} rounded-[6px] border font-berkeley-mono`}>
                          No specific roles listed for this event.
                        </div>
                      );
                    }

                    return available.map(pos => {
                      const checked = selected.includes(pos);
                      return (
                        <label
                          key={pos}
                          className={`flex items-center gap-2 p-2.5 rounded-[6px] border cursor-pointer transition-all select-none ${
                            checked 
                              ? (isDark ? "bg-[#23252a] border-[#383b3f] text-white" : "bg-indigo-50 border-indigo-200 text-indigo-900") 
                              : (isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:border-[#383b3f] hover:text-[#d0d6e0]" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50")
                          } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isLocked}
                            onChange={() => {
                              if (isLocked) return;
                              const nextSelected = checked
                                ? selected.filter(p => p !== pos)
                                : [...selected, pos];
                              setApplyForm({ ...applyForm, selected_positions: nextSelected });
                            }}
                            className={`w-3.5 h-3.5 rounded ${isDark ? "accent-[#e4f222]" : "accent-indigo-600"} flex-shrink-0`}
                          />
                          <span className="text-[12px] font-berkeley-mono leading-tight truncate" title={pos}>
                            {pos}
                          </span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-between gap-3 px-5 py-3 border-t flex-shrink-0 ${
              isDark ? "border-[#23252a] bg-[#0f1011]" : "border-gray-200 bg-white"
            }`}>
              <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} hidden sm:block`}>
                {existingApp && existingApp.apply_status !== "Pending"
                  ? "Application locked" 
                  : (applyForm.selected_positions || []).length > 0 
                    ? `${(applyForm.selected_positions || []).length} role(s) selected` 
                    : "Select at least 1 role"}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button 
                  onClick={closeApplyModal}
                  className={`px-3.5 py-1.5 rounded-[6px] text-[12px] font-[510] border transition-colors ${
                    isDark 
                      ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]" 
                      : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-300"
                  }`}
                >
                  Cancel
                </button>
                {(!existingApp || existingApp.apply_status === "Pending") && (
                  <button 
                    onClick={handleApplySave} 
                    disabled={saving || !applyForm.function_id || (applyForm.selected_positions || []).length === 0}
                    className={`px-4 py-1.5 rounded-[6px] text-[12px] font-[510] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
                      isDark ? "bg-[#e4f222] hover:brightness-105 text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                    }`}
                  >
                    {saving ? "Submitting..." : existingApp ? "Update Choices" : "Submit Application"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
