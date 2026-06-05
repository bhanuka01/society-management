import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";

export default function Attendance({ isAdmin = false, session = { role: "guest", stId: "" } }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [attendanceCounts, setAttendanceCounts] = useState({ yes: 0, no: 0 });
  const [myPage, setMyPage] = useState(0);
  const [myTotal, setMyTotal] = useState(0);
  const [myCounts, setMyCounts] = useState({ yes: 0, no: 0 });

  useEffect(() => {
    supabase.from("events").select("*").order("date", { ascending: false })
      .then(({ data }) => {
        setEvents(data || []);
        if (data?.length) setSelectedEvent(data[0].event_id);
      });
  }, []);

  useEffect(() => {
    if (session.role !== "member" || !session.stId) {
      setMyAttendance([]);
      setMyTotal(0);
      setMyCounts({ yes: 0, no: 0 });
      return;
    }

    const from = myPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    Promise.all([
      supabase.from("attendance")
        .select("st_id, event_id, attend, events(name, date)", { count: "exact" })
        .eq("st_id", session.stId)
        .order("event_id")
        .range(from, to),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "YES"),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("st_id", session.stId).eq("attend", "NO"),
    ]).then(([records, yes, no]) => {
        setMyAttendance(records.data || []);
        setMyTotal(records.count || 0);
        setMyCounts({ yes: yes.count || 0, no: no.count || 0 });
      });
  }, [session.role, session.stId, myPage]);

  useEffect(() => {
    if (!selectedEvent) {
      setAttendance([]);
      setTotal(0);
      setAttendanceCounts({ yes: 0, no: 0 });
      return;
    }
    setLoading(true);
    setMsg(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from("attendance")
      .select("st_id, attend, members(name, level)", { count: "exact" })
      .eq("event_id", selectedEvent)
      .order("st_id")
      .range(from, to);

    const q = search.trim();
    if (q) {
      query = query.or(`st_id.ilike.%${q}%,attend.ilike.%${q}%`);
    }

    Promise.all([
      query,
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "YES"),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("event_id", selectedEvent).eq("attend", "NO"),
    ]).then(([records, yes, no]) => {
        if (records.error) setMsg({ type: "error", text: records.error.message });
        else setAttendance(records.data || []);
        setTotal(records.count || 0);
        setAttendanceCounts({ yes: yes.count || 0, no: no.count || 0 });
        setLoading(false);
      });
  }, [selectedEvent, page, search]);

  const toggle = async (stId, currentVal) => {
    if (!isAdmin) return;
    const newVal = currentVal === "YES" ? "NO" : "YES";
    setSaving(s => ({ ...s, [stId]: true }));
    const { error } = await supabase.from("attendance")
      .update({ attend: newVal })
      .eq("st_id", stId)
      .eq("event_id", selectedEvent);
    if (!error) {
      setAttendance(prev => prev.map(a => a.st_id === stId ? { ...a, attend: newVal } : a));
      setMyAttendance(prev => prev.map(a => a.st_id === stId && a.event_id === selectedEvent ? { ...a, attend: newVal } : a));
      setAttendanceCounts(prev => ({
        yes: prev.yes + (newVal === "YES" ? 1 : -1),
        no: prev.no + (newVal === "NO" ? 1 : -1),
      }));
    }
    setSaving(s => ({ ...s, [stId]: false }));
  };

  const markAll = async (val) => {
    if (!isAdmin || !selectedEvent) return;
    setSaving({ _all: true });
    await supabase.from("attendance").update({ attend: val }).eq("event_id", selectedEvent);
    setAttendance(prev => prev.map(a => ({ ...a, attend: val })));
    setAttendanceCounts({ yes: val === "YES" ? total : 0, no: val === "NO" ? total : 0 });
    setSaving({});
    setMsg({ type: "success", text: `Marked all as ${val}.` });
    setTimeout(() => setMsg(null), 2000);
  };

  const addMemberToEvent = async () => {
    if (!isAdmin) return;
    const stId = prompt("Enter ST ID of member to add:");
    if (!stId) return;
    const { error } = await supabase.from("attendance").insert([{ st_id: stId.trim(), event_id: selectedEvent, attend: "NO" }]);
    if (error) alert(error.message);
    else {
      const { data, count } = await supabase.from("attendance")
        .select("st_id, attend, members(name, level)", { count: "exact" })
        .eq("event_id", selectedEvent)
        .order("st_id")
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      setAttendance(data || []);
      setTotal(count || 0);
    }
  };

  const yesCount = attendanceCounts.yes;
  const noCount = attendanceCounts.no;
  const pct = total ? Math.round((yesCount / total) * 100) : 0;
  const myYesCount = myCounts.yes;
  const myPct = myTotal ? Math.round((myYesCount / myTotal) * 100) : 0;

  const selectedEventInfo = events.find(e => e.event_id === selectedEvent);
  const visibleAttendance = viewMode === "mine"
    ? attendance.filter(a => a.st_id === session.stId)
    : attendance;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">*</span> Attendance</h1>
        <p className="page-subtitle">{isAdmin ? "mark and track event attendance" : "watch attendance records without editing"}</p>
      </div>

      {session.role === "member" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">My Attendance</span>
            <span className="badge badge-purple">{session.stId}</span>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
            <div className="stat-card green">
              <div className="stat-label">Present</div>
              <div className="stat-value">{myYesCount}</div>
              <div className="stat-sub">events attended</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Absent</div>
              <div className="stat-value">{myTotal - myYesCount}</div>
              <div className="stat-sub">events missed</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">Rate</div>
              <div className="stat-value">{myPct}%</div>
              <div className="stat-sub">of {myTotal} events</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {myAttendance.length === 0 ? (
                  <tr><td colSpan="3"><div className="empty-state"><div className="icon">*</div><p>No attendance records for your ST ID yet</p></div></td></tr>
                ) : myAttendance.map(a => (
                  <tr key={`${a.st_id}-${a.event_id}`}>
                    <td><strong>{a.events?.name || a.event_id}</strong></td>
                    <td className="mono">{a.events?.date || "-"}</td>
                    <td><span className={`badge ${a.attend === "YES" ? "badge-green" : "badge-red"}`}>{a.attend}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={myPage} total={myTotal} loading={false} onPageChange={setMyPage} />
          </div>
        </div>
      )}

      {session.role !== "member" && (
        events.length === 0 ? (
          <div className="card"><div className="empty-state"><div className="icon">*</div><p>Create an event first, then seed attendance.</p></div></div>
        ) : (
          <>
            <div className="card mb-3" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Event Attendance</span>
                {selectedEventInfo && <span className="badge badge-gray">{selectedEventInfo.date}</span>}
              </div>
              <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <select value={selectedEvent} onChange={e => { setPage(0); setSelectedEvent(e.target.value); }} style={{ flex: 1, minWidth: 200 }}>
                  {events.map(e => (
                    <option key={e.event_id} value={e.event_id}>{e.name} - {e.date} ({e.event_id})</option>
                  ))}
                </select>
                {isAdmin && <button className="btn btn-ghost btn-sm" onClick={addMemberToEvent}>+ Add Member</button>}
              </div>
            </div>

            {total > 0 && (
              <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
                <div className="stat-card green">
                  <div className="stat-label">Present</div>
                  <div className="stat-value">{yesCount}</div>
                  <div className="stat-sub">marked YES</div>
                </div>
                <div className="stat-card red">
                  <div className="stat-label">Absent</div>
                  <div className="stat-value">{noCount}</div>
                  <div className="stat-sub">marked NO</div>
                </div>
                <div className="stat-card gold">
                  <div className="stat-label">Attendance Rate</div>
                  <div className="stat-value">{pct}%</div>
                  <div className="stat-sub">of {total} members</div>
                </div>
              </div>
            )}

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="toolbar">
              <div className="search-input-wrap">
                <span className="search-icon">?</span>
                <input placeholder="Search by ID or status..." value={search} onChange={e => { setPage(0); setSearch(e.target.value); }} />
              </div>
              {isAdmin && (
                <>
                  <button className="btn btn-success btn-sm" onClick={() => markAll("YES")} disabled={saving._all}>All Present</button>
                  <button className="btn btn-danger btn-sm" onClick={() => markAll("NO")} disabled={saving._all}>All Absent</button>
                </>
              )}
            </div>

            {loading ? (
              <div className="loader"><div className="spinner" /></div>
            ) : total === 0 ? (
              <div className="card"><div className="empty-state"><div className="icon">*</div><p>No attendance records. Use "Seed Att." on the Events page first.</p></div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ST ID</th><th>Name</th><th>Level</th><th>Status</th>{isAdmin && <th>Toggle</th>}</tr>
                  </thead>
                  <tbody>
                    {visibleAttendance.map(a => (
                      <tr key={a.st_id}>
                        <td className="mono">{a.st_id}</td>
                        <td><strong>{a.members?.name || "-"}</strong></td>
                        <td>{a.members?.level ? <span className="badge badge-purple">Y{a.members.level}</span> : "-"}</td>
                        <td>
                          <span className={`badge ${a.attend === "YES" ? "badge-green" : "badge-red"}`}>
                            {a.attend}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              className={`btn btn-sm ${a.attend === "YES" ? "btn-danger" : "btn-success"}`}
                              onClick={() => toggle(a.st_id, a.attend)}
                              disabled={saving[a.st_id]}
                            >
                              {saving[a.st_id] ? "..." : a.attend === "YES" ? "Mark Absent" : "Mark Present"}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={page} total={total} loading={loading} onPageChange={setPage} />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
