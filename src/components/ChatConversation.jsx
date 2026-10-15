import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Copy,
  Check,
  Download,
  Terminal,
  FileSpreadsheet,
  CornerDownLeft,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import AdssAiIcon from "./AdssAiIcon";

/* ─────────────────────────────────────────────────────────────────────────────
   Role-Grounded Suggestion Cards with Category Metadata
───────────────────────────────────────────────────────────────────────────── */
const STAFF_SUGGESTIONS = [
  { tag: "IMPORT", text: "How do I import members via CSV?" },
  { tag: "ATTENDANCE", text: "How do I generate a QR code for attendance?" },
  { tag: "ACCESS", text: "How do I invite an editor or manage permissions?" },
  { tag: "DOCS", text: "How do I upload and restrict society documents?" },
];

const MEMBER_SUGGESTIONS = [
  { tag: "REGISTRATION", text: "How do I register as an active society member?" },
  { tag: "COMMITTEE", text: "How do I apply for the Organizing Committee (OC)?" },
  { tag: "LETTERS", text: "How do I request an official appreciation letter?" },
  { tag: "QR SCAN", text: "How do I check in for event attendance using QR?" },
];



/* ─────────────────────────────────────────────────────────────────────────────
   CSV Attendance Download Button (Linear Midnight Styled)
───────────────────────────────────────────────────────────────────────────── */
export function CsvDownloadButton({ filename = "event_attendance.csv", csvData }) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div className="chat-csv-wrapper">
      <button
        type="button"
        onClick={handleDownload}
        className="chat-csv-btn"
        title="Export CSV data"
      >
        {downloaded ? (
          <Check className="w-3.5 h-3.5 text-[#27a644]" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 chat-csv-icon" />
        )}
        <span className="font-berkeley-mono text-[12px] tracking-tight">
          {downloaded ? "CSV EXPORTED" : "DOWNLOAD ATTENDANCE CSV"}
        </span>
        <Download className="w-3 h-3 chat-csv-download-icon ml-auto" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Code Block Component with 1-click Copy
