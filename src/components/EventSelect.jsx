import { useState, useRef, useEffect } from "react";

export default function EventSelect({
  events = [],
  value = "",
  onChange,
  placeholder = "Search or select an event...",
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const dropdownRef = useRef(null);

  const PAGE_SIZE = 5;
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
      style={{
        position: "relative",
        width: "100%",
        display: "inline-block",
        userSelect: "none",
        ...style
      }}
    >
      {/* Selected Box / Control */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface)",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
          borderRadius: "var(--r, 8px)",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isOpen ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
          gap: "10px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", flex: 1 }}>
          <span style={{ fontSize: "16px", flexShrink: 0 }}>📅</span>
          {selectedEvent ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: "600", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedEvent.name}
              </span>
              {selectedEvent.date && (
                <span className="badge badge-gray" style={{ fontSize: "11px", flexShrink: 0, padding: "2px 6px" }}>
                  {selectedEvent.date}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted" style={{ fontSize: "14px" }}>
              {placeholder}
            </span>
          )}
        </div>
        <span style={{ fontSize: "12px", color: "var(--text3)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          ▼
        </span>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r, 8px)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Search Box */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", background: "var(--bg3)" }}>
            <input
              type="text"
              placeholder="Type to filter events..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              autoFocus
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "13px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "var(--bg)",
                color: "var(--text)",
                outline: "none"
              }}
            />
          </div>

          {/* Events List (5 items at a time) */}
          <div
            style={{
              padding: "4px"
            }}
          >
            {paginatedEvents.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
                No events found
              </div>
            ) : (
              paginatedEvents.map(e => {
                const isSelected = e.event_id === value;
                return (
                  <div
                    key={e.event_id}
                    onClick={() => handleSelect(e.event_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: isSelected ? "var(--accent-glow, rgba(99,102,241,0.15))" : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--text)",
                      fontWeight: isSelected ? "600" : "normal",
                      transition: "background 0.15s",
                      marginBottom: "2px"
                    }}
                    onMouseEnter={ev => {
                      if (!isSelected) ev.currentTarget.style.background = "var(--bg3)";
                    }}
                    onMouseLeave={ev => {
                      if (!isSelected) ev.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                      <span style={{ fontSize: "14px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.name}
                      </span>
                    </div>
                    {e.date && (
                      <span className="badge badge-gray" style={{ fontSize: "11px", marginLeft: "8px", flexShrink: 0 }}>
                        {e.date}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with 5-by-5 pagination controls */}
          <div
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              color: "var(--text3)",
              borderTop: "1px solid var(--border)",
              background: "var(--bg3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px"
            }}
          >
            <span>
              Showing {totalItems > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + PAGE_SIZE, totalItems)} of {totalItems}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={currentPage <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setPage(p => Math.max(0, p - 1));
                }}
                style={{ padding: "2px 8px", fontSize: "11px", height: "auto" }}
              >
                ◀ Prev
              </button>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text)" }}>
                {currentPage + 1}/{totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={currentPage >= totalPages - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setPage(p => Math.min(totalPages - 1, p + 1));
                }}
                style={{ padding: "2px 8px", fontSize: "11px", height: "auto" }}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
