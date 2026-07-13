import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import { marked } from "marked";

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
  const [activeNotice, setActiveNotice] = useState(null); // Notice being read in modal

  // Custom styling for parsed HTML can be defined in CSS, but let's configure marked options
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

    // Build query
    let query = supabase
      .from("notices")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // If search text is present
    const q = searchText.trim();
    if (q) {
      query = query.or(`id.ilike.%${q}%,title.ilike.%${q}%,content.ilike.%${q}%`);
    }

    // Non-staff should only see public notices
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

    // If Notice ID is empty, generate one
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
      // Clean ID format
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
        // If edit target is different from targetId (meaning ID changed), we might need to delete old and insert new,
        // or prevent ID changes. Let's make ID read-only during edit for reliability.
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
        // Insert new notice
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
      }, 1000);
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
      return { __html: `<p style="color:var(--red)">Markdown parsing error</p>` };
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
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">📢</span> Notices</h1>
        <p className="page-subtitle">society announcement board and markdown documents</p>
      </div>

      <div className="controls-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "24px", alignItems: "center", justifyContent: "space-between" }}>
        <div className="search-bar" style={{ flex: "1", minWidth: "250px" }}>
          <input
            type="text"
            placeholder="Search notices..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            style={{ width: "100%", padding: "10px 16px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>➕</span> Add Notice
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader" style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="spinner" />
        </div>
      ) : notices.length === 0 ? (
        <div className="empty-state" style={{ textAlign: "center", padding: "4rem var(--r)" }}>
          <div className="icon" style={{ fontSize: "3rem", color: "var(--text3)", marginBottom: "1rem" }}>📢</div>
          <p style={{ color: "var(--text2)", fontSize: "16px" }}>No notices found.</p>
        </div>
      ) : (
        <div className="notices-grid" style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
          {notices.map((n) => (
            <div key={n.id} className="card notice-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--border)", position: "relative" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text3)", marginRight: "12px" }}>{formatDate(n.created_at)}</span>
                  {n.is_public ? (
                    <span className="badge badge-green" style={{ background: "rgba(74, 222, 128, 0.15)", color: "var(--green)", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>Public</span>
                  ) : (
                    <span className="badge badge-gray" style={{ background: "rgba(144, 144, 168, 0.15)", color: "var(--text2)", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>Draft / Internal</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCopyLink(n.id)}
                    style={{ fontSize: "12px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    🔗 {copiedId === n.id ? "Copied!" : "Copy Link"}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(n)}
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-red"
                        onClick={() => handleDelete(n.id)}
                        style={{ fontSize: "12px", padding: "4px 8px", color: "var(--red)" }}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <h2 className="notice-title" style={{ fontSize: "18px", fontWeight: "600", margin: "4px 0" }}>{n.title}</h2>

              <div
                className="notice-preview-snippet text-muted"
                style={{
                  fontSize: "14px",
                  lineHeight: "1.5",
                  color: "var(--text2)",
                  maxHeight: "80px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical"
                }}
              >
                {n.content.replace(/[#*`_\[\]]/g, "")}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveNotice(n)}
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                >
                  Read Full Notice →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
        <div className="modal-overlay" onClick={() => setActiveNotice(null)} style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: "800px", width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>{activeNotice.title}</h1>
                <p style={{ fontSize: "12px", color: "var(--text3)", margin: "4px 0 0 0" }}>
                  Published on {formatDate(activeNotice.created_at)}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setActiveNotice(null)} style={{ fontSize: "20px", padding: "4px 8px" }}>✕</button>
            </div>

            <div
              className="markdown-content"
              dangerouslySetInnerHTML={renderMarkdown(activeNotice.content)}
              style={{ padding: "8px 0 20px 0", color: "var(--text)", lineHeight: "1.7" }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <button
                className="btn btn-ghost"
                onClick={() => handleCopyLink(activeNotice.id)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                🔗 {copiedId === activeNotice.id ? "Link Copied!" : "Copy Shareable Link"}
              </button>
              <button className="btn btn-primary" onClick={() => setActiveNotice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT NOTICE MODAL */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal} style={{ zIndex: 1100 }}>
          <div
            className="modal"
            style={{
              maxWidth: "1100px",
              width: "95%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              padding: "24px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{editTarget ? "Edit Notice" : "Add New Notice"}</h2>
              <button className="btn btn-ghost" onClick={closeModal} style={{ fontSize: "20px", padding: "4px 8px" }}>✕</button>
            </div>

            {msg && (
              <div className={`alert alert-${msg.type}`} style={{ marginBottom: "16px" }}>
                {msg.text}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "24px",
                flex: "1",
                overflowY: "auto",
                marginBottom: "16px",
                paddingRight: "4px"
              }}
            >
              {/* Left Side: Editor Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}>Notice ID / Slug (Optional)</label>
                  <input
                    placeholder="e.g. 20260715 (Leave blank to auto-generate)"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    disabled={!!editTarget}
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)" }}
                  />
                  {!editTarget && (
                    <span style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px", display: "block" }}>
                      Allows pretty links: /notice?id=ID. Only alphanumeric characters and hyphens allowed.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}>Notice Title *</label>
                  <input
                    placeholder="Enter notice title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)" }}
                  />
                </div>

                <div className="form-group" style={{ display: "flex", flexDirection: "column", flex: "1" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}>Markdown Content *</label>
                  <textarea
                    placeholder="Write notice body in Markdown format..."
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      flex: "1",
                      minHeight: "220px",
                      fontFamily: "monospace",
                      padding: "12px",
                      borderRadius: "var(--r)",
                      border: "1px solid var(--border)",
                      background: "var(--bg3)",
                      color: "var(--text)",
                      lineHeight: "1.5",
                      resize: "none"
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "500" }}>
                    <input
                      type="checkbox"
                      checked={form.is_public}
                      onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "var(--accent)" }}
                    />
                    <span>Make this notice Publicly visible (Allows anyone to view via link)</span>
                  </label>
                </div>
              </div>

              {/* Right Side: Live Preview */}
              <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)", paddingLeft: "24px", minHeight: "350px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text2)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  👁️ Live Preview
                </h3>
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={renderMarkdown(form.content || "*Preview will appear here as you type...*")}
                  style={{
                    flex: "1",
                    overflowY: "auto",
                    padding: "12px",
                    borderRadius: "var(--r)",
                    border: "1px dashed var(--border)",
                    background: "rgba(0,0,0,0.1)",
                    lineHeight: "1.6",
                    color: form.content ? "var(--text)" : "var(--text3)"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "10px 24px" }}
              >
                {saving ? "Saving..." : "Save Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
