import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { marked } from "marked";
import { 
  Megaphone, 
  Share2, 
  Check, 
  ArrowLeft, 
  Calendar, 
  AlertCircle, 
  Sparkles,
  FileText,
  Clock
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export default function PublicNotice({ onBackToLanding }) {
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
        setErrorMsg("No notice ID specified in the URL.");
        setLoading(false);
        return;
      }

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
      return { __html: `<p class="text-rose-400">Markdown parsing error</p>` };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex items-center justify-center flex-col gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-zinc-400 text-xs font-semibold tracking-wider uppercase">Loading Notice...</p>
      </div>
    );
  }

  if (errorMsg || !notice) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-8 flex flex-col items-center justify-center text-center bg-[#17171a] border-zinc-800 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-center justify-center text-rose-400 mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Notice Access Error</h1>
          <p className="text-sm text-zinc-400 mb-6">{errorMsg || "The notice you are looking for may have been deleted or is not public."}</p>
          <Button
            onClick={onBackToLanding}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Homepage
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 selection:bg-indigo-500/30 selection:text-white pb-16">
      {/* Public Header */}
      <nav className="fixed top-0 w-full z-50 bg-[#121216]/85 backdrop-blur-xl border-b border-zinc-800/80 flex justify-between items-center px-6 md:px-12 py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBackToLanding}>
          <img alt="ADSS Logo" className="h-9 w-auto" src="/logo_trans_light.png" />
          <span className="text-xl font-extrabold tracking-tight text-white hidden md:block">ADSS Ruhuna</span>
        </div>
        <Button
          variant="ghost"
          onClick={onBackToLanding}
          className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </Button>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-28">
        {/* Notice Meta Badge */}
        <div className="flex items-center gap-3 mb-6">
          <Badge variant="default" className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border-indigo-500/20 text-indigo-300 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Official Announcement
          </Badge>
          <span className="text-zinc-400 text-xs font-mono">ID: {notice.id}</span>
        </div>

        {/* Notice Card */}
        <Card className="p-6 md:p-10 mb-8 bg-[#17171a]/90 border border-zinc-800/90 shadow-2xl rounded-2xl">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-4 leading-tight">
            {notice.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>{formatDate(notice.created_at)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs border-zinc-700/80 hover:bg-zinc-800 text-zinc-300 flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" /> Copy Shareable Link
                </>
              )}
            </Button>
          </div>

          <div
            className="markdown-body"
            dangerouslySetInnerHTML={renderMarkdown(notice.content)}
          />
        </Card>

        <div className="flex justify-center mt-10">
          <Button
            onClick={onBackToLanding}
            className="px-8 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl flex items-center gap-2 shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Homepage
          </Button>
        </div>
      </main>
    </div>
  );
}
