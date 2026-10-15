import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { marked } from "marked";
import { 
  Megaphone, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Eye, 
  ExternalLink, 
  Globe, 
  Lock, 
  X, 
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Share2,
  Filter,
  Tag,
  Radio,
  MessageCircle,
  Bold,
  Heading,
  List,
  Link2,
  Code,
  Flame,
  ShieldAlert,
  ArrowUpRight,
  Calendar,
  BookOpen,
  ShieldCheck
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

const CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "OFFICIAL", label: "Official", icon: ShieldCheck, dot: "bg-amber-500" },
  { id: "EVENTS", label: "Events", icon: Calendar, dot: "bg-indigo-500" },
  { id: "ACADEMIC", label: "Academic", icon: BookOpen, dot: "bg-orange-500" },
  { id: "URGENT", label: "Urgent", icon: Flame, dot: "bg-rose-500" }
];

const getCategoryThemeConfig = (category, isDark = true) => {
  const configs = {
    ALL: {
      id: "ALL",
      label: "All",
      color: isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-700 bg-gray-100 border-gray-200"
    },
    OFFICIAL: {
      id: "OFFICIAL",
      label: "Official",
      color: isDark ? "text-[#e4f222] bg-[#e4f222]/10 border-[#e4f222]/30" : "text-amber-800 bg-amber-50 border-amber-200",
      dot: isDark ? "bg-[#e4f222]" : "bg-amber-500",
      icon: ShieldCheck
    },
    EVENTS: {
      id: "EVENTS",
      label: "Events",
      color: isDark ? "text-indigo-400 bg-indigo-400/10 border-indigo-400/30" : "text-indigo-700 bg-indigo-50 border-indigo-200",
      dot: "bg-indigo-500",
      icon: Calendar
    },
    ACADEMIC: {
      id: "ACADEMIC",
      label: "Academic",
      color: isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/30" : "text-orange-800 bg-orange-50 border-orange-200",
      dot: "bg-orange-500",
      icon: BookOpen
    },
    URGENT: {
      id: "URGENT",
      label: "Urgent",
      color: isDark ? "text-[#eb5757] bg-[#eb5757]/10 border-[#eb5757]/30" : "text-rose-700 bg-rose-50 border-rose-200",
      dot: "bg-rose-500",
      icon: Flame
    }
  };
  return configs[category] || configs.OFFICIAL;
};

const EMPTY_FORM = { id: "", category: "OFFICIAL", title: "", content: "", is_public: true };

