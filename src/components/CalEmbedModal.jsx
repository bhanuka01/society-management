import { useState } from "react";

export default function CalEmbedModal({ isOpen, onClose, calLink, studentName, studentEmail, stId, interviewerEmail, eventName, position }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build clean Cal.com URL with prefilled parameters
  const baseUrl = calLink || "https://cal.com";
  const urlObj = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
  
  if (studentEmail) urlObj.searchParams.set("email", studentEmail);
  if (studentName) urlObj.searchParams.set("name", studentName);
  if (stId) urlObj.searchParams.set("st_id", stId);
  // Cal.com native parameter for auto-adding guests/interviewers
  if (interviewerEmail) urlObj.searchParams.set("guests", interviewerEmail);
  urlObj.searchParams.set("embed", "true");

  const fullBookingUrl = urlObj.toString();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullBookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#1e293b",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "850px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
        color: "#f8fafc"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "600", color: "#60a5fa" }}>
              📅 Schedule Interview with Cal.com
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              {position ? `${position} — ` : ""}{eventName || "Society Recruitment"} {studentName ? `(${studentName})` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={handleCopy}
              style={{
                backgroundColor: copied ? "#16a34a" : "#334155",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {copied ? "✓ Link Copied!" : "📋 Copy Cal.com Link"}
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: "transparent",
                color: "#94a3b8",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: 1,
                padding: "4px 8px"
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Modal Body / Iframe */}
        <div style={{ flex: 1, minHeight: "550px", backgroundColor: "#fff", position: "relative" }}>
          <iframe
            src={fullBookingUrl}
            title="Cal.com Interview Booking"
            style={{ width: "100%", height: "100%", border: "none", minHeight: "550px" }}
          />
        </div>
      </div>
    </div>
  );
}
