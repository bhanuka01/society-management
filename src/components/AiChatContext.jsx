import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getAssistantReply } from "../lib/chatAssistant";

const AiChatContext = createContext(null);

const STORAGE_KEY = "adss_ai_assistant_history_v1";

export function AiChatProvider({ children, role = "guest" }) {
  // Load initial messages from session storage if available
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore storage quota issues
    }
  }, [messages]);

  const toggleWidget = useCallback(() => {
    setIsWidgetOpen((prev) => !prev);
  }, []);

  const openWidget = useCallback(() => {
    setIsWidgetOpen(true);
  }, []);

  const closeWidget = useCallback(() => {
    setIsWidgetOpen(false);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const sendMessage = useCallback(
    async (text, userRole = role) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg = {
        role: "user",
        text: trimmed,
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      const historyForApi = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        text: m.text,
      }));

      try {
        const result = await getAssistantReply(trimmed, historyForApi, userRole);

        const assistantMsg = {
          role: "assistant",
          text: result.success
            ? result.text
            : `⚠️ ${result.error ?? "Something went wrong. Please try again."}`,
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "⚠️ Unexpected error connecting to ADSS Intelligence. Please try again.",
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, role]
  );

  const value = {
    messages,
    input,
    setInput,
    loading,
    sendMessage,
    clearChat,
    isWidgetOpen,
    setIsWidgetOpen,
    toggleWidget,
    openWidget,
    closeWidget,
  };

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat() {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChat must be used within an AiChatProvider");
  }
  return ctx;
}
