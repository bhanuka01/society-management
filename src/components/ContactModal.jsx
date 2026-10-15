import { useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

const CONTACT_EMAIL = "bhanukadilshan2002@gmail.com";

export default function ContactModal({ isOpen, onClose, session, isDark = true }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", text: string }

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus({ type: "error", text: "Please enter a message before sending." });
      return;
    }

    setSending(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("access_key", "a550f902-9114-4a93-be4f-44fd2145d58e");
    formData.append("subject", "Society Management System - Issue Report");
    formData.append("name", session?.name || "Guest User");
    formData.append("email", session?.email || "no-reply@society.com");

    const formattedMessage = `
Sender Details:
------------------------------------------
Name: ${session?.name || "Guest User"}
Email: ${session?.email || "Not Available"}
Student ID: ${session?.stId || "Not Available"}
Role: ${session?.role || "guest"}

System Context:
------------------------------------------
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Time: ${new Date().toLocaleString()}

Message/Issue Description:
------------------------------------------
${message.trim()}
`;
    formData.append("message", formattedMessage);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setStatus({ type: "success", text: "Your message has been sent successfully!" });
        setMessage("");
      } else {
        setStatus({ type: "error", text: data.message || "Failed to send the email. Please try again." });
      }
    } catch (error) {
      setStatus({ type: "error", text: "A network error occurred. Please check your connection." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-[620px] rounded-[10px] p-6 shadow-2xl relative text-left animate-in fade-in zoom-in-95 duration-150 border ${
          isDark
            ? "bg-[#121316] border-[#23252a] text-[#e5e5e6]"
            : "bg-white border-gray-200 text-gray-900"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            className={`text-[11px] font-semibold tracking-wider uppercase font-berkeley-mono ${
              isDark ? "text-[#8a8f98]" : "text-gray-500"
            }`}
          >
            CONTACT FOR ISSUES
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-berkeley-mono ${
                isDark
                  ? "bg-[#18191c] border border-[#26282d] text-[#a0a5ad]"
                  : "bg-gray-100 border border-gray-200 text-gray-600"
              }`}
            >
              {CONTACT_EMAIL}
            </span>
            <button
              type="button"
              onClick={onClose}
              className={`transition-colors cursor-pointer p-1 rounded ${
                isDark
                  ? "text-[#8a8f98] hover:text-white hover:bg-[#23252a]/60"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subtitle / Developer Info */}
        <p
          className={`text-[13.5px] leading-relaxed mb-4 ${
            isDark ? "text-[#9da3ad]" : "text-gray-600"
          }`}
        >
          Developed by{" "}
          <a
            href="https://bhanukadilshan.me/"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-bold hover:underline ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Bhanuka Dilshan
          </a>
          . If you encounter any bugs, issues, or have feedback, please write a message below to send an email.
        </p>

        {status && (
          <div
            className={`p-3 rounded-[6px] mb-4 text-[12.5px] flex items-center gap-2 ${
              status.type === "success"
                ? "bg-[#27a644]/15 border border-[#27a644]/30 text-[#4ade80]"
                : "bg-[#eb5757]/15 border border-[#eb5757]/30 text-[#f87171]"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{status.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className={`block text-[11px] font-semibold tracking-wider uppercase font-berkeley-mono mb-2 ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              SHORT MESSAGE
            </label>
            <textarea
              rows={4}
              placeholder="Write the issue shortly..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              className={`w-full rounded-[6px] p-3 text-[13.5px] focus:outline-none resize-y transition-colors border ${
                isDark
                  ? "bg-[#0d0e10] border-[#23252a] text-white placeholder:text-[#525866] focus:border-[#4b5563]"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500"
              }`}
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={sending}
              className={`font-[510] text-[13px] px-4 py-2 rounded-[6px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm ${
                isDark
                  ? "bg-white hover:bg-[#e4e7eb] text-black"
                  : "bg-gray-900 hover:bg-black text-white"
              }`}
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
