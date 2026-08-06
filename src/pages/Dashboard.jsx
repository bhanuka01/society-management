import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

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
    month: "long",
    day: "numeric"
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function load() {
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
    load();
  }, [isAdmin]);

  return (
    <div className="w-full max-w-container-max mx-auto px-4 sm:px-6 py-6 text-zinc-300">
      {/* Header Banner */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400">dashboard</span> 
          Dashboard
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Here is a summary of the society's status for today, {formattedToday}.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
          <span className="text-sm">Loading dashboard summary...</span>
        </div>
      ) : (
        <>
          {/* Top Section: 2x2 Stat Cards + Upcoming Events Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* 2x2 Grid of Stat Cards */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Total Members */}
              <div className="glass-card p-5 flex flex-col justify-between hover:border-zinc-500 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-white shadow-sm">
                    <span className="material-symbols-outlined text-xl">groups</span>
                  </div>
                  <span className="bg-amber-950/40 text-amber-400 border border-amber-900/50 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    📈 +12%
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Members</p>
                  <p className="text-3xl font-extrabold text-white tracking-tight">{stats.members.toLocaleString()}</p>
                </div>
              </div>

              {/* Card 2: Active Events */}
              <div className="glass-card p-5 flex flex-col justify-between hover:border-zinc-500 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-amber-400 shadow-sm">
                    <span className="material-symbols-outlined text-xl">event</span>
                  </div>
                  <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    This Month
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Active Events</p>
                  <p className="text-3xl font-extrabold text-white tracking-tight">{String(stats.events).padStart(2, '0')}</p>
                </div>
              </div>

              {/* Card 3: Pending Letter Requests */}
              <div className="glass-card p-5 flex flex-col justify-between hover:border-zinc-500 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-rose-400 shadow-sm">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </div>
                  <span className="bg-rose-950/40 text-rose-400 border border-rose-900/50 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    Action Required
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Pending Letter Requests</p>
                  <p className="text-3xl font-extrabold text-white tracking-tight">{stats.activeLetters}</p>
                </div>
              </div>

              {/* Card 4: OC Positions Filled */}
              <div className="glass-card p-5 flex flex-col justify-between hover:border-zinc-500 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-emerald-400 shadow-sm">
                    <span className="material-symbols-outlined text-xl">badge</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">OC Positions Filled</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white tracking-tight">{stats.ocFilled}</span>
                    <span className="text-sm font-semibold text-zinc-500">/ {stats.ocTarget}</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden border border-zinc-700/50">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.round((stats.ocFilled / (stats.ocTarget || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Events Card */}
            <div className="glass-card p-6 flex flex-col justify-between hover:border-zinc-500 transition-colors">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white">Upcoming Events</h3>
                  <button className="text-zinc-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xl">more_horiz</span>
                  </button>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">
                    No upcoming events scheduled.
                  </div>
                ) : (
                  <div className="space-y-3.5 my-2">
                    {upcomingEvents.map(ev => {
                      const dateBox = parseDateBox(ev.date);
                      return (
                        <div key={ev.event_id} className="flex items-center gap-3 bg-[#1e1e21] p-3 rounded-xl border border-zinc-800/60">
                          <div className="w-12 h-14 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{dateBox.month}</span>
                            <span className="text-base font-extrabold text-white leading-none">{dateBox.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate">{ev.name}</h4>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                              {ev.description ? ev.description.slice(0, 20) + "…" : "Main Auditorium"} {ev.time ? `• ${ev.time}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button 
                onClick={() => onNavigate("events")}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-medium border border-zinc-700/80 transition-colors mt-4 text-center"
              >
                View Calendar
              </button>
            </div>
          </div>

          {/* Middle Section: Recent Activities + Event Attendance Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Activities Section */}
            <div className="card">
              <div className="card-header flex justify-between items-center mb-4">
                <span className="card-title text-base font-bold text-white">Recent Activities</span>
                <button className="btn btn-ghost btn-sm text-xs" onClick={() => onNavigate("members")}>View All</button>
              </div>
              {recentActivities.length === 0 ? (
                <div className="empty-state">
                  <div className="icon"><span className="material-symbols-outlined">history</span></div>
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="table-wrap overflow-x-auto">
                  <table className="w-full text-left border-collapse" style={{ fontSize: "13px" }}>
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">User / Entity</th>
                        <th className="py-2.5 px-3">Activity</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivities.map(act => (
                        <tr key={act.id} className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {act.type === "user" ? (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-300 overflow-hidden">
                                  {act.image ? (
                                    <img src={act.image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    getInitials(act.entity)
                                  )}
                                </div>
                              ) : act.type === "event" ? (
                                <div className="w-8 h-8 rounded-full bg-amber-950/40 border border-amber-900/50 flex items-center justify-center flex-shrink-0 text-amber-400">
                                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-950/40 border border-blue-900/50 flex items-center justify-center flex-shrink-0 text-blue-400">
                                  <span className="material-symbols-outlined text-[16px]">description</span>
                                </div>
                              )}
                              <span className="font-semibold text-white truncate max-w-[140px]" title={act.entity}>
                                {act.entity}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-zinc-300 font-medium">
                            {act.activity}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              act.statusType === "completed" 
                                ? "bg-indigo-950/40 text-indigo-400 border-indigo-900/50" 
                                : act.statusType === "progress" 
                                ? "bg-amber-950/40 text-amber-400 border-amber-900/50" 
                                : "bg-rose-950/40 text-rose-400 border-rose-900/50"
                            }`}>
                              {act.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-zinc-400 text-xs whitespace-nowrap">
                            {getRelativeTime(act.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Event Attendance Section */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Event Attendance</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("events")}>View All →</button>
              </div>
              {chartData.length === 0 ? (
                <div className="empty-state"><div className="icon"><span className="material-symbols-outlined">event_busy</span></div><p>No events yet</p></div>
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
                    const lineColor    = isDark ? '#d4d4d8' : '#18181b';
                    const areaColor    = isDark ? '#d4d4d8' : '#18181b';
                    const gridColor    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
                    const labelColor   = isDark ? 'rgba(255,255,255,0.45)'  : 'rgba(0,0,0,0.45)';
                    const subColor     = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';
                    const dotFill      = isDark ? '#141417'                 : '#ffffff';
                    const dotInner     = isDark ? '#cbd5e1'                : '#3f3f46';
                    const tooltipBg    = isDark ? 'rgba(20,20,24,0.95)'    : 'rgba(250,250,250,0.97)';
                    const tooltipBorder= isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
                    const tooltipText  = isDark ? '#e5e5ea'               : '#18181b';

                    return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={areaColor} stopOpacity={isDark ? 0.12 : 0.08} />
                              <stop offset="100%" stopColor={areaColor} stopOpacity="0.01" />
                            </linearGradient>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="2.5" result="g" />
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
                          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

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

                                <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 7 : 5} fill={dotFill} stroke={lineColor} strokeWidth="1.5" style={{ transition: 'r 0.2s' }} />
                                <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 3.5 : 2.5} fill={dotInner} style={{ transition: 'r 0.2s' }} />
                                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />

                                {hoveredPoint === i && (
                                  <g>
                                    <rect x={p.x - 30} y={p.y - 30} width="60" height="20" rx="6" fill={tooltipBg} stroke={tooltipBorder} strokeWidth="1" />
                                    <text x={p.x} y={p.y - 17} fill={tooltipText} fontSize="11" textAnchor="middle" fontWeight="600" fontFamily="monospace">{p.count}</text>
                                  </g>
                                )}

                                <text x={p.x} y={PY + plotH + 16} fill={labelColor} fontSize="9" textAnchor="middle" fontFamily="sans-serif">{label}</text>
                                <text x={p.x} y={PY + plotH + 28} fill={subColor} fontSize="8" textAnchor="middle" fontFamily="monospace">{p.date}</text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Add Member", page: "members", icon: "person_add" },
                { label: "Create Event", page: "events", icon: "add_circle" },
                { label: "Take Attendance", page: "attendance", icon: "fact_check" },
                { label: "Manage Committee", page: "committee", icon: "diversity_3" },
              ].map(a => (
                <button key={a.page} className="btn btn-ghost" onClick={() => onNavigate(a.page)}>
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
