import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { marked } from "marked";
import { 
  Megaphone, 
  Share2, 
  Check, 
  ArrowLeft, 
  Calendar, 
  AlertCircle, 
  Clock,
  MessageCircle,
  Copy,
  BookOpen,
  ShieldCheck,
  Globe
} from "lucide-react";

export default function PublicNotice({ onBackToLanding, theme }) {
  const isDark = theme ? theme === "dark" : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const getNoticeIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id");
    if (queryId) return queryId;

    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const pathParts = pathname.split("/");
    const hashParts = hash.split("/");

    if (pathParts[1] === "notice" && pathParts[2]) return pathParts[2];
    if (hashParts[1] === "#/notice" && hashParts[2]) return hashParts[2];
    if (hashParts[1] === "notice" && hashParts[2]) return hashParts[2];

    return null;
  };

  const loadNotice = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const targetId = getNoticeIdFromUrl();

      if (!targetId) {
        setErrorMsg("No notice ID specified in the URL address.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notices")
        .select("id, title, content, is_public, created_at")
        .eq("id", targetId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNotice(data);
      } else {
        setErrorMsg("The requested notice could not be found, or it is restricted to internal members.");
      }
    } catch (err) {
      console.error("Error loading public notice:", err);
      setErrorMsg("Failed to synchronize notice from society database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    loadNotice();

    const handleUrlChange = () => {
      loadNotice();
    };
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
      });
  };

  const parseNotice = (n) => {
    if (!n) return { category: "OFFICIAL", displayTitle: "", excerpt: "" };
    const match = n.title.match(/^\[(OFFICIAL|ACADEMIC|EVENTS|EVENT|URGENT|GENERAL)\]\s*(.*)$/i);
    let category = "OFFICIAL";
    let displayTitle = n.title;

    if (match) {
      const raw = match[1].toUpperCase();
      category = raw === "EVENT" ? "EVENTS" : raw === "GENERAL" ? "OFFICIAL" : raw;
      displayTitle = match[2] || n.title;
    } else {
      const haystack = `${n.title} ${n.content || ""}`.toLowerCase();
      if (/urgent|deadline|immediate|attention|emergency|mandatory|alert|asap/i.test(haystack)) {
        category = "URGENT";
      } else if (/session|workshop|event|hackathon|meetup|webinar|gathering|celebration|ceremony|competition|tournament|bootcamp/i.test(haystack)) {
        category = "EVENTS";
      } else if (/academic|exam|lecture|assignment|semester|syllabus|course|results|class|gpa|quiz|faculty|degree/i.test(haystack)) {
        category = "ACADEMIC";
      } else {
        category = "OFFICIAL";
      }
    }

    const excerpt = (n.content || "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/https?:\/\/[^\s)]+/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`.*?`/g, "")
      .replace(/^#+\s+/gm, "")
      .replace(/[*_~>]/g, "")
      .replace(/[-=]{3,}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return { category, displayTitle, excerpt };
  };

  const handleWhatsAppShare = () => {
    if (!notice) return;
    const { displayTitle, excerpt } = parseNotice(notice);
    const text = `📢 *ADSS RUHUNA DISPATCH*\n\n*${displayTitle}*\n\n${excerpt.substring(0, 140)}...\n\n🔗 *Full Circular:* ${window.location.href}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const renderMarkdown = (mdContent) => {
    try {
      return { __html: marked.parse(mdContent || "") };
    } catch (err) {
      return { __html: `<p class="text-[#eb5757] font-berkeley-mono text-xs">Markdown parsing error</p>` };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  };

  const parsedInfo = useMemo(() => {
    if (!notice) return { category: "OFFICIAL", displayTitle: "", excerpt: "", readTime: "1 min" };
    const p = parseNotice(notice);
    const wordCount = (notice.content || "").split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 180));
    return { ...p, readTime: `${minutes} min read` };
  }, [notice]);

  const getCategoryTheme = (cat) => {
    switch (cat) {
      case "URGENT":
        return {
          text: isDark ? "text-[#eb5757]" : "text-rose-700",
          border: isDark ? "border-[#eb5757]/30" : "border-rose-200",
          bg: isDark ? "bg-[#eb5757]/10" : "bg-rose-50",
          dot: isDark ? "bg-[#eb5757]" : "bg-rose-500"
        };
      case "ACADEMIC":
        return {
          text: isDark ? "text-amber-400" : "text-orange-800",
          border: isDark ? "border-amber-400/30" : "border-orange-200",
          bg: isDark ? "bg-amber-400/10" : "bg-orange-50",
          dot: isDark ? "bg-amber-400" : "bg-orange-500"
        };
      case "EVENTS":
        return {
          text: isDark ? "text-indigo-400" : "text-indigo-700",
          border: isDark ? "border-indigo-400/30" : "border-indigo-200",
          bg: isDark ? "bg-indigo-400/10" : "bg-indigo-50",
          dot: isDark ? "bg-indigo-400" : "bg-indigo-500"
        };
      default:
        return {
          text: isDark ? "text-[#e4f222]" : "text-amber-800",
          border: isDark ? "border-[#e4f222]/30" : "border-amber-200",
          bg: isDark ? "bg-[#e4f222]/10" : "bg-amber-50",
          dot: isDark ? "bg-[#e4f222]" : "bg-amber-500"
        };
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center flex-col gap-3 font-inter-variable ${
        isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-white text-gray-800"
      }`}>
        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
          isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"
        }`} />
        <p className={`font-berkeley-mono text-[11px] uppercase tracking-wider ${
          isDark ? "text-[#8a8f98]" : "text-gray-500"
        }`}>
          Retrieving Society Dispatch...
        </p>
      </div>
    );
  }

  if (errorMsg || !notice) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center font-inter-variable ${
        isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-gray-50 text-gray-800"
      }`}>
        <div className={`max-w-md w-full p-8 flex flex-col items-center justify-center text-center border rounded-[12px] shadow-2xl ${
          isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
        }`}>
          <div className="w-12 h-12 rounded-[8px] bg-[#eb5757]/10 border border-[#eb5757]/30 flex items-center justify-center text-[#eb5757] mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className={`text-lg sm:text-xl font-[590] mb-2 tracking-[-0.015em] ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Dispatch Access Unavailable
          </h1>
          <p className={`text-[13px] mb-6 leading-relaxed ${
            isDark ? "text-[#8a8f98]" : "text-gray-600"
          }`}>
            {errorMsg || "This notice may have expired, been archived, or is restricted to authenticated society members."}
          </p>
          <button
            onClick={onBackToLanding}
            className={`w-full h-9 flex items-center justify-center gap-2 border text-[13px] font-[510] rounded-[6px] transition-colors ${
              isDark 
                ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-white" 
                : "bg-gray-900 hover:bg-black border-gray-900 text-white shadow-sm"
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Return to Society Portal
          </button>
        </div>
      </div>
    );
  }

  const catTheme = getCategoryTheme(parsedInfo.category);

  return (
    <div className={`min-h-screen font-inter-variable pb-20 selection:bg-[#e4f222]/20 selection:text-white ${
      isDark ? "bg-[#08090a] text-[#d0d6e0]" : "bg-[#f8f9fa] text-gray-800"
    }`}>
      {/* ── Fixed Precision Linear Topbar ── */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 flex items-center justify-between ${
        isDark ? "bg-[#0c0c0e]/85 border-[#23252a]" : "bg-white/85 border-gray-200 shadow-sm"
      }`}>
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={onBackToLanding}
        >
          <img 
            alt="ADSS Logo" 
            className="h-7 w-auto" 
            src={isDark ? "/logo_trans_light.png" : "/logo_trans_dark.png"} 
          />
          <div className="flex items-center gap-2">
            <span className={`text-[14px] font-[590] tracking-[-0.015em] transition-colors ${
              isDark ? "text-white group-hover:text-[#e4f222]" : "text-gray-900 group-hover:text-indigo-600"
            }`}>
              ADSS RUHUNA
            </span>
            <span className={`hidden sm:inline-block px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[9px] uppercase tracking-wider ${
              isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
            }`}>
              DISPATCH VIEWER
            </span>
          </div>
        </div>

        <button
          onClick={onBackToLanding}
          className={`h-8 px-3 rounded-[6px] border text-[12px] font-[510] flex items-center gap-1.5 transition-colors ${
            isDark 
              ? "bg-[#161718] border-[#23252a] hover:border-white/20 text-[#d0d6e0] hover:text-white" 
              : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-sm"
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Portal</span>
        </button>
      </nav>

      {/* ── Notice Main Container ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28">
        {/* Breadcrumbs & Metadata Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-3 mb-4 text-[11px] font-berkeley-mono ${
          isDark ? "text-[#8a8f98]" : "text-gray-600"
        }`}>
          <div className="flex items-center gap-2">
            <span className={isDark ? "text-[#62666d]" : "text-gray-400"}>DISPATCHES</span>
            <span className={isDark ? "text-[#383b42]" : "text-gray-300"}>/</span>
            <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>#{notice.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border ${catTheme.bg} ${catTheme.border} ${catTheme.text} font-[510]`}>
              <span className={`w-1.5 h-1.5 rounded-full ${catTheme.dot}`} />
              {parsedInfo.category}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border ${
              isDark ? "bg-[#161718] border-[#23252a] text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              <Globe className="w-2.5 h-2.5" /> PUBLIC
            </span>
          </div>
        </div>

        {/* Notice Card Container */}
        <article className={`rounded-[12px] border p-6 sm:p-10 relative overflow-hidden ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-2xl" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
            isDark ? "from-[#e4f222] via-[#6366f1] to-transparent opacity-90" : "from-indigo-500 via-amber-500 to-transparent opacity-100"
          }`} />

          {/* Title */}
          <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-[590] tracking-[-0.025em] mb-5 leading-tight ${
            isDark ? "text-[#ffffff]" : "text-gray-900"
          }`}>
            {parsedInfo.displayTitle}
          </h1>

          {/* Action & Publishing Meta Bar */}
          <div className={`flex flex-wrap items-center justify-between gap-4 py-3.5 px-4 rounded-[8px] border mb-8 text-[12px] ${
            isDark ? "bg-[#0c0c0e] border-[#23252a]" : "bg-gray-50 border-gray-200"
          }`}>
            <div className={`flex flex-wrap items-center gap-4 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <span>{formatDate(notice.created_at)}</span>
              </div>
              <div className={`flex items-center gap-1.5 font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{parsedInfo.readTime}</span>
              </div>
            </div>

            {/* Sharing buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleWhatsAppShare}
                className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1.5 transition-colors ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] hover:border-[#25D366]/50 hover:text-[#25D366] text-[#8a8f98]" 
                    : "bg-white border-gray-200 hover:border-emerald-500 hover:text-emerald-600 text-gray-600 shadow-sm"
                }`}
                title="Share on WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                onClick={handleCopyLink}
                className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-[510] flex items-center gap-1.5 transition-colors ${
                  isDark 
                    ? "bg-[#161718] border-[#23252a] hover:border-[#383b42] text-[#8a8f98] hover:text-white" 
                    : "bg-white border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 shadow-sm"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Rendered Markdown Body */}
          <div 
            className={`markdown-body leading-relaxed ${isDark ? "text-[#d0d6e0]" : "text-gray-800"}`}
            dangerouslySetInnerHTML={renderMarkdown(notice.content)} 
          />

          {/* Society Seal & Attribution */}
          <div className={`mt-12 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] ${
            isDark ? "border-[#1d1f24] text-[#62666d]" : "border-gray-200 text-gray-500"
          }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-emerald-600"}`} />
              <span>Official circular · Association of Data Science Students (ADSS)</span>
            </div>
            <div className="font-berkeley-mono">
              University of Ruhuna, Matara
            </div>
          </div>
        </article>

        {/* Bottom Back Button */}
        <div className="flex justify-center mt-10">
          <button
            onClick={onBackToLanding}
            className={`h-9 px-6 border text-[13px] font-[510] rounded-[6px] flex items-center gap-2 transition-colors shadow-sm ${
              isDark 
                ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-white" 
                : "bg-gray-900 hover:bg-black border-gray-900 text-white"
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Return to Society Portal
          </button>
        </div>
      </main>
    </div>
  );
}

