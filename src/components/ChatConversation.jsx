import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Default suggestion chips
───────────────────────────────────────────────────────────────────────────── */
const DEFAULT_SUGGESTIONS = [
  "How do I import members via CSV?",
  "How do I generate a QR code for attendance?",
  "How do I invite a new editor?",
  "Can a member delete another member?",
];

/* ─────────────────────────────────────────────────────────────────────────────
   Quick-ask pills row (always available above the input bar)
───────────────────────────────────────────────────────────────────────────── */
const QUICK_ASK_PILLS = [
  "How do I import members?",
  "How does QR attendance work?",
  "How do I request a letter?",
  "How do I invite an editor?",
];

/* ─────────────────────────────────────────────────────────────────────────────
   Lightweight inline Markdown renderer — zero external dependencies.
   Handles: **bold**, *italic*, `code`, and blank-line paragraph breaks.
───────────────────────────────────────────────────────────────────────────── */
export function renderMdText(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];

  lines.forEach((line, li) => {
    if (li > 0) {
      if (line.trim() === "") {
        elements.push(<div key={`gap-${li}`} style={{ height: "6px" }} />);
        return;
      }
      elements.push(<br key={`br-${li}`} />);
    }

    const tokens = [];
    const rx = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|([^*`]+)/g;
    let m;
    let tIdx = 0;
    while ((m = rx.exec(line)) !== null) {
      if (m[1] !== undefined) {
        tokens.push(<strong key={`${li}-b-${tIdx++}`}>{m[1]}</strong>);
      } else if (m[2] !== undefined) {
        tokens.push(<em key={`${li}-i-${tIdx++}`}>{m[2]}</em>);
      } else if (m[3] !== undefined) {
        tokens.push(
          <code
            key={`${li}-c-${tIdx++}`}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border2)",
              borderRadius: "4px",
              padding: "1px 5px",
              fontSize: "0.85em",
              fontFamily: "var(--mono, monospace)",
            }}
          >
            {m[3]}
          </code>
        );
      } else {
        tokens.push(<span key={`${li}-t-${tIdx++}`}>{m[4]}</span>);
      }
    }
    elements.push(...tokens);
  });

  return elements;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ChatConversation — Presentational Chat Component
   Used by both ChatWidget (compact=true) and AssistantPage (compact=false).
───────────────────────────────────────────────────────────────────────────── */
export default function ChatConversation({
  messages = [],
  loading = false,
  input = "",
  onInputChange,
  onSendMessage,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = "Ask about a feature…",
  compact = false,
  inputRef,
  className = "",
}) {
  const bottomRef = useRef(null);

  // Client-side rate limit guard (2 second cooldown)
  const [cooldown, setCooldown] = useState(false);

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = (textToSend) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading || cooldown) return;

    onSendMessage(trimmed);

    // Trigger 2-second rate-limit guard
    setCooldown(true);
    setTimeout(() => setCooldown(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleSuggestion = (text) => {
    handleSend(text);
  };

  const isBtnDisabled = loading || cooldown || !input.trim();
  const effectivePlaceholder = cooldown
    ? "Please wait a moment…"
    : loading
    ? "Thinking…"
    : placeholder;

  return (
    <div className={`chat-conversation ${compact ? "chat-conv--compact" : "chat-conv--full"} ${className}`}>
      {/* Scrollable message log */}
      <div className="chat-conv-messages" role="log" aria-live="polite" aria-label="Conversation History">
        {messages.length === 0 && !loading && (
          <div className="chat-conv-empty">
            <div className="chat-conv-empty-icon">
              <span className="material-symbols-outlined" style={{ fontSize: compact ? 32 : 44 }}>
                auto_awesome
              </span>
            </div>
            <p className="chat-conv-empty-title">ADSS Society AI Assistant</p>
            <p className="chat-conv-empty-sub">
              Ask any question about member management, events, attendance, access roles, or society settings.
            </p>
            <div className="chat-conv-chips">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chat-conv-chip"
                  onClick={() => handleSuggestion(s)}
                  disabled={loading || cooldown}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, opacity: 0.7 }}>
                    help_outline
                  </span>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-conv-msg chat-conv-msg--${msg.role}`}>
            {msg.role === "assistant" && (
              <span className="chat-conv-avatar" title="ADSS Assistant">
                <span className="material-symbols-outlined" style={{ fontSize: compact ? 13 : 15 }}>
                  auto_awesome
                </span>
              </span>
            )}
            <div className="chat-conv-bubble">
              {msg.role === "assistant" ? renderMdText(msg.text) : msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-conv-msg chat-conv-msg--assistant">
            <span className="chat-conv-avatar">
              <span className="material-symbols-outlined" style={{ fontSize: compact ? 13 : 15 }}>
                auto_awesome
              </span>
            </span>
            <div className="chat-conv-bubble chat-conv-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested Quick Questions Row above Input */}
      {messages.length > 0 && (
        <div className="chat-conv-quick-row">
          {QUICK_ASK_PILLS.map((q) => (
            <button
              key={q}
              type="button"
              className="chat-conv-quick-pill"
              onClick={() => handleSuggestion(q)}
              disabled={loading || cooldown}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form className="chat-conv-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="chat-conv-input"
          type="text"
          placeholder={effectivePlaceholder}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={loading || cooldown}
          autoComplete="off"
          aria-label="Message to ADSS assistant"
        />
        <button
          type="submit"
          className="chat-conv-send-btn"
          disabled={isBtnDisabled}
          aria-label="Send message"
        >
          <span className="material-symbols-outlined" style={{ fontSize: compact ? 18 : 20 }}>
            send
          </span>
        </button>
      </form>

      {/* Visible Disclaimer Footer */}
      <div className="chat-conv-disclaimer">
        AI assistant — may be inaccurate. Contact staff for official help.
      </div>

      {/* Scoped CSS styling */}
      <style>{`
        .chat-conversation {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          min-height: 0;
          background: var(--bg2);
          color: var(--text);
          font-family: var(--sans);
        }

        .chat-conv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }

        .chat-conv--full .chat-conv-messages {
          padding: 24px 28px;
          gap: 16px;
        }

        /* Empty state */
        .chat-conv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding: 20px 10px;
          margin: auto 0;
        }
        .chat-conv--full .chat-conv-empty {
          max-width: 640px;
          margin: auto;
          padding: 40px 20px;
        }
        .chat-conv-empty-icon {
          color: var(--accent2);
          background: var(--accent-dim);
          border: 1px solid var(--accent-glow);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .chat-conv--full .chat-conv-empty-icon {
          width: 72px;
          height: 72px;
        }
        .chat-conv-empty-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }
        .chat-conv--full .chat-conv-empty-title {
          font-size: 20px;
        }
        .chat-conv-empty-sub {
          font-size: 12px;
          color: var(--text2);
          margin: 0;
          line-height: 1.5;
        }
        .chat-conv--full .chat-conv-empty-sub {
          font-size: 14px;
        }

        .chat-conv-chips {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          margin-top: 8px;
        }
        .chat-conv--full .chat-conv-chips {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        .chat-conv-chip {
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: var(--r);
          padding: 10px 14px;
          font-size: 12.5px;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
          font-family: var(--sans);
        }
        .chat-conv--full .chat-conv-chip {
          font-size: 13.5px;
          padding: 12px 16px;
          border-radius: var(--r2);
        }
        .chat-conv-chip:hover:not(:disabled) {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--accent2);
          transform: translateY(-1px);
        }
        .chat-conv-chip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Quick ask pills row */
        .chat-conv-quick-row {
          display: flex;
          gap: 6px;
          padding: 6px 12px;
          overflow-x: auto;
          scrollbar-width: none;
          background: var(--bg3);
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-conv-quick-row::-webkit-scrollbar { display: none; }
        .chat-conv-quick-pill {
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: 12px;
          padding: 4px 10px;
          font-size: 11px;
          color: var(--text2);
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .chat-conv-quick-pill:hover:not(:disabled) {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--accent2);
        }
        .chat-conv-quick-pill:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Messages */
        .chat-conv-msg {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          max-width: 88%;
          animation: chat-conv-fadein 0.18s ease;
        }
        .chat-conv--full .chat-conv-msg {
          max-width: 80%;
          gap: 12px;
        }
        @keyframes chat-conv-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .chat-conv-msg--user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .chat-conv-msg--assistant {
          align-self: flex-start;
        }

        .chat-conv-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--accent-dim);
          border: 1px solid var(--accent-glow);
          color: var(--accent2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-bottom: 2px;
        }
        .chat-conv--full .chat-conv-avatar {
          width: 32px;
          height: 32px;
        }

        .chat-conv-bubble {
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .chat-conv--full .chat-conv-bubble {
          padding: 14px 18px;
          font-size: 14.5px;
          border-radius: 16px;
        }
        .chat-conv-msg--user .chat-conv-bubble {
          background: var(--accent);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }
        .chat-conv-msg--assistant .chat-conv-bubble {
          background: var(--bg3);
          color: var(--text);
          border: 1px solid var(--border);
          border-bottom-left-radius: 4px;
        }

        /* Typing indicator */
        .chat-conv-typing {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 14px 18px;
        }
        .chat-conv-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text3);
          animation: chat-conv-bounce 1.2s infinite ease-in-out;
        }
        .chat-conv-typing span:nth-child(2) { animation-delay: 0.2s; }
        .chat-conv-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes chat-conv-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }

        /* Input bar */
        .chat-conv-input-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-top: 1px solid var(--border);
          background: var(--bg2);
          flex-shrink: 0;
        }
        .chat-conv--full .chat-conv-input-bar {
          padding: 14px 24px;
        }
        .chat-conv-input {
          flex: 1;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 24px;
          padding: 9px 16px;
          font-size: 13.5px;
          color: var(--text);
          font-family: var(--sans);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          min-width: 0;
        }
        .chat-conv--full .chat-conv-input {
          font-size: 14.5px;
          padding: 12px 20px;
          border-radius: 28px;
        }
        .chat-conv-input::placeholder { color: var(--text3); }
        .chat-conv-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim);
        }
        .chat-conv-input:disabled { opacity: 0.6; cursor: not-allowed; }

        .chat-conv-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          color: #ffffff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.12s, opacity 0.15s;
        }
        .chat-conv--full .chat-conv-send-btn {
          width: 44px;
          height: 44px;
        }
        .chat-conv-send-btn:hover:not(:disabled) {
          background: var(--accent2);
          transform: scale(1.05);
        }
        .chat-conv-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Disclaimer footer */
        .chat-conv-disclaimer {
          font-size: 10.5px;
          color: var(--text3);
          text-align: center;
          padding: 4px 12px 8px;
          background: var(--bg2);
          line-height: 1.3;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
