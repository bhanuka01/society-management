import { useState, useRef, useEffect, useCallback } from "react";
import "./DatePicker.css";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val + "T00:00:00");
  return isNaN(d) ? null : d;
}

function toYMD(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(val) {
  const d = parseDate(val);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DatePicker({ value, onChange, placeholder = "Select date", id }) {
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());
  const [mode, setMode] = useState("calendar"); // "calendar" | "month" | "year"

  const ref = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState(null);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_W = 256;
    const GAP = 6;
    const popoverH = popoverRef.current ? popoverRef.current.offsetHeight : 310;

    let left = rect.left;
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = rect.right - POPOVER_W;
    }
    left = Math.max(8, left);

    let top = rect.bottom + GAP;
    // If not enough space below, flip above trigger
    if (rect.bottom + GAP + popoverH > window.innerHeight - 8 && rect.top - GAP - popoverH > 0) {
      top = rect.top - GAP - popoverH;
    }

    setPopoverPos({ top: Math.max(8, top), left });
  }, [open]);

  useEffect(() => {
    if (open) {
      updatePosition();
      const timer = requestAnimationFrame(updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        cancelAnimationFrame(timer);
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    } else {
      setPopoverPos(null);
    }
  }, [open, mode, updatePosition]);

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  const openPicker = () => {
    setOpen(true);
    setMode("calendar");
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  };

  const selectDay = useCallback((d) => {
    onChange(toYMD(d));
    setOpen(false);
  }, [onChange]);

  const clear = useCallback((e) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  }, [onChange]);

  const goToToday = useCallback(() => {
    onChange(toYMD(today));
    setOpen(false);
  }, [onChange]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, cur: false, date: new Date(viewYear, viewMonth - 1, prevMonthDays - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, cur: true, date: new Date(viewYear, viewMonth, i) });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, cur: false, date: new Date(viewYear, viewMonth + 1, i) });
  }

  const yearRange = [];
  const startYear = Math.floor(viewYear / 12) * 12;
  for (let i = startYear; i < startYear + 12; i++) yearRange.push(i);

  const isSelected = (d) => selected && toYMD(d) === toYMD(selected);
  const isToday = (d) => toYMD(d) === toYMD(today);

  return (
    <div className="dp-root" ref={ref} id={id}>
      {/* Trigger */}
      <button
        type="button"
        ref={triggerRef}
        className={`dp-trigger ${open ? "dp-trigger--open" : ""}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-label="Open date picker"
      >
        <span className={`dp-trigger-text ${!value ? "dp-placeholder" : ""}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg className="dp-icon" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Popover */}
      {open && popoverPos && (
        <div
          className="dp-popover"
          ref={popoverRef}
          style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left }}
        >
          {/* ── Calendar View ── */}
          {mode === "calendar" && (
            <>
              <div className="dp-header">
                <button type="button" className="dp-nav-btn" onClick={prevMonth} aria-label="Previous month">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  type="button"
                  className="dp-month-label"
                  onClick={() => setMode("month")}
                >
                  {MONTHS[viewMonth]} {viewYear}
                  <svg className="dp-chevron" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                <button type="button" className="dp-nav-btn" onClick={nextMonth} aria-label="Next month">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              <div className="dp-weekdays">
                {DAYS.map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="dp-grid">
                {cells.map((cell, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      "dp-cell",
                      !cell.cur ? "dp-cell--outside" : "",
                      isSelected(cell.date) ? "dp-cell--selected" : "",
                      isToday(cell.date) && !isSelected(cell.date) ? "dp-cell--today" : ""
                    ].join(" ")}
                    onClick={() => selectDay(cell.date)}
                  >
                    {cell.day}
                  </button>
                ))}
              </div>

              <div className="dp-footer">
                {value && <button type="button" className="dp-foot-btn dp-foot-btn--ghost" onClick={clear}>Clear</button>}
                <button type="button" className="dp-foot-btn dp-foot-btn--accent" onClick={goToToday}>Today</button>
              </div>
            </>
          )}

          {/* ── Month Picker ── */}
          {mode === "month" && (
            <>
              <div className="dp-header">
                <button type="button" className="dp-nav-btn" onClick={() => setViewYear(y => y - 1)}>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button type="button" className="dp-month-label" onClick={() => setMode("year")}>
                  {viewYear}
                  <svg className="dp-chevron" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                <button type="button" className="dp-nav-btn" onClick={() => setViewYear(y => y + 1)}>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="dp-month-grid">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    className={[
                      "dp-month-cell",
                      i === viewMonth ? "dp-month-cell--selected" : "",
                      i === today.getMonth() && viewYear === today.getFullYear() ? "dp-month-cell--today" : ""
                    ].join(" ")}
                    onClick={() => { setViewMonth(i); setMode("calendar"); }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Year Picker ── */}
          {mode === "year" && (
            <>
              <div className="dp-header">
                <button type="button" className="dp-nav-btn" onClick={() => setViewYear(y => y - 12)}>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="dp-month-label" style={{ cursor: "default" }}>{startYear} – {startYear + 11}</span>
                <button type="button" className="dp-nav-btn" onClick={() => setViewYear(y => y + 12)}>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="dp-year-grid">
                {yearRange.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    className={[
                      "dp-year-cell",
                      yr === viewYear ? "dp-year-cell--selected" : "",
                      yr === today.getFullYear() ? "dp-year-cell--today" : ""
                    ].join(" ")}
                    onClick={() => { setViewYear(yr); setMode("month"); }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
