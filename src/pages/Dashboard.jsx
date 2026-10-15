import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { fetchWithCache, invalidateCache, CACHE_KEYS } from "../lib/queryCache";
import { 
  Users, 
  Calendar, 
  Mail, 
  TrendingUp, 
  PlusCircle, 
  CheckSquare, 
  Clock, 
  ChevronRight, 
  RefreshCw,
  Activity,
  ArrowUpRight,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  GraduationCap
} from "lucide-react";
import { StudentNameLink } from "../components/StudentProfileContext";


const getInitials = (name) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getRelativeTime = (timeString) => {
  if (!timeString) return "Recently";
  const now = new Date();
  const date = new Date(timeString);
  const diffMs = now - date;
  if (isNaN(diffMs)) return "Recently";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const parseDateBox = (dateStr) => {
  if (!dateStr) return { month: "OCT", day: "28" };
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return { month: "OCT", day: "28" };
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return { month, day };
};

export default function Dashboard({ onNavigate, isAdmin = false, theme }) {
  const isDark = theme ? theme === "dark" : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);
  const [stats, setStats] = useState({ 
    members: 0, 
    events: 0, 
    upcomingCount: 0,
    attendanceTotal: 0,
    avgTurnout: 0,
    pendingLetters: 0,
    pendingMembers: 0,
    lastEventName: null
  });
  
  const [cohortLevels, setCohortLevels] = useState({ y1: 0, y2: 0, y3: 0, y4: 0, total: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all");

  const formattedToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  async function loadData() {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];

    try {
      const dashboardPayload = await fetchWithCache(CACHE_KEYS.DASHBOARD_STATS, async () => {
        const promises = [
          // 1. Members count & level distribution
          supabase.from("members").select("level, member_function"),
          
          // 2. Events total count
          supabase.from("events").select("event_id", { count: "exact", head: true }),
          
          // 3. Upcoming events (fetch only needed columns)
          supabase.from("events").select("event_id, name, date, time, flyer_url, is_public").gte("date", todayStr).order("date", { ascending: true }).limit(3),
          
          // 4. Last 6 events for attendance trend
          supabase.from("events").select("event_id, name, date").order("date", { ascending: false }).limit(6),
          
          // 5. Recent approved profiles
          supabase.from("profiles")
            .select("st_id, full_name, status, created_at, members(level, profile_image_url)")
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(6),
          
          // 6. Pending profiles waiting for review
          supabase.from("profiles")
            .select("id, full_name, st_id, status, created_at")
            .eq("status", "pending"),
          
          // 7. Pending letter requests awaiting staff action ('not start' or 'inprogress')
          supabase.from("letter_requests")
            .select("id, status")
            .in("status", ["not start", "inprogress"]),

          // 8. Recent letter requests for activity ledger
          supabase.from("letter_requests")
            .select("id, status, created_at, st_id, members(name)")
            .order("created_at", { ascending: false })
            .limit(8)
        ];

        const results = await Promise.allSettled(promises);
        const [membersRes, eventsCountRes, upcomingRes, lastEventsRes, profilesRes, pendingProfilesRes, pendingLettersRes, lettersRes] = results;

        const memberRows = membersRes.status === "fulfilled" && membersRes.value.data ? membersRes.value.data : [];
        const levels = { y1: 0, y2: 0, y3: 0, y4: 0, total: memberRows.length };
        memberRows.forEach(m => {
          const lvl = String(m.level);
          if (lvl === "1") levels.y1++;
          else if (lvl === "2") levels.y2++;
          else if (lvl === "3") levels.y3++;
          else if (lvl === "4") levels.y4++;
        });

        const totalEvents = eventsCountRes.status === "fulfilled" ? (eventsCountRes.value.count || 0) : 0;
        const upcomingData = upcomingRes.status === "fulfilled" && upcomingRes.value.data ? upcomingRes.value.data : [];
        const pendingProfiles = pendingProfilesRes.status === "fulfilled" && pendingProfilesRes.value.data ? pendingProfilesRes.value.data : [];
        const pendingLetters = pendingLettersRes.status === "fulfilled" && pendingLettersRes.value.data ? pendingLettersRes.value.data : [];
        const letterRows = lettersRes.status === "fulfilled" && lettersRes.value.data ? lettersRes.value.data : [];
        const recentEvents = lastEventsRes.status === "fulfilled" && lastEventsRes.value.data ? [...lastEventsRes.value.data].reverse() : [];

        // Single batched query for attendance counts (eliminates N+1 network requests)
        let totalAtt = 0;
        let chartPoints = [];
        if (recentEvents.length > 0) {
          const eventIds = recentEvents.map(ev => ev.event_id);
          const { data: attRows } = await supabase
            .from("attendance")
            .select("event_id")
            .eq("attend", "YES")
            .in("event_id", eventIds);

          const countMap = {};
          (attRows || []).forEach(r => {
            countMap[r.event_id] = (countMap[r.event_id] || 0) + 1;
          });

          chartPoints = recentEvents.map(ev => {
            const count = countMap[ev.event_id] || 0;
            totalAtt += count;
            return {
              name: ev.name,
              date: ev.date,
              count
            };
          });
        }

        const avgTurnout = chartPoints.length > 0 ? Math.round(totalAtt / chartPoints.length) : 0;

        const calculatedStats = {
          members: memberRows.length,
          events: totalEvents,
          upcomingCount: upcomingData.length,
          attendanceTotal: totalAtt,
          avgTurnout,
          pendingLetters: pendingLetters.length,
          pendingMembers: pendingProfiles.length,
          lastEventName: recentEvents.length > 0 ? recentEvents[recentEvents.length - 1].name : null
        };

        const activities = [];
        const approvedProfiles = profilesRes.status === "fulfilled" && profilesRes.value.data ? profilesRes.value.data : [];
        approvedProfiles.forEach(p => {
          activities.push({
            id: `mem-${p.st_id}-${p.created_at}`,
            stId: p.st_id,
            entity: p.full_name || "New Member",
            type: "member",
            activity: "Profile approved & activated",
            status: "Approved",
            statusType: "success",
            timestamp: p.created_at
          });
        });

        upcomingData.forEach(ev => {
          activities.push({
            id: `evt-${ev.event_id}`,
            entity: ev.name,
            type: "event",
            activity: `Event session scheduled (${ev.date})`,
            status: "Scheduled",
            statusType: "info",
            timestamp: ev.date || new Date().toISOString()
          });
        });

        letterRows.forEach(l => {
          const isIssued = l.status === "done" || l.status === "completed";
          const isInProgress = l.status === "inprogress";
          const isRejected = l.status === "rejected";

          activities.push({
            id: `let-${l.id}`,
            stId: l.st_id,
            entity: "Letter Request",
            memberName: l.members?.name,
            type: "letter",
            activity: `Requested by ${l.members?.name || "Student"}`,
            status: isIssued ? "Issued" : isInProgress ? "Reviewing" : isRejected ? "Declined" : "Pending",
            statusType: isIssued ? "success" : isInProgress ? "warning" : isRejected ? "error" : "info",
            timestamp: l.created_at || new Date().toISOString()
          });
        });

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
          levels,
          upcomingData,
          chartPoints,
          calculatedStats,
          activities
        };
      }, 30000); // 30s TTL cache

      if (dashboardPayload) {
        setCohortLevels(dashboardPayload.levels);
        setUpcomingEvents(dashboardPayload.upcomingData);
        setChartData(dashboardPayload.chartPoints);
        setStats(dashboardPayload.calculatedStats);
        setRecentActivities(dashboardPayload.activities);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return recentActivities.slice(0, 6);
    return recentActivities.filter(a => a.type === activityFilter).slice(0, 6);
  }, [recentActivities, activityFilter]);

  const totalPendingActions = stats.pendingMembers + stats.pendingLetters;

  return (
    <div
      className={`w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 font-inter-variable space-y-8 transition-colors duration-200 ${
        isDark ? "text-[#d0d6e0]" : "text-[#3f3f46]"
      }`}
    >
      {/* ── Top Header & Command Titlebar ─────────────────────────────────── */}
      <div
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b transition-colors ${
          isDark ? "border-[#23252a]" : "border-gray-200"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? "bg-[#27a644]" : "bg-[#16a34a]"
              }`}
            ></span>
            <h1
              className={`text-[26px] sm:text-[30px] font-[510] tracking-[-0.022em] transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              Society Command Center
            </h1>
            <span
              className={`text-[10px] font-berkeley-mono uppercase tracking-wider px-2 py-0.5 rounded-[4px] border hidden sm:inline-block ${
                isDark
                  ? "text-[#8a8f98] bg-[#161718] border-[#23252a]"
                  : "text-gray-600 bg-gray-100 border-gray-200"
              }`}
            >
              LIVE OPS
            </span>
          </div>
          <p
            className={`text-[13px] font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            {formattedToday} · Operational Status: Synchronized
          </p>
        </div>

        {/* Top Control Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              invalidateCache(CACHE_KEYS.DASHBOARD_STATS);
              loadData();
            }}
            disabled={loading}
            className={`text-[13px] px-3.5 py-1.5 rounded-[6px] font-[510] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? "linear-btn-ghost"
                : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 shadow-xs"
            }`}
            title="Refresh database telemetry"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""} ${
                isDark
                  ? loading
                    ? "text-white"
                    : "text-[#8a8f98]"
                  : loading
                  ? "text-gray-900"
                  : "text-gray-600"
              }`}
            />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onNavigate("events")}
              className={`text-[13px] px-4 py-1.5 rounded-[6px] font-[510] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                isDark
                  ? "linear-btn-primary"
                  : "bg-[#09090b] text-white hover:bg-black shadow-sm"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Event</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Quick Operations Command Toolbar ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate("scan_attendance")}
          className={`p-3 rounded-[12px] border flex items-center justify-between transition-all group cursor-pointer text-left ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
              : "bg-white border-gray-200 shadow-xs hover:border-gray-300 hover:bg-gray-50/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-[6px] border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-[#161718] border-[#23252a] text-[#27a644]"
                  : "bg-green-50 border-green-200 text-[#16a34a]"
              }`}
            >
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div
                className={`text-[12px] font-[510] transition-colors ${
                  isDark ? "text-white" : "text-[#09090b]"
                }`}
              >
                QR Telemetry
              </div>
              <div
                className={`text-[10px] font-berkeley-mono ${
                  isDark ? "text-[#62666d]" : "text-gray-500"
                }`}
              >
                Verify attendance
              </div>
            </div>
          </div>
          <span
            className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded border hidden md:inline ${
              isDark
                ? "text-[#62666d] bg-[#08090a] border-[#23252a]"
                : "text-gray-500 bg-gray-100 border-gray-200"
            }`}
          >
            ⌘Q
          </span>
        </button>

        <button
          onClick={() => onNavigate("members")}
          className={`p-3 rounded-[12px] border flex items-center justify-between transition-all group cursor-pointer text-left ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
              : "bg-white border-gray-200 shadow-xs hover:border-gray-300 hover:bg-gray-50/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-[6px] border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-[#161718] border-[#23252a] text-[#02b8cc]"
                  : "bg-sky-50 border-sky-200 text-[#0284c7]"
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div
                className={`text-[12px] font-[510] transition-colors ${
                  isDark ? "text-white" : "text-[#09090b]"
                }`}
              >
                Member Roster
              </div>
              <div
                className={`text-[10px] font-berkeley-mono ${
                  isDark ? "text-[#62666d]" : "text-gray-500"
                }`}
              >
                {stats.members} profiles
              </div>
            </div>
          </div>
          <span
            className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded border hidden md:inline ${
              isDark
                ? "text-[#62666d] bg-[#08090a] border-[#23252a]"
                : "text-gray-500 bg-gray-100 border-gray-200"
            }`}
          >
            ⌘M
          </span>
        </button>

        <button
          onClick={() => onNavigate("letters")}
          className={`p-3 rounded-[12px] border flex items-center justify-between transition-all group cursor-pointer text-left ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
              : "bg-white border-gray-200 shadow-xs hover:border-gray-300 hover:bg-gray-50/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-[6px] border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-[#161718] border-[#23252a] text-[#8b5cf6]"
                  : "bg-purple-50 border-purple-200 text-[#7c3aed]"
              }`}
            >
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div
                className={`text-[12px] font-[510] transition-colors ${
                  isDark ? "text-white" : "text-[#09090b]"
                }`}
              >
                Letter Requests
              </div>
              <div
                className={`text-[10px] font-berkeley-mono ${
                  isDark ? "text-[#62666d]" : "text-gray-500"
                }`}
              >
                {stats.pendingLetters > 0 ? `${stats.pendingLetters} pending` : "All issued"}
              </div>
            </div>
          </div>
          <span
            className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded border hidden md:inline ${
              isDark
                ? "text-[#62666d] bg-[#08090a] border-[#23252a]"
                : "text-gray-500 bg-gray-100 border-gray-200"
            }`}
          >
            ⌘L
          </span>
        </button>

        <button
          onClick={() => onNavigate("assistant")}
          className={`p-3 rounded-[12px] border flex items-center justify-between transition-all group cursor-pointer text-left ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
              : "bg-white border-gray-200 shadow-xs hover:border-gray-300 hover:bg-gray-50/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-[6px] border flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-[#161718] border-[#23252a] text-[#6366f1]"
                  : "bg-indigo-50 border-indigo-200 text-[#4f46e5]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div
                className={`text-[12px] font-[510] transition-colors ${
                  isDark ? "text-white" : "text-[#09090b]"
                }`}
              >
                AI Copilot
              </div>
              <div
                className={`text-[10px] font-berkeley-mono ${
                  isDark ? "text-[#62666d]" : "text-gray-500"
                }`}
              >
                Terminal query
              </div>
            </div>
          </div>
          <span
            className={`font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded border hidden md:inline ${
              isDark
                ? "text-[#62666d] bg-[#08090a] border-[#23252a]"
                : "text-gray-500 bg-gray-100 border-gray-200"
            }`}
          >
            ⌘A
          </span>
        </button>
      </div>

      {/* ── Executive Decision & Action Queue Banner ─────────────────────── */}
      <div
        className={`p-4 rounded-[12px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          isDark
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
            : "bg-white border-gray-200 shadow-xs"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${
              totalPendingActions > 0
                ? isDark
                  ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/20"
                  : "bg-red-50 text-red-600 border-red-200"
                : isDark
                ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/20"
                : "bg-green-50 text-green-600 border-green-200"
            }`}
          >
            {totalPendingActions > 0 ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <div
              className={`text-[13px] font-[510] flex items-center gap-2 ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              {totalPendingActions > 0
                ? "Executive Action Required"
                : "All Operational Queues Clear"}
              <span
                className={`text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                  totalPendingActions > 0
                    ? isDark
                      ? "bg-[#eb5757]/20 text-[#eb5757] border-[#eb5757]/30"
                      : "bg-red-100 text-red-700 border-red-200 font-medium"
                    : isDark
                    ? "bg-[#27a644]/20 text-[#27a644] border-[#27a644]/30"
                    : "bg-green-100 text-green-700 border-green-200 font-medium"
                }`}
              >
                {totalPendingActions > 0
                  ? `${totalPendingActions} PENDING`
                  : "CLEAR"}
              </span>
            </div>
            <p
              className={`text-[12px] font-berkeley-mono mt-0.5 ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              {totalPendingActions > 0
                ? `${stats.pendingMembers} pending member registration${
                    stats.pendingMembers === 1 ? "" : "s"
                  } · ${stats.pendingLetters} unsigned letter request${
                    stats.pendingLetters === 1 ? "" : "s"
                  }`
                : "Zero pending account reviews or unanswered document requests."}
            </p>
          </div>
        </div>

        {totalPendingActions > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-center">
            {stats.pendingMembers > 0 && (
              <button
                onClick={() => onNavigate("access")}
                className={`text-[12px] py-1 px-2.5 rounded-[6px] font-[510] transition-colors cursor-pointer ${
                  isDark
                    ? "linear-btn-ghost"
                    : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                }`}
              >
                Review Accounts ({stats.pendingMembers}) →
              </button>
            )}
            {stats.pendingLetters > 0 && (
              <button
                onClick={() => onNavigate("letters")}
                className={`text-[12px] py-1 px-2.5 rounded-[6px] font-[510] transition-colors cursor-pointer ${
                  isDark
                    ? "linear-btn-ghost"
                    : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                }`}
              >
                Process Letters ({stats.pendingLetters}) →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 4-Point Precision Metric Matrix ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Registered Members */}
        <div
          className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-3 transition-all ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
              : "bg-white border-gray-200 shadow-xs"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[11px] font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            <span>MEMBER REGISTRY</span>
            <span
              className={`px-1.5 py-0.5 rounded-[4px] border ${
                isDark
                  ? "text-[#27a644] bg-[#27a644]/10 border-[#27a644]/20"
                  : "text-green-700 bg-green-50 border-green-200 font-medium"
              }`}
            >
              VERIFIED
            </span>
          </div>
          <div>
            <div
              className={`text-[32px] font-berkeley-mono font-[510] leading-none mb-1 transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              {stats.members}
            </div>
            <div
              className={`text-[11px] font-berkeley-mono ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              L1: {cohortLevels.y1} · L2: {cohortLevels.y2} · L3: {cohortLevels.y3} · L4: {cohortLevels.y4}
            </div>
          </div>
        </div>

        {/* Metric 2: Active Events Organized */}
        <div
          className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-3 transition-all ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
              : "bg-white border-gray-200 shadow-xs"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[11px] font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            <span>EVENT OPERATIONS</span>
            <span
              className={`px-1.5 py-0.5 rounded-[4px] border ${
                isDark
                  ? "text-[#02b8cc] bg-[#02b8cc]/10 border-[#02b8cc]/20"
                  : "text-sky-700 bg-sky-50 border-sky-200 font-medium"
              }`}
            >
              {stats.upcomingCount} UPCOMING
            </span>
          </div>
          <div>
            <div
              className={`text-[32px] font-berkeley-mono font-[510] leading-none mb-1 transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              {String(stats.events).padStart(2, "0")}
            </div>
            <div
              className={`text-[11px] font-berkeley-mono ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              Total official workshops & sessions
            </div>
          </div>
        </div>

        {/* Metric 3: Average Turnout & Quorum */}
        <div
          className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-3 transition-all ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
              : "bg-white border-gray-200 shadow-xs"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[11px] font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            <span>AVERAGE TURNOUT</span>
            <span
              className={`px-1.5 py-0.5 rounded-[4px] border ${
                isDark
                  ? "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20"
                  : "text-indigo-700 bg-indigo-50 border-indigo-200 font-medium"
              }`}
            >
              QUORUM
            </span>
          </div>
          <div>
            <div
              className={`text-[32px] font-berkeley-mono font-[510] leading-none mb-1 transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              {stats.avgTurnout > 0 ? stats.avgTurnout : "—"}
            </div>
            <div
              className={`text-[11px] font-berkeley-mono ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              Attendees per session telemetry
            </div>
          </div>
        </div>

        {/* Metric 4: Executive Action Items */}
        <div
          className={`p-5 rounded-[12px] border flex flex-col justify-between space-y-3 transition-all ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
              : "bg-white border-gray-200 shadow-xs"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[11px] font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            <span>DECISION QUEUE</span>
            <span
              className={`px-1.5 py-0.5 rounded-[4px] border ${
                totalPendingActions > 0
                  ? isDark
                    ? "text-[#eb5757] bg-[#eb5757]/10 border-[#eb5757]/20"
                    : "text-red-700 bg-red-50 border-red-200 font-medium"
                  : isDark
                  ? "text-[#27a644] bg-[#27a644]/10 border-[#27a644]/20"
                  : "text-green-700 bg-green-50 border-green-200 font-medium"
              }`}
            >
              {totalPendingActions > 0 ? "ATTN" : "NOMINAL"}
            </span>
          </div>
          <div>
            <div
              className={`text-[32px] font-berkeley-mono font-[510] leading-none mb-1 transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              {String(totalPendingActions).padStart(2, "0")}
            </div>
            <div
              className={`text-[11px] font-berkeley-mono ${
                isDark ? "text-[#62666d]" : "text-gray-500"
              }`}
            >
              Items requiring committee sign-off
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Operations Grid (Left: 7 cols, Right: 5 cols) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Attendance Telemetry & Cohort Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Attendance Telemetry SVG Curve */}
          <div
            className={`rounded-[12px] border p-6 space-y-4 transition-all ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
                : "bg-white border-gray-200 shadow-xs"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-4 ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp
                  className={`w-4 h-4 ${
                    isDark ? "text-[#e4f222]" : "text-indigo-600"
                  }`}
                />
                <h3
                  className={`text-[14px] font-[510] tracking-[-0.012em] ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Attendance Telemetry & Quorum Trend
                </h3>
              </div>
              <button
                onClick={() => onNavigate("events")}
                className={`text-[12px] font-berkeley-mono transition-colors flex items-center gap-1 cursor-pointer ${
                  isDark
                    ? "text-[#8a8f98] hover:text-white"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                <span>Full Ledger</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {chartData.length === 0 ? (
              <div
                className={`py-16 text-center font-berkeley-mono text-[12px] flex flex-col items-center gap-2 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}
              >
                <Calendar
                  className={`w-6 h-6 ${
                    isDark ? "text-[#383b3f]" : "text-gray-300"
                  }`}
                />
                <span>No attendance telemetry logged yet.</span>
              </div>
            ) : (
              <div className="relative pt-2 pb-1">
                {(() => {
                  const W = 460, H = 190, PX = 36, PY = 20, PB = 34;
                  const plotW = W - PX * 2, plotH = H - PY - PB;
                  const maxVal = Math.max(...chartData.map(d => d.count), 1);
                  const ceil = Math.ceil(maxVal / 5) * 5 || 10;
                  const points = chartData.map((d, i) => ({
                    x: PX + (chartData.length === 1 ? plotW / 2 : (i / (chartData.length - 1)) * plotW),
                    y: PY + plotH - (d.count / ceil) * plotH,
                    ...d
                  }));

                  const smoothPath = (pts) => {
                    if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;
                    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
                    let d = `M${pts[0].x},${pts[0].y}`;
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p0 = pts[i - 1] || pts[i];
                      const p1 = pts[i];
                      const p2 = pts[i + 1];
                      const p3 = pts[i + 2] || p2;
                      const t = 0.35;
                      const cp1x = p1.x + (p2.x - p0.x) * t;
                      const cp1y = p1.y + (p2.y - p0.y) * t;
                      const cp2x = p2.x - (p3.x - p1.x) * t;
                      const cp2y = p2.y - (p3.y - p1.y) * t;
                      d += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
                    }
                    return d;
                  };

                  const linePath = smoothPath(points);
                  const areaPath = linePath + `L${points[points.length - 1].x},${PY + plotH}L${points[0].x},${PY + plotH}Z`;
                  const gridLines = [0, 0.5, 1];

                  const strokeLineColor = isDark ? "#e4f222" : "#4f46e5";
                  const gridLineColor = isDark ? "#23252a" : "#f1f5f9";
                  const yAxisTextColor = isDark ? "#62666d" : "#94a3b8";
                  const pointCircleFill = isDark ? "#08090a" : "#ffffff";

                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      <defs>
                        <linearGradient id="linearAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={strokeLineColor} stopOpacity={isDark ? "0.18" : "0.15"} />
                          <stop offset="100%" stopColor={strokeLineColor} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {gridLines.map((frac, i) => {
                        const y = PY + plotH - frac * plotH;
                        const val = Math.round(frac * ceil);
                        return (
                          <g key={i}>
                            <line x1={PX} y1={y} x2={PX + plotW} y2={y} stroke={gridLineColor} strokeWidth="1" />
                            <text x={PX - 8} y={y + 3} fill={yAxisTextColor} fontSize="10" textAnchor="end" fontFamily="monospace">{val}</text>
                          </g>
                        );
                      })}

                      <path d={areaPath} fill="url(#linearAreaGrad)" />
                      <path d={linePath} fill="none" stroke={strokeLineColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

                      {points.map((p, i) => {
                        const label = p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name;
                        return (
                          <g
                            key={i}
                            onMouseEnter={() => setHoveredPoint(i)}
                            onMouseLeave={() => setHoveredPoint(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {hoveredPoint === i && (
                              <line
                                x1={p.x}
                                y1={PY}
                                x2={p.x}
                                y2={PY + plotH}
                                stroke={isDark ? "#383b3f" : "#cbd5e1"}
                                strokeWidth="1"
                                strokeDasharray="3,3"
                              />
                            )}

                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={hoveredPoint === i ? 5 : 3.5}
                              fill={pointCircleFill}
                              stroke={strokeLineColor}
                              strokeWidth="2"
                              style={{ transition: 'all 0.15s ease' }}
                            />

                            {hoveredPoint === i && (
                              <g>
                                <rect
                                  x={p.x - 42}
                                  y={p.y - 28}
                                  width="84"
                                  height="20"
                                  rx="4"
                                  fill={isDark ? "#161718" : "#ffffff"}
                                  stroke={isDark ? "#23252a" : "#e2e8f0"}
                                  strokeWidth="1"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 14}
                                  fill={isDark ? "#ffffff" : "#0f172a"}
                                  fontSize="10"
                                  textAnchor="middle"
                                  fontFamily="monospace"
                                  fontWeight="500"
                                >
                                  {p.count} attendees
                                </text>
                              </g>
                            )}

                            <text
                              x={p.x}
                              y={PY + plotH + 16}
                              fill={isDark ? "#8a8f98" : "#475569"}
                              fontSize="9"
                              textAnchor="middle"
                              fontFamily="sans-serif"
                            >
                              {label}
                            </text>
                            <text
                              x={p.x}
                              y={PY + plotH + 27}
                              fill={isDark ? "#62666d" : "#94a3b8"}
                              fontSize="8"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {p.date}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Cohort Level Breakdown Matrix */}
          <div
            className={`rounded-[12px] border p-6 space-y-4 transition-all ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
                : "bg-white border-gray-200 shadow-xs"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <GraduationCap
                  className={`w-4 h-4 ${
                    isDark ? "text-[#02b8cc]" : "text-sky-600"
                  }`}
                />
                <h3
                  className={`text-[14px] font-[510] tracking-[-0.012em] ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Academic Cohort Enrollment Distribution
                </h3>
              </div>
              <span
                className={`text-[11px] font-berkeley-mono ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}
              >
                {cohortLevels.total} TOTAL PROFILES
              </span>
            </div>

            <div className="space-y-3 font-berkeley-mono text-[12px]">
              {[
                { label: "Year 1 (Level 1)", count: cohortLevels.y1, color: isDark ? "#27a644" : "#16a34a" },
                { label: "Year 2 (Level 2)", count: cohortLevels.y2, color: isDark ? "#02b8cc" : "#0284c7" },
                { label: "Year 3 (Level 3)", count: cohortLevels.y3, color: "#6366f1" },
                { label: "Year 4 (Level 4)", count: cohortLevels.y4, color: isDark ? "#8b5cf6" : "#7c3aed" },
              ].map(item => {
                const pct = cohortLevels.total > 0 ? Math.round((item.count / cohortLevels.total) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div
                      className={`flex items-center justify-between ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>
                        {item.count}{" "}
                        <span className={isDark ? "text-[#62666d]" : "text-gray-400"}>
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div
                      className={`h-1.5 w-full rounded-full overflow-hidden ${
                        isDark ? "bg-[#161718]" : "bg-gray-100"
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Schedule & Filtered Activity Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Events Calendar */}
          <div
            className={`rounded-[12px] border p-6 space-y-4 transition-all ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
                : "bg-white border-gray-200 shadow-xs"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock
                  className={`w-4 h-4 ${
                    isDark ? "text-[#e4f222]" : "text-amber-500"
                  }`}
                />
                <h3
                  className={`text-[14px] font-[510] tracking-[-0.012em] ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Scheduled Public Events
                </h3>
              </div>
              <button
                onClick={() => onNavigate("events")}
                className={`text-[11px] font-berkeley-mono transition-colors cursor-pointer ${
                  isDark
                    ? "text-[#8a8f98] hover:text-white"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                Schedule →
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div
                className={`py-8 text-center font-berkeley-mono text-[12px] flex flex-col items-center gap-2 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}
              >
                <Calendar
                  className={`w-6 h-6 ${
                    isDark ? "text-[#383b3f]" : "text-gray-300"
                  }`}
                />
                <span>No upcoming public sessions.</span>
                {isAdmin && (
                  <button
                    onClick={() => onNavigate("events")}
                    className={`text-[11px] py-1 px-2.5 mt-1 rounded-[6px] transition-colors cursor-pointer ${
                      isDark
                        ? "linear-btn-ghost"
                        : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-xs"
                    }`}
                  >
                    + Schedule Session
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(ev => {
                  const dateBox = parseDateBox(ev.date);
                  return (
                    <div
                      key={ev.event_id}
                      onClick={() => onNavigate("events")}
                      className={`p-3 rounded-[8px] border transition-all flex items-center gap-3.5 cursor-pointer group ${
                        isDark
                          ? "bg-[#08090a] border-[#23252a] hover:border-[#383b3f] hover:bg-[#161718]/40"
                          : "bg-gray-50/70 border-gray-200 hover:border-gray-300 hover:bg-gray-100/70 shadow-2xs"
                      }`}
                    >
                      <div
                        className={`w-11 h-12 rounded-[6px] border flex flex-col items-center justify-center flex-shrink-0 font-berkeley-mono transition-colors ${
                          isDark
                            ? "bg-[#161718] border-[#23252a]"
                            : "bg-white border-gray-200 shadow-xs"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-[510] uppercase ${
                            isDark ? "text-[#e4f222]" : "text-indigo-600"
                          }`}
                        >
                          {dateBox.month}
                        </span>
                        <span
                          className={`text-[15px] font-[510] leading-none mt-0.5 ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {dateBox.day}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`text-[13px] font-[510] truncate transition-colors ${
                            isDark
                              ? "text-white group-hover:text-white"
                              : "text-gray-900 group-hover:text-indigo-600"
                          }`}
                        >
                          {ev.name}
                        </h4>
                        <p
                          className={`text-[11px] font-berkeley-mono truncate mt-0.5 ${
                            isDark ? "text-[#62666d]" : "text-gray-500"
                          }`}
                        >
                          {ev.time ? ev.time : "Time to be confirmed"}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 transition-colors flex-shrink-0 ${
                          isDark
                            ? "text-[#383b3f] group-hover:text-white"
                            : "text-gray-400 group-hover:text-gray-900"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity & Operational Audit Feed */}
          <div
            className={`rounded-[12px] border p-6 space-y-4 transition-all ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]"
                : "bg-white border-gray-200 shadow-xs"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                isDark ? "border-[#23252a]" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity
                  className={`w-4 h-4 ${
                    isDark ? "text-[#27a644]" : "text-green-600"
                  }`}
                />
                <h3
                  className={`text-[14px] font-[510] tracking-[-0.012em] ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Operational Audit Log
                </h3>
              </div>

              {/* Category Filter Tabs */}
              <div
                className={`flex items-center gap-1 p-0.5 rounded-[4px] border ${
                  isDark
                    ? "bg-[#08090a] border-[#23252a]"
                    : "bg-gray-100 border-gray-200"
                }`}
              >
                {["all", "member", "event", "letter"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActivityFilter(cat)}
                    className={`px-2 py-0.5 text-[10px] font-berkeley-mono rounded-[3px] transition-colors cursor-pointer ${
                      activityFilter === cat
                        ? isDark
                          ? "bg-[#161718] text-white border border-[#383b3f]"
                          : "bg-white text-gray-900 border border-gray-200 shadow-xs font-medium"
                        : isDark
                        ? "text-[#8a8f98] hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {cat === "all" ? "ALL" : cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div
                className={`py-8 text-center font-berkeley-mono text-[12px] ${
                  isDark ? "text-[#8a8f98]" : "text-gray-500"
                }`}
              >
                No recent activity records match this filter.
              </div>
            ) : (
              <div
                className={`divide-y font-berkeley-mono text-[12px] ${
                  isDark ? "divide-[#161718]" : "divide-gray-100"
                }`}
              >
                {filteredActivities.map(act => (
                  <div
                    key={act.id}
                    className={`py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isDark ? "hover:bg-[#161718]/20" : "hover:bg-gray-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${
                          isDark
                            ? "bg-[#161718] border-[#23252a] text-[#8a8f98]"
                            : "bg-gray-100 border-gray-200 text-gray-700"
                        }`}
                      >
                        {act.image ? (
                          <img src={act.image} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          getInitials(act.entity)
                        )}
                      </div>
                      <div className="min-w-0">
                        {act.type === "member" && act.stId ? (
                          <div className="truncate max-w-[170px]">
                            <StudentNameLink stId={act.stId} name={act.entity} size="sm" />
                          </div>
                        ) : (
                          <div
                            className={`text-[12px] truncate max-w-[170px] ${
                              isDark ? "text-white" : "text-gray-900 font-medium"
                            }`}
                            title={act.entity}
                          >
                            {act.entity}
                          </div>
                        )}
                        <div
                          className={`text-[10px] truncate max-w-[200px] flex items-center gap-1 ${
                            isDark ? "text-[#62666d]" : "text-gray-500"
                          }`}
                        >
                          {act.type === "letter" && act.stId ? (
                            <>
                              <span>Requested by</span>
                              <StudentNameLink
                                stId={act.stId}
                                name={act.memberName || "Student"}
                                size="sm"
                                showIcon={false}
                                className={`!text-[10px] ${
                                  isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                                }`}
                              />
                            </>
                          ) : (
                            <span>{act.activity}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded-[4px] text-[10px] border ${
                          act.statusType === "success"
                            ? isDark
                              ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/20"
                              : "bg-green-50 text-green-700 border-green-200 font-medium"
                            : act.statusType === "warning"
                            ? isDark
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-amber-50 text-amber-700 border-amber-200 font-medium"
                            : act.statusType === "error"
                            ? isDark
                              ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/20"
                              : "bg-red-50 text-red-700 border-red-200 font-medium"
                            : isDark
                            ? "bg-[#08090a] text-[#8a8f98] border-[#23252a]"
                            : "bg-gray-100 text-gray-600 border-gray-200 font-medium"
                        }`}
                      >
                        {act.status}
                      </span>
                      <span
                        className={`text-[10px] hidden sm:inline ${
                          isDark ? "text-[#62666d]" : "text-gray-400"
                        }`}
                      >
                        {getRelativeTime(act.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
