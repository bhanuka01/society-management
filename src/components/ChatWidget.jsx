import React, { useState, useEffect, useRef } from "react";
import { X, Maximize2, Trash2, Sparkles } from "lucide-react";
import { useAiChat } from "./AiChatContext";
import AdssAiIcon from "./AdssAiIcon";
import ChatConversation from "./ChatConversation";

/* ─────────────────────────────────────────────────────────────────────────────
   ChatWidget — Floating AI Assistant Trigger & Linear Midnight Popup Window
   Adheres to DESIGN.md tokens: Void (#08090a), Carbon (#0f1011), hairline (#23252a)
───────────────────────────────────────────────────────────────────────────── */
export default function ChatWidget({
  role = "guest",
  session = {},
  onNavigate,
  currentPage,
  theme,
}) {
  const userRole = session?.role || role || "guest";
  const {
    messages,
    input,
    setInput,
    loading,
    sendMessage,
    clearChat,
    isWidgetOpen,
    setIsWidgetOpen,
    toggleWidget,
    closeWidget,
  } = useAiChat();

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isWidgetOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isWidgetOpen]);

  // Global Keyboard shortcuts:
  // - Escape closes
  // - Ctrl + / or Cmd + / toggles the widget
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle on Ctrl+/ or Cmd+/
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        toggleWidget();
        return;
      }

      // Close on Escape
      if (e.key === "Escape" && isWidgetOpen) {
        closeWidget();
        toggleRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWidgetOpen, toggleWidget, closeWidget]);

  // Expand to dedicated full-page assistant
  const handleExpandToFullPage = () => {
    closeWidget();
    if (onNavigate) {
      onNavigate("assistant");
    } else {
      window.history.pushState({}, "", "/assistant");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (window.confirm("Clear active ADSS intelligence conversation?")) {
      clearChat();
    }
  };

  const roleLabel =
    userRole === "admin"
      ? "STAFF COMMAND"
      : userRole === "editor"
      ? "EDITOR PORTAL"
      : userRole === "member"
      ? "MEMBER PORTAL"
      : "GUEST ACCESS";

  return (
    <>
      {/* Floating Trigger Button — Linear Midnight Carbon */}
      <div className="adss-ai-trigger-container">
        <button
          ref={toggleRef}
          id="adss-ai-widget-toggle"
          className={`adss-ai-trigger-btn ${isWidgetOpen ? "adss-ai-trigger-btn--open" : ""}`}
          onClick={toggleWidget}
          aria-label={isWidgetOpen ? "Close ADSS AI assistant" : "Open ADSS AI assistant"}
          aria-expanded={isWidgetOpen}
          aria-controls="adss-ai-widget-panel"
          title="ADSS Portal AI Assistant (Ctrl+/)"
        >
          {isWidgetOpen ? (
            <X className="w-5 h-5 text-current transition-transform duration-200" />
          ) : (
            <div className="relative flex items-center justify-center">
              <AdssAiIcon size={22} variant="brand" animate={loading} />
              {/* Online pulse telemetry dot */}
              <span className="adss-ai-status-indicator" />
            </div>
          )}

          {/* Floating Pill Tooltip on Hover */}
          {!isWidgetOpen && (
            <div className="adss-ai-trigger-tooltip">
              <span className="font-sans text-[12px] font-medium adss-ai-tooltip-text">ADSS AI</span>
              <span className="adss-ai-shortcut-badge">Ctrl /</span>
            </div>
          )}
        </button>
      </div>

      {/* Floating Popup Window Panel */}
      <div
        id="adss-ai-widget-panel"
        ref={panelRef}
        className={`adss-ai-panel ${isWidgetOpen ? "adss-ai-panel--open" : ""}`}
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-label="ADSS Portal AI Assistant"
      >
        {/* Mobile Drag Indicator */}
        <div className="adss-ai-mobile-handle" />

        {/* Panel Header */}
        <div className="adss-ai-header">
          <div className="adss-ai-header-left">
            <div className="adss-ai-header-emblem">
              <AdssAiIcon size={18} variant="brand" />
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="adss-ai-title">ADSS Intelligence</h3>
              <span className="adss-ai-role-badge">{roleLabel}</span>
            </div>
          </div>

          <div className="adss-ai-header-actions">
            {/* Clear Chat Action */}
            {messages.length > 0 && (
              <button
                type="button"
                className="adss-ai-action-btn"
                onClick={handleClearHistory}
                title="Clear conversation"
                aria-label="Clear conversation history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Expand to Full Page Action */}
            <button
              type="button"
              className="adss-ai-action-btn"
              onClick={handleExpandToFullPage}
              title="Expand to full workspace view (/assistant)"
              aria-label="Open in full screen page"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="adss-ai-action-btn"
              onClick={closeWidget}
              title="Close panel (Esc)"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation Stream Area */}
        <div className="adss-ai-content">
          <ChatConversation
            messages={messages}
            loading={loading}
            input={input}
            onInputChange={setInput}
            onSendMessage={sendMessage}
            compact={true}
            inputRef={inputRef}
            role={userRole}
            theme={theme}
          />
        </div>
      </div>

      {/* Backdrop (Mobile only) */}
      {isWidgetOpen && (
        <div
          className="adss-ai-backdrop"
          onClick={closeWidget}
          aria-hidden="true"
        />
      )}

      {/* Scoped CSS Styles adhering to DESIGN.md */}
      <style>{`
        /* Trigger Container */
        .adss-ai-trigger-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
        }

        .adss-ai-trigger-btn {
          width: 50px;
          height: 50px;
          border-radius: 9999px;
          background: #0f1011;
          color: #ffffff;
          border: 1px solid #23252a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: rgba(0, 0, 0, 0.4) 0px 4px 16px 0px, rgb(35, 37, 42) 0px 0px 0px 1px inset;
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.18s ease,
                      background 0.18s ease;
          position: relative;
        }

        .adss-ai-trigger-btn:hover {
          transform: scale(1.06);
          background: #161718;
          border-color: #383b3f;
        }

        .adss-ai-trigger-btn:focus-visible {
          outline: 2px solid #e4f222;
          outline-offset: 3px;
        }

        .adss-ai-trigger-btn:active {
          transform: scale(0.95);
        }

        .adss-ai-trigger-btn--open {
          background: #161718;
          border-color: #383b3f;
        }

        /* Status Dot */
        .adss-ai-status-indicator {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e4f222;
          border: 2px solid #0f1011;
          box-shadow: 0 0 6px rgba(228, 242, 34, 0.6);
        }

        /* Tooltip */
        .adss-ai-trigger-tooltip {
          position: absolute;
          right: 60px;
          top: 50%;
          transform: translateY(-50%) translateX(6px);
          background: #0f1011;
          border: 1px solid #23252a;
          box-shadow: rgba(0, 0, 0, 0.4) 0px 4px 12px;
          border-radius: 6px;
          padding: 5px 9px;
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .adss-ai-trigger-btn:hover .adss-ai-trigger-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }

        .adss-ai-shortcut-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8a8f98;
          background: #161718;
          border: 1px solid #23252a;
          border-radius: 3px;
          padding: 1px 4px;
        }

        /* Floating Popup Window Panel */
        .adss-ai-panel {
          position: fixed;
          bottom: 86px;
          right: 24px;
          z-index: 999;
          width: 390px;
          height: 540px;
          max-height: calc(100vh - 110px);
          background: #0f1011;
          border: 1px solid #23252a;
          border-radius: 12px;
          box-shadow: rgba(8, 9, 10, 0.6) 0px 4px 32px 0px, rgb(35, 37, 42) 0px 0px 0px 1px inset;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          transform: translateY(12px) scale(0.97);
          pointer-events: none;
          transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .adss-ai-panel--open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: all;
        }

        .adss-ai-mobile-handle {
          display: none;
        }

        /* Header Bar */
        .adss-ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #0f1011;
          border-bottom: 1px solid #23252a;
          flex-shrink: 0;
        }

        .adss-ai-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .adss-ai-header-emblem {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: #161718;
          border: 1px solid #23252a;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .adss-ai-title {
          font-size: 13px;
          font-weight: 510;
          color: #ffffff;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        .adss-ai-role-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          color: #8a8f98;
          background: #161718;
          border: 1px solid #23252a;
          border-radius: 4px;
          padding: 0 4px;
          letter-spacing: 0.02em;
        }



        .adss-ai-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .adss-ai-action-btn {
          background: transparent;
          border: none;
          color: #8a8f98;
          padding: 5px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s;
        }

        .adss-ai-action-btn:hover {
          color: #ffffff;
          background: #161718;
        }

        .adss-ai-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .adss-ai-backdrop {
          display: none;
        }

        /* ─── Light Mode Theme Support ─── */
        [data-theme='light'] .adss-ai-panel,
        .adss-ai-panel[data-theme='light'] {
          background: #ffffff;
          border-color: #e4e4e7;
          box-shadow: 0 12px 48px -8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        [data-theme='light'] .adss-ai-header,
        .adss-ai-panel[data-theme='light'] .adss-ai-header {
          background: #ffffff;
          border-bottom-color: #e4e4e7;
        }

        [data-theme='light'] .adss-ai-header-emblem,
        .adss-ai-panel[data-theme='light'] .adss-ai-header-emblem {
          background: #18181b;
          border-color: #27272a;
        }

        [data-theme='light'] .adss-ai-title,
        .adss-ai-panel[data-theme='light'] .adss-ai-title {
          color: #09090b;
        }

        [data-theme='light'] .adss-ai-role-badge,
        .adss-ai-panel[data-theme='light'] .adss-ai-role-badge {
          color: #52525b;
          background: #f4f4f5;
          border-color: #e4e4e7;
        }



        [data-theme='light'] .adss-ai-action-btn,
        .adss-ai-panel[data-theme='light'] .adss-ai-action-btn {
          color: #71717a;
        }

        [data-theme='light'] .adss-ai-action-btn:hover,
        .adss-ai-panel[data-theme='light'] .adss-ai-action-btn:hover {
          color: #09090b;
          background: #f4f4f5;
        }

        [data-theme='light'] .adss-ai-mobile-handle,
        .adss-ai-panel[data-theme='light'] .adss-ai-mobile-handle {
          background: #e4e4e7;
        }

        [data-theme='light'] .adss-ai-backdrop {
          background: rgba(0, 0, 0, 0.35);
        }

        [data-theme='light'] .adss-ai-trigger-btn {
          background: #09090b;
          color: #ffffff;
          border-color: rgba(0, 0, 0, 0.15);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.22);
        }

        [data-theme='light'] .adss-ai-trigger-btn:hover {
          background: #18181b;
          border-color: rgba(0, 0, 0, 0.25);
        }

        [data-theme='light'] .adss-ai-trigger-btn--open {
          background: #18181b;
          border-color: rgba(0, 0, 0, 0.25);
        }

        [data-theme='light'] .adss-ai-trigger-tooltip {
          background: #ffffff;
          border-color: #e4e4e7;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        [data-theme='light'] .adss-ai-tooltip-text {
          color: #09090b;
        }

        [data-theme='light'] .adss-ai-shortcut-badge {
          color: #52525b;
          background: #f4f4f5;
          border-color: #e4e4e7;
        }

        /* Mobile Viewport Adaptations (Phone & Tablet with Mobile Bottom Bar) */
        @media (max-width: 768px) {
          .adss-ai-trigger-container {
            bottom: calc(76px + env(safe-area-inset-bottom, 0px));
            right: 16px;
            z-index: 45; /* Below mobile-bottom-bar (50), drawer-backdrop (90) and drawer (100) */
          }

          .adss-ai-trigger-btn {
            width: 44px;
            height: 44px;
          }

          .adss-ai-trigger-tooltip {
            display: none !important;
          }

          .adss-ai-panel {
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            height: 76vh;
            max-height: 80vh;
            border-radius: 14px 14px 0 0;
            border-bottom: none;
            border-left: none;
            border-right: none;
            transform: translateY(100%);
            z-index: 999;
          }

          .adss-ai-panel--open {
            transform: translateY(0);
          }

          .adss-ai-mobile-handle {
            display: block;
            width: 36px;
            height: 4px;
            border-radius: 9999px;
            background: #23252a;
            margin: 8px auto 2px;
          }

          .adss-ai-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 998;
          }
        }
      `}</style>
    </>
  );
}
