import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { invalidateCache, CACHE_KEYS } from "../lib/queryCache";
import StudentProfileModal from "../components/StudentProfileModal";
import { StudentNameLink } from "../components/StudentProfileContext";
import {
  FileText,
  Clock,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  XCircle,
  Search,
  Copy,
  Download,
  SlidersHorizontal,
  Trash2,
  ExternalLink,
  Eye,
  Award,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Status Configurations (Linear midnight precision tokens)
───────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  "not start": {
    label: "Pending",
    icon: Clock,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.25)",
  },
  inprogress: {
    label: "In Progress",
    icon: RefreshCw,
    color: "#818cf8",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.25)",
  },
  done: {
    label: "Issued",
    icon: CheckCircle2,
    color: "#27a644",
    bg: "rgba(39, 166, 68, 0.08)",
    border: "rgba(39, 166, 68, 0.25)",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "#eb5757",
    bg: "rgba(235, 87, 87, 0.08)",
    border: "rgba(235, 87, 87, 0.25)",
  },
};

function StatusBadge({ status, isDark = true }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["not start"];
  const Icon = cfg.icon;

  const lightStyles = {
    "not start": "bg-amber-50 text-amber-700 border-amber-200",
    inprogress: "bg-indigo-50 text-indigo-700 border-indigo-200",
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  if (!isDark) {
    const cls = lightStyles[status] || lightStyles["not start"];
    return (
      <span className={`inline-flex items-center gap-1 font-berkeley-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${cls}`}>
        <Icon className="w-3 h-3" />
        <span>{cfg.label}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 font-berkeley-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] border"
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <Icon className="w-3 h-3" />
      <span>{cfg.label}</span>
    </span>
  );
}

export default function Letters({ session, theme }) {
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
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({
    letter_show_name: true,
    letter_show_events: true,
    letter_show_details: true,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [copiedStId, setCopiedStId] = useState(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, settingsRes] = await Promise.all([
        supabase
          .from("letter_requests")
          .select("id, st_id, name_on_letter, selected_events, additional_details, status, created_at, members(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["letter_show_name", "letter_show_events", "letter_show_details"]),
      ]);

      if (reqRes.error) throw reqRes.error;
      setRequests(reqRes.data || []);

      if (settingsRes.data) {
        const config = {};
        settingsRes.data.forEach((item) => {
          config[item.key] = item.value === "true";
        });
        setSettings((prev) => ({ ...prev, ...config }));
      }
    } catch (err) {
      console.error("Error loading letters data:", err);
      setMsg({ type: "error", text: "Failed to load letter requests: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSetting = async (key) => {
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: newValue ? "true" : "false" })
        .eq("key", key);
      if (error) throw error;
      setMsg({ type: "success", text: "Form visibility updated." });
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      console.error("Error toggling setting:", err);
      setMsg({ type: "error", text: "Failed to update configuration: " + err.message });
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("letter_requests")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      invalidateCache(CACHE_KEYS.DASHBOARD_STATS);
    } catch (err) {
      console.error("Error updating status:", err);
      setMsg({ type: "error", text: "Failed to update status: " + err.message });
    }
  };

  const handleDeleteRequest = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this letter request?")) {
      try {
        const { error } = await supabase.from("letter_requests").delete().eq("id", id);
        if (error) throw error;
        setRequests((prev) => prev.filter((r) => r.id !== id));
        invalidateCache(CACHE_KEYS.DASHBOARD_STATS);
        setMsg({ type: "success", text: "Request deleted successfully." });
        setTimeout(() => setMsg(null), 2000);
      } catch (err) {
        console.error("Error deleting request:", err);
        setMsg({ type: "error", text: "Failed to delete request: " + err.message });
      }
    }
  };

  const handleCopyStId = (stId, e) => {
    e.stopPropagation();
    if (!stId) return;
    navigator.clipboard.writeText(stId);
    setCopiedStId(stId);
    setTimeout(() => setCopiedStId(null), 1800);
  };

  const handleCopyCitationSnippet = (r, e) => {
    e.stopPropagation();
    const recipientName = r.name_on_letter || r.members?.name || "the recipient";
    const eventList =
      Array.isArray(r.selected_events) && r.selected_events.length > 0
        ? r.selected_events.join(", ")
        : "society initiatives";
    const snippet = `This is to certify that ${recipientName} (${r.st_id}) has actively participated in and contributed to ${eventList} as a dedicated member of the Association of Data Science Students.`;

    navigator.clipboard.writeText(snippet);
    setCopiedSnippetId(r.id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const handleExportCsv = () => {
    if (requests.length === 0) {
      alert("No requests to export.");
      return;
    }

    const headers = [
      "ID",
      "Student_ID",
      "Member_Name",
      "Name_on_Letter",
      "Events",
      "Additional_Details",
      "Status",
      "Requested_At",
    ];

    const rows = filteredRequests.map((r) => [
      r.id,
      `"${r.st_id}"`,
      `"${r.members?.name || ""}"`,
      `"${r.name_on_letter || ""}"`,
      `"${Array.isArray(r.selected_events) ? r.selected_events.join("; ") : ""}"`,
      `"${(r.additional_details || "").replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${new Date(r.created_at).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `letter_requests_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status counts
  const countNotStarted = useMemo(() => requests.filter((r) => r.status === "not start").length, [requests]);
  const countInProgress = useMemo(() => requests.filter((r) => r.status === "inprogress").length, [requests]);
  const countDone = useMemo(() => requests.filter((r) => r.status === "done").length, [requests]);
  const countRejected = useMemo(() => requests.filter((r) => r.status === "rejected").length, [requests]);

  // Filter requests by status tab and search query
  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q) {
        const matchesName = (r.members?.name || "").toLowerCase().includes(q);
        const matchesStId = (r.st_id || "").toLowerCase().includes(q);
        const matchesLetterName = (r.name_on_letter || "").toLowerCase().includes(q);
        const matchesDetails = (r.additional_details || "").toLowerCase().includes(q);
        const matchesEvent = Array.isArray(r.selected_events) && r.selected_events.some((ev) => ev.toLowerCase().includes(q));
        return matchesName || matchesStId || matchesLetterName || matchesDetails || matchesEvent;
      }
      return true;
    });
  }, [requests, filterStatus, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-gray-50/50 text-gray-800"} font-inter-variable pb-20 selection:bg-[#e4f222]/20 selection:text-white`}>
      {/* ── HIGH-DENSITY LINEAR STICKY CONTROL BAR ── */}
      <div className={`border-b ${isDark ? "border-[#23252a] bg-[#0c0c0e]/95" : "border-gray-200 bg-white/95 shadow-xs"} backdrop-blur-md sticky top-0 z-20`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          {/* Row 1: Title, Telemetry Chips & Action Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-indigo-50 border-indigo-200 text-indigo-600"} border flex items-center justify-center flex-shrink-0`}>
                <Award className="w-4 h-4" />
              </div>
              <h1 className={`text-[15px] sm:text-[16px] font-[590] tracking-[-0.018em] ${isDark ? "text-[#ffffff]" : "text-gray-900"} truncate`}>
                Appreciation Letters & Credentials
              </h1>
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"} border font-berkeley-mono text-[10px]`}>
                <span>{requests.length} requests</span>
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className={isDark ? "text-[#f59e0b] font-[510]" : "text-amber-600 font-[510]"}>{countNotStarted} pending</span>
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className={isDark ? "text-[#818cf8]" : "text-indigo-600"}>{countInProgress} in progress</span>
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className={isDark ? "text-[#27a644]" : "text-emerald-600"}>{countDone} issued</span>
              </div>
            </div>

            {/* Quick Action Tools */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setShowSettingsDrawer((v) => !v)}
                className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                  showSettingsDrawer
                    ? isDark
                      ? "bg-[#23252a] text-white border-[#383b3f]"
                      : "bg-indigo-50 text-indigo-700 border-indigo-300"
                    : isDark
                    ? "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:text-white hover:border-[#383b3f]"
                    : "bg-white text-gray-700 border-gray-200 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                }`}
                title="Configure member request form fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Form Config</span>
              </button>

              <button
                onClick={handleExportCsv}
                className={`h-7 px-2.5 rounded-[6px] border font-berkeley-mono text-[11px] font-[510] transition-colors flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                    : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                }`}
                title="Export requests to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={loadData}
                className={`w-7 h-7 rounded-[6px] border flex items-center justify-center transition-colors ${
                  isDark
                    ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                    : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                }`}
                title="Refresh requests ledger"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Status Tabs & Real-time Search */}
          <div className={`flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t ${isDark ? "border-[#1a1b1e]" : "border-gray-200"}`}>
            {/* Status Segment Pills */}
            <div className={`flex items-center p-0.5 rounded-[6px] border overflow-x-auto scrollbar-none max-w-full ${
              isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"
            }`}>
              {[
                { id: "all", label: `All (${requests.length})` },
                { id: "not start", label: `Pending (${countNotStarted})`, color: "#f59e0b" },
                { id: "inprogress", label: `In Progress (${countInProgress})`, color: "#818cf8" },
                { id: "done", label: `Issued (${countDone})`, color: "#27a644" },
                { id: "rejected", label: `Rejected (${countRejected})`, color: "#eb5757" },
              ].map((tab) => {
                const active = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setPage(0);
                      setFilterStatus(tab.id);
                    }}
                    className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[11px] font-[510] whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      active
                        ? isDark
                          ? "bg-[#23252a] text-white"
                          : "bg-white text-gray-900 shadow-xs"
                        : isDark
                        ? "text-[#8a8f98] hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab.color && active && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tab.color }} />
                    )}
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
                onChange={(e) => {
                  setPage(0);
                  setSearch(e.target.value);
                }}
                placeholder="Search member, ST ID, event..."
                className={`w-full rounded-[6px] pl-8 pr-7 py-1 text-[12px] font-sans border transition-colors focus:outline-none ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#d0d6e0]"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-xs"
                }`}
              />
              {search && (
                <button
                  onClick={() => {
                    setPage(0);
                    setSearch("");
                  }}
                  className={`absolute right-2 top-1.5 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {msg && (
          <div
            className={`p-3 rounded-[6px] text-[12px] font-berkeley-mono border flex items-center justify-between ${
              msg.type === "error"
                ? isDark
                  ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                  : "bg-red-50 text-red-700 border-red-200"
                : isDark
                ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className={isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-700"}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Collapsible Form Settings Drawer ── */}
        {showSettingsDrawer && (
          <div className={`border rounded-[12px] p-4 sm:p-5 shadow-lg space-y-3 animation-fadeIn ${
            isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-md"
          }`}>
            <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <h3 className={`text-[13.5px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                  Member Form Configuration
                </h3>
              </div>
              <span className={`font-berkeley-mono text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                Controls fields visible in My Credentials page
              </span>
            </div>

            <p className={`text-[12px] leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
              Toggle which optional fields appear on the student-facing appreciation letter request modal. Changes apply dynamically across the application.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                {
                  key: "letter_show_name",
                  title: 'Show "Name on Letter"',
                  desc: "Allows member to specify custom certificate name",
                  checked: settings.letter_show_name,
                },
                {
                  key: "letter_show_events",
                  title: 'Show "Attended Events"',
                  desc: "Allows selecting specific completed society events",
                  checked: settings.letter_show_events,
                },
                {
                  key: "letter_show_details",
                  title: 'Show "Request Details"',
                  desc: "Provides multiline text box for special notes",
                  checked: settings.letter_show_details,
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-start gap-2.5 p-3 rounded-[6px] border cursor-pointer transition-all select-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f]"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleSetting(item.key)}
                    className="w-4 h-4 mt-0.5 rounded accent-indigo-600 flex-shrink-0"
                  />
                  <div>
                    <span className={`text-[12px] font-[510] block ${isDark ? "text-white" : "text-gray-900"}`}>
                      {item.title}
                    </span>
                    <span className={`text-[10.5px] block leading-tight mt-0.5 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      {item.desc}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Interactive Status Telemetry Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: "not start",
              label: "Pending Review",
              count: countNotStarted,
              sub: "Awaiting staff action",
              color: "#f59e0b",
              lightBorder: "border-amber-300",
              lightBg: "bg-amber-50/60",
            },
            {
              id: "inprogress",
              label: "In Progress",
              count: countInProgress,
              sub: "Drafting certificate",
              color: "#818cf8",
              lightBorder: "border-indigo-300",
              lightBg: "bg-indigo-50/60",
            },
            {
              id: "done",
              label: "Issued & Delivered",
              count: countDone,
              sub: "Letters granted",
              color: "#27a644",
              lightBorder: "border-emerald-300",
              lightBg: "bg-emerald-50/60",
            },
            {
              id: "rejected",
              label: "Declined",
              count: countRejected,
              sub: "Ineligible requests",
              color: "#eb5757",
              lightBorder: "border-red-300",
              lightBg: "bg-red-50/60",
            },
          ].map((card) => {
            const isSelected = filterStatus === card.id;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setPage(0);
                  setFilterStatus(isSelected ? "all" : card.id);
                }}
                className={`p-3.5 rounded-[8px] border cursor-pointer transition-all ${
                  isSelected
                    ? isDark
                      ? "border-[#383b3f] bg-[#161718] ring-1 ring-[#e4f222]/20"
                      : `${card.lightBorder} ${card.lightBg} shadow-xs ring-1 ring-indigo-500/20`
                    : isDark
                    ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] hover:bg-[#161718]/40"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-berkeley-mono text-[10.5px] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    {card.label}
                  </span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                </div>
                <div className={`font-berkeley-mono text-[22px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                  {card.count}
                </div>
                <div className={`font-berkeley-mono text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                  {card.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Requests Ledger Table Container ── */}
        <div className={`border rounded-[12px] overflow-hidden ${
          isDark ? "bg-[#0f1011] border-[#23252a] shadow-xl" : "bg-white border-gray-200 shadow-xs"
        }`}>
          {/* Table Header Row */}
          <div className={`px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 ${
            isDark ? "border-[#23252a]" : "border-gray-200 bg-white"
          }`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
              <span className={`text-[13.5px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                Letter Requests Ledger
              </span>
              <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                ({filteredRequests.length} matched)
              </span>
            </div>

            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className={`font-berkeley-mono text-[10.5px] underline transition-colors ${
                  isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Clear status filter
              </button>
            )}
          </div>

          {loading ? (
            <div className={`flex flex-col items-center justify-center py-24 gap-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
              <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
                isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"
              }`} />
              <span className="text-[12px] font-berkeley-mono">Loading requests registry...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className={`p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-2 ${
              isDark ? "text-[#62666d]" : "text-gray-500"
            }`}>
              <div className={`w-10 h-10 rounded-[6px] border flex items-center justify-center ${
                isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-500"
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <h3 className={`text-[14px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>No requests found</h3>
              <p className={`text-[12px] leading-relaxed font-sans ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                {search
                  ? `No requests match "${search}". Try clearing search keywords.`
                  : "No appreciation letter requests in this category."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b font-berkeley-mono text-[10px] uppercase tracking-wider ${
                    isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]" : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>
                    <th className="py-2.5 px-4 font-[510]">Member & ST ID</th>
                    <th className="py-2.5 px-4 font-[510]">Name on Letter</th>
                    <th className="py-2.5 px-4 font-[510]">Events Credited</th>
                    <th className="py-2.5 px-4 font-[510]">Additional Notes</th>
                    <th className="py-2.5 px-4 font-[510]">Submitted</th>
                    <th className="py-2.5 px-4 font-[510]">Status & Workflow</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-100"}`}>
                  {paginatedRequests.map((r) => {
                    const isCopiedThisStId = copiedStId === r.st_id;
                    const isCopiedThisSnippet = copiedSnippetId === r.id;

                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors group text-[12.5px] ${
                          isDark ? "hover:bg-[#161718]/40" : "hover:bg-gray-50/80"
                        }`}
                      >
                        {/* Member Identity & Profile Trigger */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col">
                            <StudentNameLink
                              stId={r.st_id}
                              name={r.members?.name || "Unregistered"}
                            />

                            <div className={`flex items-center gap-1.5 font-berkeley-mono text-[10.5px] mt-0.5 ${
                              isDark ? "text-[#8a8f98]" : "text-gray-500"
                            }`}>
                              <span>{r.st_id}</span>
                              <button
                                onClick={(e) => handleCopyStId(r.st_id, e)}
                                className={`transition-colors ${
                                  isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-700"
                                }`}
                                title="Copy Student ID"
                              >
                                {isCopiedThisStId ? (
                                  <Check className="w-2.5 h-2.5 text-[#27a644]" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Name on Letter */}
                        <td className="py-3 px-4 align-top">
                          {r.name_on_letter ? (
                            <span className={`font-[510] border px-2 py-0.5 rounded-[4px] inline-block font-berkeley-mono text-[11px] ${
                              isDark
                                ? "text-[#ffffff] bg-[#161718] border-[#23252a]"
                                : "text-gray-900 bg-gray-50 border-gray-200"
                            }`}>
                              {r.name_on_letter}
                            </span>
                          ) : (
                            <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>—</span>
                          )}
                        </td>

                        {/* Selected Events */}
                        <td className="py-3 px-4 align-top">
                          {Array.isArray(r.selected_events) && r.selected_events.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {r.selected_events.map((eName, idx) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center gap-1 font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] border ${
                                    isDark
                                      ? "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/30"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>{eName}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>—</span>
                          )}
                        </td>

                        {/* Additional Details */}
                        <td className="py-3 px-4 align-top max-w-xs">
                          {r.additional_details ? (
                            <p className={`text-[12px] leading-relaxed line-clamp-2 ${
                              isDark ? "text-[#8a8f98]" : "text-gray-600"
                            }`}>
                              {r.additional_details}
                            </p>
                          ) : (
                            <span className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>—</span>
                          )}
                        </td>

                        {/* Requested Date */}
                        <td className={`py-3 px-4 align-top font-berkeley-mono text-[11px] whitespace-nowrap ${
                          isDark ? "text-[#8a8f98]" : "text-gray-500"
                        }`}>
                          {new Date(r.created_at).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        {/* Status & Workflow Actions */}
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={r.status} isDark={isDark} />

                              {/* Copy Citation Snippet Button */}
                              <button
                                onClick={(e) => handleCopyCitationSnippet(r, e)}
                                className={`px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] transition-all flex items-center gap-1 ${
                                  isCopiedThisSnippet
                                    ? isDark
                                      ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isDark
                                    ? "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:text-white hover:border-[#383b3f]"
                                    : "bg-white text-gray-700 border-gray-200 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                                }`}
                                title="Copy formatted certification text"
                              >
                                {isCopiedThisSnippet ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-[#27a644]" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Citation</span>
                                  </>
                                )}
                              </button>

                              {/* Delete Request */}
                              <button
                                onClick={() => handleDeleteRequest(r.id)}
                                className={`p-1 rounded-[4px] transition-colors ${
                                  isDark
                                    ? "text-[#62666d] hover:text-[#eb5757] hover:bg-[#eb5757]/10"
                                    : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                                }`}
                                title="Delete Request"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Status State Transition Buttons */}
                            <div className="flex items-center gap-1 pt-0.5">
                              {r.status === "not start" && (
                                <button
                                  onClick={() => handleUpdateStatus(r.id, "inprogress")}
                                  className={`font-berkeley-mono text-[9.5px] px-2 py-0.5 rounded-[3px] border transition-colors ${
                                    isDark
                                      ? "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/30 hover:bg-[#6366f1]/20"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                  }`}
                                >
                                  Start Draft
                                </button>
                              )}

                              {r.status !== "done" && (
                                <button
                                  onClick={() => handleUpdateStatus(r.id, "done")}
                                  className={`font-berkeley-mono text-[9.5px] px-2 py-0.5 rounded-[3px] border transition-colors ${
                                    isDark
                                      ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30 hover:bg-[#27a644]/20"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  }`}
                                >
                                  Issue Letter
                                </button>
                              )}

                              {r.status !== "rejected" && (
                                <button
                                  onClick={() => handleUpdateStatus(r.id, "rejected")}
                                  className={`font-berkeley-mono text-[9.5px] px-2 py-0.5 rounded-[3px] border transition-colors ${
                                    isDark
                                      ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30 hover:bg-[#eb5757]/20"
                                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                  }`}
                                >
                                  Decline
                                </button>
                              )}

                              {r.status !== "not start" && (
                                <button
                                  onClick={() => handleUpdateStatus(r.id, "not start")}
                                  className={`font-berkeley-mono text-[9.5px] px-1.5 py-0.5 rounded-[3px] border transition-colors ${
                                    isDark
                                      ? "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:text-white"
                                      : "bg-white text-gray-600 border-gray-200 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                                  }`}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Table Pagination Bar ── */}
          {totalPages > 1 && (
            <div className={`px-5 py-3 border-t flex items-center justify-between text-[11px] font-berkeley-mono ${
              isDark
                ? "border-[#23252a] bg-[#161718]/40 text-[#8a8f98]"
                : "border-gray-200 bg-gray-50 text-gray-600"
            }`}>
              <span>
                Page {page + 1} of {totalPages} ({filteredRequests.length} total entries)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className={`px-2.5 py-1 rounded-[4px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-[#d0d6e0] hover:text-white"
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-xs"
                  }`}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className={`px-2.5 py-1 rounded-[4px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-[#d0d6e0] hover:text-white"
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-xs"
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Student Profile Modal Popup ── */}
      {selectedMemberId && (
        <StudentProfileModal
          stId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}
