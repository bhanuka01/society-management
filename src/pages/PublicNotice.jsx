import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { marked } from "marked";

export default function PublicNotice({ onBackToLanding }) {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Parse notice_id from query params or route path
  const getNoticeIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id");
    if (queryId) return queryId;

    // Check path-based params e.g. /notice/slug or #/notice/slug
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
        setErrorMsg("No notice ID specified in the URL.");
        setLoading(false);
        return;
      }

      // Fetch notice (RLS allows anyone to read if is_public = true)
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNotice(data);
      } else {
        setErrorMsg("Notice not found, or it is set to private.");
      }
    } catch (err) {
      console.error("Error loading public notice:", err);
      setErrorMsg("Failed to load notice details.");
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

    // Listen for URL changes
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

  const renderMarkdown = (mdContent) => {
    try {
      return { __html: marked.parse(mdContent || "") };
    } catch (err) {
      return { __html: `<p class="text-red-400">Markdown parsing error</p>` };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-[#e5e5ea] flex items-center justify-center flex-col gap-4">
        <div className="w-10 h-10 border-3 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 text-xs font-semibold tracking-wider uppercase">Loading Notice...</p>
      </div>
    );
  }

  if (errorMsg || !notice) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-[#e5e5ea] flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">campaign</span>
        <h1 className="text-3xl font-bold mb-2">Notice Access Error</h1>
        <p className="text-zinc-400 max-w-md mb-8">{errorMsg || "The notice you are looking for may have been deleted or is not public."}</p>
        <button
          onClick={onBackToLanding}
          className="px-6 py-3 bg-[#e4e4e7] text-[#09090b] font-bold rounded-xl hover:bg-white transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#e5e5ea] font-body-md selection:bg-white/20 selection:text-white pb-16">
      <style>{`
        .glass-header {
          background: rgba(18, 18, 22, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .notice-container-card {
          background: rgba(24, 24, 28, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
        }
        .markdown-body h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 0.5rem;
          color: #ffffff;
        }
        .markdown-body h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #ffffff;
        }
        .markdown-body h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #ffffff;
        }
        .markdown-body p {
          margin-bottom: 1.25rem;
          line-height: 1.75;
          color: #cbd5e1;
        }
        .markdown-body ul {
          list-style-type: disc;
          margin-left: 1.75rem;
          margin-bottom: 1.25rem;
          color: #cbd5e1;
        }
        .markdown-body ol {
          list-style-type: decimal;
          margin-left: 1.75rem;
          margin-bottom: 1.25rem;
          color: #cbd5e1;
        }
        .markdown-body li {
          margin-bottom: 0.35rem;
        }
        .markdown-body code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
          color: #e4e4e7;
        }
        .markdown-body pre {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1.25rem;
          border-radius: 12px;
          overflow-x: auto;
          margin-bottom: 1.25rem;
        }
        .markdown-body pre code {
          background: none;
          padding: 0;
          color: #e2e8f0;
        }
        .markdown-body blockquote {
          border-left: 4px solid #e4e4e7;
          padding-left: 1.25rem;
          color: #a1a1aa;
          font-style: italic;
          margin-bottom: 1.25rem;
          background: rgba(255, 255, 255, 0.04);
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          border-radius: 0 8px 8px 0;
        }
        .markdown-body a {
          color: #e4e4e7;
          text-decoration: underline;
          transition: color 0.2s;
        }
        .markdown-body a:hover {
          color: #ffffff;
        }
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.25rem;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.75rem;
          text-align: left;
        }
        .markdown-body th {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }
      `}</style>

      {/* Public Header */}
      <nav className="fixed top-0 w-full z-50 glass-header flex justify-between items-center px-6 md:px-12 py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBackToLanding}>
          <img alt="ADSS Logo" className="h-9 w-auto" src="/logo_trans_light.png" />
          <span className="font-headline-md text-xl font-bold text-on-surface hidden md:block">ADSS Ruhuna</span>
        </div>
        <button
          onClick={onBackToLanding}
          className="text-zinc-400 hover:text-white transition-colors duration-300 flex items-center gap-2 text-sm font-semibold cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Home
        </button>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-28">
        
        {/* Notice Meta Badge */}
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/15">
            Official Announcement
          </span>
          <span className="text-zinc-400 text-sm">Notice ID: {notice.id}</span>
        </div>

        {/* Notice Card */}
        <div className="notice-container-card p-6 md:p-10 mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white mb-4">
            {notice.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6 mb-8 text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">calendar_today</span>
              <span>{formatDate(notice.created_at)}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-all flex items-center gap-2 text-xs border border-white/10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">share</span>
              <span>{copied ? "Link Copied!" : "Copy Shareable Link"}</span>
            </button>
          </div>

          <div
            className="markdown-body"
            dangerouslySetInnerHTML={renderMarkdown(notice.content)}
          />
        </div>

        <div className="flex justify-center mt-12">
          <button
            onClick={onBackToLanding}
            className="px-8 py-3 bg-[#e4e4e7] hover:bg-white text-[#09090b] font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span> Return to Homepage
          </button>
        </div>
      </main>
    </div>
  );
}