export default function Notices({ isAdmin = false, session, theme }) {
  const isDark = theme ? theme === "dark" : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("all"); // "all", "public", "internal"
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [activeNotice, setActiveNotice] = useState(null);
  const [composerTab, setComposerTab] = useState("split"); // "split", "edit", "preview"

  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);

  // Parse category tag or intelligently infer from notice title & content
  const parseNotice = (notice) => {
    if (!notice) return { category: "OFFICIAL", displayTitle: "", excerpt: "", isAuto: false };
    
    // 1. Check for explicit [TAG] prefix in title
    const match = notice.title.match(/^\[(OFFICIAL|ACADEMIC|EVENTS|EVENT|URGENT|GENERAL)\]\s*(.*)$/i);
    let category = "OFFICIAL";
    let displayTitle = notice.title;
    let isAuto = false;

    if (match) {
      const raw = match[1].toUpperCase();
      category = raw === "EVENT" ? "EVENTS" : raw === "GENERAL" ? "OFFICIAL" : raw;
      displayTitle = match[2] || notice.title;
    } else {
      // 2. Smart auto-identification based on keywords in title and content
      const haystack = `${notice.title} ${notice.content || ""}`.toLowerCase();
      if (/urgent|deadline|immediate|attention|emergency|mandatory|alert|asap/i.test(haystack)) {
        category = "URGENT";
      } else if (/session|workshop|event|hackathon|meetup|webinar|gathering|celebration|ceremony|competition|tournament|bootcamp|orientation/i.test(haystack)) {
        category = "EVENTS";
      } else if (/academic|exam|lecture|assignment|semester|syllabus|course|results|class|gpa|quiz|faculty|degree/i.test(haystack)) {
        category = "ACADEMIC";
      } else {
        category = "OFFICIAL";
      }
      isAuto = true;
    }

    // 3. Clean excerpt: properly strip markdown images, links, raw URLs, code blocks, headings
    const excerpt = (notice.content || "")
      .replace(/!\[.*?\]\(.*?\)/g, "") // strip images ![alt](url)
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // convert [text](url) -> text
      .replace(/https?:\/\/[^\s)]+/g, "") // strip raw URLs
      .replace(/```[\s\S]*?```/g, "") // strip code blocks
      .replace(/`.*?`/g, "") // strip inline code
      .replace(/^#+\s+/gm, "") // strip headings
      .replace(/[*_~>]/g, "") // strip markdown emphasis symbols
      .replace(/[-=]{3,}/g, "") // strip horizontal dividers
      .replace(/\s+/g, " ") // collapse multiple spaces
      .trim();

    return { category, displayTitle, excerpt, isAuto };
  };

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("notices")
      .select("id, title, content, is_public, created_at, created_by", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const q = searchText.trim();
    if (q) {
      query = query.or(`id.ilike.%${q}%,title.ilike.%${q}%,content.ilike.%${q}%`);
    }

    if (!isAdmin) {
      query = query.eq("is_public", true);
    } else if (scopeFilter === "public") {
      query = query.eq("is_public", true);
    } else if (scopeFilter === "internal") {
      query = query.eq("is_public", false);
    }

    try {
      const { data, count, error } = await query;
      if (error) throw error;
      setNotices(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error loading notices:", err);
      setMsg({ type: "error", text: "Failed to load dispatches: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, search);
  }, [page, search, isAdmin, scopeFilter]);

  // Frontend category filtering
  const filteredNotices = useMemo(() => {
    if (selectedCategory === "ALL") return notices;
    return notices.filter((n) => {
      const { category } = parseNotice(n);
      return category === selectedCategory;
    });
  }, [notices, selectedCategory]);

  // Compute telemetry metrics
  const telemetry = useMemo(() => {
    const pub = notices.filter(n => n.is_public).length;
    const internal = notices.filter(n => !n.is_public).length;
    return { total, publicCount: pub, internalCount: internal };
  }, [notices, total]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setComposerTab("split");
    setModal(true);
    setMsg(null);
  };

  const openEdit = (n) => {
    const { category, displayTitle } = parseNotice(n);
    setForm({
      id: n.id,
      category: category,
      title: displayTitle,
      content: n.content,
      is_public: n.is_public
    });
    setEditTarget(n.id);
    setComposerTab("split");
    setModal(true);
    setMsg(null);
  };

  const closeModal = () => {
    setModal(false);
    setMsg(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setMsg({ type: "error", text: "Dispatch title and markdown content are required." });
      return;
    }

    setSaving(true);
    setMsg(null);

    // Format final title with clean Category bracket: [CATEGORY] Title
    const finalTitle = `[${form.category}] ${form.title.trim()}`;

    let targetId = form.id.trim();
    if (!targetId) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const cleanTitle = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = cleanTitle.substring(0, 32);
      targetId = `${dateStr}-${slug || Math.floor(Math.random() * 1000)}`;
    } else {
      targetId = targetId.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
    }

    const payload = {
      id: targetId,
      title: finalTitle,
      content: form.content,
      is_public: form.is_public,
      updated_at: new Date().toISOString()
    };

    try {
      if (editTarget) {
        const { error } = await supabase
          .from("notices")
          .update({
            title: payload.title,
            content: payload.content,
            is_public: payload.is_public,
            updated_at: payload.updated_at
          })
          .eq("id", editTarget);

        if (error) throw error;
      } else {
        payload.created_by = session?.userId || null;
        const { error } = await supabase
          .from("notices")
          .insert([payload]);

        if (error) throw error;
      }

      setMsg({ type: "success", text: "Dispatch saved and synchronized successfully." });
      setTimeout(() => {
        closeModal();
        load(page, search);
      }, 700);
    } catch (err) {
      console.error("Error saving notice:", err);
      setMsg({ type: "error", text: "Failed to commit notice: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Permanently remove notice [${id}] from the system?`)) return;
    try {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
      load(page, search);
    } catch (err) {
      console.error("Error deleting notice:", err);
      alert("Failed to delete notice: " + err.message);
    }
  };

  const handleCopyLink = (id) => {
    const link = `${window.location.origin}/notice?id=${id}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
      });
  };

  const handleWhatsAppShare = (n) => {
    const { displayTitle, excerpt } = parseNotice(n);
    const permalink = `${window.location.origin}/notice?id=${n.id}`;
    const text = `📢 *ADSS RUHUNA DISPATCH*\n\n*${displayTitle}*\n\n${excerpt.substring(0, 140)}...\n\n🔗 *Full Circular:* ${permalink}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const insertMarkdown = (prefix, suffix = "") => {
    const textarea = document.getElementById("dispatch-markdown-input");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.content;
    const selected = text.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setForm({ ...form, content: newContent });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 50);
  };

  const renderMarkdown = (mdContent) => {
    try {
      return { __html: marked.parse(mdContent || "") };
    } catch (err) {
      return { __html: `<p class="text-[#eb5757] font-berkeley-mono text-xs">Markdown rendering error</p>` };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const getCategoryConfig = (category) => {
    return getCategoryThemeConfig(category, isDark);
  };

  // Hero feature notice: either the first urgent notice or the top notice on first page
  const featuredNotice = useMemo(() => {
    if (page !== 0 || search || selectedCategory !== "ALL" || filteredNotices.length === 0) return null;
    const urgent = filteredNotices.find(n => n.title.includes("[URGENT]"));
    return urgent || filteredNotices[0];
  }, [filteredNotices, page, search, selectedCategory]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-white text-gray-800"} font-inter-variable pb-20 selection:bg-[#e4f222]/20 selection:text-white`}>
      {/* ── HIGH-DENSITY COMPACT CONTROL BAR ── */}
      <div className={`border-b ${isDark ? "border-[#23252a] bg-[#0c0c0e]/95" : "border-gray-200 bg-white/95"} backdrop-blur-md sticky top-0 z-20`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
          {/* Row 1: Title, Live Telemetry & Add Action (Compact Single Line) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Megaphone className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"} flex-shrink-0`} />
              <h1 className={`text-[16px] sm:text-[17px] font-[590] tracking-[-0.018em] ${isDark ? "text-[#ffffff]" : "text-gray-900"} truncate`}>
                Dispatches & Notices
              </h1>
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] ${
                isDark ? "bg-[#161718] border border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border border-gray-200 text-gray-600"
              }`}>
                <span>{total} total</span>
                <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                <span className="text-emerald-500 font-medium">{telemetry.publicCount} public</span>
                {isAdmin && (
                  <>
                    <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>·</span>
                    <span className="text-amber-500 font-medium">{telemetry.internalCount} internal</span>
                  </>
                )}
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={openAdd}
                className={`h-7 px-3 text-[12px] font-[510] flex items-center gap-1.5 rounded-[5px] flex-shrink-0 shadow-sm hover:brightness-105 transition-all ${
                  isDark ? "linear-btn-primary" : "bg-gray-900 text-white hover:bg-black shadow-sm"
                }`}
              >
                <Plus className={`w-3.5 h-3.5 ${isDark ? "text-[#08090a]" : "text-white"}`} />
                <span>Post Notice</span>
              </button>
            )}
          </div>

          {/* Row 2: Scope Tabs, Taxonomy Pills & Search Input (Single Compact Control Line) */}
          <div className={`flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t ${isDark ? "border-[#1a1b1e]" : "border-gray-100"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Scope Segment */}
              <div className={`flex items-center p-0.5 rounded-[5px] ${isDark ? "bg-[#161718] border border-[#23252a]" : "bg-gray-100 border border-gray-200"}`}>
                <button
                  onClick={() => { setScopeFilter("all"); setPage(0); }}
                  className={`px-2 py-0.5 rounded-[3px] text-[11px] font-[510] transition-colors ${
                    scopeFilter === "all" 
                      ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                      : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900")
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => { setScopeFilter("public"); setPage(0); }}
                  className={`px-2 py-0.5 rounded-[3px] text-[11px] font-[510] transition-colors flex items-center gap-1 ${
                    scopeFilter === "public" 
                      ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                      : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900")
                  }`}
                >
                  <Globe className="w-2.5 h-2.5 text-emerald-500" /> Public
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { setScopeFilter("internal"); setPage(0); }}
                    className={`px-2 py-0.5 rounded-[3px] text-[11px] font-[510] transition-colors flex items-center gap-1 ${
                      scopeFilter === "internal" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900")
                    }`}
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-500" /> Internal
                  </button>
                )}
              </div>

              <div className={`h-3.5 w-px hidden sm:block ${isDark ? "bg-[#23252a]" : "bg-gray-200"}`} />

              {/* Taxonomy Pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const IconComp = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-[510] transition-all flex-shrink-0 border ${
                        isSelected
                          ? (isDark ? "bg-[#161718] text-white border-[#383b42] shadow-sm ring-1 ring-white/10" : "bg-white text-gray-900 border-gray-300 shadow-sm ring-1 ring-black/5 font-semibold")
                          : (isDark ? "bg-[#0f1011] text-[#8a8f98] border-[#23252a] hover:text-white hover:border-[#30333a]" : "bg-gray-50 text-gray-600 border-gray-200 hover:text-gray-900 hover:bg-gray-100")
                      }`}
                    >
                      {IconComp ? <IconComp className="w-3 h-3" /> : cat.dot && <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />}
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Precision Search Input */}
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className={`w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search dispatches..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className={`w-full h-7 pl-7 pr-6 rounded-[5px] text-[11px] transition-colors focus:outline-none ${
                  isDark 
                    ? "bg-[#0f1011] border border-[#23252a] focus:border-[#383b42] text-white placeholder-[#62666d]" 
                    : "bg-white border border-gray-200 focus:border-gray-400 text-gray-900 placeholder-gray-400 shadow-sm"
                }`}
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(0); }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {loading ? (
          <div className={`flex flex-col items-center justify-center py-24 gap-3 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            <div className={`w-7 h-7 border-2 rounded-full animate-spin ${
              isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"
            }`} />
            <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
              Fetching dispatches from Supabase...
            </span>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className={`p-10 text-center flex flex-col items-center justify-center gap-3 border border-dashed rounded-[12px] my-4 ${
            isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-gray-50/80 border-gray-200"
          }`}>
            <div className={`w-10 h-10 rounded-[8px] border flex items-center justify-center ${
              isDark ? "bg-[#161718] border-[#23252a] text-[#62666d]" : "bg-white border-gray-200 text-gray-400 shadow-sm"
            }`}>
              <Megaphone className="w-5 h-5" />
            </div>
            <p className={`text-[14px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>No notices found</p>
            <p className={`text-[12px] max-w-md ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
              {search 
                ? `No notices matched "${search}". Clear your search query or pick another category filter.` 
                : "No notices have been published under this scope yet. Admins can post a new dispatch above."}
            </p>
            {search && (
              <button
                onClick={() => { setSearch(""); setSelectedCategory("ALL"); }}
                className={`mt-2 text-[12px] hover:underline font-berkeley-mono ${
                  isDark ? "text-[#e4f222]" : "text-indigo-600 font-medium"
                }`}
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Featured Hero Notice ── */}
            {featuredNotice && (
              <div className={`relative overflow-hidden rounded-[12px] p-4 sm:p-6 transition-colors ${
                isDark 
                  ? "bg-[#0f1011] border border-[#23252a] shadow-xl hover:border-[#383b42]" 
                  : "bg-white border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md"
              }`}>
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
                  isDark ? "from-[#e4f222] via-[#6366f1] to-transparent opacity-80" : "from-indigo-500 via-amber-500 to-transparent opacity-100"
                }`} />
                
                {(() => {
                  const { category, displayTitle, excerpt } = parseNotice(featuredNotice);
                  const catConfig = getCategoryConfig(category);
                  const IconComp = catConfig.icon || ShieldCheck;

                  return (
                    <>
                      {/* Top Badges Row: Category, Featured status, Scope, ID, and Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Prominent Category Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] border ${catConfig.color}`}>
                            <IconComp className="w-3 h-3" />
                            {category}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] border ${
                            isDark 
                              ? "bg-[#e4f222]/10 border-[#e4f222]/30 text-[#e4f222]" 
                              : "bg-amber-50 border-amber-200 text-amber-700"
                          }`}>
                            <Flame className="w-3 h-3" /> FEATURED
                          </span>

                          {featuredNotice.is_public ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[9px] uppercase ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] text-emerald-400" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}>
                              <Globe className="w-2.5 h-2.5" /> PUBLIC
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[9px] uppercase ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] text-amber-400" 
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}>
                              <Lock className="w-2.5 h-2.5" /> INTERNAL ONLY
                            </span>
                          )}

                          <span className={`px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" 
                              : "bg-gray-100 border-gray-200 text-gray-600"
                          }`}>
                            #{featuredNotice.id}
                          </span>
                        </div>

                        <span className={`text-[11px] font-berkeley-mono flex items-center gap-1 ${
                          isDark ? "text-[#62666d]" : "text-gray-400"
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatDate(featuredNotice.created_at)}
                        </span>
                      </div>

                      {/* Title & Excerpt */}
                      <h2 
                        onClick={() => setActiveNotice(featuredNotice)}
                        className={`text-lg sm:text-xl font-[590] tracking-[-0.022em] cursor-pointer transition-colors line-clamp-2 ${
                          isDark ? "text-white hover:text-[#e4f222]" : "text-gray-900 hover:text-indigo-600"
                        }`}
                      >
                        {displayTitle}
                      </h2>
                      <p className={`text-[13px] leading-relaxed mt-1.5 line-clamp-2 font-[400] ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600"
                      }`}>
                        {excerpt || "No excerpt text available."}
                      </p>

                      {/* Bottom Action Row */}
                      <div className={`flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t ${
                        isDark ? "border-[#1a1b1e]" : "border-gray-100"
                      }`}>
                        <div className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                          PERMALINK: <span className={isDark ? "text-[#8a8f98]" : "text-gray-600 font-medium"}>/notice?id={featuredNotice.id}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleWhatsAppShare(featuredNotice)}
                            className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1.5 transition-colors ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] hover:border-[#25D366]/50 hover:text-[#25D366] text-[#8a8f98]" 
                                : "bg-white border-gray-200 hover:border-emerald-500 hover:text-emerald-600 text-gray-600 shadow-sm"
                            }`}
                            title="Share to WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

                          <button
                            onClick={() => handleCopyLink(featuredNotice.id)}
                            className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1.5 transition-colors ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] hover:border-[#383b42] text-[#8a8f98] hover:text-white" 
                                : "bg-white border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 shadow-sm"
                            }`}
                          >
                            {copiedId === featuredNotice.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setActiveNotice(featuredNotice)}
                            className={`h-7 px-3 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1.5 transition-colors ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] hover:border-white/20 text-white" 
                                : "bg-gray-900 border-gray-900 hover:bg-black text-white shadow-sm"
                            }`}
                          >
                            <Eye className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-amber-300"}`} />
                            <span>Quick View</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => openEdit(featuredNotice)}
                              className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1 transition-colors ${
                                isDark 
                                  ? "bg-[#161718] border-[#23252a] hover:border-indigo-400/40 text-[#8a8f98] hover:text-indigo-400" 
                                  : "bg-white border-gray-200 hover:border-indigo-400 text-gray-600 hover:text-indigo-600 shadow-sm"
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── Precision Notice Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredNotices.map((n) => {
                const { category, displayTitle, excerpt } = parseNotice(n);
                const catConfig = getCategoryConfig(category);
                const IconComp = catConfig.icon || ShieldCheck;

                return (
                  <div
                    key={n.id}
                    className={`group relative flex flex-col justify-between rounded-[12px] border p-4 sm:p-5 transition-all shadow-sm ${
                      isDark 
                        ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b42]" 
                        : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div>
                      {/* Card Meta Row */}
                      <div className={`flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b ${
                        isDark ? "border-[#1a1b1e]" : "border-gray-100"
                      }`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Category Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] border ${catConfig.color}`}>
                            <IconComp className="w-3 h-3" />
                            {category}
                          </span>

                          {n.is_public ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[9px] uppercase ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] text-emerald-400" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}>
                              <Globe className="w-2.5 h-2.5" /> PUBLIC
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[9px] uppercase ${
                              isDark 
                                ? "bg-[#161718] border-[#23252a] text-amber-400" 
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}>
                              <Lock className="w-2.5 h-2.5" /> INTERNAL
                            </span>
                          )}

                          <span className={`px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" 
                              : "bg-gray-100 border-gray-200 text-gray-600"
                          }`}>
                            #{n.id}
                          </span>
                        </div>

                        <span className={`text-[10px] font-berkeley-mono flex items-center gap-1 ${
                          isDark ? "text-[#62666d]" : "text-gray-400"
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(n.created_at)}
                        </span>
                      </div>

                      {/* Title & Excerpt */}
                      <h3
                        onClick={() => setActiveNotice(n)}
                        className={`text-[15px] font-[590] tracking-[-0.015em] cursor-pointer transition-colors leading-snug line-clamp-2 ${
                          isDark 
                            ? "text-[#ffffff] group-hover:text-[#e4f222]" 
                            : "text-gray-900 group-hover:text-indigo-600"
                        }`}
                      >
                        {displayTitle}
                      </h3>

                      <p className={`text-[12px] font-[400] leading-relaxed mt-1.5 line-clamp-3 ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600"
                      }`}>
                        {excerpt || "No summary text provided."}
                      </p>
                    </div>

                    {/* Bottom Actions Toolbar */}
                    <div className={`mt-3.5 pt-2.5 border-t flex items-center justify-between gap-2 ${
                      isDark ? "border-[#1a1b1e]" : "border-gray-100"
                    }`}>
                      <div className={`font-berkeley-mono text-[10px] truncate max-w-[120px] ${
                        isDark ? "text-[#62666d]" : "text-gray-400"
                      }`}>
                        ID: {n.id}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleWhatsAppShare(n)}
                          className={`w-7 h-7 rounded-[5px] border flex items-center justify-center transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] hover:border-[#25D366]/40 text-[#8a8f98] hover:text-[#25D366]" 
                              : "bg-white border-gray-200 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 shadow-sm"
                          }`}
                          title="Share to WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleCopyLink(n.id)}
                          className={`w-7 h-7 rounded-[5px] border flex items-center justify-center transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] hover:border-[#383b42] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm"
                          }`}
                          title="Copy permalink"
                        >
                          {copiedId === n.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => setActiveNotice(n)}
                          className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1 transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] hover:border-white/20 text-[#d0d6e0] hover:text-white" 
                              : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200 hover:text-gray-900"
                          }`}
                        >
                          <Eye className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                          <span>View</span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(n)}
                              className={`w-7 h-7 rounded-[5px] border flex items-center justify-center transition-colors ${
                                isDark 
                                  ? "bg-[#161718] border-[#23252a] hover:border-indigo-400/40 text-[#8a8f98] hover:text-indigo-400" 
                                  : "bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 shadow-sm"
                              }`}
                              title="Edit notice"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(n.id)}
                              className={`w-7 h-7 rounded-[5px] border flex items-center justify-center transition-colors ${
                                isDark 
                                  ? "bg-[#161718] border-[#23252a] hover:border-[#eb5757]/40 text-[#8a8f98] hover:text-[#eb5757]" 
                                  : "bg-white border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-300 shadow-sm"
                              }`}
                              title="Delete notice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-6">
            <Pagination
              current={page}
              total={total}
              onChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}
      </div>

      {/* ── QUICK VIEW MODAL ── */}
      {activeNotice && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150 ${
            isDark ? "bg-black/80" : "bg-black/50"
          }`}
          onClick={() => setActiveNotice(null)}
        >
          <div 
            className={`w-full max-w-3xl max-h-[88vh] flex flex-col border rounded-[12px] shadow-2xl overflow-hidden ${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-start justify-between p-5 border-b ${
              isDark ? "border-[#23252a] bg-[#0c0c0e]" : "border-gray-200 bg-gray-50/80"
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const { category } = parseNotice(activeNotice);
                    const cfg = getCategoryConfig(category);
                    const IconComp = cfg.icon || ShieldCheck;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[10px] uppercase font-[510] border ${cfg.color}`}>
                        <IconComp className="w-3 h-3" />
                        {category}
                      </span>
                    );
                  })()}
                  {activeNotice.is_public ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] uppercase ${
                      isDark 
                        ? "bg-[#161718] border-[#23252a] text-emerald-400" 
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}>
                      <Globe className="w-2.5 h-2.5" /> PUBLIC
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] uppercase ${
                      isDark 
                        ? "bg-[#161718] border-[#23252a] text-amber-400" 
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      <Lock className="w-2.5 h-2.5" /> INTERNAL ONLY
                    </span>
                  )}
                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                    ID: {activeNotice.id}
                  </span>
                </div>
                <h2 className={`text-lg sm:text-xl font-[590] tracking-[-0.022em] ${isDark ? "text-white" : "text-gray-900"}`}>
                  {parseNotice(activeNotice).displayTitle}
                </h2>
                <div className={`text-[11px] font-berkeley-mono flex items-center gap-1.5 mt-1 ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                  <Clock className="w-3 h-3" />
                  Published {formatDate(activeNotice.created_at)}
                </div>
              </div>

              <button
                onClick={() => setActiveNotice(null)}
                className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors ${
                  isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className={`flex-1 overflow-y-auto p-6 text-[14px] leading-relaxed markdown-body ${
              isDark ? "text-[#d0d6e0] bg-[#0f1011]" : "text-gray-800 bg-white"
            }`}>
              <div dangerouslySetInnerHTML={renderMarkdown(activeNotice.content)} />
            </div>

            {/* Modal Footer */}
            <div className={`flex flex-wrap items-center justify-between gap-3 p-4 border-t ${
              isDark ? "border-[#23252a] bg-[#0c0c0e]" : "border-gray-200 bg-gray-50/80"
            }`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWhatsAppShare(activeNotice)}
                  className={`h-8 px-3 rounded-[6px] border text-[12px] font-[510] flex items-center gap-1.5 transition-colors ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] hover:border-[#25D366]/40 text-[#8a8f98] hover:text-[#25D366]" 
                      : "bg-white border-gray-200 hover:border-emerald-500 text-gray-700 hover:text-emerald-600 shadow-sm"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Share via WhatsApp</span>
                </button>

                <button
                  onClick={() => handleCopyLink(activeNotice.id)}
                  className={`h-8 px-3 rounded-[6px] border text-[12px] font-[510] flex items-center gap-1.5 transition-colors ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] hover:border-[#383b42] text-[#8a8f98] hover:text-white" 
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-sm"
                  }`}
                >
                  {copiedId === activeNotice.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <a
                  href={`/notice?id=${activeNotice.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`h-8 px-3 rounded-[6px] border text-[12px] font-[510] flex items-center gap-1.5 transition-colors ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] hover:border-white/20 text-[#d0d6e0] hover:text-white" 
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-sm"
                  }`}
                >
                  <span>Open Standalone</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <button
                onClick={() => setActiveNotice(null)}
                className={`h-8 px-4 rounded-[6px] border text-[12px] font-[510] transition-colors ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] hover:bg-[#23252a] text-white" 
                    : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-800"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT NOTICE COMPOSER MODAL (2-COLUMN MARKDOWN WITH LIVE PREVIEW) ── */}
      {modal && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-150 ${
            isDark ? "bg-black/85" : "bg-black/50"
          }`}
          onClick={closeModal}
        >
          <div 
            className={`w-full max-w-5xl max-h-[92vh] flex flex-col border rounded-[12px] shadow-2xl overflow-hidden ${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 sm:p-5 border-b ${
              isDark ? "border-[#23252a] bg-[#0c0c0e]" : "border-gray-200 bg-gray-50/80"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-[6px] border flex items-center justify-center ${
                  isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-white border-gray-200 text-indigo-600 shadow-sm"
                }`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={`text-[15px] font-[590] tracking-[-0.015em] ${isDark ? "text-white" : "text-gray-900"}`}>
                    {editTarget ? "Edit Dispatch Notice" : "Compose New Dispatch Notice"}
                  </h2>
                  <p className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    SUPABASE DISPATCH SYSTEM · MARKDOWN SYNCHRONIZED
                  </p>
                </div>
              </div>

              {/* View Toggle on Mobile / Small screens */}
              <div className="flex items-center gap-1">
                <div className={`lg:hidden flex items-center p-0.5 rounded-[6px] border mr-2 ${
                  isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"
                }`}>
                  <button
                    onClick={() => setComposerTab("edit")}
                    className={`px-2 py-1 rounded-[4px] text-[11px] font-[510] ${
                      composerTab === "edit" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98]" : "text-gray-500")
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setComposerTab("preview")}
                    className={`px-2 py-1 rounded-[4px] text-[11px] font-[510] ${
                      composerTab === "preview" 
                        ? (isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-sm font-semibold") 
                        : (isDark ? "text-[#8a8f98]" : "text-gray-500")
                    }`}
                  >
                    Preview
                  </button>
                </div>

                <button
                  onClick={closeModal}
                  className={`w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors ${
                    isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#161718]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {msg && (
              <div className={`mx-5 mt-4 p-3 rounded-[6px] border text-[12px] font-[510] flex items-center gap-2 ${
                msg.type === "error" 
                  ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" 
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}

            {/* Modal Body: 2-Column Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Left Column: Form Controls */}
                <div className={`flex flex-col gap-4 ${composerTab === "preview" ? "hidden lg:flex" : "flex"}`}>
                  {/* Category Selector */}
                  <div>
                    <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1.5 ${
                      isDark ? "text-[#8a8f98]" : "text-gray-600 font-semibold"
                    }`}>
                      Dispatch Category Tag *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORIES.filter(c => c.id !== "ALL").map(c => {
                        const IconComp = c.icon;
                        const isSelected = form.category === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setForm({ ...form, category: c.id })}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[6px] text-[11px] font-[510] border transition-all ${
                              isSelected
                                ? (isDark ? "bg-[#161718] text-white border-[#383b42] shadow-sm ring-1 ring-white/10" : "bg-gray-900 text-white border-gray-900 shadow-sm")
                                : (isDark ? "bg-[#0c0c0e] text-[#8a8f98] border-[#23252a] hover:text-white" : "bg-gray-50 text-gray-600 border-gray-200 hover:text-gray-900 hover:bg-gray-100")
                            }`}
                          >
                            {IconComp && <IconComp className="w-3 h-3" />}
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider mb-1.5 ${
                      isDark ? "text-[#8a8f98]" : "text-gray-600 font-semibold"
                    }`}>
                      Notice Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Annual General Meeting & Committee Nominations"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className={`w-full h-9 px-3 border rounded-[6px] text-[13px] transition-colors focus:outline-none ${
                        isDark 
                          ? "bg-[#0c0c0e] border-[#23252a] focus:border-[#383b42] text-white placeholder-[#62666d]" 
                          : "bg-white border-gray-200 focus:border-gray-400 text-gray-900 placeholder-gray-400 shadow-sm"
                      }`}
                      required
                    />
                  </div>

                  {/* Notice Slug / ID */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600 font-semibold"
                      }`}>
                        Custom Slug / ID (Optional)
                      </label>
                      <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                        /notice?id=...
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 2024-agm-nominations"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      disabled={!!editTarget}
                      className={`w-full h-8 px-3 border rounded-[6px] text-[12px] font-berkeley-mono transition-colors focus:outline-none disabled:opacity-60 ${
                        isDark 
                          ? "bg-[#0c0c0e] border-[#23252a] focus:border-[#383b42] text-white placeholder-[#62666d]" 
                          : "bg-white border-gray-200 focus:border-gray-400 text-gray-900 placeholder-gray-400 shadow-sm"
                      }`}
                    />
                    {!editTarget && (
                      <span className={`text-[10px] font-berkeley-mono mt-1 block ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                        Leave blank to auto-generate a dated permalink from title.
                      </span>
                    )}
                  </div>

                  {/* Public Visibility Toggle */}
                  <div className={`flex items-center justify-between p-3 rounded-[6px] border ${
                    isDark ? "bg-[#0c0c0e] border-[#23252a]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {form.is_public ? (
                        <Globe className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-500" />
                      )}
                      <div>
                        <div className={`text-[12px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                          {form.is_public ? "Public Notice (Accessible to all)" : "Internal Notice (Restricted to logged-in users)"}
                        </div>
                        <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                          {form.is_public ? "Shared on public landing and shareable links" : "Only members and staff can view"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_public: !form.is_public })}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        form.is_public ? "bg-emerald-500" : (isDark ? "bg-[#23252a]" : "bg-gray-300")
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          form.is_public ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Markdown Editor with Quick Formatting Toolbar */}
                  <div className="flex-1 flex flex-col min-h-[220px]">
                    <div className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                      isDark ? "border-[#23252a]" : "border-gray-200"
                    }`}>
                      <label className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600 font-semibold"
                      }`}>
                        Markdown Document *
                      </label>

                      {/* Formatting Shortcut Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => insertMarkdown("**", "**")}
                          className={`w-6 h-6 rounded-[4px] border flex items-center justify-center text-[11px] transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                          }`}
                          title="Bold"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown("## ")}
                          className={`w-6 h-6 rounded-[4px] border flex items-center justify-center text-[11px] transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                          }`}
                          title="Heading 2"
                        >
                          <Heading className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown("- ")}
                          className={`w-6 h-6 rounded-[4px] border flex items-center justify-center text-[11px] transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                          }`}
                          title="Bullet list"
                        >
                          <List className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown("[", "](https://)")}
                          className={`w-6 h-6 rounded-[4px] border flex items-center justify-center text-[11px] transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                          }`}
                          title="Insert link"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown("```\n", "\n```")}
                          className={`w-6 h-6 rounded-[4px] border flex items-center justify-center text-[11px] transition-colors ${
                            isDark 
                              ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white" 
                              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm"
                          }`}
                          title="Code block"
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      id="dispatch-markdown-input"
                      placeholder="Write your dispatch announcement in Markdown format... Supports headings, lists, tables, and bold tags."
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className={`flex-1 min-h-[220px] p-3 border rounded-[6px] text-[13px] font-berkeley-mono resize-none leading-relaxed transition-colors focus:outline-none ${
                        isDark 
                          ? "bg-[#0c0c0e] border-[#23252a] focus:border-[#383b42] text-white placeholder-[#62666d]" 
                          : "bg-white border-gray-200 focus:border-gray-400 text-gray-900 placeholder-gray-400 shadow-sm"
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Right Column: Live Rendered Synchronized Preview */}
                <div className={`flex flex-col border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 ${
                  isDark ? "border-[#23252a]" : "border-gray-200"
                } ${composerTab === "edit" ? "hidden lg:flex" : "flex"}`}>
                  <div className={`flex items-center justify-between pb-2 mb-3 border-b ${
                    isDark ? "border-[#23252a]" : "border-gray-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Eye className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                      <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-600 font-semibold"
                      }`}>
                        Live Document Preview
                      </span>
                    </div>
                    <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                      GFM RENDERING
                    </span>
                  </div>

                  <div className={`flex-1 overflow-y-auto p-4 rounded-[8px] border markdown-body min-h-[300px] ${
                    isDark ? "border-[#23252a] bg-[#0c0c0e]" : "border-gray-200 bg-gray-50/50"
                  }`}>
                    {form.title && (
                      <div className={`mb-4 pb-3 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-berkeley-mono text-[9px] uppercase font-[510] border ${getCategoryConfig(form.category).color}`}>
                            {form.category}
                          </span>
                          <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                            {form.is_public ? "PUBLIC" : "INTERNAL"}
                          </span>
                        </div>
                        <h2 className={`text-xl font-[590] tracking-[-0.02em] !mt-0 !mb-0 !border-0 ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}>
                          {form.title}
                        </h2>
                      </div>
                    )}

                    {form.content ? (
                      <div dangerouslySetInnerHTML={renderMarkdown(form.content)} />
                    ) : (
                      <div className={`h-full flex flex-col items-center justify-center text-center p-8 ${
                        isDark ? "text-[#62666d]" : "text-gray-400"
                      }`}>
                        <FileText className="w-8 h-8 mb-2 stroke-[1.2]" />
                        <p className="text-[12px] font-berkeley-mono">
                          Live rendered Markdown circular will appear here in real-time.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-between p-4 border-t ${
              isDark ? "border-[#23252a] bg-[#0c0c0e]" : "border-gray-200 bg-gray-50/80"
            }`}>
              <div className={`font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                {form.content ? `${form.content.split(/\s+/).filter(Boolean).length} words` : "0 words"}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={`h-8 px-4 rounded-[6px] border text-[12px] font-[510] transition-colors ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] hover:bg-[#23252a] text-[#d0d6e0]" 
                      : "bg-white border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`h-8 px-5 rounded-[6px] text-[12px] font-[510] transition-all disabled:opacity-50 ${
                    isDark ? "linear-btn-primary" : "bg-gray-900 text-white hover:bg-black shadow-sm"
                  }`}
                >
                  {saving ? "Synchronizing..." : editTarget ? "Update Dispatch" : "Publish Dispatch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