───────────────────────────────────────────────────────────────────────────── */
function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="chat-codeblock">
      <div className="chat-codeblock-header">
        <div className="flex items-center gap-1.5 text-[11px] font-berkeley-mono chat-codeblock-label">
          <Terminal className="w-3 h-3 chat-codeblock-term-icon" />
          <span>SNIPPET</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="chat-copy-code-btn"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-[#27a644]" /> : <Copy className="w-3 h-3" />}
          <span className="text-[10px] font-berkeley-mono">{copied ? "COPIED" : "COPY"}</span>
        </button>
      </div>
      <pre className="chat-codeblock-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Inline Markdown Renderer
───────────────────────────────────────────────────────────────────────────── */
export function renderMdText(text) {
  if (!text) return null;

  const codeBlockRx = /```(?:csv|text|json|sql|javascript|js)?\n([\s\S]*?)\n```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRx.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      blocks.push({ type: "text", content: textBefore });
    }

    const codeContent = match[1].trim();
    const isCsv =
      match[0].startsWith("```csv") ||
      (codeContent.includes(",") &&
        (codeContent.toLowerCase().includes("st id") ||
          codeContent.toLowerCase().includes("email") ||
          codeContent.toLowerCase().includes("attended")));

    if (isCsv) {
      blocks.push({ type: "csv", content: codeContent });
    } else {
      blocks.push({ type: "code", content: codeContent });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    blocks.push({ type: "text", content: remaining });
  }

  return (
    <>
      {blocks.map((block, bIdx) => {
        if (block.type === "csv") {
          return <CsvDownloadButton key={`csv-${bIdx}`} csvData={block.content} />;
        }
        if (block.type === "code") {
          return <CodeBlock key={`code-${bIdx}`} code={block.content} />;
        }

        const lines = block.content.split("\n");
        const elements = [];

        lines.forEach((line, li) => {
          if (li > 0) {
            if (line.trim() === "") {
              elements.push(<div key={`gap-${li}`} className="h-2" />);
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
              tokens.push(
                <strong key={`${bIdx}-${li}-b-${tIdx++}`} className="font-semibold chat-md-strong">
                  {m[1]}
                </strong>
              );
            } else if (m[2] !== undefined) {
              tokens.push(
                <em key={`${bIdx}-${li}-i-${tIdx++}`} className="italic chat-md-em">
                  {m[2]}
                </em>
              );
            } else if (m[3] !== undefined) {
              tokens.push(
                <code
                  key={`${bIdx}-${li}-c-${tIdx++}`}
                  className="chat-inline-code"
                >
                  {m[3]}
                </code>
              );
            } else {
              tokens.push(<span key={`${bIdx}-${li}-t-${tIdx++}`}>{m[4]}</span>);
            }
          }
          elements.push(...tokens);
        });

        return <span key={`text-block-${bIdx}`}>{elements}</span>;
      })}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ChatConversation Component
───────────────────────────────────────────────────────────────────────────── */
export default function ChatConversation({
  messages = [],
  loading = false,
  input = "",
  onInputChange,
  onSendMessage,
  role = "guest",
  compact = false,
  inputRef,
  className = "",
  theme,
}) {
  const bottomRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [cooldown, setCooldown] = useState(false);

  const isStaff = role === "admin" || role === "editor";
  const suggestions = isStaff ? STAFF_SUGGESTIONS : MEMBER_SUGGESTIONS;


  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = (textToSend) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading || cooldown) return;

    onSendMessage(trimmed, role);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleCopyMessage = async (msgId, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const isBtnDisabled = loading || cooldown || !input.trim();

  return (
    <div
      className={`chat-conversation ${compact ? "chat-conv--compact" : "chat-conv--full"} ${className}`}
      data-theme={theme}
    >
      {/* Scrollable Message Feed */}
      <div className="chat-conv-messages" role="log" aria-live="polite" aria-label="Conversation History">
        {messages.length === 0 && !loading && (
          <div className="chat-conv-empty">
            <div className="chat-conv-empty-icon-wrap">
              <AdssAiIcon size={compact ? 36 : 48} animate variant="brand" />
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="chat-conv-telemetry-badge">
                  ADSS TELEMETRY V2.6
                </span>
                <span className="chat-conv-grounded-badge">
                  LIVE GROUNDING
                </span>
              </div>
              <h2 className="chat-conv-empty-title">ADSS Portal Intelligence</h2>
              <p className="chat-conv-empty-sub">
                {isStaff
                  ? "Instant precision answers regarding society operations, member directories, attendance analytics, and role governance."
                  : "Instant precision answers regarding membership registration, event check-in, OC recruitment, and official letters."}
              </p>
            </div>

            {/* Linear-Style Suggestion Cards */}
            <div className="chat-conv-chips">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chat-conv-chip"
                  onClick={() => handleSend(s.text)}
                  disabled={loading || cooldown}
                >
                  <span className="chat-conv-chip-tag">{s.tag}</span>
                  <span className="chat-conv-chip-text">{s.text}</span>
                  <CornerDownLeft className="w-3 h-3 chat-conv-chip-arrow ml-auto shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Log */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const msgKey = msg.id || `msg-${i}`;

          return (
            <div
              key={msgKey}
              className={`chat-conv-msg-row ${isUser ? "chat-conv-msg-row--user" : "chat-conv-msg-row--assistant"}`}
            >
              {!isUser && (
                <div className="chat-conv-avatar-wrap" title="ADSS Portal AI Assistant">
                  <AdssAiIcon size={16} variant="brand" />
                </div>
              )}

              <div className="chat-conv-msg-body">
                <div className={`chat-conv-bubble ${isUser ? "chat-conv-bubble--user" : "chat-conv-bubble--assistant"}`}>
                  {isUser ? msg.text : renderMdText(msg.text)}
                </div>

                {/* Micro Action Bar under Assistant Messages */}
                {!isUser && (
                  <div className="chat-conv-msg-meta">
                    <span className="chat-conv-msg-time">{msg.timestamp || "ADSS INTEL"}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msgKey, msg.text)}
                      className="chat-conv-copy-action"
                      title="Copy response"
                    >
                      {copiedId === msgKey ? (
                        <>
                          <Check className="w-3 h-3 text-[#27a644]" />
                          <span className="text-[#27a644]">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Active Thinking Indicator */}
        {loading && (
          <div className="chat-conv-msg-row chat-conv-msg-row--assistant">
            <div className="chat-conv-avatar-wrap">
              <AdssAiIcon size={16} animate variant="brand" />
            </div>
            <div className="chat-conv-msg-body">
              <div className="chat-conv-bubble chat-conv-bubble--assistant chat-conv-thinking">
                <div className="chat-pulse-node" />
                <span className="font-berkeley-mono text-[11px] chat-thinking-text tracking-wider uppercase">
                  Analyzing ADSS records…
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar — Linear Midnight Precision */}
      <form className="chat-conv-input-bar" onSubmit={handleSubmit}>
        <div className="chat-conv-input-wrapper">
          <input
            ref={inputRef}
            className="chat-conv-input"
            type="text"
            placeholder={cooldown ? "Rate limit throttle (1s)..." : loading ? "ADSS intelligence processing..." : "Ask ADSS Intelligence (e.g. attendance, OC, letters)..."}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={loading || cooldown}
            autoComplete="off"
            aria-label="Message to ADSS AI Assistant"
          />
          <button
            type="submit"
            className="chat-conv-send-btn"
            disabled={isBtnDisabled}
            aria-label="Send query"
            title="Execute query (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Component Styles (Linear Midnight Tokens) */}
      <style>{`
        .chat-conversation {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          min-height: 0;
          background: #08090a;
          color: #d0d6e0;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          position: relative;
        }

        .chat-conv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          scroll-behavior: smooth;
        }

        .chat-conv--full .chat-conv-messages {
          padding: 24px 32px;
          gap: 20px;
        }

        /* Empty State */
        .chat-conv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin: auto 0;
          padding: 16px 8px;
        }

        .chat-conv--full .chat-conv-empty {
          max-width: 680px;
          margin: auto;
          padding: 40px 16px;
        }

        .chat-conv-empty-icon-wrap {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: #0f1011;
          border: 1px solid #23252a;
          box-shadow: rgba(0, 0, 0, 0.4) 0px 2px 4px 0px, rgb(35, 37, 42) 0px 0px 0px 1px inset;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .chat-conv--full .chat-conv-empty-icon-wrap {
          width: 76px;
          height: 76px;
        }

        .chat-conv-empty-title {
          font-size: 17px;
          font-weight: 510;
          color: #ffffff;
          letter-spacing: -0.012em;
          margin: 0;
        }

        .chat-conv--full .chat-conv-empty-title {
          font-size: 22px;
        }

        .chat-conv-empty-sub {
          font-size: 13px;
          color: #8a8f98;
          max-width: 420px;
          margin: 6px auto 0;
          line-height: 1.5;
        }

        .chat-conv--full .chat-conv-empty-sub {
          font-size: 14px;
          max-width: 560px;
        }

        .chat-conv-chips {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          margin-top: 10px;
        }

        .chat-conv--full .chat-conv-chips {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 20px;
        }

        .chat-conv-chip {
          background: #0f1011;
          border: 1px solid #23252a;
          border-radius: 6px;
          padding: 9px 12px;
          color: #d0d6e0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          transition: background 0.15s, border-color 0.15s, transform 0.12s;
        }

        .chat-conv-chip:hover:not(:disabled) {
          background: #161718;
          border-color: #383b3f;
          transform: translateY(-1px);
        }

        .chat-conv-chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-conv-chip-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8a8f98;
          background: #161718;
          border: 1px solid #23252a;
          padding: 1px 5px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .chat-conv-chip-text {
          font-size: 12.5px;
          color: #d0d6e0;
          line-height: 1.35;
          flex: 1;
        }

        /* Message Rows */
        .chat-conv-msg-row {
          display: flex;
          gap: 10px;
          max-width: 90%;
          animation: chat-fadein 0.18s ease;
        }

        .chat-conv--full .chat-conv-msg-row {
          max-width: 82%;
          gap: 14px;
        }

        @keyframes chat-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .chat-conv-msg-row--user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .chat-conv-msg-row--assistant {
          align-self: flex-start;
        }

        .chat-conv-avatar-wrap {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: #0f1011;
          border: 1px solid #23252a;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .chat-conv--full .chat-conv-avatar-wrap {
          width: 32px;
          height: 32px;
        }

        .chat-conv-msg-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .chat-conv-bubble {
          padding: 10px 14px;
          font-size: 13.5px;
          line-height: 1.6;
          word-break: break-word;
          border-radius: 6px;
        }

        .chat-conv--full .chat-conv-bubble {
          padding: 14px 18px;
          font-size: 14.5px;
          border-radius: 8px;
        }

        .chat-conv-bubble--user {
          background: #161718;
          border: 1px solid #23252a;
          color: #ffffff;
        }

        .chat-conv-bubble--assistant {
          background: #0f1011;
          border: 1px solid #23252a;
          color: #d0d6e0;
          box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 12px 0px inset;
        }

        .chat-conv-msg-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-left: 2px;
        }

        .chat-conv-msg-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #62666d;
        }

        .chat-conv-copy-action {
          background: none;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8a8f98;
          padding: 2px 4px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }

        .chat-conv-copy-action:hover {
          color: #ffffff;
          background: #161718;
        }

        /* Thinking State */
        .chat-conv-thinking {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
        }

        .chat-pulse-node {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e4f222;
          box-shadow: 0 0 8px rgba(228, 242, 34, 0.6);
          animation: chat-pulse 1s infinite alternate ease-in-out;
        }

        @keyframes chat-pulse {
          from { transform: scale(0.85); opacity: 0.6; }
          to { transform: scale(1.15); opacity: 1; }
        }

        /* Code & CSV */
        .chat-inline-code {
          background: #161718;
          border: 1px solid #23252a;
          color: #e5e5e6;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 1px 4px;
          border-radius: 4px;
        }

        .chat-codeblock {
          background: #08090a;
          border: 1px solid #23252a;
          border-radius: 6px;
          margin: 8px 0;
          overflow: hidden;
        }

        .chat-codeblock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #0f1011;
          border-bottom: 1px solid #23252a;
          padding: 4px 10px;
        }

        .chat-copy-code-btn {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          gap: 4px;
          color: #8a8f98;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .chat-copy-code-btn:hover {
          background: #161718;
          color: #ffffff;
        }

        .chat-codeblock-content {
          padding: 10px 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.5;
          color: #e5e5e6;
          overflow-x: auto;
          margin: 0;
        }

        .chat-csv-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #0f1011;
          border: 1px solid #23252a;
          border-radius: 6px;
          padding: 8px 12px;
          color: #ffffff;
          cursor: pointer;
          margin: 6px 0;
          width: 100%;
          transition: background 0.15s, border-color 0.15s;
        }

        .chat-csv-btn:hover {
          background: #161718;
          border-color: #383b3f;
        }

        /* Input Bar */
        .chat-conv-input-bar {
          padding: 12px 14px;
          background: #0f1011;
          border-top: 1px solid #23252a;
          flex-shrink: 0;
        }

        .chat-conv--full .chat-conv-input-bar {
          padding: 16px 24px;
        }

        .chat-conv-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #161718;
          border: 1px solid #23252a;
          border-radius: 6px;
          padding: 4px 6px 4px 12px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .chat-conv-input-wrapper:focus-within {
          border-color: #383b3f;
          box-shadow: 0 0 0 1px #383b3f;
        }

        .chat-conv-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-size: 13.5px;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          min-width: 0;
        }

        .chat-conv-input::placeholder {
          color: #8a8f98;
        }

        /* Primary Action Button — The Acid Lime Flashlight */
        .chat-conv-send-btn {
          background: #e4f222;
          color: #08090a;
          border: none;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s, transform 0.12s;
        }

        .chat-conv-send-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: scale(1.04);
        }

        .chat-conv-send-btn:disabled {
          background: #23252a;
          color: #62666d;
          cursor: not-allowed;
          transform: none;
        }

        /* Base Themeable Token Styles */
        .chat-csv-icon {
          color: #e4f222;
        }

        .chat-csv-download-icon {
          color: #8a8f98;
        }

        .chat-codeblock-label {
          color: #8a8f98;
        }

        .chat-codeblock-term-icon {
          color: #e4f222;
        }

        .chat-md-strong {
          color: #ffffff;
        }

        .chat-md-em {
          color: #d0d6e0;
        }

        .chat-conv-telemetry-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #8a8f98;
          background: #161718;
          border: 1px solid #23252a;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .chat-conv-grounded-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          color: #e4f222;
          background: rgba(228, 242, 34, 0.1);
          border: 1px solid rgba(228, 242, 34, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .chat-conv-chip-arrow {
          color: #62666d;
          transition: color 0.15s;
        }

        .chat-conv-chip:hover .chat-conv-chip-arrow {
          color: #e4f222;
        }

        .chat-thinking-text {
          color: #8a8f98;
        }

        .chat-quick-label {
          color: #62666d;
        }

        .chat-disclaimer-text {
          color: #8a8f98;
        }

        /* ─── Light Mode Theme Support ─── */
        [data-theme='light'] .chat-conversation,
        .chat-conversation[data-theme='light'] {
          background: #ffffff;
          color: #18181b;
        }

        [data-theme='light'] .chat-conv-empty-icon-wrap,
        .chat-conversation[data-theme='light'] .chat-conv-empty-icon-wrap {
          background: #18181b;
          border-color: #27272a;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        [data-theme='light'] .chat-conv-empty-title,
        .chat-conversation[data-theme='light'] .chat-conv-empty-title {
          color: #09090b;
        }

        [data-theme='light'] .chat-conv-empty-sub,
        .chat-conversation[data-theme='light'] .chat-conv-empty-sub {
          color: #52525b;
        }

        [data-theme='light'] .chat-conv-telemetry-badge,
        .chat-conversation[data-theme='light'] .chat-conv-telemetry-badge {
          color: #52525b;
          background: #f4f4f5;
          border-color: #e4e4e7;
        }

        [data-theme='light'] .chat-conv-grounded-badge,
        .chat-conversation[data-theme='light'] .chat-conv-grounded-badge {
          color: #854d0e;
          background: #fef9c3;
          border-color: #fde047;
          font-weight: 500;
        }

        [data-theme='light'] .chat-conv-chip,
        .chat-conversation[data-theme='light'] .chat-conv-chip {
          background: #fafafa;
          border-color: #e4e4e7;
          color: #18181b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        [data-theme='light'] .chat-conv-chip:hover:not(:disabled),
        .chat-conversation[data-theme='light'] .chat-conv-chip:hover:not(:disabled) {
          background: #f4f4f5;
          border-color: #d4d4d8;
        }

        [data-theme='light'] .chat-conv-chip-tag,
        .chat-conversation[data-theme='light'] .chat-conv-chip-tag {
          color: #52525b;
          background: #f4f4f5;
          border-color: #e4e4e7;
        }

        [data-theme='light'] .chat-conv-chip-text,
        .chat-conversation[data-theme='light'] .chat-conv-chip-text {
          color: #18181b;
        }

        [data-theme='light'] .chat-conv-chip-arrow,
        .chat-conversation[data-theme='light'] .chat-conv-chip-arrow {
          color: #a1a1aa;
        }

        [data-theme='light'] .chat-conv-chip:hover:not(:disabled) .chat-conv-chip-arrow,
        .chat-conversation[data-theme='light'] .chat-conv-chip:hover:not(:disabled) .chat-conv-chip-arrow {
          color: #09090b;
        }

        [data-theme='light'] .chat-conv-avatar-wrap,
        .chat-conversation[data-theme='light'] .chat-conv-avatar-wrap {
          background: #18181b;
          border-color: #27272a;
        }

        [data-theme='light'] .chat-conv-bubble--user,
        .chat-conversation[data-theme='light'] .chat-conv-bubble--user {
          background: #09090b;
          border-color: #09090b;
          color: #ffffff;
        }

        [data-theme='light'] .chat-conv-bubble--assistant,
        .chat-conversation[data-theme='light'] .chat-conv-bubble--assistant {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        [data-theme='light'] .chat-md-strong,
        .chat-conversation[data-theme='light'] .chat-md-strong {
          color: #09090b;
        }

        [data-theme='light'] .chat-md-em,
        .chat-conversation[data-theme='light'] .chat-md-em {
          color: #334155;
        }

        [data-theme='light'] .chat-inline-code,
        .chat-conversation[data-theme='light'] .chat-inline-code {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #0f172a;
        }

        [data-theme='light'] .chat-codeblock,
        .chat-conversation[data-theme='light'] .chat-codeblock {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        [data-theme='light'] .chat-codeblock-header,
        .chat-conversation[data-theme='light'] .chat-codeblock-header {
          background: #f1f5f9;
          border-bottom-color: #e2e8f0;
        }

        [data-theme='light'] .chat-codeblock-label,
        .chat-conversation[data-theme='light'] .chat-codeblock-label {
          color: #64748b;
        }

        [data-theme='light'] .chat-codeblock-term-icon,
        .chat-conversation[data-theme='light'] .chat-codeblock-term-icon {
          color: #0284c7;
        }

        [data-theme='light'] .chat-copy-code-btn,
        .chat-conversation[data-theme='light'] .chat-copy-code-btn {
          color: #64748b;
        }

        [data-theme='light'] .chat-copy-code-btn:hover,
        .chat-conversation[data-theme='light'] .chat-copy-code-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        [data-theme='light'] .chat-codeblock-content,
        .chat-conversation[data-theme='light'] .chat-codeblock-content {
          color: #0f172a;
        }

        [data-theme='light'] .chat-csv-btn,
        .chat-conversation[data-theme='light'] .chat-csv-btn {
          background: #ffffff;
          border-color: #e4e4e7;
          color: #09090b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        [data-theme='light'] .chat-csv-btn:hover,
        .chat-conversation[data-theme='light'] .chat-csv-btn:hover {
          background: #f4f4f5;
          border-color: #d4d4d8;
        }

        [data-theme='light'] .chat-csv-icon,
        .chat-conversation[data-theme='light'] .chat-csv-icon {
          color: #16a34a;
        }

        [data-theme='light'] .chat-csv-download-icon,
        .chat-conversation[data-theme='light'] .chat-csv-download-icon {
          color: #71717a;
        }

        [data-theme='light'] .chat-conv-msg-time,
        .chat-conversation[data-theme='light'] .chat-conv-msg-time {
          color: #71717a;
        }

        [data-theme='light'] .chat-conv-copy-action,
        .chat-conversation[data-theme='light'] .chat-conv-copy-action {
          color: #71717a;
        }

        [data-theme='light'] .chat-conv-copy-action:hover,
        .chat-conversation[data-theme='light'] .chat-conv-copy-action:hover {
          color: #09090b;
          background: #f4f4f5;
        }

        [data-theme='light'] .chat-pulse-node,
        .chat-conversation[data-theme='light'] .chat-pulse-node {
          background: #ca8a04;
          box-shadow: 0 0 8px rgba(202, 138, 4, 0.5);
        }

        [data-theme='light'] .chat-thinking-text,
        .chat-conversation[data-theme='light'] .chat-thinking-text {
          color: #71717a;
        }



        [data-theme='light'] .chat-conv-input-bar,
        .chat-conversation[data-theme='light'] .chat-conv-input-bar {
          background: #ffffff;
          border-top-color: #e4e4e7;
        }

        [data-theme='light'] .chat-conv-input-wrapper,
        .chat-conversation[data-theme='light'] .chat-conv-input-wrapper {
          background: #f4f4f5;
          border-color: #e4e4e7;
        }

        [data-theme='light'] .chat-conv-input-wrapper:focus-within,
        .chat-conversation[data-theme='light'] .chat-conv-input-wrapper:focus-within {
          border-color: #09090b;
          box-shadow: 0 0 0 1px #09090b;
          background: #ffffff;
        }

        [data-theme='light'] .chat-conv-input,
        .chat-conversation[data-theme='light'] .chat-conv-input {
          color: #09090b;
        }

        [data-theme='light'] .chat-conv-input::placeholder,
        .chat-conversation[data-theme='light'] .chat-conv-input::placeholder {
          color: #71717a;
        }

        [data-theme='light'] .chat-conv-send-btn,
        .chat-conversation[data-theme='light'] .chat-conv-send-btn {
          background: #09090b;
          color: #ffffff;
        }

        [data-theme='light'] .chat-conv-send-btn:hover:not(:disabled),
        .chat-conversation[data-theme='light'] .chat-conv-send-btn:hover:not(:disabled) {
          background: #27272a;
          opacity: 1;
        }

        [data-theme='light'] .chat-conv-send-btn:disabled,
        .chat-conversation[data-theme='light'] .chat-conv-send-btn:disabled {
          background: #e4e4e7;
          color: #a1a1aa;
        }

      `}</style>
    </div>
  );
}
