import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import DatePicker from "../components/DatePicker";

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

export default function Events({ isAdmin = false, session }) {
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

  const today = new Date().toLocaleDateString("sv-SE");

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let eventQuery = supabase
      .from("events")
      .select("*", { count: "exact" })
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
          .select("event_id")
          .eq("apply_status", "Accept")
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

      // Map OC Counts
      const ocMap = {};
      ocRes.data?.forEach(o => {
        ocMap[o.event_id] = (ocMap[o.event_id] || 0) + 1;
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

  const openAdd = () => { setForm(EMPTY); setEditTarget(null); setEventOcMembers([]); setModal(true); setMsg(null); setCustomPosInput(""); };
  
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
    setTimeout(closeApplyModal, 1500);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete event "${id}"? This will remove all attendance records for it.`)) return;
    const { error } = await supabase.from("events").delete().eq("event_id", id);
    if (error) alert(error.message);
    else load(page, search);
  };

  const seedAttendance = async (eventId) => {
    const { data: membersData } = await supabase.from("members").select("st_id").lte("level", 4);
    if (!membersData?.length) { alert("No members to seed attendance for."); return; }
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

  const getStatusInfo = (date) => {
    if (date > today) return { type: "upcoming", label: "Upcoming", badgeBg: "bg-blue-950/30 text-blue-400 border-blue-900/50" };
    if (date === today) return { type: "ongoing", label: "Ongoing", badgeBg: "bg-orange-950/30 text-orange-400 border-orange-900/50", pulse: true };
    return { type: "past", label: "Past", badgeBg: "bg-zinc-900 text-zinc-400 border-zinc-800" };
  };

  const isAccepting = (e) => {
    if (!e.apply_start_date || !e.apply_end_date) return false;
    return today >= e.apply_start_date && today <= e.apply_end_date;
  };

  // Filter events according to status tab
  const filteredEvents = events.filter(e => {
    const status = getStatusInfo(e.date).type;
    if (statusFilter === "upcoming") return status === "upcoming";
    if (statusFilter === "ongoing") return status === "ongoing";
    if (statusFilter === "past") return status === "past";
    return true;
  });

  return (
    <div className="w-full max-w-container-max mx-auto px-4 sm:px-6 py-6 text-zinc-300">
      {/* Header */}
      <header className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-zinc-700/50 shadow-sm flex-shrink-0">
          <span className="material-symbols-outlined text-white text-2xl">event</span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white leading-none mb-1">Events</h1>
          <p className="text-sm text-zinc-400">Manage society events, organizing committees, and public visibility.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={openAdd}
            className="flex bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border border-zinc-700 items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden sm:inline">Create Event</span>
          </button>
        )}
      </header>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-row justify-between items-center mb-8 gap-4 bg-[#121212] p-3 rounded-xl border border-zinc-800 w-full flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          <button 
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${statusFilter === "all" ? "bg-[#27272a] text-white" : "hover:bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            All Events
          </button>
          <button 
            onClick={() => setStatusFilter("upcoming")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${statusFilter === "upcoming" ? "bg-[#27272a] text-white" : "hover:bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setStatusFilter("ongoing")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${statusFilter === "ongoing" ? "bg-[#27272a] text-white" : "hover:bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            Ongoing
          </button>
          <button 
            onClick={() => setStatusFilter("past")}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${statusFilter === "past" ? "bg-[#27272a] text-white" : "hover:bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            Past
          </button>
        </div>
        <div className="relative w-full sm:w-64 flex-shrink-0 ml-auto">
          <input 
            type="text"
            value={search} 
            onChange={e => { setPage(0); setSearch(e.target.value); }} 
            placeholder="Search events..." 
            className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg pl-3 pr-8 py-1.5 text-[13px] text-white focus:outline-none focus:border-zinc-500 placeholder-zinc-500 transition-colors"
          />
          <span className="material-symbols-outlined absolute right-2.5 top-2 text-zinc-500 text-[18px]">search</span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
          <span className="text-sm">Loading events...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center border border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-zinc-400 text-2xl">event_busy</span>
          </div>
          <h3 className="text-white font-medium text-base mb-1">No events found</h3>
          <p className="text-zinc-500 text-sm max-w-sm">
            {search ? `No events match "${search}". Try clearing your search filter.` : "No events registered in this section yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map(e => {
            const statusInfo = getStatusInfo(e.date);
            const isPast = statusInfo.type === "past";

            return (
              <div 
                key={e.event_id} 
                className={`glass-card p-6 flex flex-col hover:border-zinc-500 transition-all duration-200 group ${isPast ? "opacity-75 hover:opacity-100" : ""}`}
              >
                {/* Card Top Banner */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider border ${statusInfo.badgeBg}`}>
                        {statusInfo.pulse && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5 animate-pulse"></span>}
                        {statusInfo.label}
                      </span>
                      {e.is_public !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/30 text-emerald-400 text-[10px] font-medium border border-emerald-900/50">
                          🌐 Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium border border-zinc-700">
                          🔒 Private
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => toggleSelfAttendance(e.event_id, e.self_attendance_enabled)}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${e.self_attendance_enabled ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white"}`}
                          title="Toggle member self-attendance"
                        >
                          Self-Att: {e.self_attendance_enabled ? "ON" : "OFF"}
                        </button>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg text-white mb-1 leading-snug">{e.name}</h3>
                    <p className="text-[13px] text-zinc-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {e.date} {e.time ? `• ${e.time}` : ""}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEdit(e)} 
                        className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
                        title="Edit Event"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(e.event_id)} 
                        className="text-zinc-500 hover:text-red-400 p-1 rounded-md hover:bg-red-950/30 transition-colors"
                        title="Delete Event"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Description & Flyer Preview */}
                {e.description && (
                  <p className="text-[13px] text-zinc-400 mb-4 line-clamp-2 leading-relaxed">
                    {e.description}
                  </p>
                )}

                {/* OC Lead & Committee Details Box */}
                <div className="flex items-center gap-3 mb-6 bg-[#1e1e21] p-4 rounded-xl border border-zinc-800/50">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0">
                    {e.flyer_url ? (
                      <img src={e.flyer_url} alt="Flyer" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-zinc-400 text-lg">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">OC Lead</p>
                    <p className="text-[13px] text-zinc-200 font-medium truncate">
                      {e.oc_st_id ? getMemberName(e.oc_st_id) : "Not Assigned"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      {isPast ? "Attendance" : "Committee"}
                    </p>
                    <p className="text-[13px] text-zinc-200 font-medium">
                      {isPast 
                        ? (attendanceCountMap[e.event_id] !== undefined ? `${attendanceCountMap[e.event_id]} Attendees` : "Completed")
                        : (ocCountsMap[e.event_id] ? `${ocCountsMap[e.event_id]} Members` : "Pending Setup")
                      }
                    </p>
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="mt-auto pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
                  {/* Button 1: Application / Committee */}
                  {isAccepting(e) && session?.stId ? (
                    <button 
                      onClick={() => openApply(e)}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-blue-900/50 text-blue-400 bg-blue-950/20 hover:bg-blue-950/40 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">group_add</span>
                      {existingApp ? "My Application" : "Apply for OC"}
                    </button>
                  ) : isAdmin ? (
                    <button 
                      onClick={() => openEdit(e)}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-zinc-700 rounded-lg text-[12px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">group_add</span>
                      {ocCountsMap[e.event_id] ? "Manage OC" : "Form OC"}
                    </button>
                  ) : null}

                  {/* Button 2: Attendance */}
                  {isAdmin ? (
                    <button 
                      onClick={() => seedAttendance(e.event_id)}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-zinc-700 rounded-lg text-[12px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                      Seed Attendance
                    </button>
                  ) : session?.role && session.role !== "guest" && e.date === today ? (
                    e.self_attendance_enabled ? (
                      myAttendanceMap[e.event_id] === "YES" ? (
                        <span className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Present
                        </span>
                      ) : isTimeWithinRange(e.time) ? (
                        <button
                          onClick={() => handleSelfMarkAttendance(e.event_id)}
                          disabled={markingMap[e.event_id]}
                          className="flex-1 min-w-[120px] px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                          {markingMap[e.event_id] ? "Marking..." : "Mark Present"}
                        </button>
                      ) : (
                        <button disabled className="flex-1 min-w-[120px] px-3 py-2 border border-zinc-800 text-zinc-600 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-not-allowed">
                          Outside Time
                        </button>
                      )
                    ) : null
                  ) : null}

                  {/* Button 3: Public Page */}
                  <a 
                    href={`/event?id=${e.event_id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 min-w-[120px] px-3 py-2 bg-white/10 text-white rounded-lg text-[12px] font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5 border border-zinc-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    {e.is_public !== false ? "Public Page" : "Preview"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="mt-8">
        <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
      </div>

      {/* Create / Edit Event Modal */}
      {modal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-zinc-400">{editTarget ? "edit_calendar" : "add_event"}</span>
                {editTarget ? "Edit Event" : "Create Event"}
              </h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {msg && (
              <div className={`p-3 rounded-lg text-sm border ${msg.type === "error" ? "bg-red-950/30 text-red-400 border-red-900/50" : "bg-emerald-950/30 text-emerald-400 border-emerald-900/50"}`}>
                {msg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Event ID *</label>
                <input 
                  placeholder="e.g. 20261" 
                  value={form.event_id} 
                  onChange={e => setForm({ ...form, event_id: e.target.value })} 
                  disabled={!!editTarget}
                  className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Date *</label>
                <DatePicker
                  value={form.date}
                  onChange={v => setForm({ ...form, date: v })}
                  placeholder="Select event date"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Event Name *</label>
              <input 
                placeholder="Name of the event" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 bg-[#1e1e21] p-3 rounded-xl border border-zinc-800 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.is_public !== false} 
                  onChange={e => setForm({ ...form, is_public: e.target.checked })} 
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-xs font-medium text-zinc-300">
                  Show Event on Public Page
                </span>
              </label>

              <label className="flex items-center gap-3 bg-[#1e1e21] p-3 rounded-xl border border-zinc-800 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.self_attendance_enabled === true} 
                  onChange={e => setForm({ ...form, self_attendance_enabled: e.target.checked })} 
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-xs font-medium text-zinc-300">
                  Enable Member Self-Attendance
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Event Time</label>
                <input 
                  placeholder="e.g. 10:00 AM - 1:00 PM" 
                  value={form.time || ""} 
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Tally.so Link / ID</label>
                <input 
                  placeholder="e.g. mBQKkN or full URL" 
                  value={form.tally_link || ""} 
                  onChange={e => setForm({ ...form, tally_link: e.target.value })}
                  className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Event Description</label>
              <textarea 
                placeholder="Describe the event, topics, guest speakers..." 
                value={form.description || ""} 
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full h-24 bg-[#1e1e21] border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Event Flyer Image</label>
              <div className="flex items-center gap-4 bg-[#1e1e21] p-3 rounded-xl border border-zinc-800">
                {flyerPreview || form.flyer_url ? (
                  <img
                    src={flyerPreview || form.flyer_url}
                    alt="Flyer Preview"
                    className="w-16 h-20 object-cover rounded-lg border border-zinc-700 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-lg bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 text-xl flex-shrink-0">
                    🖼️
                  </div>
                )}
                <div className="flex flex-col gap-1 flex-grow">
                  <input
                    type="file"
                    accept="image/*"
                    id="event-flyer-upload"
                    onChange={handleFlyerChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="event-flyer-upload"
                    className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium self-start transition-colors border border-zinc-700"
                  >
                    Choose Flyer
                  </label>
                  <span className="text-zinc-500 text-xs truncate max-w-[200px]">
                    {flyerFile ? flyerFile.name : "No flyer uploaded"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Apply Start Date (OC)</label>
                <DatePicker
                  value={form.apply_start_date}
                  onChange={v => setForm({ ...form, apply_start_date: v })}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Apply End Date (OC)</label>
                <DatePicker
                  value={form.apply_end_date}
                  onChange={v => setForm({ ...form, apply_end_date: v })}
                  placeholder="Select end date"
                />
              </div>
            </div>

            <div className="bg-[#1e1e21] p-4 rounded-xl border border-zinc-800 space-y-3">
              <label className="block text-xs font-semibold text-zinc-300">
                Available OC Positions for Applicants
              </label>
              <div className="flex flex-wrap gap-1.5">
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
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${isSelected ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
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
                    className="px-3 py-1 rounded-full text-xs bg-blue-600 text-white"
                  >
                    ✓ {customPos} ✕
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add custom position (e.g. Design Lead)..."
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
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
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
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Assigned OC Lead</label>
              <select 
                value={form.oc_st_id} 
                onChange={e => setForm({ ...form, oc_st_id: e.target.value })}
                className="w-full bg-[#1e1e21] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
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
                    <option key={m.st_id} value={m.st_id}>{m.st_id} - {m.name}</option>
                  ));
                })()}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button 
                onClick={closeModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editTarget ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply for OC Modal */}
      {applyModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && closeApplyModal()}
        >
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-zinc-400">group_add</span>
                Apply for OC - {applyTarget?.name}
              </h2>
              <button 
                onClick={closeApplyModal}
                className="w-8 h-8 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {msg && (
              <div className={`p-3 rounded-lg text-sm border ${msg.type === "error" ? "bg-red-950/30 text-red-400 border-red-900/50" : "bg-emerald-950/30 text-emerald-400 border-emerald-900/50"}`}>
                {msg.text}
              </div>
            )}

            {existingApp && (
              <div className={`p-3 rounded-xl border text-xs ${existingApp.apply_status === "Accept" ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" : existingApp.apply_status === "Reject" ? "bg-red-950/30 border-red-900/50 text-red-400" : "bg-amber-950/30 border-amber-900/50 text-amber-400"}`}>
                <div className="font-semibold mb-0.5">
                  {existingApp.apply_status === "Accept" ? "✓ Application Accepted" : existingApp.apply_status === "Reject" ? "✕ Application Rejected" : "⏳ Application Pending"}
                </div>
                <div className="text-zinc-300">
                  {existingApp.apply_status === "Pending" 
                    ? "You can update your preferred positions below."
                    : `Status: ${existingApp.apply_status}`}
                </div>
              </div>
            )}

            {applyForm.member_function_name && (
              <div className="bg-[#1e1e21] p-3 rounded-xl border border-zinc-800">
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Your Function</label>
                <div className="text-sm font-semibold text-white">
                  💼 {applyForm.member_function_name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Preferred Positions (Select 1 or more) *
              </label>
              <div className="space-y-2 mt-2">
                {(() => {
                  const available = parsePositionsList(applyTarget?.available_oc_positions);
                  const selected = applyForm.selected_positions || [];
                  const isLocked = existingApp && existingApp.apply_status !== "Pending";

                  return (
                    <>
                      {available.map(pos => {
                        const checked = selected.includes(pos);
                        return (
                          <label
                            key={pos}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? "bg-blue-950/30 border-blue-600 text-white" : "bg-[#1e1e21] border-zinc-800 text-zinc-300 hover:border-zinc-700"}`}
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
                              className="w-4 h-4 rounded accent-blue-600"
                            />
                            <span className="text-xs font-medium">{pos}</span>
                          </label>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button 
                onClick={closeApplyModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              {(!existingApp || existingApp.apply_status === "Pending") && (
                <button 
                  onClick={handleApplySave} 
                  disabled={saving || !applyForm.function_id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Submitting..." : existingApp ? "Update Application" : "Submit Application"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
