import { useState, useEffect } from "react";
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
  Share2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

const EMPTY_FORM = { id: "", title: "", content: "", is_public: true };

export default function Notices({ isAdmin = false, session }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [activeNotice, setActiveNotice] = useState(null);
  const [previewTab, setPreviewTab] = useState("split"); // "split", "edit", "preview"

  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);

  const load = async (pageToLoad = page, searchText = search) => {
    setLoading(true);
    const from = pageToLoad * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("notices")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const q = searchText.trim();
    if (q) {
      query = query.or(`id.ilike.%${q}%,title.ilike.%${q}%,content.ilike.%${q}%`);
    }

    if (!isAdmin) {
      query = query.eq("is_public", true);
    }

    try {
      const { data, count, error } = await query;
      if (error) throw error;
      setNotices(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error loading notices:", err);
      setMsg({ type: "error", text: "Failed to load notices: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, search);
  }, [page, search, isAdmin]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModal(true);
    setMsg(null);
  };

  const openEdit = (n) => {
    setForm({
      id: n.id,
      title: n.title,
      content: n.content,
      is_public: n.is_public
    });
    setEditTarget(n.id);
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
      setMsg({ type: "error", text: "Title and Content are required." });
      return;
    }

    setSaving(true);
    setMsg(null);

    let targetId = form.id.trim();
    if (!targetId) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const cleanTitle = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = cleanTitle.substring(0, 30);
      targetId = `${dateStr}-${slug || Math.floor(Math.random() * 1000)}`;
    } else {
      targetId = targetId.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
    }

    const payload = {
      id: targetId,
      title: form.title.trim(),
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

      setMsg({ type: "success", text: "Notice saved successfully!" });
      setTimeout(() => {
        closeModal();
        load(page, search);
      }, 800);
    } catch (err) {
      console.error("Error saving notice:", err);
      setMsg({ type: "error", text: "Failed to save: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
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

  const renderMarkdown = (mdContent) => {
    try {
      return { __html: marked.parse(mdContent || "") };
    } catch (err) {
      return { __html: `<p class="text-rose-400">Markdown parsing error</p>` };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 text-zinc-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Announcements & Notices
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            Society announcement board, official updates, and markdown documents
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40"
          >
            <Plus className="w-4 h-4" /> Add Notice
          </Button>
        )}
      </div>

      {/* Controls Row: Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search notices by title, slug, or content..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
          <div className="w-9 h-9 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-zinc-400">Loading notices...</span>
        </div>
      ) : notices.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-[#17171a]/60 border-dashed border-zinc-800">
          <Megaphone className="w-10 h-10 text-zinc-600 stroke-[1.5]" />
          <p className="text-base font-semibold text-zinc-300">No notices found</p>
          <p className="text-xs text-zinc-500 max-w-sm">
            {search ? `No notices matched "${search}". Try adjusting your search.` : "There are currently no notices posted on the board."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4 mb-8">
          {notices.map((n) => (
            <Card key={n.id} className="p-5 sm:p-6 bg-[#17171a]/90 border border-zinc-800/80 hover:border-zinc-700/90 transition-all shadow-lg flex flex-col gap-4">
              {/* Top Header Row: Date & Status Badge on Left, Actions on Right */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-medium">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{formatDate(n.created_at)}</span>
                  </div>

                  {n.is_public ? (
                    <Badge variant="success" className="flex items-center gap-1 text-[11px] px-2.5 py-1">
                      <Globe className="w-3 h-3" /> Public
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-zinc-800/80 text-zinc-400 border-zinc-700/50">
                      <Lock className="w-3 h-3 text-amber-400" /> Draft / Internal
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(n.id)}
                    className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                  >
                    {copiedId === n.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-zinc-400" /> Copy Link
                      </>
                    )}
                  </Button>

                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(n)}
                        className="h-7 px-2.5 text-xs text-zinc-400 hover:text-white"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(n.id)}
                        className="h-7 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Middle Content Box */}
              <div className="flex flex-col gap-2 my-0.5">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <h2 className="text-xl font-bold text-white leading-snug tracking-tight">
                    {n.title}
                  </h2>
                </div>

                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60 text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                  {n.content.replace(/[#*`_\[\]]/g, "")}
                </div>
              </div>

              {/* Bottom Row: View Buttons on Right */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveNotice(n)}
                    className="h-8 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700"
                  >
                    <Eye className="w-3.5 h-3.5" /> Quick View
                  </Button>

                  <a
                    href={`/notice?id=${n.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                  >
                    Read Full Notice <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination
          current={page}
          total={total}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* READ NOTICE MODAL */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveNotice(null)}>
          <Card 
            className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-zinc-800">
              <div>
                <CardTitle className="text-xl font-bold text-white mb-1">
                  {activeNotice.title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Published on {formatDate(activeNotice.created_at)}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveNotice(null)}
                className="h-8 w-8 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6 text-sm text-zinc-200 leading-relaxed markdown-body">
              <div
                dangerouslySetInnerHTML={renderMarkdown(activeNotice.content)}
              />
            </CardContent>

            <CardFooter className="flex items-center justify-between pt-4 border-t border-zinc-800 bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(activeNotice.id)}
                  className="text-xs border-zinc-700"
                >
                  {copiedId === activeNotice.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </>
                  )}
                </Button>
                <a
                  href={`/notice?id=${activeNotice.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Open Preview Page <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <Button size="sm" onClick={() => setActiveNotice(null)}>
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ADD/EDIT NOTICE MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <Card 
            className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <CardTitle className="text-lg font-bold text-white">
                  {editTarget ? "Edit Notice" : "Add New Notice"}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeModal}
                className="h-8 w-8 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {msg && (
              <div className={`mx-6 mt-4 p-3.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                msg.type === "error" 
                  ? "bg-rose-950/40 border-rose-900/60 text-rose-300" 
                  : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{msg.text}</span>
              </div>
            )}

            <CardContent className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[420px]">
                {/* Left Side: Editor Form */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Notice Slug / ID (Optional)
                    </label>
                    <Input
                      placeholder="e.g. 20260715-general-meeting"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      disabled={!!editTarget}
                    />
                    {!editTarget && (
                      <span className="text-[11px] text-zinc-500 mt-1 block">
                        Clean permalink for /notice?id=SLUG. Auto-generated if left blank.
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Notice Title *
                    </label>
                    <Input
                      placeholder="Enter notice title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="is_public_cb"
                      checked={form.is_public}
                      onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="is_public_cb" className="text-xs font-medium text-zinc-300 cursor-pointer">
                      Make this notice Publicly visible (accessible via direct link)
                    </label>
                  </div>

                  <div className="flex-1 flex flex-col min-h-[220px]">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Markdown Content *
                    </label>
                    <Textarea
                      placeholder="Write notice content in Markdown format..."
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className="flex-1 min-h-[220px] resize-none font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Right Side: Live Preview */}
                <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-zinc-800 pt-4 lg:pt-0 lg:pl-6">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-zinc-800">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Live Preview
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 markdown-body">
                    {form.content ? (
                      <div dangerouslySetInnerHTML={renderMarkdown(form.content)} />
                    ) : (
                      <p className="text-zinc-600 italic text-xs">
                        Live markdown preview will appear here as you type...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {saving ? "Saving..." : "Save Notice"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
