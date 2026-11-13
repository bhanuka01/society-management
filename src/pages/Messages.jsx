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
  MessageSquare,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Users,
  Bell,
  MessageSquareQuote,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Status Configurations & Badges
───────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "#f59e0b",
    lightBg: "rgba(245, 158, 11, 0.12)",
    darkBg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.3)",
  },
  "in-progress": {
    label: "In Progress",
    icon: RefreshCw,
    color: "#6366f1",
    lightBg: "rgba(99, 102, 241, 0.12)",
    darkBg: "rgba(99, 102, 241, 0.15)",
    border: "rgba(99, 102, 241, 0.3)",
  },
  done: {
    label: "Resolved",
    icon: Check,
    color: "#16a34a",
    lightBg: "rgba(22, 163, 74, 0.12)",
    darkBg: "rgba(22, 163, 74, 0.15)",
    border: "rgba(22, 163, 74, 0.3)",
  },
};

function StatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isMini = size === "xs";

  return (
    <span
      className={`inline-flex items-center gap-1 font-sans font-medium rounded-full border ${
        isMini ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.5"
      }`}
      style={{
        color: cfg.color,
        backgroundColor: cfg.lightBg,
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
    <div className={`flex items-center gap-1.5 ${compact ? "flex-wrap" : "mt-2 flex-wrap"}`}>
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
            className={`font-sans text-[11px] px-2.5 py-1 rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-transparent shadow-xs font-medium"
                : "bg-white dark:bg-[#161718] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-[#23252a] hover:border-slate-300 dark:hover:border-[#383b3f] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Icon className="w-3 h-3" style={{ color: active ? "currentColor" : cfg.color }} />
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Avatar & Identity Helpers
───────────────────────────────────────────────────────────────────────────── */
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

const AVATAR_COLOR_PALETTES = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/40",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/40",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/40",
  "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/40",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/40",
  "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/40",
];

function ChannelAvatar({ channel, size = "md" }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [channel?.avatar]);

  const sizeClasses =
    size === "sm"
      ? "w-7 h-7 text-[10px]"
      : size === "lg"
      ? "w-11 h-11 text-[13px]"
      : "w-9 h-9 text-[12px]";

  if (channel?.isBroadcast) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 shadow-2xs`}
      >
        <Radio className={size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
    );
  }

  if (channel?.avatar && !imgFailed) {
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 border border-slate-200/80 dark:border-zinc-700/60 shadow-2xs bg-slate-100 dark:bg-zinc-800`}
      >
        <img
          src={channel.avatar}
          alt={channel.name || ""}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const name = channel?.name || "User";
  const charCode = name.charCodeAt(0) + name.length;
  const colorScheme = AVATAR_COLOR_PALETTES[charCode % AVATAR_COLOR_PALETTES.length];

  return (
    <div
      className={`${sizeClasses} rounded-full font-semibold flex items-center justify-center shrink-0 border shadow-2xs ${colorScheme}`}
    >
      {getInitials(name)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Message Content & Image Renderer
───────────────────────────────────────────────────────────────────────────── */
function renderMessageContent(content) {
  if (!content) return null;

  // Regex to detect image URLs (standard image extensions or Supabase storage paths)
  const urlRegex = /(https?:\/\/[^\s]+?(?:\.(?:png|jpe?g|webp|gif|svg)|supabase\.co\/storage\/[^\s]+)(\?[^\s]*)?)/gi;
  const matches = content.match(urlRegex);

  if (matches && matches.length > 0) {
    const textWithoutUrls = content.replace(urlRegex, "").trim();
    return (
      <div className="space-y-2">
        {textWithoutUrls && <p className="whitespace-pre-wrap break-words">{textWithoutUrls}</p>}
        <div className="flex flex-col gap-2 pt-1">
          {matches.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group bg-black/5 dark:bg-white/5"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={url}
                alt="Shared attachment"
                className="max-h-72 w-auto max-w-full object-contain rounded-xl transition-transform group-hover:scale-[1.01]"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{content}</p>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Date & Time Formatting Helpers
───────────────────────────────────────────────────────────────────────────── */
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
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (isYesterday) {
    return "Yesterday";
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
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
   Message Detail & Status Modal
───────────────────────────────────────────────────────────────────────────── */
function MessagePopup({ msg, session, isAdmin, onClose, onReply, onChangeStatus }) {
  const isStaff = Boolean(isAdmin || session?.role === "admin" || session?.role === "editor");
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
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f1011] border border-slate-200 dark:border-[#23252a] rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 font-sans text-slate-800 dark:text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-[#23252a] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-slate-900 dark:text-white">
                {isMine ? "You" : msg.sender?.name || (isStaff ? msg.sender_st_id : "Society Member")}
              </span>
              {isStaff && msg.sender_st_id && (
                <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-[#161718] border border-slate-200 dark:border-[#23252a] px-2 py-0.5 rounded-md">
                  {msg.sender_st_id}
                </span>
              )}
            </div>
            <div className="text-[12px] text-slate-400 dark:text-zinc-500 mt-1">
              {new Date(msg.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#161718] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Content */}
        <div className="p-4 rounded-xl text-[14px] leading-relaxed bg-slate-50 dark:bg-[#161718] border border-slate-200/80 dark:border-[#23252a] text-slate-900 dark:text-white">
          {renderMessageContent(msg.content)}
        </div>

        {/* Status Control */}
        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#0c0d0e] border border-slate-200/80 dark:border-[#23252a] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Status Resolution
            </span>
            <StatusBadge status={msg.status || "pending"} />
          </div>
          {(isReceiver || isAdmin) && (
            <div className="pt-1">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1.5">Change Status:</span>
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
            className="flex-1 bg-slate-50 dark:bg-[#161718] border border-slate-200 dark:border-[#23252a] rounded-xl px-3.5 py-2 text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:focus:ring-white/10 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#e4f222] dark:hover:bg-[#d6e41b] dark:text-[#08090a] font-medium rounded-xl px-4 py-2 text-[12.5px] transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-xs"
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
   Main Messages Component
───────────────────────────────────────────────────────────────────────────── */
export default function Messages({ isAdmin, session, theme, role }) {
  const isStaff = Boolean(
    isAdmin ||
      session?.role === "admin" ||
      session?.role === "editor" ||
      role === "admin" ||
      role === "editor"
  );
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
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'
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
    const matchesBroadcast =
      !debouncedSearch ||
      "society announcements broadcast public".includes(debouncedSearch.toLowerCase()) ||
      "announcements".includes(debouncedSearch.toLowerCase());

    if (matchesBroadcast) {
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

    const PAGE_SIZE = 14;
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
    const PAGE_SIZE = 14;
    const end = (nextPage + 1) * PAGE_SIZE;
    setChannels(allChannels.slice(0, end));
    setHasMore(end < allChannels.length);
  };

  const MSG_PAGE = 25;

  const buildMsgQuery = () => {
    let q = supabase
      .from("messages")
      .select(
        `id, content, created_at, sender_st_id, receiver_st_id, status, sender:sender_st_id (name, profile_image_url)`
      );

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
            .select("name, profile_image_url")
            .eq("st_id", newMsg.sender_st_id)
            .maybeSingle()
            .then(({ data }) => {
              if (isMounted) {
                setMessages((prev) => [
                  ...prev,
                  { ...newMsg, sender: data || { name: newMsg.sender_st_id } },
                ]);
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
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, status: updated.status } : m)));
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
    const source = activeTab === "all" ? channels : allChannels;
    return source.filter((ch) => {
      if (activeTab === "broadcast") return ch.isBroadcast;
      if (activeTab === "staff") return ch.type === "staff";
      if (activeTab === "members") return ch.type === "member";
      if (activeTab === "pending") return (pendingCounts[ch.id] || 0) > 0;
      return true;
    });
  }, [channels, allChannels, activeTab, pendingCounts]);

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
      <div className="min-h-screen bg-slate-50 dark:bg-[#08090a] text-slate-800 dark:text-zinc-200 font-sans flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#0f1011] border border-slate-200 dark:border-[#23252a] rounded-2xl p-8 max-w-md text-center shadow-xl space-y-4">
          <div className="w-13 h-13 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-white">Student ID Required</h2>
          <p className="text-[13.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            Your account must be linked with an active Student ID to access the society messaging system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page-container bg-slate-50/80 dark:bg-[#08090a] text-slate-800 dark:text-zinc-200 font-sans pb-0 sm:pb-8">
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

      {/* ── Top Header / Telemetry Bar (Desktop & Tablet only; Mobile uses MobileNav) ── */}
      <div className="hidden sm:block border-b border-slate-200/80 dark:border-[#23252a] bg-white/90 dark:bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#161718] border border-slate-200/80 dark:border-[#23252a] flex items-center justify-center shrink-0 shadow-2xs">
              <MessageSquare className="w-4 h-4 text-slate-700 dark:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] sm:text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  Direct & Broadcast Comms
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#161718] border border-slate-200 dark:border-[#23252a] text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  {allChannels.length} channels
                </span>
                {totalPendingQueries > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    {totalPendingQueries} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                fetchChannels(0, false);
                fetchPendingCounts();
              }}
              title="Refresh messages"
              className="p-1.5 sm:p-2 rounded-xl bg-white dark:bg-[#161718] border border-slate-200 dark:border-[#23252a] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {isStaff && session.stId && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#161718] border border-slate-200 dark:border-[#23252a] font-mono text-[11.5px] text-slate-600 dark:text-zinc-300 shadow-2xs">
                <span className="font-semibold">{session.stId}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Messaging Workspace Split Pane ── */}
      <div className="max-w-7xl mx-auto p-0 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
        <div
          className={`messages-layout flex rounded-xl sm:rounded-2xl border-0 sm:border border-slate-200/90 dark:border-[#23252a] bg-white dark:bg-[#0f1011] overflow-hidden h-[calc(100dvh-135px)] sm:h-[calc(100vh-140px)] shadow-none sm:shadow-sm ${
            mobileView === "chat" ? "mobile-view-chat" : "mobile-view-list"
          }`}
        >
          {/* ═══════════════════════════════════════════════
              LEFT COLUMN: Channel & Thread Navigation
              Visible on mobile only when mobileView === "list"
              Always visible side-by-side on lg: (1024px+)
             ═══════════════════════════════════════════════ */}
          <aside
            className={`messages-sidebar w-full lg:w-80 xl:w-92 bg-white dark:bg-[#0f1011] border-r border-slate-200/80 dark:border-[#23252a] flex flex-col shrink-0 ${
              mobileView === "chat" ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* Thread Header & Search */}
            <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-[#23252a] space-y-2.5 shrink-0 bg-white dark:bg-[#0f1011]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  Conversations
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full">
                  {filteredChannels.length} active
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400 dark:text-zinc-500 w-3.5 h-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isStaff ? "Search by name or SC number..." : "Search conversations..."}
                  className="w-full bg-slate-50 dark:bg-[#161718] border border-slate-200/80 dark:border-[#23252a] rounded-xl pl-9 pr-8 py-2 text-[12.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:focus:ring-white/10 focus:border-slate-300 dark:focus:border-zinc-700 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Filter Control: 4 columns grid, fits all mobile & desktop screens with zero scrollbars */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 dark:bg-[#161718] rounded-xl text-center">
                {[
                  { id: "all", label: "All" },
                  { id: "broadcast", label: "Broadcast", icon: Radio },
                  ...(isAdmin
                    ? [{ id: "members", label: "Members", icon: Users }]
                    : [{ id: "staff", label: "Staff", icon: Shield }]),
                  {
                    id: "pending",
                    label: "Pending",
                    badge: totalPendingQueries,
                    icon: Clock,
                  },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`h-8 rounded-lg text-[11px] sm:text-[11.5px] transition-all duration-150 flex items-center justify-center gap-1 col-span-1 px-1 min-w-0 ${
                        active
                          ? "bg-white dark:bg-[#23252a] text-slate-900 dark:text-white font-semibold shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-normal"
                      }`}
                      title={tab.label}
                    >
                      {TabIcon && <TabIcon className="w-3 h-3 shrink-0 hidden xs:inline sm:inline" />}
                      <span className="truncate">{tab.label}</span>
                      {tab.badge > 0 && (
                        <span
                          className={`ml-0.5 text-[9.5px] font-bold px-1 rounded-full shrink-0 ${
                            active
                              ? "bg-amber-500 text-white"
                              : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-slate-100/90 dark:bg-[#161718] text-slate-900 dark:text-white shadow-2xs font-medium"
                        : "hover:bg-slate-50 dark:hover:bg-[#161718]/60 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    {/* Active Accent Indicator */}
                    {isSelected && (
                      <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#0a0a0b] dark:bg-[#e4f222]" />
                    )}

                    <ChannelAvatar channel={ch} size="md" />

                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <h3
                            className={`text-[13px] truncate ${
                              isSelected
                                ? "text-slate-950 dark:text-white font-semibold"
                                : "text-slate-800 dark:text-zinc-200 font-medium"
                            }`}
                          >
                            {ch.name}
                          </h3>
                          {ch.isBroadcast ? (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                              Public
                            </span>
                          ) : ch.roleTag ? (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shrink-0">
                              {ch.roleTag}
                            </span>
                          ) : null}
                        </div>

                        {ch.lastTime > 0 && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap ml-1 shrink-0 font-normal">
                            {formatSidebarTime(ch.lastTime)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-[12px] text-slate-500 dark:text-zinc-400 truncate leading-snug font-normal">
                          {ch.lastSnippet ||
                            (ch.isBroadcast
                              ? "Public broadcast channel"
                              : isStaff && ch.st_id
                              ? ch.st_id
                              : "Direct conversation")}
                        </p>

                        {/* Pending Indicator Badge */}
                        {pending > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white dark:bg-[#e4f222] dark:text-[#08090a] text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
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
                  <div className="w-5 h-5 border-2 border-slate-200 dark:border-zinc-700 border-t-slate-800 dark:border-t-[#e4f222] rounded-full animate-spin mx-auto" />
                  <span className="text-[12px] text-slate-400 dark:text-zinc-500 mt-2 block">
                    Loading conversations...
                  </span>
                </div>
              ) : hasMore && (
                <div className="p-2 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="w-full py-2 bg-slate-50 dark:bg-[#161718] hover:bg-slate-100 dark:hover:bg-[#23252a] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-[12px] font-medium rounded-xl border border-slate-200 dark:border-[#23252a] transition-colors"
                  >
                    Load More Conversations
                  </button>
                </div>
              )}

              {!loadingChannels && filteredChannels.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-[12.5px] space-y-2">
                  <MessageSquareQuote className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
                  <p>No matching conversations found.</p>
                </div>
              )}
            </div>
          </aside>

          {/* ═══════════════════════════════════════════════
              RIGHT COLUMN: Main Chat & Message Stream Area
              Visible on mobile only when mobileView === "chat"
              Always visible side-by-side on lg: (1024px+)
             ═══════════════════════════════════════════════ */}
          <section
            className={`messages-chat flex-1 flex flex-col bg-slate-50/50 dark:bg-[#08090a] min-w-0 min-h-0 ${
              mobileView === "list" ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* ── Chat Header ── */}
            <div className="h-14 sm:h-16 px-3 sm:px-6 border-b border-slate-200/80 dark:border-[#23252a] flex items-center justify-between shrink-0 bg-white/95 dark:bg-[#0f1011]/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Back Button: Returns to Conversation List */}
                <button
                  onClick={() => setMobileView("list")}
                  className="messages-back-btn lg:hidden p-1.5 -ml-1 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#161718] transition-colors flex items-center gap-1"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-[12px] font-medium hidden sm:inline">Back</span>
                </button>

                <ChannelAvatar channel={activeChannelObj} size="md" />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="text-[13.5px] sm:text-[14.5px] font-semibold text-slate-900 dark:text-white truncate">
                      {activeChannelObj?.name || "Select a conversation"}
                    </h2>
                    {activeChannelObj?.isBroadcast ? (
                      <span className="text-[9px] sm:text-[9.5px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 uppercase tracking-wide shrink-0">
                        Public
                      </span>
                    ) : activeChannelObj?.roleTag ? (
                      <span className="text-[9px] sm:text-[9.5px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide shrink-0">
                        {activeChannelObj.roleTag}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-slate-500 dark:text-zinc-400 truncate">
                    {activeChannelObj?.isBroadcast ? (
                      <span className="truncate">Public Broadcast to all members</span>
                    ) : isStaff ? (
                      <>
                        <span className="font-mono text-slate-800 dark:text-zinc-200 font-medium shrink-0">
                          {activeChannelObj?.st_id || activeChannelObj?.id || "—"}
                        </span>
                        {activeChannelObj?.st_id && (
                          <button
                            onClick={() => handleCopyStId(activeChannelObj.st_id)}
                            title="Copy SC Number"
                            className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            {copiedStId ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">{copiedStId ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="truncate">Direct conversation</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Utility Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 dark:text-zinc-400 shrink-0">
                {/* Search In Chat Toggle */}
                <button
                  onClick={() => setIsChatSearchOpen((v) => !v)}
                  title="Search in this conversation"
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all ${
                    isChatSearchOpen
                      ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-transparent shadow-xs"
                      : "bg-slate-50 dark:bg-[#161718] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-[#23252a] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Filter by status dropdown/pill */}
                {!activeChannelObj?.isBroadcast && (
                  <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#161718] border border-slate-200 dark:border-[#23252a]">
                    <button
                      onClick={() => setMsgStatusFilter("all")}
                      className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px] font-medium transition-all ${
                        msgStatusFilter === "all"
                          ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setMsgStatusFilter("pending")}
                      className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px] font-medium transition-all ${
                        msgStatusFilter === "pending"
                          ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-2xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
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
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#161718] border-b border-slate-200 dark:border-[#23252a] flex items-center gap-2 shrink-0">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Filter messages in this conversation..."
                  className="flex-1 bg-transparent text-[13px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
                />
                {chatSearch && (
                  <button
                    onClick={() => setChatSearch("")}
                    className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* ── Message History Stream Container ── */}
            <div ref={msgListRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 flex flex-col gap-3.5">
              {/* Load Older Messages */}
              {hasMoreMsgs && (
                <div className="text-center pb-2">
                  <button
                    onClick={handleLoadMoreMsgs}
                    disabled={loadingMoreMsgs}
                    className="text-[11.5px] font-medium px-4 py-1.5 rounded-xl border border-slate-200 dark:border-[#23252a] bg-white dark:bg-[#0f1011] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-all disabled:opacity-50 shadow-2xs"
                  >
                    {loadingMoreMsgs ? "Loading older messages..." : "↑ Load older messages"}
                  </button>
                </div>
              )}

              {visibleMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#0f1011] border border-slate-200 dark:border-[#23252a] flex items-center justify-center text-slate-400 dark:text-zinc-500 shadow-2xs">
                    <MessageSquareQuote className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-zinc-300">
                      {chatSearch ? "No messages matching search." : "No messages yet in this thread."}
                    </p>
                    <p className="text-[12.5px] text-slate-400 dark:text-zinc-500 mt-1 max-w-sm">
                      {selectedChannel === "broadcast"
                        ? "Society-wide announcements will appear here."
                        : `Send a query or dispatch a note to start chatting with ${activeChannelObj?.name || "this user"}.`}
                    </p>
                  </div>
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
                    <div key={msg.id} className="flex flex-col gap-2">
                      {/* Date Separator */}
                      {showDateDivider && (
                        <div className="relative flex items-center justify-center my-3">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200/80 dark:border-[#23252a]" />
                          </div>
                          <span className="relative text-[11px] font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/90 px-3 py-0.5 rounded-full border border-slate-200 dark:border-[#23252a]">
                            {formatDateDivider(msg.created_at)}
                          </span>
                        </div>
                      )}

                      {/* Bubble Row */}
                      <div
                        className={`flex items-end gap-2 max-w-[92%] sm:max-w-[78%] ${
                          isMine ? "self-end flex-row-reverse" : "self-start"
                        }`}
                      >
                        {/* Sender Avatar: Displays profile image if available */}
                        {!isMine && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shrink-0 mb-1 border border-slate-200/80 dark:border-zinc-700/60 shadow-2xs bg-slate-100 dark:bg-zinc-800">
                            {msg.sender?.profile_image_url ? (
                              <img
                                src={msg.sender.profile_image_url}
                                alt={msg.sender?.name || ""}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = "flex";
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-full h-full font-semibold flex items-center justify-center text-[10px] sm:text-[11px] ${
                                msg.sender?.profile_image_url ? "hidden" : "flex"
                              } ${
                                AVATAR_COLOR_PALETTES[
                                  ((msg.sender?.name || msg.sender_st_id || "U").charCodeAt(0) +
                                    (msg.sender_st_id || "").length) %
                                    AVATAR_COLOR_PALETTES.length
                                ]
                              }`}
                            >
                              {getInitials(msg.sender?.name || msg.sender_st_id)}
                            </div>
                          </div>
                        )}

                        <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                          {/* Sender name for received broadcast messages */}
                          {!isMine && selectedChannel === "broadcast" && (
                            <span className="text-[11px] sm:text-[11.5px] font-semibold text-slate-600 dark:text-zinc-400 px-1">
                              {msg.sender?.name || (isStaff ? msg.sender_st_id : "Society Staff")}
                            </span>
                          )}

                          {/* Bubble Container */}
                          <div
                            onClick={() => setPopupMsg(msg)}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[13px] sm:text-[13.5px] leading-relaxed cursor-pointer transition-all duration-150 ${
                              isMine
                                ? "bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 rounded-br-xs shadow-xs hover:bg-slate-800 dark:hover:bg-zinc-700"
                                : selectedChannel === "broadcast"
                                ? "bg-white dark:bg-[#0f1011] text-slate-900 dark:text-zinc-100 border border-amber-500/30 rounded-bl-xs shadow-xs hover:border-amber-500/50"
                                : "bg-white dark:bg-[#0f1011] text-slate-800 dark:text-zinc-100 border border-slate-200/90 dark:border-[#23252a] rounded-bl-xs shadow-xs hover:border-slate-300 dark:hover:border-zinc-700"
                            }`}
                          >
                            {renderMessageContent(msg.content)}
                          </div>

                          {/* Metadata row: time, tick, and status */}
                          <div
                            className={`flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-slate-400 dark:text-zinc-500 px-1 ${
                              isMine ? "flex-row-reverse" : ""
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>

                            {isMine && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}

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

            {/* ── Bottom Input & Composer (Docked at bottom of screen) ── */}
            <div className="p-2.5 sm:p-4 bg-white dark:bg-[#0f1011] border-t border-slate-200/80 dark:border-[#23252a] shrink-0 sticky bottom-0 z-10">
              {!isAdmin && selectedChannel === "broadcast" ? (
                <div className="text-center p-2.5 sm:p-3 text-[12px] sm:text-[12.5px] text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-[#161718] rounded-xl border border-slate-200 dark:border-[#23252a]">
                  📢 Society announcements channel is read-only for members. Only staff can dispatch public notices.
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="bg-slate-50 dark:bg-[#161718] border border-slate-200/90 dark:border-[#23252a] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 focus-within:ring-2 focus-within:ring-slate-400/20 dark:focus-within:ring-white/10 focus-within:border-slate-300 dark:focus-within:border-zinc-700 transition-all space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={
                        selectedChannel === "broadcast"
                          ? "Broadcast a public announcement..."
                          : `Message ${activeChannelObj?.name || "recipient"}...`
                      }
                      className="w-full bg-transparent text-[13px] sm:text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none px-2 py-1"
                    />

                    {/* Primary Action Button */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="h-8 sm:h-9 px-3.5 sm:px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#e4f222] dark:hover:bg-[#d6e41b] dark:text-[#08090a] font-medium text-[12.5px] sm:text-[13px] rounded-lg sm:rounded-xl transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </div>

                  {/* Micro Hint */}
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 dark:text-zinc-500 px-2 border-t border-slate-200/60 dark:border-[#23252a]/60 pt-1 font-normal">
                    <span>Press ↵ Enter to send</span>
                    <span>
                      {selectedChannel === "broadcast"
                        ? "Public Broadcast"
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
