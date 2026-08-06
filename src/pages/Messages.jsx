import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.3)",  icon: "⏳" },
  "in-progress": { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", icon: "🔄" },
  done:        { label: "Done",        color: "#22c55e", bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.3)",   icon: "✅" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusButtons({ status, onChangeStatus }) {
  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <button
          key={key}
          onClick={(e) => { e.stopPropagation(); onChangeStatus(key); }}
          className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border transition-all ${status === key ? "bg-opacity-100 text-white" : "bg-transparent"}`}
          style={{
            borderColor: cfg.color,
            backgroundColor: status === key ? cfg.color : "transparent",
            color: status === key ? "#ffffff" : cfg.color,
          }}
        >
          {cfg.icon} {cfg.label}
        </button>
      ))}
    </div>
  );
}

const getInitials = (name) => {
  if (!name) return "??";
  const cleanName = name.replace(/^🛡️\s*/, '').replace(/\s*\([^)]*\)$/, '').trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatSidebarTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (isYesterday) {
    return "Yesterday";
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
};

const formatDateDivider = (timestamp) => {
  if (!timestamp) return "Today";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Today";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
};

/* ─────────────────── Message Popup Detail Modal ─────────────────── */
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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#121216] border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-base text-white">
              {isMine ? "You" : msg.sender?.name || msg.sender_st_id}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {new Date(msg.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              {" • "}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-lg">✕</button>
        </div>

        <div className={`p-4 rounded-xl text-sm leading-relaxed border ${isMine ? "bg-indigo-600 text-white border-indigo-500" : "bg-[#1c1c24] text-zinc-200 border-zinc-800"}`}>
          {msg.content}
        </div>

        <div className="flex flex-col gap-1">
          <StatusBadge status={msg.status || "pending"} />
          {isReceiver && (
            <StatusButtons status={msg.status || "pending"} onChangeStatus={(s) => { onChangeStatus(msg.id, s); onClose(); }} />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            autoFocus
            type="text"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder="Type a reply..."
            className="flex-1 bg-[#1a1a22] border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Main Messages Page Component ─────────────────── */
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

  const oldestMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const msgListRef = useRef(null);
  const fetchChannelsRef = useRef(null);
  const pageRef = useRef(0);

  pageRef.current = page;

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(h);
  }, [searchQuery]);

  const fetchPendingCounts = async () => {
    if (!session.stId) return;
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

  const fetchChannels = async (pageNum, isLoadMore = false) => {
    if (!session.stId) return;
    setLoadingChannels(true);

    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender_st_id, receiver_st_id, created_at, content")
      .or(`sender_st_id.eq.${session.stId},receiver_st_id.eq.${session.stId}`)
      .order("created_at", { ascending: false });

    const lastMessageTimeMap = {};
    const lastMessageContentMap = {};
    let broadcastTime = 0;
    let broadcastSnippet = "";

    if (recentMessages) {
      for (const msg of recentMessages) {
        if (msg.receiver_st_id === null) {
          if (!broadcastTime) {
            broadcastTime = new Date(msg.created_at).getTime();
            broadcastSnippet = msg.content;
          }
        } else {
          const partnerId = msg.sender_st_id === session.stId ? msg.receiver_st_id : msg.sender_st_id;
          if (partnerId && !lastMessageTimeMap[partnerId]) {
            lastMessageTimeMap[partnerId] = new Date(msg.created_at).getTime();
            lastMessageContentMap[partnerId] = msg.content;
          }
        }
      }
    }

    let loadedChannels = [];

    if (!debouncedSearch || "📢 announcements (all)".includes(debouncedSearch.toLowerCase())) {
      loadedChannels.push({ 
        id: "broadcast", 
        name: "📢 Announcements (All)", 
        isBroadcast: true,
        lastTime: broadcastTime,
        lastSnippet: broadcastSnippet
      });
    }

    let list = [];
    if (isAdmin) {
      let query = supabase.from("members").select("st_id, name, profile_image_url");
      if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
      const { data: members, error } = await query;
      if (!error && members) {
        list = members.map(m => ({ 
          id: m.st_id, 
          name: `${m.name}`, 
          st_id: m.st_id,
          avatar: m.profile_image_url,
          isBroadcast: false,
          lastTime: lastMessageTimeMap[m.st_id] || 0,
          lastSnippet: lastMessageContentMap[m.st_id] || ""
        }));
      }
    } else {
      let query = supabase.from("profiles").select("st_id, full_name, role, members(profile_image_url)").in("role", ["admin", "editor"]).not("st_id", "is", null);
      if (debouncedSearch) query = query.ilike("full_name", `%${debouncedSearch}%`);
      const { data: staffProfiles, error } = await query;
      if (!error && staffProfiles) {
        const uniqueStaff = [];
        const seenIds = new Set();
        for (const s of staffProfiles) {
          if (!seenIds.has(s.st_id)) { 
            seenIds.add(s.st_id); 
            uniqueStaff.push(s); 
          }
        }
        list = uniqueStaff.map(s => ({ 
          id: s.st_id, 
          name: `🛡️ ${s.full_name}`, 
          roleTag: s.role,
          avatar: s.members?.profile_image_url,
          isBroadcast: false,
          lastTime: lastMessageTimeMap[s.st_id] || 0,
          lastSnippet: lastMessageContentMap[s.st_id] || ""
        }));
      }
    }

    loadedChannels = [...loadedChannels, ...list];
    loadedChannels.sort((a, b) => {
      const tA = a.id === "broadcast" ? broadcastTime : (lastMessageTimeMap[a.id] || 0);
      const tB = b.id === "broadcast" ? broadcastTime : (lastMessageTimeMap[b.id] || 0);
      if (tA !== tB) return tB - tA;
      return a.name.localeCompare(b.name);
    });

    const PAGE_SIZE = 6;
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
    const PAGE_SIZE = 6;
    const end = (nextPage + 1) * PAGE_SIZE;
    setChannels(allChannels.slice(0, end));
    setHasMore(end < allChannels.length);
  };

  const MSG_PAGE = 15;

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

  const handleLoadMoreMsgs = async () => {
    if (!oldestMsgRef.current || loadingMoreMsgs) return;
    setLoadingMoreMsgs(true);

    const { data, error } = await buildMsgQuery()
      .lt("created_at", oldestMsgRef.current)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE);

    if (!error && data && data.length > 0) {
      const older = [...data].reverse();
      oldestMsgRef.current = older[0].created_at;
      setHasMoreMsgs(data.length === MSG_PAGE);

      const listEl = msgListRef.current;
      const prevScrollHeight = listEl ? listEl.scrollHeight : 0;

      setMessages(prev => [...older, ...prev]);

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

  useEffect(() => {
    if (!selectedChannel || !session.stId) return;
    let isMounted = true;

    const loadMessages = async () => {
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

  const handleChangeStatus = async (msgId, newStatus) => {
    const { data, error } = await supabase
      .from("messages")
      .update({ status: newStatus })
      .eq("id", msgId)
      .select();

    if (error) {
      alert("Status update failed: " + error.message);
    } else {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: newStatus } : m));
      fetchPendingCounts();
    }
  };

  const activeChannelObj = channels.find(c => c.id === selectedChannel);

  if (!session.stId) {
    return (
      <div className="w-full max-w-container-max mx-auto px-6 py-20 text-center">
        <div className="glass-card p-10 max-w-md mx-auto">
          <span className="material-symbols-outlined text-4xl text-zinc-500 mb-2">lock</span>
          <p className="text-zinc-300 font-medium">You must be linked to a Student ID to use messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-container-max mx-auto px-2 sm:px-4 py-4 text-zinc-300">
      {/* ── Popup Modal ── */}
      {popupMsg && (
        <MessagePopup
          msg={popupMsg}
          session={session}
          isAdmin={isAdmin}
          onClose={() => setPopupMsg(null)}
          onReply={(text) => handleSendMessage(null, text)}
          onChangeStatus={(id, s) => { handleChangeStatus(id, s); setPopupMsg(null); }}
        />
      )}

      {/* Main Split Pane Messaging Container */}
      <div className={`flex rounded-2xl border border-zinc-800 bg-[#121216] overflow-hidden h-[calc(100vh-140px)] min-h-[500px] shadow-2xl ${mobileView === "chat" ? "mobile-view-chat" : "mobile-view-list"}`}>
        
        {/* ─── Left Sidebar: Thread List ─── */}
        <aside className={`w-full md:w-80 lg:w-84 bg-[#121216] border-r border-zinc-800 flex flex-col shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-zinc-800 shrink-0">
            <h2 className="text-lg font-bold text-white mb-3">Messages</h2>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-zinc-500 text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search chats"
                className="w-full bg-[#1a1a22] border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {channels.map(ch => {
              const pending = ch.isBroadcast ? 0 : (pendingCounts[ch.id] || 0);
              const isSelected = selectedChannel === ch.id;

              return (
                <div
                  key={ch.id}
                  onClick={() => { setSelectedChannel(ch.id); setMobileView("chat"); }}
                  className={`flex items-start gap-3 p-3.5 cursor-pointer border-l-2 transition-all ${
                    isSelected 
                      ? "bg-[#1c1c24] border-indigo-500" 
                      : "border-transparent hover:bg-[#181820]"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-10 h-10 rounded-full shrink-0 bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-xs font-bold text-zinc-200">
                    {ch.isBroadcast ? (
                      <span className="material-symbols-outlined text-amber-400 text-lg">campaign</span>
                    ) : ch.avatar ? (
                      <img src={ch.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(ch.name)
                    )}
                    {!ch.isBroadcast && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#121216] rounded-full"></div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`text-xs font-semibold truncate ${isSelected ? "text-white" : "text-zinc-200"}`}>
                        {ch.name}
                      </h3>
                      {ch.lastTime > 0 && (
                        <span className={`text-[10px] whitespace-nowrap ml-1 ${isSelected ? "text-indigo-400 font-medium" : "text-zinc-500"}`}>
                          {formatSidebarTime(ch.lastTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {ch.lastSnippet || (ch.isBroadcast ? "Public Announcements" : "Click to view conversation")}
                    </p>
                  </div>

                  {/* Pending Badge */}
                  {pending > 0 && (
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                      {pending}
                    </span>
                  )}
                </div>
              );
            })}

            {loadingChannels ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto"></div>
              </div>
            ) : hasMore && (
              <div className="p-3 text-center">
                <button
                  onClick={handleLoadMore}
                  className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Load More
                </button>
              </div>
            )}

            {!loadingChannels && channels.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No conversations found.
              </div>
            )}
          </div>
        </aside>

        {/* ─── Right Main Chat Area ─── */}
        <section className={`flex-1 flex flex-col bg-[#0c0c10] min-w-0 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {/* Chat Header */}
          <div className="h-16 px-6 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#121216]/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileView("list")}
                className="md:hidden p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-xs font-bold text-zinc-200 overflow-hidden">
                {activeChannelObj?.isBroadcast ? (
                  <span className="material-symbols-outlined text-amber-400 text-xl">campaign</span>
                ) : activeChannelObj?.avatar ? (
                  <img src={activeChannelObj.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(activeChannelObj?.name || "?")
                )}
              </div>

              <div>
                <h2 className="text-sm font-bold text-white leading-tight">
                  {activeChannelObj?.name || "Select a conversation"}
                </h2>
                <p className="text-[11px] text-emerald-400 font-medium font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  {activeChannelObj?.isBroadcast ? "Public Announcements" : (activeChannelObj?.st_id || activeChannelObj?.id || "")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-zinc-400">
              <button className="p-2 hover:bg-white/5 hover:text-white rounded-full transition-colors">
                <span className="material-symbols-outlined text-xl">call</span>
              </button>
              <button className="p-2 hover:bg-white/5 hover:text-white rounded-full transition-colors">
                <span className="material-symbols-outlined text-xl">videocam</span>
              </button>
              <button className="p-2 hover:bg-white/5 hover:text-white rounded-full transition-colors">
                <span className="material-symbols-outlined text-xl">more_vert</span>
              </button>
            </div>
          </div>

          {/* Message History Container */}
          <div ref={msgListRef} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3">
            {/* Load Older Messages Button */}
            {hasMoreMsgs && (
              <div className="text-center pb-2">
                <button
                  onClick={handleLoadMoreMsgs}
                  disabled={loadingMoreMsgs}
                  className="text-xs font-semibold px-4 py-1.5 rounded-full border border-zinc-800 bg-[#16161c] text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                >
                  {loadingMoreMsgs ? "Loading…" : "⬆ Load older messages"}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                <span className="material-symbols-outlined text-4xl mb-2 text-zinc-600">chat_bubble_outline</span>
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMine = msg.sender_st_id === session.stId;
                const isReceiver = msg.receiver_st_id === session.stId;

                const currentDateStr = new Date(msg.created_at).toDateString();
                const prevDateStr = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
                const showDateDivider = currentDateStr !== prevDateStr;

                return (
                  <div key={msg.id} className="flex flex-col gap-3">
                    {showDateDivider && (
                      <div className="text-center my-2">
                        <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-3 py-1 rounded-full border border-zinc-700/50 uppercase tracking-wider">
                          {formatDateDivider(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div className={`flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%] ${isMine ? "self-end flex-row-reverse" : "self-start"}`}>
                      {!isMine && (
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-[10px] font-bold text-zinc-300 flex-shrink-0 mb-4">
                          {getInitials(msg.sender?.name || msg.sender_st_id)}
                        </div>
                      )}

                      <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                        {/* Message Bubble */}
                        <div
                          onClick={() => setPopupMsg(msg)}
                          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed cursor-pointer transition-all border ${
                            isMine 
                              ? "bg-indigo-600 text-white border-indigo-500 rounded-br-xs shadow-md" 
                              : "bg-[#1c1c24] text-zinc-200 border-zinc-800 rounded-bl-xs hover:border-zinc-700"
                          }`}
                        >
                          <p>{msg.content}</p>
                        </div>

                        {/* Timestamp & Status */}
                        <div className={`flex items-center gap-1.5 text-[10px] text-zinc-500 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMine && (
                            <span className="material-symbols-outlined text-[14px] text-indigo-400">done_all</span>
                          )}
                          {selectedChannel !== "broadcast" && (
                            <StatusBadge status={msg.status || "pending"} />
                          )}
                        </div>

                        {/* Inline Status Toggle for Receiver */}
                        {isReceiver && selectedChannel !== "broadcast" && (
                          <StatusButtons
                            status={msg.status || "pending"}
                            onChangeStatus={(s) => handleChangeStatus(msg.id, s)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Bar */}
          <div className="p-4 bg-[#121216] border-t border-zinc-800 shrink-0">
            {(!isAdmin && selectedChannel === "broadcast") ? (
              <div className="text-center p-3 text-xs text-zinc-500 bg-[#16161c] rounded-xl border border-zinc-800">
                Only staff members can post broadcast announcements.
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-[#1a1a22] border border-zinc-800 rounded-xl p-2 focus-within:border-indigo-500 transition-colors">
                <button type="button" className="p-2 text-zinc-400 hover:text-indigo-400 transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">attach_file</span>
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none px-2"
                />
                <button type="button" className="p-2 text-zinc-400 hover:text-indigo-400 transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">mood</span>
                </button>
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-40 flex-shrink-0 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
