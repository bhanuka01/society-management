import { useState, useCallback } from "react";
import { getAssistantReply } from "../lib/chatAssistant";
import ChatConversation from "../components/ChatConversation";

/* ─────────────────────────────────────────────────────────────────────────────
   AssistantPage — Full-page dedicated AI Assistant experience.
   Accessible via Sidebar ("AI Assistant") or URL route `/assistant`.
───────────────────────────────────────────────────────────────────────────── */
export default function AssistantPage({ onBackToLanding, role = "guest", session = {} }) {
  const userRole = session?.role || role || "guest";
  const isStaff = userRole === "admin" || userRole === "editor";

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg = { role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const historyForApi = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        text: m.text,
      }));

      try {
        const result = await getAssistantReply(trimmed, historyForApi, userRole);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.success
              ? result.text
              : `⚠️ ${result.error ?? "Something went wrong. Please try again."}`,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "⚠️ Unexpected error. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, userRole]
  );

  const handleClearChat = () => {
    if (window.confirm("Clear conversation history?")) {
      setMessages([]);
    }
  };

  return (
    <div className="assistant-page-container">
      {/* Top Page Header */}
      <div className="assistant-page-header">
        <div className="assistant-page-title-group">
          {onBackToLanding && (
            <button
              className="btn btn-ghost btn-sm assistant-back-btn"
              onClick={onBackToLanding}
              aria-label="Back to landing page"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
              <span>Back</span>
            </button>
          )}

          <div className="assistant-header-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              auto_awesome
            </span>
          </div>

          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              ADSS Portal AI Assistant
              <span className="badge badge-purple" style={{ fontSize: "11px", fontWeight: 600 }}>
                Grounded Knowledge
              </span>
            </h1>
            <p className="page-subtitle">
              {isStaff
                ? "Get instant, accurate answers about members, events, attendance, roles, and administrative tasks."
                : "Get instant, accurate answers about registration, event attendance, OC applications, and letter requests."}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClearChat}
            disabled={loading}
            title="Clear chat history"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              delete
            </span>
            <span>Clear Chat</span>
          </button>
        )}
      </div>

      {/* Main Chat Canvas Card */}
      <div className="assistant-chat-card">
        <ChatConversation
          messages={messages}
          loading={loading}
          input={input}
          onInputChange={setInput}
          onSendMessage={sendMessage}
          compact={false}
          role={userRole}
        />
      </div>

      {/* Page Scoped Styles */}
      <style>{`
        .assistant-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 48px);
          max-width: 1200px;
          margin: 0 auto;
          gap: 16px;
        }

        .assistant-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .assistant-page-title-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .assistant-header-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--r2);
          background: var(--accent-dim);
          border: 1px solid var(--accent-glow);
          color: var(--accent2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .assistant-back-btn {
          margin-right: 4px;
        }

        .assistant-chat-card {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r3);
          box-shadow: var(--shadow-md);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        @media (max-width: 768px) {
          .assistant-page-container {
            height: calc(100vh - 32px);
            gap: 12px;
          }
          .assistant-page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
