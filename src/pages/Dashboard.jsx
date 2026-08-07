import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { 
  Users, 
  Calendar, 
  Mail, 
  BadgeCheck, 
  TrendingUp, 
  PlusCircle, 
  UserPlus, 
  CheckSquare, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  CalendarDays, 
  Layers, 
  MoreHorizontal, 
  RefreshCw,
  Activity,
  ArrowUpRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";

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
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
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

export default function Dashboard({ onNavigate, isAdmin = false }) {
  const [stats, setStats] = useState({ 
    members: 0, 
    events: 0, 
    oc: 0, 
    ocFilled: 0,
    ocTarget: 30,
    attendance: 0, 
    activeLetters: 0 
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light');

  const formattedToday = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  async function loadData() {
    setLoading(true);
    const todayStr = new Date().toLocaleDateString("sv-SE");

    const lastEventRes = await supabase
      .from("events")
      .select("event_id, name")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const lastEvent = lastEventRes.data;

    const promises = [
      supabase.from("members").select("*", { count: "exact", head: true }).lte("level", 4),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("oc").select("*", { count: "exact", head: true }).eq("apply_status", "Accept"),
      lastEvent
        ? supabase.from("attendance").select("*", { count: "exact", head: true }).eq("attend", "YES").eq("event_id", lastEvent.event_id)
        : Promise.resolve({ count: 0 }),
      supabase.from("profiles")
        .select("st_id, full_name, status, created_at, members(level, profile_image_url)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("events").select("*").order("date", { ascending: false }).limit(5),
      supabase.from("letter_requests")
        .select("id, request_type, status, created_at, members(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("events").select("*").gte("date", todayStr).order("date", { ascending: true }).limit(3)
    ];

    if (isAdmin) {
      promises.push(
        supabase.from("letter_requests").select("*", { count: "exact", head: true }).in("status", ["not start", "inprogress"])
      );
    }

    const results = await Promise.allSettled(promises);
    const [mRes, eRes, ocRes, attRes, rmRes, reRes, lrListRes, upcomingRes, lrAdminRes] = results;

    const m = mRes.status === "fulfilled" ? mRes.value : { count: 0 };
    const e = eRes.status === "fulfilled" ? eRes.value : { count: 0 };
    const oc = ocRes.status === "fulfilled" ? ocRes.value : { count: 0 };
    const att = attRes.status === "fulfilled" ? attRes.value : { count: 0 };
    const rm = rmRes.status === "fulfilled" ? rmRes.value : { data: [] };
    const re = reRes.status === "fulfilled" ? reRes.value : { data: [] };
    const lrList = lrListRes.status === "fulfilled" ? lrListRes.value : { data: [] };
    const upcomingData = upcomingRes.status === "fulfilled" ? upcomingRes.value : { data: [] };
    const lrAdmin = lrAdminRes && lrAdminRes.status === "fulfilled" ? lrAdminRes.value : { count: 0 };

    const filledOcCount = oc.count || 0;
    const totalEventCount = e.count || 1;
    const targetOcPositions = Math.max(30, totalEventCount * 8);

    setStats({
      members: m.count || 0,
      events: e.count || 0,
      oc: oc.count || 0,
      ocFilled: filledOcCount,
      ocTarget: targetOcPositions,
      attendance: att.count || 0,
      activeLetters: lrAdmin ? (lrAdmin.count || 0) : (lrList.data?.filter(l => l.status !== 'completed')?.length || 0),
      lastEventName: lastEvent ? lastEvent.name : null
    });

    setUpcomingEvents(upcomingData.data || []);

    // Build unified recent activities
    const activities = [];

    if (rm.data) {
      for (const p of rm.data) {
        if (p.members && p.members.level <= 4) {
          activities.push({
            id: `mem-${p.st_id}`,
            entity: p.full_name || p.st_id,
            type: "user",
            image: p.members?.profile_image_url,
            activity: "Registered as new member",
            status: "Completed",
            statusType: "completed",
            timestamp: p.created_at || new Date().toISOString()
          });
        }
      }
    }

    if (re.data) {
      for (const ev of re.data) {
        activities.push({
          id: `evt-${ev.event_id}`,
          entity: ev.name,
          type: "event",
          activity: `Event created (${ev.date})`,
          status: "In Progress",
          statusType: "progress",
          timestamp: ev.created_at || new Date().toISOString()
        });
      }
    }

    if (lrList.data) {
      for (const l of lrList.data) {
        activities.push({
          id: `let-${l.id}`,
          entity: l.request_type || "Letter Request",
          type: "letter",
          activity: `Request by ${l.members?.name || "Member"}`,
          status: l.status === "completed" ? "Completed" : l.status === "inprogress" ? "In Progress" : "Pending",
          statusType: l.status === "completed" ? "completed" : l.status === "inprogress" ? "progress" : "pending",
          timestamp: l.created_at || new Date().toISOString()
        });
      }
    }

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setRecentActivities(activities.slice(0, 5));

    // Build chart data
    const last5 = (re.data || []).slice(0, 5).reverse();
    if (last5.length > 0) {
      const attCounts = await Promise.all(
        last5.map(ev =>
          supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("attend", "YES")
            .eq("event_id", ev.event_id)
        )
      );
      setChartData(
        last5.map((ev, i) => ({
          name: ev.name,
          date: ev.date,
          count: attCounts[i].count || 0
        }))
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 text-zinc-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Society Dashboard
            </h1>
          </div>
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-zinc-500" />
            Overview for <span className="text-zinc-200 font-medium">{formattedToday}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 text-xs border-zinc-700/80 text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => onNavigate("events")}
            className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Event
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
          <div className="w-9 h-9 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-zinc-400">Loading dashboard analytics...</span>
        </div>
      ) : (
        <>
          {/* Top Grid: 4 Stat Cards + Upcoming Events Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* 2x2 Stat Cards Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Total Members */}
              <Card className="p-5 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300 bg-gradient-to-br from-[#17171a] to-[#1e1e24] shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <Badge variant="success" className="flex items-center gap-1 text-[11px] py-0.5">
                    <TrendingUp className="w-3 h-3" /> +12%
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Members</p>
                  <p className="text-3xl font-black text-white tracking-tight">{stats.members.toLocaleString()}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Active registered society accounts</p>
                </div>
              </Card>

              {/* Card 2: Active Events */}
              <Card className="p-5 flex flex-col justify-between hover:border-amber-500/40 transition-all duration-300 bg-gradient-to-br from-[#17171a] to-[#1e1e24] shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[11px] text-zinc-300 bg-zinc-800/80">
                    This Month
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Active Events</p>
                  <p className="text-3xl font-black text-white tracking-tight">{String(stats.events).padStart(2, '0')}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Organized society events</p>
                </div>
              </Card>

              {/* Card 3: Pending Letter Requests */}
              <Card className="p-5 flex flex-col justify-between hover:border-rose-500/40 transition-all duration-300 bg-gradient-to-br from-[#17171a] to-[#1e1e24] shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-sm">
                    <Mail className="w-5 h-5" />
                  </div>
                  <Badge variant="destructive" className="text-[11px]">
                    Action Required
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Pending Requests</p>
                  <p className="text-3xl font-black text-white tracking-tight">{stats.activeLetters}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Letter & document approvals pending</p>
                </div>
              </Card>

              {/* Card 4: OC Positions Filled */}
              <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 bg-gradient-to-br from-[#17171a] to-[#1e1e24] shadow-lg">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-900/40">
                    {Math.round((stats.ocFilled / (stats.ocTarget || 1)) * 100)}%
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">OC Positions Filled</p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-black text-white tracking-tight">{stats.ocFilled}</span>
                    <span className="text-sm font-semibold text-zinc-500">/ {stats.ocTarget}</span>
                  </div>
                  <Progress value={stats.ocFilled} max={stats.ocTarget} />
                </div>
              </Card>
            </div>

            {/* Upcoming Events Card */}
            <Card className="p-6 flex flex-col justify-between bg-[#17171a]/90 border border-zinc-800 hover:border-zinc-700 transition-all shadow-xl">
              <div>
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-base font-bold text-white tracking-tight">Upcoming Events</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="py-10 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                    <Calendar className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                    <span>No upcoming events scheduled.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {upcomingEvents.map(ev => {
                      const dateBox = parseDateBox(ev.date);
                      return (
                        <div key={ev.event_id} className="group flex items-center gap-3.5 bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800/80 hover:border-indigo-500/40 hover:bg-zinc-900 transition-all">
                          <div className="w-12 h-14 bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/60 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-inner group-hover:border-indigo-500/50">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{dateBox.month}</span>
                            <span className="text-base font-black text-white leading-none mt-0.5">{dateBox.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-zinc-100 truncate group-hover:text-indigo-300 transition-colors">{ev.name}</h4>
                            <p className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                              <span>{ev.description ? ev.description.slice(0, 24) + "…" : "Main Auditorium"}</span>
                              {ev.time && <span className="text-zinc-500">• {ev.time}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button 
                variant="outline"
                onClick={() => onNavigate("events")}
                className="w-full mt-5 text-xs font-semibold border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center gap-1.5"
              >
                View Full Calendar <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Card>
          </div>

          {/* Middle Grid: Recent Activities + Event Attendance Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Activities Section */}
            <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-base font-bold text-white">Recent Activity</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white" onClick={() => onNavigate("members")}>
                  View All <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              {recentActivities.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <Layers className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                  <p>No recent activity recorded</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" style={{ fontSize: "13px" }}>
                    <thead>
                      <tr className="border-b border-zinc-800/80 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="pb-3 px-2">Entity</th>
                        <th className="pb-3 px-2">Activity</th>
                        <th className="pb-3 px-2">Status</th>
                        <th className="pb-3 px-2 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {recentActivities.map(act => (
                        <tr key={act.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2.5">
                              {act.type === "user" ? (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-200 overflow-hidden shadow-sm">
                                  {act.image ? (
                                    <img src={act.image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    getInitials(act.entity)
                                  )}
                                </div>
                              ) : act.type === "event" ? (
                                <div className="w-8 h-8 rounded-full bg-amber-950/40 border border-amber-900/50 flex items-center justify-center flex-shrink-0 text-amber-400 shadow-sm">
                                  <Calendar className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-center flex-shrink-0 text-indigo-400 shadow-sm">
                                  <Mail className="w-4 h-4" />
                                </div>
                              )}
                              <span className="font-semibold text-zinc-100 truncate max-w-[130px]" title={act.entity}>
                                {act.entity}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-zinc-300 font-medium text-xs">
                            {act.activity}
                          </td>
                          <td className="py-3 px-2">
                            <Badge 
                              variant={
                                act.statusType === "completed" 
                                  ? "success" 
                                  : act.statusType === "progress" 
                                  ? "warning" 
                                  : "destructive"
                              }
                              className="text-[11px] px-2 py-0.5"
                            >
                              {act.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right text-zinc-400 text-xs whitespace-nowrap">
                            {getRelativeTime(act.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Event Attendance Section */}
            <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-base font-bold text-white">Event Attendance Analytics</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white" onClick={() => onNavigate("events")}>
                  View All <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              {chartData.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <Calendar className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                  <p>No event attendance data available yet</p>
                </div>
              ) : (
                <div style={{ padding: '16px 8px 8px', position: 'relative' }}>
                  {(() => {
                    const W = 400, H = 200, PX = 44, PY = 24, PB = 36;
                    const plotW = W - PX * 2, plotH = H - PY - PB;
                    const maxVal = Math.max(...chartData.map(d => d.count), 1);
                    const ceil = Math.ceil(maxVal / 5) * 5 || 5;
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
                    const gridLines = [0, 0.25, 0.5, 0.75, 1];
                    const lineColor    = isDark ? '#6366f1' : '#4f46e5';
                    const areaColor    = isDark ? '#6366f1' : '#4f46e5';
                    const gridColor    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
                    const labelColor   = isDark ? 'rgba(255,255,255,0.45)'  : 'rgba(0,0,0,0.45)';
                    const subColor     = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';
                    const dotFill      = isDark ? '#141417'                 : '#ffffff';
                    const dotInner     = isDark ? '#818cf8'                : '#4f46e5';
                    const tooltipBg    = isDark ? 'rgba(20,20,26,0.95)'    : 'rgba(250,250,250,0.97)';
                    const tooltipBorder= isDark ? 'rgba(99,102,241,0.3)'   : 'rgba(0,0,0,0.12)';
                    const tooltipText  = isDark ? '#e5e5ea'               : '#18181b';

                    return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={areaColor} stopOpacity={isDark ? 0.35 : 0.2} />
                              <stop offset="100%" stopColor={areaColor} stopOpacity="0.0" />
                            </linearGradient>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="3" result="g" />
                              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                          </defs>

                          {gridLines.map((frac, i) => {
                            const y = PY + plotH - frac * plotH;
                            const val = Math.round(frac * ceil);
                            return (
                              <g key={i}>
                                <line x1={PX} y1={y} x2={PX + plotW} y2={y} stroke={gridColor} strokeWidth="1" />
                                <text x={PX - 8} y={y + 4} fill={labelColor} fontSize="10" textAnchor="end" fontFamily="monospace">{val}</text>
                              </g>
                            );
                          })}

                          <path d={areaPath} fill="url(#areaGrad)" />
                          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

                          {points.map((p, i) => {
                            const label = p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name;
                            return (
                              <g key={i}
                                onMouseEnter={() => setHoveredPoint(i)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                style={{ cursor: 'pointer' }}
                              >
                                {hoveredPoint === i && (
                                  <line x1={p.x} y1={PY} x2={p.x} y2={PY + plotH} stroke={gridColor} strokeWidth="1" strokeDasharray="4,3" />
                                )}

                                <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 7 : 5} fill={dotFill} stroke={lineColor} strokeWidth="2" style={{ transition: 'r 0.2s' }} />
                                <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 3.5 : 2.5} fill={dotInner} style={{ transition: 'r 0.2s' }} />
                                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />

                                {hoveredPoint === i && (
                                  <g>
                                    <rect x={p.x - 30} y={p.y - 32} width="60" height="22" rx="6" fill={tooltipBg} stroke={tooltipBorder} strokeWidth="1" />
                                    <text x={p.x} y={p.y - 17} fill={tooltipText} fontSize="11" textAnchor="middle" fontWeight="700" fontFamily="sans-serif">{p.count} attendees</text>
                                  </g>
                                )}

                                <text x={p.x} y={PY + plotH + 16} fill={labelColor} fontSize="9" textAnchor="middle" fontFamily="sans-serif" fontWeight="500">{label}</text>
                                <text x={p.x} y={PY + plotH + 28} fill={subColor} fontSize="8" textAnchor="middle" fontFamily="monospace">{p.date}</text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                  })()}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions Bar */}
          <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl">
            <CardTitle className="text-base font-bold text-white mb-4">Quick Management Actions</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Add Member", page: "members", icon: UserPlus, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20" },
                { label: "Create Event", page: "events", icon: PlusCircle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20" },
                { label: "Take Attendance", page: "attendance", icon: CheckSquare, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" },
                { label: "Manage Committee", page: "committee", icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20" },
              ].map(a => {
                const IconComponent = a.icon;
                return (
                  <Button
                    key={a.page}
                    variant="outline"
                    onClick={() => onNavigate(a.page)}
                    className={`h-auto py-3.5 px-4 flex items-center justify-start gap-3 border rounded-xl transition-all duration-200 ${a.color}`}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold text-xs text-zinc-100">{a.label}</span>
                  </Button>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
