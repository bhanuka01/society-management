import React, { useState } from "react";

export default function PhoneContact({ phone }) {
  const [showModal, setShowModal] = useState(false);

  if (!phone) return <span className="text-muted">Not provided</span>;

  // Clean phone number for WhatsApp: keep only numbers.
  // If Sri Lankan mobile (starts with 0 and has 10 digits), convert 0 to 94.
  const getWhatsAppLink = (num) => {
    let cleaned = num.replace(/\D/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "94" + cleaned.substring(1);
    }
    return `https://wa.me/${cleaned}`;
  };

  // Clean phone number for tel: link (keep numbers and + sign)
  const getTelLink = (num) => {
    const cleaned = num.replace(/[^\d+]/g, "");
    return `tel:${cleaned}`;
  };

  return (
    <>
      <span
        className="contact-number-link"
        onClick={() => setShowModal(true)}
      >
        {phone}
      </span>

      {showModal && (
        <div
          className="contact-choice-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="contact-choice-card">
            <div className="contact-choice-header">
              <h3 className="contact-choice-title">Contact Options</h3>
              <button
                className="contact-choice-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <div className="contact-choice-body">
              <a
                href={getTelLink(phone)}
                className="contact-choice-btn call"
                onClick={() => setShowModal(false)}
              >
                <span>📞</span>
                <span>Call Phone</span>
              </a>
              <a
                href={getWhatsAppLink(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-choice-btn whatsapp"
                onClick={() => setShowModal(false)}
              >
                <span>💬</span>
                <span>WhatsApp Message</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
