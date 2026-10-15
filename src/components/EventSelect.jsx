import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function EventSelect({
  events = [],
  value = "",
  onChange,
  placeholder = "Search or select an event...",
  className = "",
  style = {},
  theme
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") || 
             document.documentElement.getAttribute("data-theme") === "dark" 
             ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      const isDocDark = document.documentElement.classList.contains("dark") || 
                        document.documentElement.getAttribute("data-theme") === "dark";
      setCurrentTheme(isDocDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const dropdownRef = useRef(null);

  const PAGE_SIZE = 6;
  const selectedEvent = events.find(e => e.event_id === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredEvents = events.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const name = (e.name || "").toLowerCase();
    const date = (e.date || "").toLowerCase();
    const id = (e.event_id || "").toLowerCase();
    return name.includes(q) || date.includes(q) || id.includes(q);
  });

  const totalItems = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = currentPage * PAGE_SIZE;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + PAGE_SIZE);

  const handleSelect = (eventId) => {
    onChange(eventId);
    setIsOpen(false);
    setSearch("");
    setPage(0);
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(0);
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative w-full select-none font-inter-variable ${className}`}
      style={{ zIndex: isOpen ? 100 : 1, ...style }}
    >
      {/* Selected Box / Control */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 border transition-all text-left rounded-[6px] outline-none ${
          isDark
            ? `bg-[#0f1011] hover:bg-[#161718] ${
                isOpen
                  ? "border-[#d0d6e0] shadow-[0_0_0_1px_rgba(208,214,224,0.3)]"
                  : "border-[#23252a] hover:border-[#383b3f]"
              }`
            : `bg-white hover:bg-gray-50 ${
                isOpen
                  ? "border-indigo-500 ring-1 ring-indigo-500 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 shadow-xs"
              }`
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-5 h-5 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${
            isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"
          }`}>
            <Calendar className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
          </div>
          {selectedEvent ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`text-[13px] font-[510] truncate tracking-[-0.011em] ${
                isDark ? "text-[#ffffff]" : "text-gray-900"
              }`}>
                {selectedEvent.name}
              </span>
              {selectedEvent.date && (
                <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] flex-shrink-0 ${
                  isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
                }`}>
                  {selectedEvent.date}
                </span>
              )}
            </div>
          ) : (
            <span className={`text-[13px] truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 flex-shrink-0 ${
            isDark ? (isOpen ? "rotate-180 text-white" : "text-[#8a8f98]") : (isOpen ? "rotate-180 text-gray-900" : "text-gray-400")
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`absolute top-full left-0 right-0 mt-1 z-50 border rounded-[8px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[0_16px_36px_rgba(0,0,0,0.6),0_4px_12px_rgba(0,0,0,0.4)]" 
            : "bg-white border-gray-200 shadow-xl"
        }`}>
          {/* Search Box */}
          <div className={`p-2 border-b ${isDark ? "border-[#23252a] bg-[#161718]/60" : "border-gray-200 bg-gray-50/70"}`}>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search event name, ID, or date..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                autoFocus
                onClick={e => e.stopPropagation()}
                className={`w-full pl-8 pr-2.5 py-1.5 border rounded-[6px] text-[12px] outline-none transition-colors ${
                  isDark 
                    ? "bg-[#08090a] border-[#23252a] focus:border-[#d0d6e0] text-white placeholder-[#62666d]" 
                    : "bg-white border-gray-300 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
                }`}
              />
            </div>
          </div>

          {/* Events List */}
          <div className={`p-1 max-h-64 overflow-y-auto divide-y ${isDark ? "divide-[#23252a]/40" : "divide-gray-100"}`}>
            {paginatedEvents.length === 0 ? (
              <div className={`py-6 px-4 text-center text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                No matching events found
              </div>
            ) : (
              paginatedEvents.map(e => {
                const isSelected = e.event_id === value;
                return (
                  <button
                    key={e.event_id}
                    type="button"
                    onClick={() => handleSelect(e.event_id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-[6px] transition-colors ${
                      isSelected
                        ? (isDark ? "bg-[#161718] text-white" : "bg-indigo-50 text-indigo-900 font-medium")
                        : (isDark ? "hover:bg-[#161718]/60 text-[#d0d6e0]" : "hover:bg-gray-50 text-gray-700")
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] font-[510] truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                        {e.name}
                      </div>
                      <div className={`text-[10px] font-berkeley-mono truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                        ID: {e.event_id}
                      </div>
                    </div>
                    {e.date && (
                      <span className={`px-1.5 py-0.5 rounded-[4px] border font-berkeley-mono text-[10px] flex-shrink-0 ${
                        isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
                      }`}>
                        {e.date}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with pagination */}
          <div className={`px-3 py-2 text-[11px] font-berkeley-mono border-t flex items-center justify-between gap-2 ${
            isDark ? "text-[#8a8f98] border-[#23252a] bg-[#161718]/40" : "text-gray-500 border-gray-200 bg-gray-50"
          }`}>
            <span>
              {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setPage(p => Math.max(0, p - 1));
                }}
                className={`p-1 rounded-[4px] disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
                  isDark ? "hover:bg-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-200 text-gray-700"
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className={`px-1 text-[11px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                {currentPage + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setPage(p => Math.min(totalPages - 1, p + 1));
                }}
                className={`p-1 rounded-[4px] disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
                  isDark ? "hover:bg-[#23252a] text-[#d0d6e0]" : "hover:bg-gray-200 text-gray-700"
                }`}
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
