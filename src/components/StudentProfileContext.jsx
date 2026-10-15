import { createContext, useContext, useState, useCallback } from "react";
import StudentProfileModal from "./StudentProfileModal";
import { User, ExternalLink } from "lucide-react";

const StudentProfileContext = createContext({
  activeStudentId: null,
  openStudentProfile: () => {},
  closeStudentProfile: () => {},
});

export function StudentProfileProvider({ children }) {
  const [activeStudentId, setActiveStudentId] = useState(null);

  const openStudentProfile = useCallback((stId) => {
    if (stId && typeof stId === "string") {
      setActiveStudentId(stId.trim());
    } else if (stId) {
      setActiveStudentId(String(stId));
    }
  }, []);

  const closeStudentProfile = useCallback(() => {
    setActiveStudentId(null);
  }, []);

  return (
    <StudentProfileContext.Provider
      value={{
        activeStudentId,
        openStudentProfile,
        closeStudentProfile,
      }}
    >
      {children}
      {activeStudentId && (
        <StudentProfileModal
          stId={activeStudentId}
          onClose={closeStudentProfile}
        />
      )}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const context = useContext(StudentProfileContext);
  if (!context) {
    return {
      activeStudentId: null,
      openStudentProfile: (stId) => {
        console.warn("StudentProfileProvider missing, cannot open:", stId);
      },
      closeStudentProfile: () => {},
    };
  }
  return context;
}

/**
 * Reusable, visually prominent Student Name component following Linear design guidelines.
 * Features:
 * - High-contrast text transitioning to Acid-Lime (#e4f222) on hover
 * - Micro indicator / dossier icon so users immediately recognize it as clickable
 * - Hover tooltip and accessibility attributes
 * - Stops event propagation to prevent parent row triggers
 */
export function StudentNameLink({
  stId,
  name,
  subtext,
  showIcon = true,
  showAvatar = false,
  showId = false,
  avatarUrl,
  className = "",
  size = "md", // "sm" | "md" | "lg"
  children,
}) {
  const { openStudentProfile } = useStudentProfile();
  const displayName = name || children || (stId ? `Student (${stId})` : "Unknown Student");

  if (!stId) {
    return (
      <span className={`text-gray-600 dark:text-[#8a8f98] font-[400] ${className}`}>
        {displayName}
      </span>
    );
  }

  const handleClick = (e) => {
    e.stopPropagation();
    openStudentProfile(stId);
  };

  const sizeClasses = {
    sm: "text-[12px] gap-1",
    md: "text-[13px] gap-1.5",
    lg: "text-[15px] gap-2",
  };

  const getInitials = (n) => {
    if (!n) return "S";
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Inspect Student Dossier (${stId})`}
      className={`inline-flex items-center text-left group/student transition-all duration-150 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 dark:focus:ring-[#e4f222]/50 ${sizeClasses[size] || sizeClasses.md} ${className}`}
    >
      {showAvatar && (
        <span className="w-6 h-6 rounded-[4px] bg-gray-100 dark:bg-[#161718] border border-gray-200 dark:border-[#23252a] overflow-hidden flex items-center justify-center font-berkeley-mono text-[10px] text-gray-700 dark:text-[#ffffff] flex-shrink-0 group-hover/student:border-indigo-500/40 dark:group-hover/student:border-[#e4f222]/40 transition-colors">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(displayName)
          )}
        </span>
      )}

      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-1 leading-snug">
          <span className="font-[510] text-gray-900 dark:text-[#ffffff] group-hover/student:text-indigo-600 dark:group-hover/student:text-[#e4f222] transition-colors truncate">
            {displayName}
          </span>
          {showIcon && (
            <span
              className="inline-flex items-center text-gray-400 dark:text-[#62666d] group-hover/student:text-indigo-600 dark:group-hover/student:text-[#e4f222] group-hover/student:translate-x-0.5 transition-all flex-shrink-0"
              aria-hidden="true"
            >
              <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover/student:opacity-100" />
            </span>
          )}
        </span>

        {(subtext || showId) && (
          <span className="font-berkeley-mono text-[10.5px] text-gray-500 dark:text-[#8a8f98] group-hover/student:text-gray-700 dark:group-hover/student:text-[#d0d6e0] transition-colors truncate">
            {subtext || stId}
          </span>
        )}
      </span>
    </button>
  );
}

export default StudentProfileContext;
