import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({ members: 0, events: 0, oc: 0, attendance: 0 });
  const [recentMembers, setRecentMembers] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, e, oc, att, rm, re] = await Promise.all([
        supabase.from("members").select("*", { count: "exact", head: true }).lte("level", 4),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("oc").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("attend", "YES"),
        supabase.from("members").select("*").lte("level", 4).order("st_id", { ascending: false }).limit(5),
        supabase.from("events").select("*").order("date", { ascending: false }).limit(5),
      ]);
      setStats({
        members: m.count || 0,
        events: e.count || 0,
        oc: oc.count || 0,
        attendance: att.count || 0,
      });
      setRecentMembers(rm.data || []);
      setRecentEvents(re.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: "Total Members", value: stats.members, sub: "registered students", cls: "" },
    { label: "Events", value: stats.events, sub: "created events", cls: "gold" },
    { label: "Committee", value: stats.oc, sub: "OC assignments", cls: "green" },
    { label: "Attendances", value: stats.attendance, sub: "YES records", cls: "red" },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">⬡</span> Dashboard</h1>
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
                <div className="empty-state"><div className="icon">◈</div><p>No members yet</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ST ID</th><th>Name</th><th>Level</th></tr></thead>
                    <tbody>
                      {recentMembers.map(m => (
                        <tr key={m.st_id}>
                          <td className="mono">{m.st_id}</td>
                          <td>{m.name}</td>
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
                <div className="empty-state"><div className="icon">◆</div><p>No events yet</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Event ID</th><th>Name</th><th>Date</th></tr></thead>
                    <tbody>
                      {recentEvents.map(e => (
                        <tr key={e.event_id}>
                          <td className="mono">{e.event_id}</td>
                          <td>{e.name}</td>
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
                { label: "＋ Add Member", page: "members" },
                { label: "＋ Create Event", page: "events" },
                { label: "✓ Take Attendance", page: "attendance" },
                { label: "◉ Manage Committee", page: "committee" },
                // { label: "⚙ DB Setup Guide", page: "setup" },
              ].map(a => (
                <button key={a.page} className="btn btn-ghost" onClick={() => onNavigate(a.page)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
