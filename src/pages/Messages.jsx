import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  icon: "⏳" },
  "in-progress": { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.15)", icon: "🔄" },
  done:        { label: "Done",        color: "#22c55e", bg: "rgba(34,197,94,0.15)",   icon: "✅" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontSize: "10px",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: "99px",
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}44`,
      letterSpacing: "0.3px",
      whiteSpace: "nowrap"
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusButtons({ status, onChangeStatus }) {
  return (
    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <button
          key={key}
          onClick={(e) => { e.stopPropagation(); onChangeStatus(key); }}
          style={{
            fontSize: "10px",
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "99px",
            border: `1px solid ${cfg.color}`,
            background: status === key ? cfg.color : "transparent",
            color: status === key ? "#fff" : cfg.color,
            cursor: "pointer",
            transition: "all 0.18s",
          }}
        >
          {cfg.icon} {cfg.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────── Message Popup Modal ─────────────────── */
function MessagePopup({ msg, session, isAdmin, onClose, onReply, onChangeStatus }) {
  const [replyText, setReplyText] = useState("");
  const isReceiver = msg.receiver_st_id === session.stId;
  const isMine = msg.sender_st_id === session.stId;

  const handleSend = () => {
    if (!replyText.trim()) return;
    onReply(replyText.trim());
    setReplyText("");
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px",
          width: "min(480px, 92vw)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column", gap: "14px"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
              {isMine ? "You" : msg.sender?.name || msg.sender_st_id}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
              {new Date(msg.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
              {" · "}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "20px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Message bubble */}
        <div style={{
          padding: "12px 16px",
          borderRadius: "12px",
          background: isMine ? "var(--primary)" : "var(--bg)",
          color: isMine ? "#fff" : "var(--text)",
          border: isMine ? "none" : "1px solid var(--border)",
          lineHeight: "1.5",
          wordBreak: "break-word"
        }}>
          {msg.content}
        </div>

        {/* Status row */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <StatusBadge status={msg.status || "pending"} />
          {/* Only receiver can change status */}
          {isReceiver && (
            <StatusButtons status={msg.status || "pending"} onChangeStatus={(s) => { onChangeStatus(msg.id, s); onClose(); }} />
          )}
        </div>

        {/* Reply input – always show so conversation flows both ways */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <input
            autoFocus
            type="text"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder="Type a reply..."
            style={{
              flex: 1, padding: "9px 14px", borderRadius: "20px",
              border: "1px solid var(--border)", background: "var(--bg)",
              color: "var(--text)", fontSize: "13px"
            }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            className="btn btn-primary"
            style={{ borderRadius: "20px", padding: "0 18px", fontSize: "13px" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Main Component ─────────────────── */
export default function Messages({ isAdmin, session }) {
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [allChannels, setAllChannels] = useState([]);
  const [popupMsg, setPopupMsg] = useState(null);
  const [pendingCounts, setPendingCounts] = useState({});
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [loadingMoreMsgs, setLoadingMoreMsgs] = useState(false);
  // oldest created_at we have loaded — used as cursor for "load more"
  const oldestMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const msgListRef = useRef(null);
  const fetchChannelsRef = useRef(null);
  const pageRef = useRef(0);

  pageRef.current = page;

  /* ── Debounce search ── */
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(h);
  }, [searchQuery]);

  /* ── Fetch pending counts for sidebar ── */
  const fetchPendingCounts = async () => {
    if (!session.stId) return;
    // messages where I am the receiver and status is pending
    const { data } = await supabase
      .from("messages")
      .select("sender_st_id, receiver_st_id, status")
      .eq("receiver_st_id", session.stId)
      .eq("status", "pending");

    if (!data) return;
    const counts = {};
    for (const msg of data) {
      const key = msg.sender_st_id;
      counts[key] = (counts[key] || 0) + 1;
    }
    setPendingCounts(counts);
  };

  /* ── Fetch channels/sidebar ── */
  const fetchChannels = async (pageNum, isLoadMore = false) => {
    if (!session.stId) return;
    setLoadingChannels(true);

    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender_st_id, receiver_st_id, created_at")
      .or(`sender_st_id.eq.${session.stId},receiver_st_id.eq.${session.stId}`)
      .order("created_at", { ascending: false });

    const lastMessageTimeMap = {};
    let broadcastTime = 0;
    if (recentMessages) {
      for (const msg of recentMessages) {
        if (msg.receiver_st_id === null) {
          if (!broadcastTime) broadcastTime = new Date(msg.created_at).getTime();
        } else {
          const partnerId = msg.sender_st_id === session.stId ? msg.receiver_st_id : msg.sender_st_id;
          if (partnerId && !lastMessageTimeMap[partnerId]) {
            lastMessageTimeMap[partnerId] = new Date(msg.created_at).getTime();
          }
        }
      }
    }

    let loadedChannels = [];

    if (!debouncedSearch || "📢 announcements (all)".includes(debouncedSearch.toLowerCase())) {
      loadedChannels.push({ id: "broadcast", name: "📢 Announcements (All)", isBroadcast: true });
    }

    let list = [];
    if (isAdmin) {
      let query = supabase.from("members").select("st_id, name");
      if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
      const { data: members, error } = await query;
      if (!error && members) {
        list = members.map(m => ({ id: m.st_id, name: `${m.name} (${m.st_id})`, isBroadcast: false }));
      }
    } else {
      let query = supabase.from("profiles").select("st_id, full_name, role").in("role", ["admin", "editor"]).not("st_id", "is", null);
      if (debouncedSearch) query = query.ilike("full_name", `%${debouncedSearch}%`);
      const { data: staffProfiles, error } = await query;
      if (!error && staffProfiles) {
        const uniqueStaff = [];
        const seenIds = new Set();
        for (const s of staffProfiles) {
          if (!seenIds.has(s.st_id)) { seenIds.add(s.st_id); uniqueStaff.push(s); }
        }
        list = uniqueStaff.map(s => ({ id: s.st_id, name: `🛡️ ${s.full_name} (${s.role})`, isBroadcast: false }));
      }
    }

    loadedChannels = [...loadedChannels, ...list];
    loadedChannels.sort((a, b) => {
      const tA = a.id === "broadcast" ? broadcastTime : (lastMessageTimeMap[a.id] || 0);
      const tB = b.id === "broadcast" ? broadcastTime : (lastMessageTimeMap[b.id] || 0);
      if (tA !== tB) return tB - tA;
      return a.name.localeCompare(b.name);
    });

    const PAGE_SIZE = 5;
    const end = (pageNum + 1) * PAGE_SIZE;
    setAllChannels(loadedChannels);
    setChannels(loadedChannels.slice(0, end));
    setHasMore(end < loadedChannels.length);

    if (pageNum === 0 && !selectedChannel && loadedChannels.length > 0) {
      setSelectedChannel(loadedChannels[0].id);
    }
    setLoadingChannels(false);
  };

  fetchChannelsRef.current = fetchChannels;

  useEffect(() => {
    if (session.stId) {
      setPage(0);
      fetchChannels(0, false);
      fetchPendingCounts();
    }
  }, [isAdmin, session.stId, debouncedSearch]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    const PAGE_SIZE = 5;
    const end = (nextPage + 1) * PAGE_SIZE;
    setChannels(allChannels.slice(0, end));
    setHasMore(end < allChannels.length);
  };

  const MSG_PAGE = 10;

  /* ── Build base query for a conversation ── */
  const buildMsgQuery = () => {
    let q = supabase
      .from("messages")
      .select(`id, content, created_at, sender_st_id, receiver_st_id, status, sender:sender_st_id (name)`);

    if (selectedChannel === "broadcast") {
      q = q.is("receiver_st_id", null);
    } else {
      q = q.or(
        `and(sender_st_id.eq.${session.stId},receiver_st_id.eq.${selectedChannel}),` +
        `and(sender_st_id.eq.${selectedChannel},receiver_st_id.eq.${session.stId})`
      );
    }
    return q;
  };

  /* ── Load older messages ("Load 10 more") ── */
  const handleLoadMoreMsgs = async () => {
    if (!oldestMsgRef.current || loadingMoreMsgs) return;
    setLoadingMoreMsgs(true);

    const { data, error } = await buildMsgQuery()
      .lt("created_at", oldestMsgRef.current)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE);

    if (!error && data && data.length > 0) {
      const older = [...data].reverse(); // put back in ascending order
      oldestMsgRef.current = older[0].created_at;
      setHasMoreMsgs(data.length === MSG_PAGE);

      // Preserve scroll position when prepending older messages
      const listEl = msgListRef.current;
      const prevScrollHeight = listEl ? listEl.scrollHeight : 0;

      setMessages(prev => [...older, ...prev]);

      // After render, restore scroll so the user stays at the same spot
      requestAnimationFrame(() => {
        if (listEl) {
          listEl.scrollTop = listEl.scrollHeight - prevScrollHeight;
        }
      });
    } else {
      setHasMoreMsgs(false);
    }
    setLoadingMoreMsgs(false);
  };

  /* ── Load messages & realtime ── */
  useEffect(() => {
    if (!selectedChannel || !session.stId) return;
    let isMounted = true;

    const loadMessages = async () => {
      // Fetch the LAST MSG_PAGE messages (most recent)
      const { data, error } = await buildMsgQuery()
        .order("created_at", { ascending: false })
        .limit(MSG_PAGE);

      if (!error && isMounted) {
        const msgs = data ? [...data].reverse() : [];
        setMessages(msgs);
        oldestMsgRef.current = msgs.length > 0 ? msgs[0].created_at : null;
        setHasMoreMsgs(data?.length === MSG_PAGE);
        scrollToBottom();
      }
    };

    loadMessages();

    const channelName = `messages-${selectedChannel}-${session.stId}`;
    const subscription = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const newMsg = payload.new;
        let belongs = false;
        if (selectedChannel === "broadcast" && newMsg.receiver_st_id === null) belongs = true;
        else if (
          selectedChannel !== "broadcast" &&
          ((newMsg.sender_st_id === session.stId && newMsg.receiver_st_id === selectedChannel) ||
           (newMsg.sender_st_id === selectedChannel && newMsg.receiver_st_id === session.stId))
        ) belongs = true;

        if (belongs) {
          supabase.from("members").select("name").eq("st_id", newMsg.sender_st_id).maybeSingle().then(({ data }) => {
            if (isMounted) {
              setMessages(prev => [...prev, { ...newMsg, sender: data || { name: newMsg.sender_st_id } }]);
              scrollToBottom();
            }
          });
        }

        if (newMsg.sender_st_id === session.stId || newMsg.receiver_st_id === session.stId || newMsg.receiver_st_id === null) {
          fetchChannelsRef.current?.(pageRef.current, false);
          fetchPendingCounts();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, payload => {
        const updated = payload.new;
        if (isMounted) {
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m));
          fetchPendingCounts();
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [selectedChannel, session.stId]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  /* ── Send message ── */
  const handleSendMessage = async (e, overrideText) => {
    if (e) e.preventDefault();
    const text = overrideText ?? newMessage;
    if (!text.trim() || !session.stId) return;
    if (!isAdmin && selectedChannel === "broadcast") {
      alert("Only staff can send broadcast messages.");
      return;
    }

    const payload = {
      sender_st_id: session.stId,
      receiver_st_id: selectedChannel === "broadcast" ? null : selectedChannel,
      content: text.trim(),
      status: "pending",
    };

    if (!overrideText) setNewMessage("");

    const { error } = await supabase.from("messages").insert([payload]);
    if (error) alert("Failed to send message: " + error.message);
    else {
      fetchChannels(page, false);
      fetchPendingCounts();
    }
  };

  /* ── Change message status ── */
  const handleChangeStatus = async (msgId, newStatus) => {
    console.log("[status] updating msg", msgId, "→", newStatus);
    const { data, error } = await supabase
      .from("messages")
      .update({ status: newStatus })
      .eq("id", msgId)
      .select();          // force PostgREST to return the updated row

    console.log("[status] result:", data, error);

    if (error) {
      alert("Status update failed:\n" + error.message + "\n\nCheck browser console for details.");
      console.error("[status] full error:", error);
    } else {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: newStatus } : m));
      fetchPendingCounts();
    }
  };

  if (!session.stId) {
    return (
      <div className="empty-state">
        <p>You must be linked to a Student ID to use messaging.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Popup Modal ── */}
      {popupMsg && (
        <MessagePopup
          msg={popupMsg}
          session={session}
          isAdmin={isAdmin}
          onClose={() => setPopupMsg(null)}
          onReply={(text) => {
            // reply goes to the conversation partner
            handleSendMessage(null, text);
          }}
          onChangeStatus={(id, s) => { handleChangeStatus(id, s); setPopupMsg(null); }}
        />
      )}

      <div
        className={`messages-layout mobile-view-${mobileView}`}
        style={{ display: "flex", height: "calc(100vh - 120px)", gap: "20px" }}
      >
        {/* ─── Sidebar ─── */}
        <div className="messages-sidebar" style={{
          width: "300px",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderRadius: "var(--r)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", fontWeight: "bold" }}>
            Conversations
          </div>
          <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  borderRadius: "20px",
                  border: "1px solid var(--border)",
                  background: "var(--bg3)",
                  color: "var(--text)"
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
            {channels.map(ch => {
              const pending = ch.isBroadcast ? 0 : (pendingCounts[ch.id] || 0);
              return (
                <div
                  key={ch.id}
                  onClick={() => { setSelectedChannel(ch.id); setMobileView("chat"); }}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: selectedChannel === ch.id ? "var(--bg)" : "transparent",
                    borderLeft: selectedChannel === ch.id ? "3px solid var(--primary)" : "3px solid transparent",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ fontWeight: selectedChannel === ch.id ? 600 : 400, color: selectedChannel === ch.id ? "var(--text)" : "var(--text2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ch.name}
                  </div>
                  {pending > 0 && (
                    <span style={{
                      marginLeft: "8px",
                      minWidth: "20px",
                      height: "20px",
                      borderRadius: "99px",
                      background: "#f59e0b",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 5px",
                      flexShrink: 0
                    }}>
                      {pending}
                    </span>
                  )}
                </div>
              );
            })}

            {loadingChannels ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : (
              hasMore && (
                <div style={{ padding: "12px", textAlign: "center" }}>
                  <button
                    onClick={handleLoadMore}
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center", borderRadius: "16px", fontSize: "12px" }}
                  >
                    Load More
                  </button>
                </div>
              )
            )}

            {!loadingChannels && channels.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
                No conversations found.
              </div>
            )}
          </div>
        </div>

        {/* ─── Chat Area ─── */}
        <div className="messages-chat" style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderRadius: "var(--r)",
          border: "1px solid var(--border)",
          overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", fontWeight: "bold", background: "var(--bg)", display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              className="btn btn-ghost btn-sm messages-back-btn"
              onClick={() => setMobileView("list")}
              style={{ padding: "4px 8px", display: "none", alignItems: "center", gap: "4px", cursor: "pointer" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
              Back
            </button>
            <span>{channels.find(c => c.id === selectedChannel)?.name || "Select a conversation"}</span>
          </div>

          {/* Messages */}
          <div ref={msgListRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* ── Load older messages button ── */}
            {hasMoreMsgs && (
              <div style={{ textAlign: "center", paddingBottom: "8px" }}>
                <button
                  onClick={handleLoadMoreMsgs}
                  disabled={loadingMoreMsgs}
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "5px 18px",
                    borderRadius: "99px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text2)",
                    cursor: loadingMoreMsgs ? "not-allowed" : "pointer",
                    opacity: loadingMoreMsgs ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {loadingMoreMsgs ? "Loading…" : "⬆ Load 10 more"}
                </button>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="empty-state" style={{ margin: "auto" }}>
                <p className="text-muted">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_st_id === session.stId;
                // Receiver is the one who can change status
                const isReceiver = msg.receiver_st_id === session.stId;

                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMine ? "flex-end" : "flex-start",
                      maxWidth: "70%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {/* Sender / timestamp */}
                    <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "4px" }}>
                      {isMine ? "You" : msg.sender?.name || msg.sender_st_id}
                      {" • "}
                      {new Date(msg.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      {" • "}
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>

                    {/* Bubble — click to open popup */}
                    <div
                      onClick={() => setPopupMsg(msg)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "16px",
                        borderBottomRightRadius: isMine ? "4px" : "16px",
                        borderBottomLeftRadius: !isMine ? "4px" : "16px",
                        background: isMine ? "var(--primary)" : "var(--bg)",
                        color: isMine ? "white" : "var(--text)",
                        border: isMine ? "none" : "1px solid var(--border)",
                        lineHeight: "1.4",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >
                      {msg.content}
                    </div>

                    {/* Status — below the bubble */}
                    {selectedChannel !== "broadcast" && (
                      <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: "4px" }}>
                        <StatusBadge status={msg.status || "pending"} />
                        {/* Only the receiver can change status inline */}
                        {isReceiver && (
                          <StatusButtons
                            status={msg.status || "pending"}
                            onChangeStatus={(s) => handleChangeStatus(msg.id, s)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {(!isAdmin && selectedChannel === "broadcast") ? (
            <div style={{ padding: "16px", borderTop: "1px solid var(--border)", background: "var(--bg)", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
              Only staff can post announcements.
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", background: "var(--bg)" }}
            >
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ borderRadius: "20px", padding: "0 24px" }}
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
