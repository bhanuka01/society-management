import { useState, useEffect, useRef, useCallback } from "react";
import { getAssistantReply } from "../lib/chatAssistant";
import ChatConversation from "./ChatConversation";

/* ─────────────────────────────────────────────────────────────────────────────
   ChatWidget — floating chat button + compact panel
   All styling uses existing App.css design tokens (--bg, --accent, --text, etc.)
   so it automatically adapts to the user's chosen dark / light theme.
───────────────────────────────────────────────────────────────────────────── */
export default function ChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);   // { role: "user"|"assistant", text: string }
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);

  const panelRef  = useRef(null);
  const inputRef  = useRef(null);
  const toggleRef = useRef(null);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Escape key closes the panel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus trap: keep Tab inside the open panel
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  // Send message logic
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const historyForApi = messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text,
    }));

    try {
      const result = await getAssistantReply(trimmed, historyForApi);

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: result.success
            ? result.text
            : `⚠️ ${result.error ?? "Something went wrong. Please try again."}`,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: "⚠️ Unexpected error. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, messages]);

  return (
    <>
      {/* Floating toggle button */}
      <button
        ref={toggleRef}
        id="chat-widget-toggle"
        className="cw-toggle"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        aria-controls="chat-widget-panel"
        title="ADSS AI Assistant"
      >
        {open ? (
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>auto_awesome</span>
        )}
      </button>

      {/* Chat panel */}
      <div
        id="chat-widget-panel"
        ref={panelRef}
        className={`cw-panel ${open ? "cw-panel--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="ADSS AI Assistant"
      >
        {/* Header */}
        <div className="cw-header">
          <div className="cw-header-info">
            <span className="cw-avatar">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            </span>
            <div>
              <p className="cw-header-title">ADSS Assistant</p>
              <p className="cw-header-sub">Ask me anything about the portal</p>
            </div>
          </div>
          <button
            className="cw-close-btn"
            onClick={() => { setOpen(false); toggleRef.current?.focus(); }}
            aria-label="Close assistant"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Shared Conversation Presentational View */}
        <ChatConversation
          messages={messages}
          loading={loading}
          input={input}
          onInputChange={setInput}
          onSendMessage={sendMessage}
          compact={true}
          inputRef={inputRef}
        />
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="cw-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <style>{`
        .cw-toggle {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px var(--accent-glow), var(--shadow-lg);
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          outline-offset: 3px;
        }
        .cw-toggle:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 28px var(--accent-glow), var(--shadow-xl);
          background: var(--accent2);
        }
        .cw-toggle:focus-visible { outline: 2px solid var(--accent2); }
        .cw-toggle:active { transform: scale(0.96); }

        .cw-panel {
          position: fixed;
          bottom: 88px;
          right: 24px;
          z-index: 999;
          width: 360px;
          height: 480px;
          background: var(--bg2);
          border: 1px solid var(--border2);
          border-radius: var(--r3);
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          transform: translateY(12px) scale(0.97);
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .cw-panel--open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: all;
        }

        .cw-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          background: var(--bg3);
          flex-shrink: 0;
        }
        .cw-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cw-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent-dim);
          border: 1px solid var(--accent-glow);
          color: var(--accent2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cw-header-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          margin: 0;
          line-height: 1.2;
        }
        .cw-header-sub {
          font-size: 11px;
          color: var(--text3);
          margin: 0;
          line-height: 1.2;
        }
        .cw-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text3);
          padding: 4px;
          border-radius: var(--r);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s;
        }
        .cw-close-btn:hover { color: var(--text); background: var(--border); }

        .cw-backdrop { display: none; }

        @media (max-width: 600px) {
          .cw-toggle { bottom: 16px; right: 16px; }
          .cw-panel {
            bottom: 0; right: 0; left: 0;
            width: 100%; height: 72vh;
            border-radius: var(--r3) var(--r3) 0 0;
            border-bottom: none;
            transform: translateY(100%);
          }
          .cw-panel--open { transform: translateY(0); }
          .cw-backdrop {
            display: block;
            position: fixed; inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 998;
            backdrop-filter: blur(2px);
          }
        }
      `}</style>
    </>
  );
}
