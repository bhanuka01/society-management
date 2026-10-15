import { useState } from "react";
import ContactModal from "./ContactModal";

export default function MinimalFooter({ session, isDark, className = "" }) {
  const [showContact, setShowContact] = useState(false);
  const darkMode = isDark !== undefined ? isDark : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);

  return (
    <>
      <div
        className={`text-center text-[12px] font-berkeley-mono transition-colors ${
          darkMode ? "text-[#62666d]" : "text-gray-500"
        } ${className}`}
      >
        Developed by{" "}
        <a
          href="https://bhanukadilshan.me/"
          target="_blank"
          rel="noopener noreferrer"
          className={`underline transition-colors ${
            darkMode ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Bhanuka Dilshan
        </a>
        {" • "}
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className={`transition-colors cursor-pointer inline-flex items-center ${
            darkMode
              ? "text-[#8a8f98] hover:text-[#e4f222]"
              : "text-gray-600 hover:text-indigo-600 font-medium"
          }`}
        >
          Contact For Issues
        </button>
      </div>

      <ContactModal
        isOpen={showContact}
        onClose={() => setShowContact(false)}
        session={session}
        isDark={darkMode}
      />
    </>
  );
}
