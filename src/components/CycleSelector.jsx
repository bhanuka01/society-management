import React, { useState, useRef, useEffect } from "react";
import { useCycle } from "../context/CycleContext";
import { Calendar, ChevronDown, Check, Clock, RotateCcw, Sparkles } from "lucide-react";

export default function CycleSelector({
  variant = "toolbar", // "toolbar" | "sidebar" | "compact"
  theme,
  className = "",
  showAllOption = true,
  onChange
}) {
  const {
    visibleCycles,
    activeCycle,
    selectedCycleId,
    selectedCycle,
    setSelectedCycleId
  } = useCycle();

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") ||
        (document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      const isDocDark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";
      setCurrentTheme(isDocDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme === "dark";
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    setSelectedCycleId(id);
    if (onChange) onChange(id);
    setOpen(false);
  };

  const isAllSelected = selectedCycleId === "all";
  const isActiveSelected = selectedCycleId === "active" || selectedCycleId === activeCycle?.id;

  const currentLabel = isAllSelected
    ? "All Cycles"
    : selectedCycle?.name || activeCycle?.name || "Academic Cycle";

  // ── 1. SIDEBAR VARIANT ──
  if (variant === "sidebar") {
    return (
      <div className={`relative min-w-0 ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-left transition-all max-w-full ${
            isDark
              ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0]"
              : "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600 hover:text-gray-900"
          }`}
          title="Click to switch academic cycle"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isActiveSelected
                ? "bg-[#27a644] shadow-[0_0_6px_#27a644]"
                : isAllSelected
                ? "bg-[#818cf8]"
                : "bg-amber-400"
            }`}
          />
          <span className="text-[11px] font-berkeley-mono truncate font-[510]">
            {currentLabel} {isActiveSelected ? "Cycle" : ""}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60 ml-0.5" />
        </button>

        {open && (
          <div
            className={`absolute left-0 mt-1 w-56 rounded-[8px] border shadow-xl z-50 p-1.5 font-inter-variable text-[12px] animate-in fade-in zoom-in-95 duration-100 ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]"
                : "bg-white border-gray-200 text-gray-800 shadow-lg"
            }`}
          >
            <div className="px-2 py-1 text-[10px] font-berkeley-mono uppercase tracking-wider text-[#8a8f98] border-b border-[#23252a]/40 mb-1">
              Academic Cycles
            </div>

            {visibleCycles.map((c) => {
              const isSelected =
                (selectedCycleId === "active" && c.id === activeCycle?.id) ||
                selectedCycleId === c.id;
              const isCurrentActive = c.id === activeCycle?.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(isCurrentActive ? "active" : c.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] text-left transition-colors ${
                    isSelected
                      ? isDark
                        ? "bg-[#161718] text-white font-[510]"
                        : "bg-gray-100 text-gray-900 font-[510]"
                      : isDark
                      ? "hover:bg-[#161718]/60 text-[#8a8f98] hover:text-white"
                      : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-berkeley-mono text-[12px] font-[510]">
                        {c.name}
                      </span>
                      {isCurrentActive && (
                        <span className="text-[9px] font-berkeley-mono px-1 py-0.2 rounded-[3px] bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    {c.startDate && c.endDate && (
                      <div className="text-[10px] font-berkeley-mono opacity-60">
                        {c.startDate} → {c.endDate}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#e4f222] flex-shrink-0" />}
                </button>
              );
            })}

            {showAllOption && (
              <>
                <div className={`my-1 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`} />
                <button
                  type="button"
                  onClick={() => handleSelect("all")}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] text-left transition-colors ${
                    isAllSelected
                      ? isDark
                        ? "bg-[#161718] text-white font-[510]"
                        : "bg-gray-100 text-gray-900 font-[510]"
                      : isDark
                      ? "hover:bg-[#161718]/60 text-[#8a8f98] hover:text-white"
                      : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-berkeley-mono text-[12px]">All Past & Current Cycles</div>
                    <div className="text-[10px] font-berkeley-mono opacity-60">Complete history</div>
                  </div>
                  {isAllSelected && <Check className="w-3.5 h-3.5 text-[#e4f222] flex-shrink-0" />}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 2. TOOLBAR VARIANT (For Events, Attendance, Committee, Notices) ──
  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border text-left transition-all ${
          isDark
            ? "bg-[#0f1011] hover:bg-[#161718] border-[#23252a] text-[#d0d6e0]"
            : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800 shadow-xs"
        }`}
        title="Filter by Academic Cycle"
      >
        <Calendar className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
        <div className="flex items-center gap-1.5 text-[12px] font-inter-variable">
          <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Cycle:
          </span>
          <span className="font-berkeley-mono font-[510]">
            {currentLabel}
          </span>
          {isActiveSelected && (
            <span className="text-[9px] font-berkeley-mono px-1 py-0.2 rounded-[3px] bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30">
              ACTIVE
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 mt-1 w-64 rounded-[8px] border shadow-2xl z-50 p-1.5 font-inter-variable text-[12px] animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] text-[#d0d6e0]"
              : "bg-white border-gray-200 text-gray-800 shadow-xl"
          }`}
        >
          <div className="px-2 py-1 text-[10px] font-berkeley-mono uppercase tracking-wider text-[#8a8f98] border-b border-[#23252a]/40 mb-1 flex items-center justify-between">
            <span>Filter By Academic Cycle</span>
            <span className="text-[9px] opacity-75">{visibleCycles.length} Visible</span>
          </div>

          <div className="space-y-0.5">
            {visibleCycles.map((c) => {
              const isSelected =
                (selectedCycleId === "active" && c.id === activeCycle?.id) ||
                selectedCycleId === c.id;
              const isCurrentActive = c.id === activeCycle?.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(isCurrentActive ? "active" : c.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[5px] text-left transition-colors ${
                    isSelected
                      ? isDark
                        ? "bg-[#161718] text-white font-[510] border border-[#23252a]"
                        : "bg-gray-100 text-gray-900 font-[510] border border-gray-200"
                      : isDark
                      ? "hover:bg-[#161718]/60 text-[#8a8f98] hover:text-white"
                      : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-berkeley-mono text-[12px] font-[510]">
                        {c.name}
                      </span>
                      {isCurrentActive && (
                        <span className="text-[9px] font-berkeley-mono px-1 py-0.2 rounded-[3px] bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30">
                          ACTIVE CYCLE
                        </span>
                      )}
                    </div>
                    {c.startDate && c.endDate && (
                      <div className="text-[10px] font-berkeley-mono opacity-60 mt-0.5">
                        {c.startDate} → {c.endDate}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#e4f222] flex-shrink-0" />}
                </button>
              );
            })}

            {showAllOption && (
              <>
                <div className={`my-1 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`} />
                <button
                  type="button"
                  onClick={() => handleSelect("all")}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[5px] text-left transition-colors ${
                    isAllSelected
                      ? isDark
                        ? "bg-[#161718] text-white font-[510] border border-[#23252a]"
                        : "bg-gray-100 text-gray-900 font-[510] border border-gray-200"
                      : isDark
                      ? "hover:bg-[#161718]/60 text-[#8a8f98] hover:text-white"
                      : "hover:bg-gray-50 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-berkeley-mono text-[12px] font-[510]">All Academic Cycles</div>
                    <div className="text-[10px] font-berkeley-mono opacity-60 mt-0.5">Show all past & current data</div>
                  </div>
                  {isAllSelected && <Check className="w-3.5 h-3.5 text-[#e4f222] flex-shrink-0" />}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
