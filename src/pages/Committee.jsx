import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";
import EventSelect from "../components/EventSelect";
import CalEmbedModal from "../components/CalEmbedModal";
import { 
  Users, 
  Search, 
  Plus, 
  Download, 
  Calendar, 
  Clock, 
  Video, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  UserX, 
  HelpCircle, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Check, 
  Mail, 
  Settings,
  Sparkles,
  User,
  Trash2,
  Send,
  CalendarDays
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const EMPTY = { st_id: "", function_id: "", oc_position: "", apply_status: "Pending", interviewer_email: "" };
const STATUS_OPTS = ["Pending", "Invited", "Interview Scheduled", "Accept", "Reject"];
const INTERVIEWER_PAGE_SIZE = 5;

export default function Committee({ isAdmin = false, session }) {
  const [oc, setOc] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [functions, setFunctions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [fnModal, setFnModal] = useState(false);
  const [fnName, setFnName] = useState("");
  const [fnSaving, setFnSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ Accept: 0, Pending: 0, Invited: 0, Scheduled: 0, Reject: 0 });
  const [profileTarget, setProfileTarget] = useState(null);

  // Cal.com Embed Modal state
  const [calModal, setCalModal] = useState({ isOpen: false, row: null });
  const [customCalUrl, setCustomCalUrl] = useState(() => {
    return localStorage.getItem("committee_cal_url") || "https://cal.com/adss-ruhuna/committee-interview";
  });
  const [calSetupModalOpen, setCalSetupModalOpen] = useState(false);

  const [calSavedToast, setCalSavedToast] = useState(false);

  const handleCalUrlChange = (url) => {
    setCustomCalUrl(url);
    localStorage.setItem("committee_cal_url", url);
  };
  const [emailSendingId, setEmailSendingId] = useState(null);

  // Interviewer Selection Invite Modal State
  const [inviteModal, setInviteModal] = useState({ isOpen: false, row: null });
  const [selectedInterviewerEmail, setSelectedInterviewerEmail] = useState("");
  const [customInterviewerEmail, setCustomInterviewerEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // Accept Position Selection Modal State
  const [acceptModal, setAcceptModal] = useState({ isOpen: false, row: null, positions: [], selectedPosition: "", customPosition: "" });

  const openAcceptModal = (o) => {
    const posList = o.oc_position
      ? o.oc_position.split(",").map(p => p.trim()).filter(Boolean)
      : [];
    const defaultPos = posList.length > 0 ? posList[0] : (o.functions?.function_name || "Committee Member");
    setAcceptModal({
      isOpen: true,
      row: o,
      positions: posList,
      selectedPosition: defaultPos,
      customPosition: ""
    });
  };

  const handleConfirmAccept = async () => {
    const o = acceptModal.row;
    if (!o) return;

    const finalPos = acceptModal.customPosition.trim() || acceptModal.selectedPosition.trim();
    if (!finalPos) {
      alert("Please select or enter a position to assign.");
      return;
    }

    setEmailSendingId(`${o.st_id}-${o.function_id}`);
    const { error } = await supabase.from("oc")
      .update({
        apply_status: "Accept",
        oc_position: finalPos
      })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      alert(error.message);
    } else {
      const recipientEmail = o.members?.email;
      const studentName = o.members?.name || "Applicant";
      const eventName = selectedEventInfo?.name || "Society Event";

      if (recipientEmail) {
        await triggerSendEmail({
          to: recipientEmail,
          type: "STATUS_ACCEPTED",
          data: { studentName, eventName, ocPosition: finalPos }
        });
      }
      setAcceptModal({ isOpen: false, row: null, positions: [], selectedPosition: "", customPosition: "" });
      loadOc(selectedEvent, page, filterStatus, search);
    }
    setEmailSendingId(null);
  };

  // Search & Pagination inside Invite Modal for Interviewers
  const [interviewerSearch, setInterviewerSearch] = useState("");
  const [interviewerPage, setInterviewerPage] = useState(0);

  const isOwnRow = (row) => {
    if (!session) return false;
    if (session.stId && row.st_id?.toUpperCase() === session.stId?.toUpperCase()) return true;
    if (session.email && row.members?.email?.toLowerCase() === session.email?.toLowerCase()) return true;
    return false;
  };

  const load = async () => {
    setLoading(true);
    const [eventRes, fRes, profileRes, memberRes] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: false }),
      supabase.from("functions").select("*").order("function_name"),
      supabase.from("profiles").select("id, email, full_name, role").in("role", ["admin", "editor"]).order("full_name"),
      supabase.from("members").select("name, email").not("email", "is", null).order("name"),
    ]);

    const nextEvents = eventRes.data || [];
    setEvents(nextEvents);
    setSelectedEvent(current => current || nextEvents[0]?.event_id || "");
    setFunctions(fRes.data || []);

    const list = [];
    if (profileRes.data) {
      profileRes.data.forEach(p => {
        if (p.email) list.push({ name: p.full_name || p.email, email: p.email, role: p.role });
      });
    }
    if (memberRes.data) {
      memberRes.data.forEach(m => {
        if (m.email && !list.some(item => item.email.toLowerCase() === m.email.toLowerCase())) {
          list.push({ name: m.name || m.email, email: m.email, role: "member" });
        }
      });
    }
    setStaffList(list);
    setLoading(false);
  };

  const loadOc = async (eventId, pageToLoad = page, status = filterStatus, searchText = search) => {
    if (!eventId) {
      setOc([]);
      setTotal(0);
      setStatusCounts({ Accept: 0, Pending: 0, Invited: 0, Scheduled: 0, Reject: 0 });
      return;
    }

    setLoading(true);
    setMsg(null);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("oc")
      .select("*, members(name, email, st_id), functions(function_name)", { count: "exact" })
      .eq("event_id", eventId)
      .order("st_id")
      .range(from, to);

    if (status !== "All") {
      query = query.eq("apply_status", status);
    }

    const q = searchText.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,oc_position.ilike.%${q}%,apply_status.ilike.%${q}%`);
    }

    const [records, accept, pending, invited, scheduled, reject] = await Promise.all([
      query,
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Accept"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Pending"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Invited"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Interview Scheduled"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Reject"),
    ]);

    if (records.error) {
      setMsg({ type: "error", text: records.error.message });
    } else {
      let rawData = records.data || [];
      rawData.sort((a, b) => {
        const aOwn = isOwnRow(a);
        const bOwn = isOwnRow(b);
        if (aOwn && !bOwn) return -1;
        if (!aOwn && bOwn) return 1;
        return 0;
      });
      setOc(rawData);
    }
    setTotal(records.count || 0);
    setStatusCounts({
      Accept: accept.count || 0,
      Pending: pending.count || 0,
      Invited: invited.count || 0,
      Scheduled: scheduled.count || 0,
      Reject: reject.count || 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    loadOc(selectedEvent, page, filterStatus, search);
  }, [selectedEvent, page, filterStatus, search]);

  const exportCSV = async () => {
    if (!selectedEvent) {
      alert("Please select an event first.");
      return;
    }

    setLoading(true);
    let query = supabase
      .from("oc")
      .select("*, members(name, email, st_id), functions(function_name)")
      .eq("event_id", selectedEvent)
      .order("st_id");

    if (filterStatus !== "All") {
      query = query.eq("apply_status", filterStatus);
    }

    const q = search.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,oc_position.ilike.%${q}%,apply_status.ilike.%${q}%`);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      alert("Failed to fetch data for export: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("No records found to export.");
      return;
    }

    const headers = ["ST ID", "Name", "Email", "OC Position", "Function", "Interview Status", "Assigned Interviewer", "Interview Slot"];
    const rows = data.map(o => {
      const interviewerName = (() => {
        if (!o.interviewer_email) return "Unassigned";
        const staffMatch = staffList.find(s => s.email?.toLowerCase() === o.interviewer_email?.toLowerCase());
        return staffMatch ? `${staffMatch.name} (${o.interviewer_email})` : o.interviewer_email;
      })();

      const slot = o.interview_date ? new Date(o.interview_date).toLocaleString() : "Not Scheduled";

      return [
        o.st_id || "",
        o.members?.name || "",
        o.members?.email || "",
        o.oc_position || "",
        o.functions?.function_name || "",
        o.apply_status || "",
        interviewerName,
        slot
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const eventNameClean = (selectedEventInfo?.name || "oc_assignments").replace(/[^a-z0-9]/gi, "_").toLowerCase();

    link.setAttribute("href", url);
    link.setAttribute("download", `${eventNameClean}_committee_oc.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAdd = () => {
    setForm({ ...EMPTY, interviewer_email: session?.email || "" });
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => { setModal(false); setMsg(null); };

  const handleSave = async () => {
    if (!selectedEvent) {
      setMsg({ type: "error", text: "Select an event first." }); return;
    }
    if (!form.st_id || !form.function_id) {
      setMsg({ type: "error", text: "Member and Function are required." }); return;
    }
    setSaving(true);
    const payload = {
      event_id: selectedEvent,
      st_id: form.st_id.trim(),
      function_id: parseInt(form.function_id),
      oc_position: form.oc_position.trim() || null,
      apply_status: form.apply_status,
      interviewer_email: form.interviewer_email.trim() || session?.email || null,
    };
    const { error } = await supabase.from("oc").insert([payload]);
    setSaving(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: "OC record saved." });

    const { data: member } = await supabase.from("members").select("email, name").eq("st_id", form.st_id.trim()).maybeSingle();
    if (member?.email) {
      triggerSendEmail({
        to: member.email,
        type: "APPLICATION_RECEIVED",
        data: {
          studentName: member.name,
          eventName: selectedEventInfo?.name || "Society Event",
          ocPosition: form.oc_position || "Committee Member"
        }
      });
    }

    loadOc(selectedEvent, page, filterStatus, search);
    setTimeout(closeModal, 700);
  };

  const triggerSendEmail = async (payload) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: payload
      });
      if (error) console.error("Edge function send-email error:", error);
      return data;
    } catch (err) {
      console.error("Failed to invoke send-email:", err);
    }
  };

  const updateStatus = async (o, status) => {
    setEmailSendingId(`${o.st_id}-${o.function_id}`);
    const { error } = await supabase.from("oc")
      .update({ apply_status: status })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      alert(error.message);
    } else {
      const recipientEmail = o.members?.email;
      const studentName = o.members?.name || "Applicant";
      const eventName = selectedEventInfo?.name || "Society Event";
      const position = o.oc_position || o.functions?.function_name || "Committee Member";

      if (recipientEmail) {
        if (status === "Accept") {
          await triggerSendEmail({
            to: recipientEmail,
            type: "STATUS_ACCEPTED",
            data: { studentName, eventName, ocPosition: position }
          });
        } else if (status === "Reject") {
          await triggerSendEmail({
            to: recipientEmail,
            type: "STATUS_REJECTED",
            data: { studentName, eventName, ocPosition: position }
          });
        }
      }
      loadOc(selectedEvent, page, filterStatus, search);
    }
    setEmailSendingId(null);
  };

  const openInviteModal = (o) => {
    const defaultInterviewer = o.interviewer_email || session?.email || (staffList[0]?.email || "");
    setSelectedInterviewerEmail(defaultInterviewer);
    setCustomInterviewerEmail("");
    setInterviewerSearch("");
    setInterviewerPage(0);
    setInviteModal({ isOpen: true, row: o });
  };

  const sendInviteWithInterviewer = async () => {
    const o = inviteModal.row;
    if (!o) return;

    const finalInterviewerEmail = selectedInterviewerEmail === "custom"
      ? customInterviewerEmail.trim()
      : selectedInterviewerEmail.trim();

    if (!finalInterviewerEmail) {
      alert("Please select or enter a valid Interviewer email address.");
      return;
    }

    setInviteSending(true);
    setEmailSendingId(`${o.st_id}-${o.function_id}`);

    const { error } = await supabase.from("oc")
      .update({
        apply_status: "Invited",
        interviewer_email: finalInterviewerEmail
      })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      alert(error.message);
    } else {
      const recipientEmail = o.members?.email;
      if (recipientEmail) {
        const studentName = o.members?.name || "Applicant";
        const eventName = selectedEventInfo?.name || "Society Event";
        const position = o.oc_position || o.functions?.function_name || "Committee Member";

        const bookingUrlObj = new URL(customCalUrl.startsWith("http") ? customCalUrl : `https://${customCalUrl}`);
        bookingUrlObj.searchParams.set("email", recipientEmail);
        bookingUrlObj.searchParams.set("name", studentName);
        bookingUrlObj.searchParams.set("st_id", o.st_id);
        bookingUrlObj.searchParams.set("guests", finalInterviewerEmail);
        bookingUrlObj.searchParams.set("interviewer_email", finalInterviewerEmail);

        await triggerSendEmail({
          to: recipientEmail,
          type: "INTERVIEW_INVITE",
          data: {
            studentName,
            eventName,
            ocPosition: position,
            calLink: bookingUrlObj.toString()
          }
        });
        alert(`Interview invite email sent to candidate (${recipientEmail})!\nInterviewer set to: ${finalInterviewerEmail}`);
      } else {
        alert("Status updated to 'Invited'. Note: Candidate email was not found in profile.");
      }
      setInviteModal({ isOpen: false, row: null });
      loadOc(selectedEvent, page, filterStatus, search);
    }
    setInviteSending(false);
    setEmailSendingId(null);
  };

  const handleDelete = async (stId, functionId) => {
    if (!confirm("Remove this OC record?")) return;
    const { error } = await supabase.from("oc").delete().eq("event_id", selectedEvent).eq("st_id", stId).eq("function_id", functionId);
    if (error) alert(error.message);
    else loadOc(selectedEvent, page, filterStatus, search);
  };

  const addFunction = async () => {
    if (!fnName.trim()) return;
    setFnSaving(true);
    const { error } = await supabase.from("functions").insert([{ function_name: fnName.trim() }]);
    setFnSaving(false);
    if (error) alert(error.message);
    else { setFnName(""); load(); setFnModal(false); }
  };

  const renderStatusBadge = (s) => {
    if (s === "Accept") return <Badge variant="success" className="text-[11px] font-semibold px-2.5 py-0.5">Accepted</Badge>;
    if (s === "Reject") return <Badge variant="destructive" className="text-[11px] font-semibold px-2.5 py-0.5">Rejected</Badge>;
    if (s === "Invited") return <Badge variant="default" className="text-[11px] font-semibold px-2.5 py-0.5 bg-blue-600/20 text-blue-300 border-blue-500/30">Invited</Badge>;
    if (s === "Interview Scheduled") return <Badge variant="default" className="text-[11px] font-semibold px-2.5 py-0.5 bg-purple-600/20 text-purple-300 border-purple-500/30">Interview Scheduled</Badge>;
    return <Badge variant="warning" className="text-[11px] font-semibold px-2.5 py-0.5">Pending</Badge>;
  };

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);

  const fullInterviewerOptions = [];
  if (session?.email) {
    fullInterviewerOptions.push({
      name: session.name ? `Me (${session.name})` : "Me (Current User)",
      email: session.email,
      role: session.role || "staff",
      isSelf: true
    });
  }

  staffList.forEach(st => {
    if (!fullInterviewerOptions.some(item => item.email.toLowerCase() === st.email.toLowerCase())) {
      fullInterviewerOptions.push(st);
    }
  });

  const filteredInterviewers = fullInterviewerOptions.filter(item => {
    const q = interviewerSearch.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q) || item.role.toLowerCase().includes(q);
  });

  const totalInterviewerPages = Math.ceil(filteredInterviewers.length / INTERVIEWER_PAGE_SIZE) || 1;
  const paginatedInterviewers = filteredInterviewers.slice(
    interviewerPage * INTERVIEWER_PAGE_SIZE,
    (interviewerPage + 1) * INTERVIEWER_PAGE_SIZE
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 text-zinc-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Committee (OC) Management
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            {selectedEventInfo ? `${selectedEventInfo.name} — ${total} total assignments` : "Select an event to manage OC assignments"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="flex items-center gap-2 text-xs border-zinc-700/80 text-zinc-300 hover:text-white"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setFnModal(true)}
                className="flex items-center gap-1.5 text-xs border-zinc-700/80 text-zinc-300 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" /> Sub-team Function
              </Button>

              <Button
                size="sm"
                onClick={openAdd}
                className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40"
              >
                <Plus className="w-3.5 h-3.5" /> Add OC
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 5 Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Card className="p-4 bg-[#17171a]/80 border-amber-500/30">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Pending</span>
          <p className="text-2xl font-black text-white">{statusCounts.Pending}</p>
        </Card>

        <Card className="p-4 bg-[#17171a]/80 border-blue-500/30">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Invited</span>
          <p className="text-2xl font-black text-white">{statusCounts.Invited}</p>
        </Card>

        <Card className="p-4 bg-[#17171a]/80 border-purple-500/30">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Scheduled</span>
          <p className="text-2xl font-black text-white">{statusCounts.Scheduled}</p>
        </Card>

        <Card className="p-4 bg-[#17171a]/80 border-emerald-500/30">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Accepted</span>
          <p className="text-2xl font-black text-white">{statusCounts.Accept}</p>
        </Card>

        <Card className="p-4 bg-[#17171a]/80 border-rose-500/30">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">Rejected</span>
          <p className="text-2xl font-black text-white">{statusCounts.Reject}</p>
        </Card>
      </div>

      {/* Event Selection & Configuration Card */}
      <Card className="p-5 bg-[#17171a]/90 border border-zinc-800/90 shadow-xl mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-white">Target Event Selection</span>
            {selectedEventInfo && (
              <Badge variant="secondary" className="text-xs font-mono">
                {selectedEventInfo.date}
              </Badge>
            )}
          </div>
        </div>

        <EventSelect
          events={events}
          value={selectedEvent}
          onChange={(id) => { setPage(0); setSelectedEvent(id); }}
          placeholder="Search or select an event..."
        />

        {/* Editable Cal.com Link (Admin Only) */}
        {isAdmin && (
          <div className="pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5 text-indigo-400" /> Cal.com Booking Link
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="text"
                  value={customCalUrl}
                  onChange={e => handleCalUrlChange(e.target.value)}
                  placeholder="https://cal.com/adss-ruhuna/committee-interview"
                  className="h-9 text-xs flex-1 min-w-[220px]"
                />
                <a
                  href={customCalUrl.startsWith("http") ? customCalUrl : `https://${customCalUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 whitespace-nowrap"
                >
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
                <Button
                  size="sm"
                  onClick={() => {
                    handleCalUrlChange(customCalUrl);
                    setCalSavedToast(true);
                    setTimeout(() => setCalSavedToast(false), 2000);
                  }}
                  className="h-9 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 whitespace-nowrap"
                >
                  {calSavedToast ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved!</> : <><Check className="w-3.5 h-3.5" /> Save</>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalSetupModalOpen(true)}
                  className="h-9 text-xs border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 whitespace-nowrap"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Setup Guide
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Toolbar & Search Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search by ST ID, position, status..."
            value={search}
            onChange={e => { setPage(0); setSearch(e.target.value); }}
            className="pl-10 h-10 w-full"
          />
        </div>

        <select 
          value={filterStatus} 
          onChange={e => { setPage(0); setFilterStatus(e.target.value); }} 
          className="h-10 px-3.5 rounded-lg border border-zinc-800 bg-[#141417] text-xs font-semibold text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-52 flex-shrink-0 cursor-pointer"
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {msg && !modal && (
        <div className={`p-3.5 mb-6 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
          msg.type === "error" ? "bg-rose-950/40 border-rose-900/60 text-rose-300" : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
        }`}>
          {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Committee Table Card */}
      <Card className="bg-[#17171a]/90 border border-zinc-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
            <div className="w-9 h-9 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-zinc-400">Loading assignments...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ fontSize: "13px" }}>
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider bg-zinc-900/60">
                  {isAdmin && <th className="py-3 px-4">ST ID</th>}
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">OC Position & Function</th>
                  <th className="py-3 px-4">Interview Status</th>
                  <th className="py-3 px-4">Assigned Interviewer</th>
                  <th className="py-3 px-4">Interview Slot</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {oc.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 5} className="py-16 text-center text-zinc-500 text-xs">
                      <Users className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
                      <span>No committee assignments found for the current filter.</span>
                    </td>
                  </tr>
                ) : (
                  oc.map(o => {
                    const isProcessing = emailSendingId === `${o.st_id}-${o.function_id}`;
                    const own = isOwnRow(o);
                    const canSeeDetails = isAdmin || own;

                    const interviewerDisplayName = (() => {
                      if (!o.interviewer_email) return null;
                      const staffMatch = staffList.find(s => s.email?.toLowerCase() === o.interviewer_email?.toLowerCase());
                      return staffMatch?.name || o.interviewer_email.split("@")[0];
                    })();

                    return (
                      <tr
                        key={`${o.st_id}-${o.function_id}`}
                        className={`transition-colors hover:bg-zinc-800/40 ${
                          own ? "bg-indigo-600/10 border-l-4 border-l-indigo-500" : ""
                        }`}
                      >
                        {isAdmin && (
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-zinc-300">
                            {o.st_id}
                          </td>
                        )}

                        <td className="py-3.5 px-4">
                          {isAdmin ? (
                            <button
                              onClick={() => setProfileTarget(o.st_id)}
                              className="font-bold text-indigo-400 hover:underline text-left text-sm"
                            >
                              {o.members?.name || "-"}
                            </button>
                          ) : (
                            <span className="font-bold text-zinc-100 text-sm">{o.members?.name || "-"}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-white text-xs">
                              {o.oc_position || "-"}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {o.functions?.function_name || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {renderStatusBadge(o.apply_status)}
                        </td>

                        <td className="py-3.5 px-4">
                          {interviewerDisplayName ? (
                            <Badge variant="secondary" className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-xs px-2.5 py-0.5">
                              <User className="w-3 h-3" /> {interviewerDisplayName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {o.interview_date ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                {new Date(o.interview_date).toLocaleString()}
                              </span>
                              {canSeeDetails && o.interview_link && (
                                <a 
                                  href={o.interview_link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-xs font-semibold text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <Video className="w-3 h-3" /> Join Meeting
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Not booked</span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => openInviteModal(o)}
                                disabled={isProcessing}
                                className="h-7 px-2.5 text-xs bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                                title="Select Interviewer & Send Invite Email"
                              >
                                Invite
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCalModal({ isOpen: true, row: o })}
                                className="h-7 px-2 text-xs border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40"
                                title="Book via Cal.com Embed"
                              >
                                Cal
                              </Button>

                              {o.apply_status !== "Accept" && (
                                <Button
                                  size="sm"
                                  onClick={() => openAcceptModal(o)}
                                  disabled={isProcessing}
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                  Accept
                                </Button>
                              )}

                              {o.apply_status !== "Reject" && (
                                <Button
                                  size="sm"
                                  onClick={() => updateStatus(o, "Reject")}
                                  disabled={isProcessing}
                                  className="h-7 px-2.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                                >
                                  Reject
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(o.st_id, o.function_id)}
                                className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/40">
            <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* STUDENT PROFILE PREVIEW MODAL */}
      {profileTarget && (
        <StudentProfileModal
          stId={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
      )}

      {/* CAL.COM EMBED MODAL */}
      {calModal.isOpen && calModal.row && (
        <CalEmbedModal
          row={calModal.row}
          customCalUrl={customCalUrl}
          onClose={() => setCalModal({ isOpen: false, row: null })}
          onSuccess={() => loadOc(selectedEvent, page, filterStatus, search)}
        />
      )}

      {/* INTERVIEWER INVITE MODAL */}
      {inviteModal.isOpen && inviteModal.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setInviteModal({ isOpen: false, row: null })}>
          <Card 
            className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" /> Invite Candidate to Interview
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setInviteModal({ isOpen: false, row: null })} className="h-7 w-7 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 space-y-1">
                <p className="font-bold text-white text-sm">{inviteModal.row.members?.name}</p>
                <p className="text-zinc-400 font-mono">ID: {inviteModal.row.st_id} • Position: {inviteModal.row.oc_position || inviteModal.row.functions?.function_name}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select Assigned Interviewer
                </label>
                
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Search staff or member name..."
                    value={interviewerSearch}
                    onChange={e => { setInterviewerSearch(e.target.value); setInterviewerPage(0); }}
                    className="pl-9 h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 rounded-xl border border-zinc-800 bg-zinc-900/50">
                  {paginatedInterviewers.map(item => (
                    <label 
                      key={item.email}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        selectedInterviewerEmail === item.email 
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white" 
                          : "border-zinc-800 hover:bg-zinc-800/40 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="interviewerChoice"
                          value={item.email}
                          checked={selectedInterviewerEmail === item.email}
                          onChange={() => setSelectedInterviewerEmail(item.email)}
                          className="w-3.5 h-3.5 text-indigo-600"
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">{item.email}</span>
                    </label>
                  ))}

                  <label 
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedInterviewerEmail === "custom" 
                        ? "bg-indigo-600/20 border-indigo-500/50 text-white" 
                        : "border-zinc-800 hover:bg-zinc-800/40 text-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="interviewerChoice"
                      value="custom"
                      checked={selectedInterviewerEmail === "custom"}
                      onChange={() => setSelectedInterviewerEmail("custom")}
                      className="w-3.5 h-3.5 text-indigo-600"
                    />
                    <span className="font-semibold">Enter Custom Interviewer Email</span>
                  </label>
                </div>

                {totalInterviewerPages > 1 && (
                  <div className="flex items-center justify-between mt-2 text-[11px] text-zinc-500">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setInterviewerPage(p => Math.max(0, p - 1))}
                      disabled={interviewerPage === 0}
                      className="h-6 text-[11px]"
                    >
                      Prev
                    </Button>
                    <span>Page {interviewerPage + 1} of {totalInterviewerPages}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setInterviewerPage(p => Math.min(totalInterviewerPages - 1, p + 1))}
                      disabled={interviewerPage >= totalInterviewerPages - 1}
                      className="h-6 text-[11px]"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              {selectedInterviewerEmail === "custom" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Custom Interviewer Email</label>
                  <Input
                    placeholder="e.g. interviewer@domain.com"
                    value={customInterviewerEmail}
                    onChange={e => setCustomInterviewerEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={() => setInviteModal({ isOpen: false, row: null })} disabled={inviteSending}>
                Cancel
              </Button>
              <Button size="sm" onClick={sendInviteWithInterviewer} disabled={inviteSending} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold">
                {inviteSending ? "Sending..." : "Send Invite Email"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ACCEPT POSITION SELECTION MODAL */}
      {acceptModal.isOpen && acceptModal.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setAcceptModal({ isOpen: false, row: null, positions: [], selectedPosition: "", customPosition: "" })}>
          <Card 
            className="w-full max-w-md flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Accept & Assign Final Position
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setAcceptModal({ isOpen: false, row: null, positions: [], selectedPosition: "", customPosition: "" })} className="h-7 w-7 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                Confirm acceptance for <strong className="text-white">{acceptModal.row.members?.name}</strong> and assign their final committee position.
              </p>

              {acceptModal.positions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Selected Applied Position</label>
                  <div className="space-y-1.5">
                    {acceptModal.positions.map((pos, idx) => (
                      <label key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-200 cursor-pointer">
                        <input
                          type="radio"
                          name="posChoice"
                          value={pos}
                          checked={acceptModal.selectedPosition === pos && !acceptModal.customPosition}
                          onChange={() => setAcceptModal(prev => ({ ...prev, selectedPosition: pos, customPosition: "" }))}
                          className="w-3.5 h-3.5 text-indigo-600"
                        />
                        <span>{pos}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Custom Position (Overrides Selection)</label>
                <Input
                  placeholder="e.g. Lead Coordinator / Team Head"
                  value={acceptModal.customPosition}
                  onChange={e => setAcceptModal(prev => ({ ...prev, customPosition: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={() => setAcceptModal({ isOpen: false, row: null, positions: [], selectedPosition: "", customPosition: "" })}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmAccept} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                Confirm & Accept
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ADD OC MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <Card 
            className="w-full max-w-lg flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-base font-bold text-white">Add OC Assignment</CardTitle>
              <Button variant="ghost" size="icon" onClick={closeModal} className="h-7 w-7 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {msg && (
              <div className={`mx-5 mt-4 p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                msg.type === "error" ? "bg-rose-950/40 border-rose-900/60 text-rose-300" : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>{msg.text}</span>
              </div>
            )}

            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Member ST ID *</label>
                  <Input
                    placeholder="Type member ST ID"
                    value={form.st_id}
                    onChange={e => setForm({ ...form, st_id: e.target.value })}
                    className="h-9 text-xs"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Function *</label>
                  <select
                    value={form.function_id}
                    onChange={e => setForm({ ...form, function_id: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#141417] text-xs font-medium text-zinc-200"
                  >
                    <option value="">Select Function</option>
                    {functions.map(f => <option key={f.id} value={f.id}>{f.function_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Apply Status</label>
                  <select
                    value={form.apply_status}
                    onChange={e => setForm({ ...form, apply_status: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#141417] text-xs font-medium text-zinc-200"
                  >
                    {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">OC Position Title</label>
                  <Input
                    placeholder="e.g. Lead Coordinator"
                    value={form.oc_position}
                    onChange={e => setForm({ ...form, oc_position: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Assigned Interviewer Email</label>
                <Input
                  placeholder="interviewer@email.com"
                  value={form.interviewer_email}
                  onChange={e => setForm({ ...form, interviewer_email: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                {saving ? "Saving..." : "Save Record"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ADD SUB-TEAM FUNCTION MODAL */}
      {fnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setFnModal(false)}>
          <Card 
            className="w-full max-w-md flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-base font-bold text-white">Add Sub-team Function</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setFnModal(false)} className="h-7 w-7 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Function Name *</label>
                <Input
                  placeholder="e.g. Media & Photography"
                  value={fnName}
                  onChange={e => setFnName(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={() => setFnModal(false)} disabled={fnSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={addFunction} disabled={fnSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                {fnSaving ? "Saving..." : "Create Function"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* CAL.COM SETUP HELP MODAL */}
      {calSetupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setCalSetupModalOpen(false)}>
          <Card 
            className="w-full max-w-xl max-h-[85vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" /> How to Setup Cal.com Automated Interviews
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCalSetupModalOpen(false)} className="h-7 w-7 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-indigo-300">
                Follow these 3 quick steps to connect your Cal.com event type to Supabase.
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <strong className="text-white block mb-1">Step 1: Get your Cal.com Event Link</strong>
                  <p className="text-zinc-400">Copy your Cal.com booking link (e.g. <code className="text-indigo-300">https://cal.com/adss-ruhuna/committee-interview</code>) and paste it into the Cal.com input box on the Committee page.</p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <strong className="text-white block mb-1">Step 2: Add Webhook in Cal.com</strong>
                  <p className="text-zinc-400">In Cal.com settings, navigate to <strong>Webhooks</strong> and add a new webhook pointing to:</p>
                  <code className="block mt-1 p-2 rounded bg-black/50 text-emerald-400 font-mono text-[11px] break-all select-all">
                    https://zbhwelmxdgldbwbnsfhd.supabase.co/functions/v1/cal-webhook
                  </code>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <strong className="text-white block mb-1">Step 3: Enable Webhook Triggers</strong>
                  <p className="text-zinc-400">Enable <strong>BOOKING_CREATED</strong> and <strong>BOOKING_RESCHEDULED</strong> events so Supabase automatically updates applicant status to <em>Interview Scheduled</em>!</p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end pt-3 border-t border-zinc-800 bg-zinc-900/40">
              <Button size="sm" onClick={() => setCalSetupModalOpen(false)}>
                Got it
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
