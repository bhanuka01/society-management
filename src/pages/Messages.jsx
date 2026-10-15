import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  Search,
  Send,
  Radio,
  Shield,
  User,
  Clock,
  Check,
  CheckCheck,
  Copy,
  RefreshCw,
  X,
  ArrowLeft,
  Filter,
  MessageSquare,
  AlertCircle,
  Sparkles,
  ChevronRight
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Linear Design Tokens & Status Configurations
───────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.25)",
  },
  "in-progress": {
    label: "In Progress",
    icon: RefreshCw,
    color: "#818cf8",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.25)",
  },
  done: {
    label: "Resolved",
    icon: Check,
    color: "#27a644",
    bg: "rgba(39, 166, 68, 0.08)",
    border: "rgba(39, 166, 68, 0.25)",
  },
};

function StatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isMini = size === "xs";

  return (
    <span
      className={`inline-flex items-center gap-1 font-berkeley-mono uppercase tracking-wider rounded-[4px] border ${
        isMini ? "text-[9px] px-1.5 py-0.2" : "text-[10px] px-2 py-0.5"
      }`}
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <Icon className={isMini ? "w-2.5 h-2.5" : "w-3 h-3"} />
      <span>{cfg.label}</span>
    </span>
  );
}

function StatusButtons({ status, onChangeStatus, compact = false }) {
  return (
    <div className={`flex items-center gap-1 ${compact ? "flex-wrap" : "mt-1.5 flex-wrap"}`}>
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
        const Icon = cfg.icon;
        const active = status === key;
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeStatus(key);
            }}
            className={`font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] border transition-all flex items-center gap-1 ${
              active
                ? "bg-[#23252a] text-white border-[#383b3f] shadow-sm"
                : "bg-[#08090a] text-[#8a8f98] border-[#23252a] hover:border-[#383b3f] hover:text-[#d0d6e0]"
            }`}
          >
            <Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const getInitials = (name) => {
  if (!name) return "??";
  const cleanName = name
    .replace(/^🛡️\s*/, "")
    .replace(/\s*\([^)]*\)$/, "")
    .trim();
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
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Linear Message Detail & Status Resolution Modal
───────────────────────────────────────────────────────────────────────────── */
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
      className="fixed inset-0 z-50 bg-[#08090a]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1011] border border-[#23252a] rounded-[12px] p-5 w-full max-w-md shadow-2xl space-y-4 font-inter-variable text-[#d0d6e0]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b border-[#23252a] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-[510] text-[15px] text-[#ffffff]">
                {isMine ? "You" : msg.sender?.name || msg.sender_st_id}
              </span>
              {msg.sender_st_id && (
                <span className="font-berkeley-mono text-[11px] text-[#8a8f98] bg-[#161718] border border-[#23252a] px-1.5 py-0.5 rounded-[4px]">
                  {msg.sender_st_id}
                </span>
              )}
            </div>
            <div className="font-berkeley-mono text-[11px] text-[#62666d] mt-1">
              {new Date(msg.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a8f98] hover:text-white p-1 rounded-[4px] hover:bg-[#161718] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Content */}
        <div className="p-3.5 rounded-[8px] text-[13.5px] leading-relaxed bg-[#161718] border border-[#23252a] text-[#ffffff] whitespace-pre-wrap font-sans">
          {msg.content}
        </div>

        {/* Status Control */}
        <div className="p-3 rounded-[6px] bg-[#08090a] border border-[#23252a] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-berkeley-mono text-[#8a8f98] uppercase tracking-wider">
              Query Resolution
            </span>
            <StatusBadge status={msg.status || "pending"} />
          </div>
          {(isReceiver || isAdmin) && (
            <div className="pt-1">
              <span className="text-[11px] text-[#8a8f98] block mb-1">Update Status:</span>
              <StatusButtons
                status={msg.status || "pending"}
                onChangeStatus={(s) => {
                  onChangeStatus(msg.id, s);
                  onClose();
                }}
              />
            </div>
          )}
        </div>

        {/* Reply Composer */}
        <div className="flex gap-2 pt-1">
          <input
            autoFocus
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Type a follow-up reply..."
            className="flex-1 bg-[#161718] border border-[#23252a] rounded-[6px] px-3 py-2 text-[13px] text-white placeholder-[#62666d] focus:outline-none focus:border-[#d0d6e0] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            className="bg-[#e4f222] hover:brightness-105 text-[#08090a] font-[510] rounded-[6px] px-3.5 py-2 text-[12px] transition-all disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Messages Component — Linear Midnight Precision Style
───────────────────────────────────────────────────────────────────────────── */
export default function Messages({ isAdmin, session }) {
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'broadcast' | 'staff' | 'members' | 'pending'
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
  const [copiedStId, setCopiedStId] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [msgStatusFilter, setMsgStatusFilter] = useState("all"); // 'all' | 'pending' | 'done'

  const oldestMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const msgListRef = useRef(null);
  const fetchChannelsRef = useRef(null);
  const pageRef = useRef(0);

  pageRef.current = page;

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 250);
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

    // 1. Broadcast Channel (always present)
    if (!debouncedSearch || "📢 society announcements (all)".includes(debouncedSearch.toLowerCase())) {
      loadedChannels.push({
        id: "broadcast",
        name: "Society Announcements",
        type: "broadcast",
        isBroadcast: true,
        lastTime: broadcastTime,
        lastSnippet: broadcastSnippet,
      });
    }

    // 2. Members or Staff Channels
    let list = [];
    if (isAdmin) {
      // Staff/Admin sees society members
      let query = supabase.from("members").select("st_id, name, profile_image_url");
      if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
      const { data: members, error } = await query;
      if (!error && members) {
        list = members.map((m) => ({
          id: m.st_id,
          name: m.name,
          st_id: m.st_id,
          type: "member",
          avatar: m.profile_image_url,
          isBroadcast: false,
          lastTime: lastMessageTimeMap[m.st_id] || 0,
          lastSnippet: lastMessageContentMap[m.st_id] || "",
        }));
      }
    } else {
      // Member sees Committee / Staff
      let query = supabase
        .from("profiles")
        .select("st_id, full_name, role, members(profile_image_url)")
        .in("role", ["admin", "editor"])
        .not("st_id", "is", null);

      if (debouncedSearch) query = query.ilike("full_name", `%${debouncedSearch}%`);
      const { data: staffProfiles, error } = await query;
      if (!error && staffProfiles) {
        const seenIds = new Set();
        const uniqueStaff = [];
        for (const s of staffProfiles) {
          if (!seenIds.has(s.st_id)) {
            seenIds.add(s.st_id);
            uniqueStaff.push(s);
          }
        }
        list = uniqueStaff.map((s) => ({
          id: s.st_id,
          name: s.full_name,
          st_id: s.st_id,
          roleTag: s.role,
          type: "staff",
          avatar: s.members?.profile_image_url,
          isBroadcast: false,
          lastTime: lastMessageTimeMap[s.st_id] || 0,
          lastSnippet: lastMessageContentMap[s.st_id] || "",
        }));
      }
    }

    loadedChannels = [...loadedChannels, ...list];
    loadedChannels.sort((a, b) => {
      const tA = a.id === "broadcast" ? broadcastTime : lastMessageTimeMap[a.id] || 0;
      const tB = b.id === "broadcast" ? broadcastTime : lastMessageTimeMap[b.id] || 0;
      if (tA !== tB) return tB - tA;
      return a.name.localeCompare(b.name);
    });

    const PAGE_SIZE = 12;
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
    const PAGE_SIZE = 12;
    const end = (nextPage + 1) * PAGE_SIZE;
    setChannels(allChannels.slice(0, end));
    setHasMore(end < allChannels.length);
  };

  const MSG_PAGE = 25;

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

      setMessages((prev) => [...older, ...prev]);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new;
        let belongs = false;
        if (selectedChannel === "broadcast" && newMsg.receiver_st_id === null) belongs = true;
        else if (
          selectedChannel !== "broadcast" &&
          ((newMsg.sender_st_id === session.stId && newMsg.receiver_st_id === selectedChannel) ||
            (newMsg.sender_st_id === selectedChannel && newMsg.receiver_st_id === session.stId))
        )
          belongs = true;

        if (belongs) {
          supabase
            .from("members")
            .select("name")
            .eq("st_id", newMsg.sender_st_id)
            .maybeSingle()
            .then(({ data }) => {
              if (isMounted) {
                setMessages((prev) => [...prev, { ...newMsg, sender: data || { name: newMsg.sender_st_id } }]);
                scrollToBottom();
              }
            });
        }

        if (
          newMsg.sender_st_id === session.stId ||
          newMsg.receiver_st_id === session.stId ||
          newMsg.receiver_st_id === null
        ) {
          fetchChannelsRef.current?.(pageRef.current, false);
          fetchPendingCounts();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new;
        if (isMounted) {
          setMessages((prev) => (prev.map((m) => (m.id === updated.id ? { ...m, status: updated.status } : m))));
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
      alert("Only society staff can broadcast announcements.");
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
    if (error) {
      alert("Failed to send message: " + error.message);
    } else {
      fetchChannels(page, false);
      fetchPendingCounts();
    }
  };

  const handleChangeStatus = async (msgId, newStatus) => {
    const { error } = await supabase.from("messages").update({ status: newStatus }).eq("id", msgId);

    if (error) {
      alert("Status update failed: " + error.message);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: newStatus } : m)));
      fetchPendingCounts();
    }
  };

  const handleCopyStId = (stId) => {
    if (!stId) return;
    navigator.clipboard.writeText(stId);
    setCopiedStId(true);
    setTimeout(() => setCopiedStId(false), 1800);
  };

  const activeChannelObj = allChannels.find((c) => c.id === selectedChannel);

  // Filter channels according to category tabs
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (activeTab === "broadcast") return ch.isBroadcast;
      if (activeTab === "staff") return ch.type === "staff";
      if (activeTab === "members") return ch.type === "member";
      if (activeTab === "pending") return (pendingCounts[ch.id] || 0) > 0;
      return true;
    });
  }, [channels, activeTab, pendingCounts]);

  const totalPendingQueries = useMemo(() => {
    return Object.values(pendingCounts).reduce((acc, curr) => acc + curr, 0);
  }, [pendingCounts]);

  // Filter messages in chat view if user searches or selects status
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (msgStatusFilter !== "all" && m.status !== msgStatusFilter) return false;
      if (chatSearch.trim() && !m.content.toLowerCase().includes(chatSearch.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [messages, msgStatusFilter, chatSearch]);

  if (!session.stId) {
    return (
      <div className="min-h-screen bg-[#08090a] text-[#d0d6e0] font-inter-variable flex items-center justify-center p-6">
        <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] p-8 max-w-md text-center shadow-xl space-y-3">
          <div className="w-12 h-12 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center mx-auto text-[#8a8f98]">
            <AlertCircle className="w-6 h-6 text-[#f59e0b]" />
          </div>
          <h2 className="text-[17px] font-[590] text-white">Student ID Required</h2>
          <p className="text-[13px] text-[#8a8f98] leading-relaxed">
            Your account must be linked with an active Student ID to access the society messaging system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-[#d0d6e0] font-inter-variable pb-12 selection:bg-[#e4f222]/20 selection:text-white">
      {/* ── Detail Modal ── */}
      {popupMsg && (
        <MessagePopup
          msg={popupMsg}
          session={session}
          isAdmin={isAdmin}
          onClose={() => setPopupMsg(null)}
          onReply={(text) => handleSendMessage(null, text)}
          onChangeStatus={(id, s) => {
            handleChangeStatus(id, s);
            setPopupMsg(null);
          }}
        />
      )}

      {/* ── Top Header / Telemetry Bar ── */}
      <div className="border-b border-[#23252a] bg-[#0c0c0e]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-[#e4f222]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] sm:text-[16px] font-[590] tracking-[-0.018em] text-[#ffffff]">
                  Direct & Broadcast Comms
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#161718] border border-[#23252a] font-berkeley-mono text-[10px] text-[#8a8f98]">
                  {allChannels.length} channels
                </span>
                {totalPendingQueries > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#f59e0b]/10 border border-[#f59e0b]/30 font-berkeley-mono text-[10px] text-[#f59e0b]">
                    <Clock className="w-2.5 h-2.5" />
                    {totalPendingQueries} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchChannels(0, false);
                fetchPendingCounts();
              }}
              title="Refresh messages"
              className="p-1.5 rounded-[6px] bg-[#161718] border border-[#23252a] text-[#8a8f98] hover:text-white hover:border-[#383b3f] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#161718] border border-[#23252a] font-berkeley-mono text-[11px] text-[#8a8f98]">
              <span className="text-[#62666d]">ST_ID:</span>
              <span className="text-[#d0d6e0]">{session.stId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Messaging Workspace Split Pane ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 py-4">
        <div
          className={`flex rounded-[12px] border border-[#23252a] bg-[#0f1011] overflow-hidden h-[calc(100vh-140px)] min-h-[580px] shadow-2xl ${
            mobileView === "chat" ? "mobile-view-chat" : "mobile-view-list"
          }`}
        >
          {/* ═══════════════════════════════════════════════
              LEFT COLUMN: Channel & Thread Navigation
             ═══════════════════════════════════════════════ */}
          <aside
            className={`w-full md:w-80 lg:w-92 bg-[#0f1011] border-r border-[#23252a] flex flex-col shrink-0 ${
              mobileView === "chat" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Thread Header & Search */}
            <div className="p-3.5 border-b border-[#23252a] space-y-2.5 shrink-0 bg-[#0f1011]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-berkeley-mono uppercase tracking-wider text-[#8a8f98]">
                  Conversations
                </span>
                <span className="text-[11px] font-berkeley-mono text-[#62666d]">
                  {filteredChannels.length} active
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-[#62666d] w-3.5 h-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full bg-[#161718] border border-[#23252a] rounded-[6px] pl-8 pr-7 py-1.5 text-[12px] text-white placeholder-[#62666d] focus:outline-none focus:border-[#d0d6e0] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-[#62666d] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
                {[
                  { id: "all", label: "All" },
                  { id: "broadcast", label: "📢 Broadcast" },
                  ...(isAdmin
                    ? [{ id: "members", label: "👥 Members" }]
                    : [{ id: "staff", label: "🛡️ Staff" }]),
                  {
                    id: "pending",
                    label: totalPendingQueries > 0 ? `⏳ Pending (${totalPendingQueries})` : "⏳ Pending",
                  },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`font-berkeley-mono text-[10px] px-2 py-1 rounded-[4px] border whitespace-nowrap transition-colors flex items-center gap-1 ${
                        active
                          ? "bg-[#23252a] text-white border-[#383b3f]"
                          : "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:border-[#383b3f] hover:text-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#23252a]/50">
              {filteredChannels.map((ch) => {
                const pending = ch.isBroadcast ? 0 : pendingCounts[ch.id] || 0;
                const isSelected = selectedChannel === ch.id;

                return (
                  <div
                    key={ch.id}
                    onClick={() => {
                      setSelectedChannel(ch.id);
                      setMobileView("chat");
                    }}
                    className={`flex items-start gap-3 p-3 cursor-pointer border-l-2 transition-all group ${
                      isSelected
                        ? "bg-[#161718] border-[#e4f222]"
                        : "border-transparent hover:bg-[#161718]/50"
                    }`}
                  >
                    {/* Linear Precision Avatar (NO fake green online dot) */}
                    <div className="w-8 h-8 rounded-[6px] shrink-0 bg-[#161718] border border-[#23252a] flex items-center justify-center text-[11px] font-berkeley-mono font-[510] text-[#d0d6e0] overflow-hidden">
                      {ch.isBroadcast ? (
                        <Radio className="w-4 h-4 text-[#e4f222]" />
                      ) : ch.avatar ? (
                        <img src={ch.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(ch.name)
                      )}
                    </div>

                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <h3
                            className={`text-[12.5px] font-[510] truncate ${
                              isSelected ? "text-white" : "text-[#d0d6e0]"
                            }`}
                          >
                            {ch.name}
                          </h3>
                          {ch.isBroadcast ? (
                            <span className="font-berkeley-mono text-[9px] px-1 py-0.2 rounded-[3px] bg-[#e4f222]/10 border border-[#e4f222]/30 text-[#e4f222]">
                              PUBLIC
                            </span>
                          ) : ch.roleTag ? (
                            <span className="font-berkeley-mono text-[9px] px-1 py-0.2 rounded-[3px] bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#818cf8] uppercase">
                              {ch.roleTag}
                            </span>
                          ) : null}
                        </div>

                        {ch.lastTime > 0 && (
                          <span className="font-berkeley-mono text-[10px] text-[#62666d] whitespace-nowrap ml-1">
                            {formatSidebarTime(ch.lastTime)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11.5px] text-[#8a8f98] truncate leading-tight">
                          {ch.lastSnippet ||
                            (ch.isBroadcast ? "Public broadcast channel" : ch.st_id || "Direct conversation")}
                        </p>

                        {/* Pending Indicator Badge */}
                        {pending > 0 && (
                          <span className="h-4 px-1.5 rounded-[4px] bg-[#e4f222] text-[#08090a] font-berkeley-mono text-[10px] font-[590] flex items-center justify-center flex-shrink-0 shadow-sm">
                            {pending}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loadingChannels ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-[#23252a] border-t-[#e4f222] rounded-full animate-spin mx-auto"></div>
                  <span className="text-[11px] font-berkeley-mono text-[#62666d] mt-2 block">
                    Loading threads...
                  </span>
                </div>
              ) : hasMore && (
                <div className="p-2.5 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="w-full py-1.5 bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white font-berkeley-mono text-[11px] rounded-[6px] border border-[#23252a] transition-colors"
                  >
                    Load More Channels
                  </button>
                </div>
              )}

              {!loadingChannels && filteredChannels.length === 0 && (
                <div className="p-8 text-center text-[#62666d] font-berkeley-mono text-[11px]">
                  No matching conversations found.
                </div>
              )}
            </div>
          </aside>

          {/* ═══════════════════════════════════════════════
              RIGHT COLUMN: Main Chat & Message Stream Area
             ═══════════════════════════════════════════════ */}
          <section
            className={`flex-1 flex flex-col bg-[#08090a] min-w-0 ${
              mobileView === "list" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* ── Chat Header (Precision Instrument bar, no call/video buttons) ── */}
            <div className="h-14 px-4 sm:px-5 border-b border-[#23252a] flex items-center justify-between shrink-0 bg-[#0f1011] z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileView("list")}
                  className="md:hidden p-1 text-[#8a8f98] hover:text-white rounded-[4px] hover:bg-[#161718]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="w-8 h-8 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[11px] font-berkeley-mono font-[510] text-[#d0d6e0] overflow-hidden flex-shrink-0">
                  {activeChannelObj?.isBroadcast ? (
                    <Radio className="w-4 h-4 text-[#e4f222]" />
                  ) : activeChannelObj?.avatar ? (
                    <img src={activeChannelObj.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(activeChannelObj?.name || "?")
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13.5px] font-[510] text-white truncate">
                      {activeChannelObj?.name || "Select a thread"}
                    </h2>
                    {activeChannelObj?.isBroadcast ? (
                      <span className="font-berkeley-mono text-[9px] px-1 py-0.2 rounded-[3px] bg-[#e4f222]/10 border border-[#e4f222]/30 text-[#e4f222]">
                        ANNOUNCEMENTS
                      </span>
                    ) : activeChannelObj?.roleTag ? (
                      <span className="font-berkeley-mono text-[9px] px-1 py-0.2 rounded-[3px] bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#818cf8] uppercase">
                        {activeChannelObj.roleTag}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-berkeley-mono text-[#8a8f98]">
                    {activeChannelObj?.isBroadcast ? (
                      <span>All Society Members & Staff</span>
                    ) : (
                      <>
                        <span className="text-[#62666d]">ST_ID:</span>
                        <span className="text-[#d0d6e0]">
                          {activeChannelObj?.st_id || activeChannelObj?.id || ""}
                        </span>
                        {activeChannelObj?.st_id && (
                          <button
                            onClick={() => handleCopyStId(activeChannelObj.st_id)}
                            title="Copy Student ID"
                            className="text-[#62666d] hover:text-[#e4f222] transition-colors inline-flex items-center gap-0.5"
                          >
                            {copiedStId ? (
                              <Check className="w-2.5 h-2.5 text-[#27a644]" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                            <span className="text-[9px]">{copiedStId ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Functional Utilities in Place of Call/Video Buttons */}
              <div className="flex items-center gap-1 text-[#8a8f98]">
                {/* Search In Chat Toggle */}
                <button
                  onClick={() => setIsChatSearchOpen((v) => !v)}
                  title="Search in this conversation"
                  className={`p-1.5 rounded-[6px] border transition-colors ${
                    isChatSearchOpen
                      ? "bg-[#23252a] text-white border-[#383b3f]"
                      : "bg-[#161718] text-[#8a8f98] border-[#23252a] hover:text-white"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Filter by status dropdown/pill */}
                {!activeChannelObj?.isBroadcast && (
                  <div className="flex items-center p-0.5 rounded-[6px] bg-[#161718] border border-[#23252a]">
                    <button
                      onClick={() => setMsgStatusFilter("all")}
                      className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] transition-colors ${
                        msgStatusFilter === "all" ? "bg-[#23252a] text-white" : "text-[#8a8f98] hover:text-white"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setMsgStatusFilter("pending")}
                      className={`px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] transition-colors ${
                        msgStatusFilter === "pending"
                          ? "bg-[#23252a] text-[#f59e0b]"
                          : "text-[#8a8f98] hover:text-white"
                      }`}
                    >
                      Pending
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* In-Chat Search Bar Dropdown */}
            {isChatSearchOpen && (
              <div className="px-4 py-2 bg-[#161718] border-b border-[#23252a] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#62666d]" />
                <input
                  type="text"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Filter messages in this conversation..."
                  className="flex-1 bg-transparent text-[12px] text-white placeholder-[#62666d] focus:outline-none"
                />
                {chatSearch && (
                  <button onClick={() => setChatSearch("")} className="text-[#62666d] hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* ── Message History Stream Container ── */}
            <div ref={msgListRef} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
              {/* Load Older Messages */}
              {hasMoreMsgs && (
                <div className="text-center pb-2">
                  <button
                    onClick={handleLoadMoreMsgs}
                    disabled={loadingMoreMsgs}
                    className="font-berkeley-mono text-[11px] px-3.5 py-1 rounded-[6px] border border-[#23252a] bg-[#0f1011] text-[#8a8f98] hover:text-white hover:border-[#383b3f] transition-all disabled:opacity-50"
                  >
                    {loadingMoreMsgs ? "Loading older messages..." : "↑ Load older messages"}
                  </button>
                </div>
              )}

              {visibleMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#62666d] space-y-2">
                  <div className="w-10 h-10 rounded-[6px] bg-[#0f1011] border border-[#23252a] flex items-center justify-center text-[#8a8f98]">
                    <MessageSquare className="w-5 h-5 text-[#62666d]" />
                  </div>
                  <p className="text-[13px] text-[#8a8f98]">
                    {chatSearch ? "No messages matching search." : "No messages yet in this thread."}
                  </p>
                  <p className="text-[11px] font-berkeley-mono text-[#62666d]">
                    Send a query or dispatch a note to start.
                  </p>
                </div>
              ) : (
                visibleMessages.map((msg, index) => {
                  const isMine = msg.sender_st_id === session.stId;
                  const isReceiver = msg.receiver_st_id === session.stId;

                  const currentDateStr = new Date(msg.created_at).toDateString();
                  const prevDateStr =
                    index > 0 ? new Date(visibleMessages[index - 1].created_at).toDateString() : null;
                  const showDateDivider = currentDateStr !== prevDateStr;

                  return (
                    <div key={msg.id} className="flex flex-col gap-2.5">
                      {/* Date Separator */}
                      {showDateDivider && (
                        <div className="relative flex items-center justify-center my-3">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#23252a]" />
                          </div>
                          <span className="relative font-berkeley-mono text-[10px] text-[#62666d] bg-[#08090a] px-2.5 py-0.5 rounded-[4px] border border-[#23252a] uppercase tracking-wider">
                            {formatDateDivider(msg.created_at)}
                          </span>
                        </div>
                      )}

                      {/* Bubble Row */}
                      <div
                        className={`flex items-end gap-2 max-w-[90%] sm:max-w-[78%] ${
                          isMine ? "self-end flex-row-reverse" : "self-start"
                        }`}
                      >
                        {!isMine && (
                          <div className="w-7 h-7 rounded-[4px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[10px] font-berkeley-mono font-[510] text-[#8a8f98] flex-shrink-0 mb-1">
                            {getInitials(msg.sender?.name || msg.sender_st_id)}
                          </div>
                        )}

                        <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                          {/* Sender name for received broadcast messages */}
                          {!isMine && selectedChannel === "broadcast" && (
                            <span className="text-[11px] font-[510] text-[#8a8f98] px-1">
                              {msg.sender?.name || msg.sender_st_id}
                            </span>
                          )}

                          {/* Bubble Container */}
                          <div
                            onClick={() => setPopupMsg(msg)}
                            className={`px-3.5 py-2.5 rounded-[8px] text-[13px] leading-relaxed cursor-pointer transition-all border ${
                              isMine
                                ? "bg-[#161718] text-[#ffffff] border-[#383b3f] hover:border-[#8a8f98]"
                                : selectedChannel === "broadcast"
                                ? "bg-[#0f1011] text-[#ffffff] border-[#e4f222]/30 hover:border-[#e4f222]"
                                : "bg-[#0f1011] text-[#d0d6e0] border-[#23252a] hover:border-[#383b3f]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                          </div>

                          {/* Metadata row: Berkeley Mono time, tick, and status */}
                          <div
                            className={`flex items-center gap-1.5 font-berkeley-mono text-[10px] text-[#62666d] px-1 ${
                              isMine ? "flex-row-reverse" : ""
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            {isMine && <CheckCheck className="w-3 h-3 text-[#27a644]" />}

                            {selectedChannel !== "broadcast" && (
                              <StatusBadge status={msg.status || "pending"} size="xs" />
                            )}
                          </div>

                          {/* Quick 1-Click Status Controls for Receiver or Staff */}
                          {selectedChannel !== "broadcast" && (isReceiver || isAdmin) && (
                            <div className="pt-0.5">
                              <StatusButtons
                                status={msg.status || "pending"}
                                onChangeStatus={(s) => handleChangeStatus(msg.id, s)}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Bottom Input & Composer (Linear Style with Acid Lime CTA) ── */}
            <div className="p-3 sm:p-4 bg-[#0f1011] border-t border-[#23252a] shrink-0">
              {!isAdmin && selectedChannel === "broadcast" ? (
                <div className="text-center p-3 text-[12px] text-[#8a8f98] bg-[#161718] rounded-[6px] border border-[#23252a] font-berkeley-mono">
                  📢 Society announcements channel is read-only for members. Only staff can dispatch public notices.
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="bg-[#161718] border border-[#23252a] rounded-[6px] p-2 focus-within:border-[#d0d6e0] transition-colors space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={
                        selectedChannel === "broadcast"
                          ? "Broadcast a public announcement to all members..."
                          : `Message ${activeChannelObj?.name || "recipient"}...`
                      }
                      className="w-full bg-transparent text-[13px] text-white placeholder-[#62666d] focus:outline-none px-1"
                    />

                    {/* Primary Action Button (Acid Lime #e4f222) per DESIGN.md */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="h-8 px-3.5 bg-[#e4f222] hover:brightness-105 text-[#08090a] font-[510] tracking-[-0.011em] text-[12px] rounded-[6px] transition-all disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </div>

                  {/* Micro Hint in Berkeley Mono */}
                  <div className="flex items-center justify-between text-[10px] font-berkeley-mono text-[#62666d] px-1 border-t border-[#23252a]/60 pt-1.5">
                    <span>Press ↵ Enter to send</span>
                    <span>
                      {selectedChannel === "broadcast"
                        ? "Public Broadcast Mode"
                        : "Encrypted Direct Channel"}
                    </span>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
