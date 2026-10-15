import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import StudentProfileModal from "../components/StudentProfileModal";
import { StudentNameLink } from "../components/StudentProfileContext";
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
  CalendarDays,
  Copy,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";

const EMPTY_FORM = {
  st_id: "",
  function_id: "",
  oc_position: "",
  apply_status: "Pending",
  interviewer_email: ""
};

const STATUS_OPTS = ["Pending", "Invited", "Interview Scheduled", "Accept", "Reject"];
const INTERVIEWER_PAGE_SIZE = 5;

export default function Committee({ isAdmin = false, session, theme }) {
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

  const [oc, setOc] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [functions, setFunctions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const querySeqRef = useRef(0);
  const [fnModal, setFnModal] = useState(false);
  const [fnName, setFnName] = useState("");
  const [fnSaving, setFnSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    Accept: 0,
    Pending: 0,
    Invited: 0,
    Scheduled: 0,
    Reject: 0
  });
  const [profileTarget, setProfileTarget] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Cal.com Embed Modal state
  const [calModal, setCalModal] = useState({ isOpen: false, row: null });
  const [customCalUrl, setCustomCalUrl] = useState(() => {
    return (
      localStorage.getItem("committee_cal_url") ||
      "https://cal.com/adss-ruhuna/committee-interview"
    );
  });
  const [calSetupModalOpen, setCalSetupModalOpen] = useState(false);
  const [showCalSettings, setShowCalSettings] = useState(false);
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
  const [acceptModal, setAcceptModal] = useState({
    isOpen: false,
    row: null,
    positions: [],
    selectedPosition: "",
    customPosition: ""
  });

  // Search & Pagination inside Invite Modal for Interviewers
  const [interviewerSearch, setInterviewerSearch] = useState("");
  const [interviewerPage, setInterviewerPage] = useState(0);

  const getAvatarInitials = (name, stId) => {
    if (typeof name === "string" && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
    }
    if (typeof stId === "string" && stId.trim()) {
      return stId.trim().slice(0, 2).toUpperCase();
    }
    return "OC";
  };

  const formatInterviewDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const cleaned = typeof dateStr === "string" ? dateStr.replace(" ", "T") : dateStr;
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return String(dateStr);
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isOwnRow = (row) => {
    if (!session || !row) return false;
    if (session.stId && typeof row.st_id === "string" && row.st_id.toUpperCase() === session.stId.toUpperCase()) return true;
    if (session.email && row.members?.email && row.members.email.toLowerCase() === session.email.toLowerCase()) return true;
    return false;
  };

  const openAcceptModal = (o) => {
    if (!o) return;
    const posList = typeof o.oc_position === "string" && o.oc_position
      ? o.oc_position.split(",").map((p) => p.trim()).filter(Boolean)
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
      setMsg({ type: "error", text: "Please select or enter a committee position to assign." });
      return;
    }

    setEmailSendingId(`${o.st_id}-${o.function_id}`);
    const { error } = await supabase
      .from("oc")
      .update({
        apply_status: "Accept",
        oc_position: finalPos
      })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      setMsg({ type: "error", text: error.message });
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
      setMsg({ type: "success", text: `Accepted ${studentName} as [${finalPos}].` });
      loadOc(selectedEvent, page, filterStatus, debouncedSearch);
    }
    setEmailSendingId(null);
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
    setSelectedEvent((current) => current || nextEvents[0]?.event_id || "");
    setFunctions(fRes.data || []);

    const list = [];
    if (profileRes.data) {
      profileRes.data.forEach((p) => {
        if (p.email) list.push({ name: p.full_name || p.email, email: p.email, role: p.role });
      });
    }
    if (memberRes.data) {
      memberRes.data.forEach((m) => {
        if (m.email && !list.some((item) => item.email.toLowerCase() === m.email.toLowerCase())) {
          list.push({ name: m.name || m.email, email: m.email, role: "member" });
        }
      });
    }
    setStaffList(list);
    setLoading(false);
  };

  const buildSearchOrFilter = async (qText) => {
    const raw = (qText || "").trim();
    if (!raw) return null;

    // Sanitize commas, quotes, parentheses for PostgREST
    const q = raw.replace(/[,()"]/g, " ").trim().replace(/\s+/g, " ");
    if (!q) return null;

    const words = q.split(" ").filter(Boolean);

    // Build member query clauses to match candidate name, preferred name, email, or ST ID
    const memberOrClauses = [
      `name.ilike.%${q}%`,
      `preferred_name.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `st_id.ilike.%${q}%`
    ];

    if (words.length > 1) {
      memberOrClauses.push(`name.ilike.%${words.join("%")}%`);
      memberOrClauses.push(`name.ilike.%${[...words].reverse().join("%")}%`);
      memberOrClauses.push(`preferred_name.ilike.%${words.join("%")}%`);
      memberOrClauses.push(`email.ilike.%${words.join("%")}%`);
    }

    let matchedStIds = [];
    let matchedFnIds = [];

    try {
      const [memberRes, fnRes] = await Promise.all([
        supabase
          .from("members")
          .select("st_id")
          .or(memberOrClauses.join(","))
          .limit(100),
        supabase
          .from("functions")
          .select("id")
          .ilike("function_name", `%${q}%`)
          .limit(20)
      ]);

      if (memberRes.data && memberRes.data.length > 0) {
        matchedStIds = Array.from(
          new Set(
            memberRes.data
              .flatMap((m) => {
                const id = m?.st_id?.trim();
                if (!id) return [];
                return [id, id.toUpperCase(), id.toLowerCase()];
              })
              .filter(Boolean)
          )
        );
      }

      if (fnRes.data && fnRes.data.length > 0) {
        matchedFnIds = Array.from(
          new Set(fnRes.data.map((f) => f?.id).filter(Boolean))
        );
      }
    } catch (err) {
      console.error("Candidate search lookup error:", err);
    }

    // Check staffList for interviewer names matching search term
    const matchedStaffEmails = (staffList || [])
      .filter((s) => {
        const name = (s?.name || "").toLowerCase();
        const email = (s?.email || "").toLowerCase();
        const qLower = q.toLowerCase();
        return name.includes(qLower) || email.includes(qLower);
      })
      .map((s) => s?.email?.trim())
      .filter(Boolean);

    // Build top-level oc table conditions
    const orConditions = [
      `st_id.ilike.%${q}%`,
      `oc_position.ilike.%${q}%`,
      `apply_status.ilike.%${q}%`,
      `interviewer_email.ilike.%${q}%`
    ];

    if (matchedStIds.length > 0) {
      orConditions.push(`st_id.in.(${matchedStIds.map((id) => `"${id}"`).join(",")})`);
    }

    if (matchedFnIds.length > 0) {
      orConditions.push(`function_id.in.(${matchedFnIds.join(",")})`);
    }

    if (matchedStaffEmails.length > 0) {
      orConditions.push(`interviewer_email.in.(${matchedStaffEmails.map((e) => `"${e}"`).join(",")})`);
    }

    return orConditions.join(",");
  };

  const loadOc = async (eventId, pageToLoad = page, status = filterStatus, searchText = debouncedSearch) => {
    if (!eventId) {
      setOc([]);
      setTotal(0);
      setStatusCounts({ Accept: 0, Pending: 0, Invited: 0, Scheduled: 0, Reject: 0 });
      return;
    }

    const currentSeq = ++querySeqRef.current;
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

    const orFilter = await buildSearchOrFilter(searchText);
    if (currentSeq !== querySeqRef.current) return;

    if (orFilter) {
      query = query.or(orFilter);
    }

    const [records, accept, pending, invited, scheduled, reject] = await Promise.all([
      query,
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Accept"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Pending"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Invited"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Interview Scheduled"),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("apply_status", "Reject"),
    ]);

    if (currentSeq !== querySeqRef.current) return;

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

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadOc(selectedEvent, page, filterStatus, debouncedSearch);
  }, [selectedEvent, page, filterStatus, debouncedSearch]);

  const exportCSV = async () => {
    if (!selectedEvent) {
      setMsg({ type: "error", text: "Select an event before exporting CSV." });
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

    const orFilter = await buildSearchOrFilter(debouncedSearch || search);
    if (orFilter) {
      query = query.or(orFilter);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      setMsg({ type: "error", text: "Failed to export data: " + error.message });
      return;
    }

    if (!data || data.length === 0) {
      setMsg({ type: "error", text: "No matching records found to export." });
      return;
    }

    const headers = ["ST ID", "Name", "Email", "OC Position", "Function", "Interview Status", "Assigned Interviewer", "Interview Slot"];
    const rows = data.map((o) => {
      const interviewerName = (() => {
        if (!o.interviewer_email) return "Unassigned";
        const targetEmail = String(o.interviewer_email).toLowerCase().trim();
        const staffMatch = (staffList || []).find((s) => (s?.email || "").toLowerCase().trim() === targetEmail);
        return staffMatch ? `${staffMatch.name} (${o.interviewer_email})` : o.interviewer_email;
      })();

      const slot = formatInterviewDate(o.interview_date) || "Not Scheduled";

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
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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
    setForm({ ...EMPTY_FORM, interviewer_email: session?.email || "" });
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => {
    setModal(false);
    setMsg(null);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEvent) {
      setMsg({ type: "error", text: "Select an event first." });
      return;
    }
    if (!form.st_id || !form.function_id) {
      setMsg({ type: "error", text: "Member ST ID and Function are required." });
      return;
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
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setMsg({ type: "success", text: "OC assignment successfully saved." });

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

    loadOc(selectedEvent, page, filterStatus, debouncedSearch);
    setTimeout(closeModal, 600);
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
    const { error } = await supabase
      .from("oc")
      .update({ apply_status: status })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      setMsg({ type: "error", text: error.message });
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
      setMsg({ type: "success", text: `Updated status for ${studentName} to [${status}].` });
      loadOc(selectedEvent, page, filterStatus, debouncedSearch);
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

    const finalInterviewerEmail =
      selectedInterviewerEmail === "custom"
        ? customInterviewerEmail.trim()
        : selectedInterviewerEmail.trim();

    if (!finalInterviewerEmail) {
      setMsg({ type: "error", text: "Please select or enter an interviewer email address." });
      return;
    }

    setInviteSending(true);
    setEmailSendingId(`${o.st_id}-${o.function_id}`);

    const { error } = await supabase
      .from("oc")
      .update({
        apply_status: "Invited",
        interviewer_email: finalInterviewerEmail
      })
      .eq("event_id", selectedEvent)
      .eq("st_id", o.st_id)
      .eq("function_id", o.function_id);

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      const recipientEmail = o.members?.email;
      if (recipientEmail) {
        const studentName = o.members?.name || "Applicant";
        const eventName = selectedEventInfo?.name || "Society Event";
        const position = o.oc_position || o.functions?.function_name || "Committee Member";

        let calBookingLink = customCalUrl;
        try {
          const bookingUrlObj = new URL(customCalUrl.startsWith("http") ? customCalUrl : `https://${customCalUrl}`);
          bookingUrlObj.searchParams.set("email", recipientEmail);
          bookingUrlObj.searchParams.set("name", studentName);
          bookingUrlObj.searchParams.set("st_id", o.st_id);
          bookingUrlObj.searchParams.set("guests", finalInterviewerEmail);
          bookingUrlObj.searchParams.set("interviewer_email", finalInterviewerEmail);
          calBookingLink = bookingUrlObj.toString();
        } catch (urlErr) {
          console.warn("Could not parse booking URL:", urlErr);
        }

        await triggerSendEmail({
          to: recipientEmail,
          type: "INTERVIEW_INVITE",
          data: {
            studentName,
            eventName,
            ocPosition: position,
            calLink: calBookingLink
          }
        });
        setMsg({
          type: "success",
          text: `Interview invite email dispatched to ${studentName} (${recipientEmail}). Assigned interviewer: ${finalInterviewerEmail}.`
        });
      } else {
        setMsg({
          type: "success",
          text: `Status updated to 'Invited'. Note: Candidate email was not found in profile.`
        });
      }
      setInviteModal({ isOpen: false, row: null });
      loadOc(selectedEvent, page, filterStatus, debouncedSearch);
    }
    setInviteSending(false);
    setEmailSendingId(null);
  };

  const handleDelete = async (stId, functionId) => {
    if (!confirm("Are you sure you want to remove this OC record?")) return;
    const { error } = await supabase
      .from("oc")
      .delete()
      .eq("event_id", selectedEvent)
      .eq("st_id", stId)
      .eq("function_id", functionId);

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "OC record removed." });
      loadOc(selectedEvent, page, filterStatus, debouncedSearch);
    }
  };

  const addFunction = async (e) => {
    if (e) e.preventDefault();
    if (!fnName.trim()) return;
    setFnSaving(true);
    const { error } = await supabase.from("functions").insert([{ function_name: fnName.trim() }]);
    setFnSaving(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setFnName("");
      setFnModal(false);
      setMsg({ type: "success", text: "Sub-team function created." });
      load();
    }
  };

  const renderStatusBadge = (s) => {
    if (s === "Accept") {
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
          isDark
            ? "bg-[#27a644]/15 text-[#27a644] border-[#27a644]/30"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}>
          <CheckCircle2 className="w-3 h-3" />
          Accepted
        </span>
      );
    }
    if (s === "Reject") {
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
          isDark
            ? "bg-[#eb5757]/15 text-[#eb5757] border-[#eb5757]/30"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    if (s === "Invited") {
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
          isDark
            ? "bg-[#02b8cc]/15 text-[#02b8cc] border-[#02b8cc]/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
        }`}>
          <Mail className="w-3 h-3" />
          Invited
        </span>
      );
    }
    if (s === "Interview Scheduled") {
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
          isDark
            ? "bg-[#6366f1]/15 text-[#818cf8] border-[#6366f1]/30"
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
        }`}>
          <Clock className="w-3 h-3" />
          Scheduled
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
        isDark
          ? "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}>
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const selectedEventInfo = events.find((e) => e.event_id === selectedEvent);

  const fullInterviewerOptions = useMemo(() => {
    const opts = [];
    if (session?.email) {
      opts.push({
        name: session.name ? `Me (${session.name})` : "Me (Current User)",
        email: session.email,
        role: session.role || "staff",
        isSelf: true
      });
    }

    (staffList || []).forEach((st) => {
      const stEmail = (st?.email || "").toLowerCase().trim();
      if (stEmail && !opts.some((item) => (item?.email || "").toLowerCase().trim() === stEmail)) {
        opts.push(st);
      }
    });
    return opts;
  }, [session, staffList]);

  const filteredInterviewers = useMemo(() => {
    const q = (interviewerSearch || "").trim().toLowerCase();
    if (!q) return fullInterviewerOptions;
    return fullInterviewerOptions.filter((item) => {
      const name = (item?.name || "").toLowerCase();
      const email = (item?.email || "").toLowerCase();
      const role = (item?.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [fullInterviewerOptions, interviewerSearch]);

  const totalInterviewerPages = Math.ceil(filteredInterviewers.length / INTERVIEWER_PAGE_SIZE) || 1;
  const paginatedInterviewers = filteredInterviewers.slice(
    interviewerPage * INTERVIEWER_PAGE_SIZE,
    (interviewerPage + 1) * INTERVIEWER_PAGE_SIZE
  );

  return (
    <div className="space-y-3 pb-8">
      {/* ── Page Header (Compact 1-row precision toolbar) ── */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-2.5`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-6 h-6 rounded-[5px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-indigo-50 border-indigo-200 text-indigo-600"} border flex items-center justify-center flex-shrink-0`}>
            <Users className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className={`text-[16px] sm:text-[17px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight whitespace-nowrap`}>
              Committee (OC) Management
            </h1>
            <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider px-1.5 py-0.2 rounded-[3px] ${isDark ? "bg-[#161718] text-[#8a8f98] border-[#23252a]" : "bg-gray-100 text-gray-600 border-gray-200"} border whitespace-nowrap`}>
              {selectedEventInfo ? `${total} Records` : "Select Event"}
            </span>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {isAdmin && (
            <>
              <button
                onClick={exportCSV}
                disabled={loading || !selectedEvent}
                className={`inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-[400] ${isDark ? "text-[#8a8f98] hover:text-[#d0d6e0] bg-[#0f1011] hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200 shadow-xs"} border rounded-[5px] transition-colors disabled:opacity-50 cursor-pointer`}
                title="Export current committee roster to CSV"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setFnModal(true)}
                className={`inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-[400] ${isDark ? "text-[#8a8f98] hover:text-[#d0d6e0] bg-[#0f1011] hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200 shadow-xs"} border rounded-[5px] transition-colors cursor-pointer`}
                title="Manage society functions / sub-teams"
              >
                <Plus className="w-3 h-3" />
                <span>Function</span>
                <span className={`text-[9px] font-berkeley-mono px-1 rounded ${isDark ? "bg-[#161718] text-[#62666d] border-[#23252a]" : "bg-gray-100 text-gray-500 border-gray-200"} border`}>
                  {functions.length}
                </span>
              </button>

              <button
                onClick={openAdd}
                className={`inline-flex items-center gap-1 px-3 h-7 text-[11px] font-[510] ${isDark ? "text-[#08090a] bg-[#e4f222] hover:bg-[#d8e61e]" : "text-white bg-gray-900 hover:bg-black"} rounded-[5px] transition-all shadow-sm cursor-pointer`}
              >
                <Plus className="w-3 h-3" />
                <span>Add OC Member</span>
              </button>
            </>
          )}

          <button
            onClick={() => loadOc(selectedEvent, page, filterStatus, debouncedSearch)}
            disabled={loading}
            className={`w-7 h-7 flex items-center justify-center ${isDark ? "text-[#8a8f98] hover:text-[#d0d6e0] bg-[#0f1011] hover:bg-[#161718] border-[#23252a]" : "text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200 shadow-xs"} border rounded-[5px] transition-colors cursor-pointer`}
            title="Refresh records"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? `animate-spin ${isDark ? "text-[#e4f222]" : "text-indigo-600"}` : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Status Message Alert ── */}
      {msg && (
        <div
          className={`p-2.5 rounded-[6px] text-[12px] flex items-center justify-between border ${
            msg.type === "error"
              ? isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700"
              : isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "error" ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="p-0.5 hover:opacity-75 transition-opacity text-current cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Interactive Telemetry KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {/* Pending */}
        <div
          onClick={() => {
            const next = filterStatus === "Pending" ? "All" : "Pending";
            setPage(0);
            setFilterStatus(next);
          }}
          className={`px-3 py-2 rounded-[8px] border transition-all cursor-pointer ${
            filterStatus === "Pending"
              ? isDark ? "border-[#f59e0b]/60 bg-[#161718]" : "border-amber-400 bg-amber-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-0.5`}>
            <span className="text-[10px] font-[400] uppercase tracking-wider">Pending</span>
            <Clock className={`w-3 h-3 ${isDark ? "text-[#f59e0b]" : "text-amber-500"}`} />
          </div>
          <div className={`text-[18px] font-berkeley-mono font-[510] ${isDark ? "text-[#f59e0b]" : "text-amber-600"} tracking-tight`}>
            {statusCounts.Pending}
          </div>
        </div>

        {/* Invited */}
        <div
          onClick={() => {
            const next = filterStatus === "Invited" ? "All" : "Invited";
            setPage(0);
            setFilterStatus(next);
          }}
          className={`px-3 py-2 rounded-[8px] border transition-all cursor-pointer ${
            filterStatus === "Invited"
              ? isDark ? "border-[#02b8cc]/60 bg-[#161718]" : "border-cyan-400 bg-cyan-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-0.5`}>
            <span className="text-[10px] font-[400] uppercase tracking-wider">Invited</span>
            <Mail className={`w-3 h-3 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
          </div>
          <div className={`text-[18px] font-berkeley-mono font-[510] ${isDark ? "text-[#02b8cc]" : "text-cyan-600"} tracking-tight`}>
            {statusCounts.Invited}
          </div>
        </div>

        {/* Scheduled */}
        <div
          onClick={() => {
            const next = filterStatus === "Interview Scheduled" ? "All" : "Interview Scheduled";
            setPage(0);
            setFilterStatus(next);
          }}
          className={`px-3 py-2 rounded-[8px] border transition-all cursor-pointer ${
            filterStatus === "Interview Scheduled"
              ? isDark ? "border-[#818cf8]/60 bg-[#161718]" : "border-indigo-400 bg-indigo-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-0.5`}>
            <span className="text-[10px] font-[400] uppercase tracking-wider">Scheduled</span>
            <Video className={`w-3 h-3 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
          </div>
          <div className={`text-[18px] font-berkeley-mono font-[510] ${isDark ? "text-[#818cf8]" : "text-indigo-600"} tracking-tight`}>
            {statusCounts.Scheduled}
          </div>
        </div>

        {/* Accepted */}
        <div
          onClick={() => {
            const next = filterStatus === "Accept" ? "All" : "Accept";
            setPage(0);
            setFilterStatus(next);
          }}
          className={`px-3 py-2 rounded-[8px] border transition-all cursor-pointer ${
            filterStatus === "Accept"
              ? isDark ? "border-[#27a644]/60 bg-[#161718]" : "border-emerald-400 bg-emerald-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-0.5`}>
            <span className="text-[10px] font-[400] uppercase tracking-wider">Accepted OC</span>
            <CheckCircle2 className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
          </div>
          <div className={`text-[18px] font-berkeley-mono font-[510] ${isDark ? "text-[#27a644]" : "text-emerald-600"} tracking-tight`}>
            {statusCounts.Accept}
          </div>
        </div>

        {/* Rejected */}
        <div
          onClick={() => {
            const next = filterStatus === "Reject" ? "All" : "Reject";
            setPage(0);
            setFilterStatus(next);
          }}
          className={`px-3 py-2 rounded-[8px] border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            filterStatus === "Reject"
              ? isDark ? "border-[#eb5757]/60 bg-[#161718]" : "border-red-400 bg-red-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-0.5`}>
            <span className="text-[10px] font-[400] uppercase tracking-wider">Declined</span>
            <XCircle className={`w-3 h-3 ${isDark ? "text-[#eb5757]" : "text-red-600"}`} />
          </div>
          <div className={`text-[18px] font-berkeley-mono font-[510] ${isDark ? "text-[#eb5757]" : "text-red-600"} tracking-tight`}>
            {statusCounts.Reject}
          </div>
        </div>
      </div>

      {/* ── Unified Compact Event Selection, Search & Filter Toolbar ── */}
      <div className={`p-2.5 rounded-[10px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border space-y-2.5 relative z-30`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Left: Event Selection + Cal.com Toggle */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-[220px] max-w-sm">
              <EventSelect
                events={events}
                value={selectedEvent}
                onChange={(id) => {
                  setPage(0);
                  setSelectedEvent(id);
                }}
                theme={currentTheme}
                placeholder="Search or select an event..."
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowCalSettings(!showCalSettings)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-[400] rounded-[6px] border transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer ${
                  showCalSettings
                    ? isDark ? "bg-[#161718] border-[#818cf8] text-[#ffffff]" : "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98] hover:text-[#d0d6e0] hover:bg-[#161718]" : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 shadow-xs"
                }`}
                title="Cal.com Automated Booking Settings"
              >
                <Video className={`w-3.5 h-3.5 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
                <span className="hidden sm:inline">Cal.com Setup</span>
                {showCalSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Right: Candidate Search & Status Dropdown */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setPage(0);
                  const val = e.target.value;
                  setSearch(val);
                  if (!val.trim()) {
                    setDebouncedSearch("");
                  }
                }}
                placeholder="Search candidate by name, ST ID, position..."
                className={`w-full h-[38px] pl-8 pr-7 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff] focus:border-[#d0d6e0]" : "bg-gray-50 border-gray-300 text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"} border rounded-[6px] outline-none transition-colors`}
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setPage(0);
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-700"} cursor-pointer`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setPage(0);
                setFilterStatus(e.target.value);
              }}
              className={`h-[38px] px-2.5 rounded-[6px] border ${isDark ? "border-[#23252a] bg-[#161718] text-[#d0d6e0] focus:border-[#d0d6e0]" : "border-gray-300 bg-white text-gray-900 focus:border-indigo-500 shadow-xs"} text-[11px] font-berkeley-mono focus:outline-none cursor-pointer whitespace-nowrap flex-shrink-0`}
            >
              <option value="All">All Statuses ({total})</option>
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Collapsible Cal.com Config Drawer */}
        {isAdmin && showCalSettings && (
          <div className={`pt-2.5 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} space-y-2`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <label className={`text-[10px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-600"} flex items-center gap-1.5`}>
                <Video className={`w-3 h-3 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
                Cal.com Booking URL (Embedded & Invite Emails)
              </label>
              <button
                onClick={() => setCalSetupModalOpen(true)}
                className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#818cf8]" : "text-indigo-600"} hover:underline flex items-center gap-1 cursor-pointer`}
              >
                <HelpCircle className="w-3 h-3" />
                Setup Guide & Webhook
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customCalUrl}
                onChange={(e) => handleCalUrlChange(e.target.value)}
                placeholder="https://cal.com/adss-ruhuna/committee-interview"
                className={`flex-1 min-w-[240px] h-7 px-2.5 text-[11px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff] focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[5px] font-berkeley-mono outline-none transition-colors`}
              />
              <a
                href={customCalUrl.startsWith("http") ? customCalUrl : `https://${customCalUrl}`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-[5px] text-[11px] font-medium border ${isDark ? "border-[#23252a] bg-[#161718] hover:bg-[#23252a] text-[#d0d6e0]" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-xs"} transition-colors`}
              >
                <ExternalLink className="w-3 h-3" />
                <span>Test Link</span>
              </a>
              <button
                onClick={() => {
                  handleCalUrlChange(customCalUrl);
                  setCalSavedToast(true);
                  setTimeout(() => setCalSavedToast(false), 2000);
                }}
                className={`px-2.5 h-7 rounded-[5px] text-[11px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} flex items-center gap-1 transition-colors cursor-pointer`}
              >
                {calSavedToast ? <Check className={`w-3 h-3 ${isDark ? "text-[#08090a]" : "text-white"}`} /> : <Check className="w-3 h-3" />}
                <span>{calSavedToast ? "Saved!" : "Save Link"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Candidate Table Container ── */}
      <div className={`rounded-[10px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className={`${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50/80 border-gray-200 text-gray-600"} border-b font-berkeley-mono text-[11px] uppercase`}>
                {isAdmin && <th className="py-2.5 px-4 font-normal">ST ID</th>}
                <th className="py-2.5 px-4 font-normal">Candidate Name</th>
                <th className="py-2.5 px-4 font-normal">Position & Sub-Team</th>
                <th className="py-2.5 px-4 font-normal">Interview Status</th>
                <th className="py-2.5 px-4 font-normal">Assigned Interviewer</th>
                <th className="py-2.5 px-4 font-normal">Scheduled Slot</th>
                {isAdmin && <th className="py-2.5 px-4 font-normal text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-100"}`}>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className={`py-12 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    <RefreshCw className={`w-5 h-5 animate-spin mx-auto mb-2 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                    <span>Loading committee candidate records...</span>
                  </td>
                </tr>
              ) : oc.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className={`py-12 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
                    <span>No committee assignments match your active criteria.</span>
                  </td>
                </tr>
              ) : (
                oc.map((o) => {
                  const isProcessing = emailSendingId === `${o.st_id}-${o.function_id}`;
                  const own = isOwnRow(o);
                  const canSeeDetails = isAdmin || own;

                  const interviewerDisplayName = (() => {
                    if (!o.interviewer_email) return null;
                    const targetEmail = String(o.interviewer_email).toLowerCase().trim();
                    const staffMatch = (staffList || []).find(
                      (s) => (s?.email || "").toLowerCase().trim() === targetEmail
                    );
                    return staffMatch?.name || o.interviewer_email.split("@")[0];
                  })();

                  return (
                    <tr
                      key={`${o.st_id}-${o.function_id}`}
                      className={`${isDark ? "hover:bg-[#161718]/50" : "hover:bg-gray-50/80"} transition-colors ${
                        own ? (isDark ? "bg-[#e4f222]/5 border-l-2 border-l-[#e4f222]" : "bg-indigo-50/50 border-l-2 border-l-indigo-600") : ""
                      }`}
                    >
                      {/* ST ID */}
                      {isAdmin && (
                        <td className={`py-3 px-4 align-middle font-berkeley-mono text-[11px] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"} whitespace-nowrap`}>
                          <div className="flex items-center gap-1.5">
                            <span>{o.st_id}</span>
                            <button
                              onClick={() => copyToClipboard(o.st_id, `stid-${o.st_id}`)}
                              className={`p-1 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-700"} rounded-[3px] transition-colors cursor-pointer`}
                              title="Copy Student ID"
                            >
                              {copiedId === `stid-${o.st_id}` ? (
                                <Check className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Candidate Name */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff]" : "bg-gray-100 border-gray-200 text-gray-800"} border flex items-center justify-center font-berkeley-mono text-[11px] font-[510]`}>
                            {getAvatarInitials(o.members?.name, o.st_id)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <StudentNameLink
                                stId={o.st_id}
                                name={o.members?.name || "Unnamed Candidate"}
                              />
                              {own && (
                                <span className={`text-[9px] font-berkeley-mono px-1.5 py-0.2 rounded-[3px] ${isDark ? "bg-[#e4f222]/15 text-[#e4f222] border-[#e4f222]/30" : "bg-indigo-50 text-indigo-700 border-indigo-200"} border`}>
                                  YOU
                                </span>
                              )}
                            </div>
                            {o.members?.email && (
                              <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                                {o.members.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Position & Function */}
                      <td className="py-3 px-4 align-middle">
                        <div>
                          <div className={`font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                            {o.oc_position || "Committee Member"}
                          </div>
                          <div className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                            {o.functions?.function_name || "General"}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-middle">
                        {renderStatusBadge(o.apply_status)}
                      </td>

                      {/* Interviewer */}
                      <td className="py-3 px-4 align-middle font-berkeley-mono text-[11px]">
                        {interviewerDisplayName ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "bg-gray-100 border-gray-200 text-gray-800"} border`}>
                            <User className={`w-3 h-3 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
                            <span>{interviewerDisplayName}</span>
                          </span>
                        ) : (
                          <span className={`${isDark ? "text-[#62666d]" : "text-gray-400"} italic`}>Unassigned</span>
                        )}
                      </td>

                      {/* Interview Slot */}
                      <td className="py-3 px-4 align-middle font-berkeley-mono text-[11px]">
                        {o.interview_date ? (
                          <div className="space-y-0.5">
                            <span className={`${isDark ? "text-[#27a644]" : "text-emerald-700"} flex items-center gap-1 font-medium`}>
                              <Clock className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
                              {formatInterviewDate(o.interview_date)}
                            </span>
                            {canSeeDetails && o.interview_link && (
                              <a
                                href={o.interview_link}
                                target="_blank"
                                rel="noreferrer"
                                className={`${isDark ? "text-[#02b8cc]" : "text-cyan-700"} hover:underline inline-flex items-center gap-1 font-medium`}
                              >
                                <Video className="w-3 h-3" />
                                <span>Join Meeting</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className={`${isDark ? "text-[#62666d]" : "text-gray-400"} italic`}>Not scheduled</span>
                        )}
                      </td>

                      {/* Actions (Admin Only) */}
                      {isAdmin && (
                        <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Invite Button */}
                            <button
                              onClick={() => openInviteModal(o)}
                              disabled={isProcessing}
                              className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#02b8cc] hover:bg-[#02b8cc]/15 border-[#02b8cc]/30" : "text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border-cyan-200"} border rounded-[4px] transition-colors cursor-pointer`}
                              title="Assign Interviewer & Send Invite"
                            >
                              Invite
                            </button>

                            {/* Cal Modal Button */}
                            <button
                              onClick={() => setCalModal({ isOpen: true, row: o })}
                              className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#818cf8] hover:bg-[#818cf8]/15 border-[#818cf8]/30" : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"} border rounded-[4px] transition-colors cursor-pointer`}
                              title="Open Cal.com Embed"
                            >
                              Cal
                            </button>

                            {/* Accept Button */}
                            {o.apply_status !== "Accept" && (
                              <button
                                onClick={() => openAcceptModal(o)}
                                disabled={isProcessing}
                                className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#27a644] hover:bg-[#27a644]/15 border-[#27a644]/30" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"} border rounded-[4px] transition-colors cursor-pointer`}
                                title="Accept candidate & finalize position"
                              >
                                Accept
                              </button>
                            )}

                            {/* Reject Button */}
                            {o.apply_status !== "Reject" && (
                              <button
                                onClick={() => updateStatus(o, "Reject")}
                                disabled={isProcessing}
                                className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#eb5757] hover:bg-[#eb5757]/15 border-[#eb5757]/30" : "text-red-700 bg-red-50 hover:bg-red-100 border-red-200"} border rounded-[4px] transition-colors cursor-pointer`}
                                title="Decline application"
                              >
                                Reject
                              </button>
                            )}

                            {/* Trash */}
                            <button
                              onClick={() => handleDelete(o.st_id, o.function_id)}
                              className={`p-1.5 ${isDark ? "text-[#62666d] hover:text-[#eb5757] hover:bg-[#eb5757]/15" : "text-gray-400 hover:text-red-600 hover:bg-red-50"} rounded-[4px] transition-colors cursor-pointer`}
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className={`p-2.5 sm:p-3 border-t ${isDark ? "border-[#23252a] bg-[#161718]/40" : "border-gray-200 bg-gray-50"}`}>
            <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── MODAL: Student Profile Preview ── */}
      {profileTarget && (
        <StudentProfileModal stId={profileTarget} onClose={() => setProfileTarget(null)} />
      )}

      {/* ── MODAL: Cal.com Embed ── */}
      {calModal.isOpen && calModal.row && (
        <CalEmbedModal
          isOpen={calModal.isOpen}
          onClose={() => setCalModal({ isOpen: false, row: null })}
          calLink={customCalUrl}
          studentName={calModal.row?.members?.name}
          studentEmail={calModal.row?.members?.email}
          stId={calModal.row?.st_id}
          interviewerEmail={calModal.row?.interviewer_email}
          eventName={selectedEventInfo?.name}
          position={calModal.row?.oc_position || calModal.row?.functions?.function_name}
        />
      )}

      {/* ── MODAL: Interviewer Invite Selection ── */}
      {inviteModal.isOpen && inviteModal.row && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-[#08090a]/80" : "bg-black/40"} backdrop-blur-sm`}
          onClick={() => setInviteModal({ isOpen: false, row: null })}
        >
          <div
            className={`w-full max-w-lg ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
              <div className="flex items-center gap-2.5">
                <Mail className={`w-4 h-4 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
                <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>
                  Invite Candidate to Interview
                </h3>
              </div>
              <button
                onClick={() => setInviteModal({ isOpen: false, row: null })}
                className={`${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"} p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Header Summary */}
            <div className={`p-3 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border rounded-[8px] space-y-1 text-[12px]`}>
              <div className={`font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>{inviteModal.row.members?.name}</div>
              <div className={`font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                ID: {inviteModal.row.st_id} • Applied Function: {inviteModal.row.oc_position || inviteModal.row.functions?.function_name}
              </div>
            </div>

            {/* Search & Radio List of Interviewers */}
            <div className="space-y-2">
              <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                Assign Interviewer
              </label>

              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
                <input
                  type="text"
                  placeholder="Filter interviewer by name or email..."
                  value={interviewerSearch}
                  onChange={(e) => {
                    setInterviewerSearch(e.target.value);
                    setInterviewerPage(0);
                  }}
                  className={`w-full h-8 pl-8 pr-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none transition-colors`}
                />
              </div>

              <div className={`space-y-1 max-h-48 overflow-y-auto p-1.5 rounded-[8px] border ${isDark ? "border-[#23252a] bg-[#161718]" : "border-gray-200 bg-gray-50"}`}>
                {paginatedInterviewers.map((item) => (
                  <label
                    key={item.email}
                    className={`flex items-center justify-between p-2 rounded-[6px] border text-[12px] cursor-pointer transition-colors ${
                      selectedInterviewerEmail === item.email
                        ? isDark ? "bg-[#6366f1]/15 border-[#6366f1]/40 text-white" : "bg-indigo-50 border-indigo-300 text-indigo-900"
                        : isDark ? "border-transparent hover:bg-[#23252a]/40 text-[#d0d6e0]" : "border-transparent hover:bg-gray-200/50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="interviewerChoice"
                        value={item.email}
                        checked={selectedInterviewerEmail === item.email}
                        onChange={() => setSelectedInterviewerEmail(item.email)}
                        className={`w-3.5 h-3.5 ${isDark ? "accent-[#e4f222]" : "accent-indigo-600"}`}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-500"} font-berkeley-mono`}>{item.email}</span>
                  </label>
                ))}

                <label
                  className={`flex items-center gap-2 p-2 rounded-[6px] border text-[12px] cursor-pointer transition-colors ${
                    selectedInterviewerEmail === "custom"
                      ? isDark ? "bg-[#6366f1]/15 border-[#6366f1]/40 text-white" : "bg-indigo-50 border-indigo-300 text-indigo-900"
                      : isDark ? "border-transparent hover:bg-[#23252a]/40 text-[#d0d6e0]" : "border-transparent hover:bg-gray-200/50 text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="interviewerChoice"
                    value="custom"
                    checked={selectedInterviewerEmail === "custom"}
                    onChange={() => setSelectedInterviewerEmail("custom")}
                    className={`w-3.5 h-3.5 ${isDark ? "accent-[#e4f222]" : "accent-indigo-600"}`}
                  />
                  <span className="font-semibold">Specify Custom Interviewer Email</span>
                </label>
              </div>

              {/* Pagination within Modal */}
              {totalInterviewerPages > 1 && (
                <div className={`flex items-center justify-between text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} pt-1`}>
                  <button
                    type="button"
                    onClick={() => setInterviewerPage((p) => Math.max(0, p - 1))}
                    disabled={interviewerPage === 0}
                    className={`px-2 py-0.5 rounded border ${isDark ? "border-[#23252a] text-[#8a8f98] hover:text-white" : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-xs"} disabled:opacity-40 cursor-pointer`}
                  >
                    Prev
                  </button>
                  <span>Page {interviewerPage + 1} of {totalInterviewerPages}</span>
                  <button
                    type="button"
                    onClick={() => setInterviewerPage((p) => Math.min(totalInterviewerPages - 1, p + 1))}
                    disabled={interviewerPage >= totalInterviewerPages - 1}
                    className={`px-2 py-0.5 rounded border ${isDark ? "border-[#23252a] text-[#8a8f98] hover:text-white" : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-xs"} disabled:opacity-40 cursor-pointer`}
                  >
                    Next
                  </button>
                </div>
              )}

              {selectedInterviewerEmail === "custom" && (
                <div className="pt-2">
                  <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-600"} block mb-1`}>
                    Custom Interviewer Email
                  </label>
                  <input
                    type="email"
                    placeholder="interviewer@domain.com"
                    value={customInterviewerEmail}
                    onChange={(e) => setCustomInterviewerEmail(e.target.value)}
                    className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] font-berkeley-mono outline-none`}
                  />
                </div>
              )}
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() => setInviteModal({ isOpen: false, row: null })}
                disabled={inviteSending}
                className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:bg-gray-50 border-gray-300 shadow-xs"} border rounded-[6px] transition-colors cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendInviteWithInterviewer}
                disabled={inviteSending}
                className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} rounded-[6px] flex items-center gap-1.5 transition-colors cursor-pointer`}
              >
                {inviteSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Invite...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Invite Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Accept & Assign Position ── */}
      {acceptModal.isOpen && acceptModal.row && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-[#08090a]/80" : "bg-black/40"} backdrop-blur-sm`}
          onClick={() =>
            setAcceptModal({
              isOpen: false,
              row: null,
              positions: [],
              selectedPosition: "",
              customPosition: ""
            })
          }
        >
          <div
            className={`w-full max-w-md ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
                <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>
                  Accept & Assign Committee Position
                </h3>
              </div>
              <button
                onClick={() =>
                  setAcceptModal({
                    isOpen: false,
                    row: null,
                    positions: [],
                    selectedPosition: "",
                    customPosition: ""
                  })
                }
                className={`${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"} p-1 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
              Confirm acceptance for <strong className={isDark ? "text-white" : "text-gray-900"}>{acceptModal.row.members?.name}</strong> and designate their official organizing committee role.
            </p>

            {acceptModal.positions.length > 0 && (
              <div className="space-y-1.5">
                <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                  Applied Position Options
                </label>
                <div className="space-y-1">
                  {acceptModal.positions.map((pos, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-[6px] border ${isDark ? "border-[#23252a] bg-[#161718] text-[#d0d6e0]" : "border-gray-200 bg-gray-50 text-gray-800"} text-[12px] cursor-pointer`}
                    >
                      <input
                        type="radio"
                        name="posChoice"
                        value={pos}
                        checked={acceptModal.selectedPosition === pos && !acceptModal.customPosition}
                        onChange={() =>
                          setAcceptModal((prev) => ({
                            ...prev,
                            selectedPosition: pos,
                            customPosition: ""
                          }))
                        }
                        className={`w-3.5 h-3.5 ${isDark ? "accent-[#e4f222]" : "accent-emerald-600"}`}
                      />
                      <span>{pos}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                Custom Override Position Title
              </label>
              <input
                type="text"
                placeholder="e.g. Lead Coordinator / Team Head"
                value={acceptModal.customPosition}
                onChange={(e) =>
                  setAcceptModal((prev) => ({
                    ...prev,
                    customPosition: e.target.value
                  }))
                }
                className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none`}
              />
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() =>
                  setAcceptModal({
                    isOpen: false,
                    row: null,
                    positions: [],
                    selectedPosition: "",
                    customPosition: ""
                  })
                }
                className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:bg-gray-50 border-gray-300 shadow-xs"} border rounded-[6px] transition-colors cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAccept}
                className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} rounded-[6px] flex items-center gap-1.5 transition-colors cursor-pointer`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add OC Member ── */}
      {modal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-[#08090a]/80" : "bg-black/40"} backdrop-blur-sm`}
          onClick={closeModal}
        >
          <div
            className={`w-full max-w-lg ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
              <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>
                Add OC Assignment
              </h3>
              <button onClick={closeModal} className={`${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"} p-1 cursor-pointer`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                    Member Student ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SC/2022/12345"
                    value={form.st_id}
                    onChange={(e) => setForm({ ...form, st_id: e.target.value })}
                    className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] font-berkeley-mono outline-none`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                    Sub-team Function *
                  </label>
                  <select
                    required
                    value={form.function_id}
                    onChange={(e) => setForm({ ...form, function_id: e.target.value })}
                    className={`w-full h-8 px-2.5 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none cursor-pointer`}
                  >
                    <option value="">Select Function</option>
                    {functions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.function_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                    Initial Status
                  </label>
                  <select
                    value={form.apply_status}
                    onChange={(e) => setForm({ ...form, apply_status: e.target.value })}
                    className={`w-full h-8 px-2.5 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none cursor-pointer`}
                  >
                    {STATUS_OPTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                    Position Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Coordinator"
                    value={form.oc_position}
                    onChange={(e) => setForm({ ...form, oc_position: e.target.value })}
                    className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                  Assigned Interviewer Email
                </label>
                <input
                  type="email"
                  placeholder="interviewer@email.com"
                  value={form.interviewer_email}
                  onChange={(e) => setForm({ ...form, interviewer_email: e.target.value })}
                  className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] font-berkeley-mono outline-none`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:bg-gray-50 border-gray-300 shadow-xs"} border rounded-[6px] transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} rounded-[6px] flex items-center gap-1.5 transition-colors cursor-pointer`}
                >
                  {saving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Add Sub-team Function ── */}
      {fnModal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-[#08090a]/80" : "bg-black/40"} backdrop-blur-sm`}
          onClick={() => setFnModal(false)}
        >
          <div
            className={`w-full max-w-md ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
              <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>
                Add Sub-Team Function
              </h3>
              <button onClick={() => setFnModal(false)} className={`${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"} p-1 cursor-pointer`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={addFunction} className="space-y-3.5">
              <div className="space-y-1">
                <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
                  Function Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Media & Photography"
                  value={fnName}
                  onChange={(e) => setFnName(e.target.value)}
                  className={`w-full h-8 px-3 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"} border rounded-[6px] outline-none`}
                  autoFocus
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
                <button
                  type="button"
                  onClick={() => setFnModal(false)}
                  disabled={fnSaving}
                  className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:bg-gray-50 border-gray-300 shadow-xs"} border rounded-[6px] transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fnSaving || !fnName.trim()}
                  className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} rounded-[6px] transition-colors cursor-pointer`}
                >
                  {fnSaving ? "Creating..." : "Create Function"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Cal.com Setup Help ── */}
      {calSetupModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-[#08090a]/80" : "bg-black/40"} backdrop-blur-sm`}
          onClick={() => setCalSetupModalOpen(false)}
        >
          <div
            className={`w-full max-w-lg ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
              <div className="flex items-center gap-2">
                <Settings className={`w-4 h-4 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
                <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"} tracking-tight`}>
                  Cal.com Automated Interview Integration
                </h3>
              </div>
              <button onClick={() => setCalSetupModalOpen(false)} className={`${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"} p-1 cursor-pointer`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`space-y-3 text-[12px] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"} leading-relaxed`}>
              <div className={`p-3 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border space-y-1`}>
                <strong className={`${isDark ? "text-white" : "text-gray-900"} block`}>Step 1: Event Type Link</strong>
                <p className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
                  Paste your public Cal.com event link into the Cal.com URL input box (e.g. <code className={`${isDark ? "text-[#e4f222]" : "text-indigo-600 font-semibold"} font-berkeley-mono`}>https://cal.com/adss-ruhuna/committee-interview</code>).
                </p>
              </div>

              <div className={`p-3 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border space-y-1`}>
                <strong className={`${isDark ? "text-white" : "text-gray-900"} block`}>Step 2: Add Webhook Endpoint in Cal.com</strong>
                <p className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
                  In your Cal.com dashboard, navigate to <strong>Settings → Webhooks</strong> and add a webhook targeting:
                </p>
                <div className={`p-2 rounded-[4px] ${isDark ? "bg-[#08090a] text-[#27a644] border-[#23252a]" : "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium"} font-berkeley-mono text-[11px] break-all select-all border`}>
                  https://zbhwelmxdgldbwbnsfhd.supabase.co/functions/v1/cal-webhook
                </div>
              </div>

              <div className={`p-3 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border space-y-1`}>
                <strong className={`${isDark ? "text-white" : "text-gray-900"} block`}>Step 3: Webhook Triggers</strong>
                <p className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
                  Enable <strong className={isDark ? "text-white" : "text-gray-900"}>BOOKING_CREATED</strong> and <strong className={isDark ? "text-white" : "text-gray-900"}>BOOKING_RESCHEDULED</strong> triggers so applicant statuses update to <em>Interview Scheduled</em> automatically!
                </p>
              </div>
            </div>

            <div className={`flex items-center justify-end pt-2 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() => setCalSetupModalOpen(false)}
                className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white shadow-xs"} rounded-[6px] cursor-pointer`}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
