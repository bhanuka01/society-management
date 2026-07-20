import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function Dashboard({ onNavigate, isAdmin = false }) {
  const [stats, setStats] = useState({ members: 0, events: 0, oc: 0, attendance: 0, activeLetters: 0 });
  const [recentMembers, setRecentMembers] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // First, fetch the last event to scope Committee & Attendance cards
      const lastEventRes = await supabase
        .from("events")
        .select("event_id, name")
        .order("date", { ascending: false })
        .limit(1)
        .single();

      const lastEvent = lastEventRes.data; // may be null if no events

      const promises = [
        supabase.from("members").select("*", { count: "exact", head: true }).lte("level", 4),
        supabase.from("events").select("*", { count: "exact", head: true }),
        // OC count for last event only
        lastEvent
          ? supabase.from("oc").select("*", { count: "exact", head: true }).eq("event_id", lastEvent.event_id)
          : Promise.resolve({ count: 0 }),
        // Attendance YES count for last event only
        lastEvent
          ? supabase.from("attendance").select("*", { count: "exact", head: true }).eq("attend", "YES").eq("event_id", lastEvent.event_id)
          : Promise.resolve({ count: 0 }),
        supabase.from("profiles")
          .select("st_id, full_name, status, created_at, members(level)")
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase.from("events").select("*").order("date", { ascending: false }).limit(5),
      ];

      if (isAdmin) {
        promises.push(
          supabase.from("letter_requests").select("*", { count: "exact", head: true }).in("status", ["not start", "inprogress"])
        );
      }

      const results = await Promise.all(promises);
      const [m, e, oc, att, rm, re, lr] = results;

      setStats({
        members: m.count || 0,
        events: e.count || 0,
        oc: oc.count || 0,
        attendance: att.count || 0,
        activeLetters: lr ? (lr.count || 0) : 0,
        lastEventName: lastEvent ? lastEvent.name : null
      });

      const mappedMembers = [];
      if (rm.data) {
        for (const p of rm.data) {
          if (p.members && p.members.level <= 4) {
            mappedMembers.push({
              st_id: p.st_id,
              name: p.full_name,
              level: p.members.level
            });
            if (mappedMembers.length === 5) break;
          }
        }
      }

      setRecentMembers(mappedMembers);
      setRecentEvents(re.data || []);
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  const lastEvtLabel = stats.lastEventName ? stats.lastEventName : "no events";

  const statCards = [
    { label: "Total Members", value: stats.members, sub: "registered students", cls: "" },
    { label: "Events", value: stats.events, sub: "created events", cls: "gold" },
    { label: "Committee", value: stats.oc, sub: `OC assignments · ${lastEvtLabel}`, cls: "green" },
    { label: "Attendances", value: stats.attendance, sub: `YES records · ${lastEvtLabel}`, cls: "red" },
  ];

  if (isAdmin) {
    statCards.push({
      label: "Pending Letters",
      value: stats.activeLetters,
      sub: "not started & in progress",
      cls: "" // defaults to theme accent color (purple)
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">dashboard</span></span> Dashboard</h1>
        <p className="page-subtitle">society management overview</p>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stat-grid">
            {statCards.map(s => (
              <div key={s.label} className={`stat-card ${s.cls}`}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent Members</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("members")}>View All →</button>
              </div>
              {recentMembers.length === 0 ? (
                <div className="empty-state"><div className="icon"><span className="material-symbols-outlined">group_off</span></div><p>No members yet</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="table-fit table-cards">
                    <thead><tr>{isAdmin && <th>ST ID</th>}<th>Name</th><th>Level</th></tr></thead>
                    <tbody>
                      {recentMembers.map(m => (
                        <tr key={m.st_id}>
                          {isAdmin && <td className="mono col-secondary">{m.st_id}</td>}
                          <td className="col-name">{m.name}</td>
                          <td>{m.level ? <span className="badge badge-purple">Y{m.level}</span> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Upcoming Events</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("events")}>View All →</button>
              </div>
              {recentEvents.length === 0 ? (
                <div className="empty-state"><div className="icon"><span className="material-symbols-outlined">event_busy</span></div><p>No events yet</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="table-fit table-cards">
                    <thead><tr><th>Event ID</th><th>Name</th><th>Date</th></tr></thead>
                    <tbody>
                      {recentEvents.map(e => (
                        <tr key={e.event_id}>
                          <td className="mono col-secondary">{e.event_id}</td>
                          <td className="col-name">{e.name}</td>
                          <td className="mono">{e.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card mt-2" style={{marginTop: 16}}>
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Add Member", page: "members", icon: "person_add" },
                { label: "Create Event", page: "events", icon: "add_circle" },
                { label: "Take Attendance", page: "attendance", icon: "fact_check" },
                { label: "Manage Committee", page: "committee", icon: "diversity_3" },
                // { label: "⚙ DB Setup Guide", page: "setup" },
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
