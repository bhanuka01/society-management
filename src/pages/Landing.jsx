import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { supabase } from "../supabaseClient";
import MinimalFooter from "../components/MinimalFooter";

export default function Landing({
  theme = "dark",
  onThemeToggle,
  onLoginClick,
  onRegisterClick,
  regEnabled = true,
  aiEnabled = true,
}) {
  const isDark = theme === "dark";
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // 1. Query upcoming public events (date >= today)
        let { data, error } = await supabase
          .from("events")
          .select("event_id, name, date, time, flyer_url, description, is_public")
          .or("is_public.is.null,is_public.eq.true")
          .gte("date", todayStr)
          .order("date", { ascending: true })
          .limit(3);

        // 2. If no future public events, retrieve the latest real public events from the database
        if (!error && (!data || data.length === 0)) {
          const recentRes = await supabase
            .from("events")
            .select("event_id, name, date, time, flyer_url, description, is_public")
            .or("is_public.is.null,is_public.eq.true")
            .order("date", { ascending: false })
            .limit(3);

          if (!recentRes.error && recentRes.data) {
            data = recentRes.data;
          }
        }

        if (!error && data) {
          setUpcomingEvents(data);
        }
      } catch (err) {
        console.error("Error fetching landing events:", err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLogin = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleRegister = () => {
    if (onRegisterClick) {
      onRegisterClick();
    } else {
      window.history.pushState({}, "", "/register");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  return (
    <div
      className={`linear-landing min-h-screen font-inter-variable relative overflow-x-hidden transition-colors duration-200 ${
        isDark
          ? "bg-[#08090a] text-[#d0d6e0] selection:bg-[#e4f222] selection:text-[#08090a]"
          : "landing-light bg-white text-[#3f3f46] selection:bg-[#6366f1] selection:text-white"
      }`}
    >
      {/* ── Fixed Top Navigation Bar ────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-colors duration-200 ${
          isDark
            ? "bg-[#08090a]/85 border-b border-[#23252a]"
            : "bg-white/85 border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div
              className={`w-7 h-7 rounded-[6px] flex items-center justify-center p-1 transition-colors ${
                isDark
                  ? "bg-[#161718] border border-[#23252a]"
                  : "bg-gray-100 border border-gray-200"
              }`}
            >
              <img
                alt="ADSS Logo"
                className="w-full h-full object-contain"
                src={`${import.meta.env.BASE_URL}${isDark ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
              />
            </div>
            <span
              className={`text-[15px] font-[510] tracking-[-0.015em] flex items-center gap-2 transition-colors ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              ADSS Ruhuna
            </span>
          </div>

          {/* Center Nav Items */}
          <nav
            className={`hidden md:flex items-center gap-6 text-[13px] ${
              isDark ? "text-[#8a8f98]" : "text-gray-600"
            }`}
          >
            <button
              onClick={() => scrollToSection("features")}
              className={`transition-colors py-1 cursor-pointer font-[400] ${
                isDark ? "hover:text-[#ffffff]" : "hover:text-gray-900"
              }`}
            >
              What We Do
            </button>
            <button
              onClick={() => scrollToSection("events")}
              className={`transition-colors py-1 cursor-pointer font-[400] ${
                isDark ? "hover:text-[#ffffff]" : "hover:text-gray-900"
              }`}
            >
              Events
            </button>
            {aiEnabled && (
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/assistant");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 font-[400] ${
                  isDark ? "hover:text-[#ffffff]" : "hover:text-gray-900"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></span>
                <span>AI Assistant</span>
              </button>
            )}
            <button
              onClick={() => scrollToSection("footer")}
              className={`transition-colors py-1 cursor-pointer font-[400] ${
                isDark ? "hover:text-[#ffffff]" : "hover:text-gray-900"
              }`}
            >
              Contact
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            {onThemeToggle && (
              <button
                type="button"
                onClick={onThemeToggle}
                className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-all cursor-pointer ${
                  isDark
                    ? "bg-[#161718] border border-[#23252a] text-[#8a8f98] hover:text-white hover:border-[#383b3f]"
                    : "bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-700" />
                )}
              </button>
            )}

            <button
              onClick={handleLogin}
              className={`text-[13px] px-3.5 py-1.5 rounded-[6px] font-[510] transition-colors cursor-pointer ${
                isDark
                  ? "linear-btn-ghost"
                  : "border border-gray-300 bg-transparent text-gray-700 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-100"
              }`}
            >
              Log in
            </button>

            <button
              onClick={regEnabled ? handleRegister : handleLogin}
              className={`text-[13px] px-4 py-1.5 rounded-[9999px] font-[510] transition-all cursor-pointer ${
                isDark
                  ? "linear-btn-pill-white"
                  : "bg-[#09090b] text-white hover:bg-black shadow-sm"
              }`}
            >
              {regEnabled ? "Join Society" : "Member Portal"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section ────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 max-w-[1200px] mx-auto px-6 text-center">
        {/* Subtle background glow */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isDark ? "opacity-[0.03]" : "opacity-[0.04]"
          }`}
          style={{
            backgroundImage: isDark
              ? "radial-gradient(#ffffff 1px, transparent 1px)"
              : "radial-gradient(#000000 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="max-w-[760px] mx-auto relative z-10">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-[9999px] text-[12px] font-berkeley-mono mb-6 transition-colors ${
              isDark
                ? "bg-[#0f1011] border border-[#23252a] text-[#8a8f98]"
                : "bg-gray-100 border border-gray-200 text-gray-600"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? "bg-[#27a644]" : "bg-[#16a34a]"
              }`}
            ></span>
            <span className={isDark ? "text-[#d0d6e0]" : "text-gray-900 font-medium"}>
              Actuarial & Data Science Society
            </span>
            <span className={isDark ? "text-[#383b3f]" : "text-gray-300"}>•</span>
            <span className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
              University of Ruhuna
            </span>
          </div>

          {/* Primary Headline in plain, simple English */}
          <h1
            className={`text-[38px] sm:text-[50px] lg:text-[60px] font-[510] tracking-[-0.022em] leading-[1.1] mb-5 transition-colors ${
              isDark ? "text-white" : "text-[#09090b]"
            }`}
          >
            The all-in-one portal for society members and events.
          </h1>

          {/* Subtext in simple words */}
          <p
            className={`text-[16px] sm:text-[17px] font-[400] leading-[1.6] max-w-[600px] mx-auto mb-8 transition-colors ${
              isDark ? "text-[#8a8f98]" : "text-gray-600"
            }`}
          >
            Manage your society membership, register for workshops with quick QR check-in, request official certificates, and stay updated with the latest announcements.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={regEnabled ? handleRegister : handleLogin}
              className={`px-5 py-2.5 rounded-[6px] font-[510] text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isDark
                  ? "linear-btn-primary"
                  : "bg-[#09090b] text-white hover:bg-black shadow-sm"
              }`}
            >
              <span>{regEnabled ? "Join Society" : "Member Login"}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>

            <button
              onClick={() => scrollToSection("events")}
              className={`py-[10px] px-4 text-[14px] rounded-[6px] font-[400] flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isDark
                  ? "linear-btn-ghost"
                  : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 shadow-xs"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              <span>View Events</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature Cards: What the System Does (Short & Quick) ─────────────── */}
      <section
        id="features"
        className={`py-12 border-t transition-colors duration-200 ${
          isDark
            ? "border-[#23252a] bg-[#08090a]"
            : "border-gray-200 bg-[#f9fafb]"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-[560px] mx-auto mb-10">
            <span
              className={`text-[12px] font-berkeley-mono uppercase tracking-wider block mb-2 ${
                isDark ? "text-[#8a8f98]" : "text-gray-500"
              }`}
            >
              SOCIETY MANAGEMENT SYSTEM
            </span>
            <h2
              className={`text-[28px] sm:text-[34px] font-[510] tracking-[-0.02em] ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              Everything you need in one place
            </h2>
            <p
              className={`text-[14px] mt-2 ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              Simple tools built to support student activities, workshops, and smooth society operations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Event Registration & QR Check-in */}
            <div
              className={`p-5 rounded-[12px] border transition-all flex flex-col justify-between ${
                isDark
                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                  : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"
              }`}
            >
              <div>
                <div
                  className={`w-10 h-10 rounded-[8px] flex items-center justify-center mb-4 transition-colors ${
                    isDark
                      ? "bg-[#161718] border border-[#23252a] text-[#e4f222]"
                      : "bg-amber-50 border border-amber-200 text-amber-600"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                </div>
                <h3
                  className={`text-[16px] font-[510] mb-1.5 ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Event Registration & QR Pass
                </h3>
                <p
                  className={`text-[13px] leading-relaxed ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Browse upcoming workshops and seminars. Register online and get your personal QR pass for quick event entry.
                </p>
              </div>
              <div
                className={`mt-4 pt-3 border-t text-[12px] font-berkeley-mono flex items-center gap-1.5 ${
                  isDark
                    ? "border-[#161718] text-[#27a644]"
                    : "border-gray-100 text-[#16a34a]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isDark ? "bg-[#27a644]" : "bg-[#16a34a]"
                  }`}
                ></span>
                Fast contactless check-in
              </div>
            </div>

            {/* Card 2: Member Profiles */}
            <div
              className={`p-5 rounded-[12px] border transition-all flex flex-col justify-between ${
                isDark
                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                  : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"
              }`}
            >
              <div>
                <div
                  className={`w-10 h-10 rounded-[8px] flex items-center justify-center mb-4 transition-colors ${
                    isDark
                      ? "bg-[#161718] border border-[#23252a] text-[#6366f1]"
                      : "bg-indigo-50 border border-indigo-200 text-[#4f46e5]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <h3
                  className={`text-[16px] font-[510] mb-1.5 ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Member Profiles & Directory
                </h3>
                <p
                  className={`text-[13px] leading-relaxed ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Create your member profile, verify your student status, and stay connected with fellow members across all years.
                </p>
              </div>
              <div
                className={`mt-4 pt-3 border-t text-[12px] font-berkeley-mono flex items-center gap-1.5 ${
                  isDark
                    ? "border-[#161718] text-[#8a8f98]"
                    : "border-gray-100 text-gray-600"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></span>
                Active student community
              </div>
            </div>

            {/* Card 3: Letter & Certificate Requests */}
            <div
              className={`p-5 rounded-[12px] border transition-all flex flex-col justify-between ${
                isDark
                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                  : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"
              }`}
            >
              <div>
                <div
                  className={`w-10 h-10 rounded-[8px] flex items-center justify-center mb-4 transition-colors ${
                    isDark
                      ? "bg-[#161718] border border-[#23252a] text-[#02b8cc]"
                      : "bg-sky-50 border border-sky-200 text-[#0284c7]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <h3
                  className={`text-[16px] font-[510] mb-1.5 ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Letters & Certificates
                </h3>
                <p
                  className={`text-[13px] leading-relaxed ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Easily request official society membership letters and event participation certificates right through your portal.
                </p>
              </div>
              <div
                className={`mt-4 pt-3 border-t text-[12px] font-berkeley-mono flex items-center gap-1.5 ${
                  isDark
                    ? "border-[#161718] text-[#02b8cc]"
                    : "border-gray-100 text-[#0284c7]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isDark ? "bg-[#02b8cc]" : "bg-[#0284c7]"
                  }`}
                ></span>
                Online request & download
              </div>
            </div>

            {/* Card 4: Notices & AI Assistant */}
            <div
              className={`p-5 rounded-[12px] border transition-all flex flex-col justify-between ${
                isDark
                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                  : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"
              }`}
            >
              <div>
                <div
                  className={`w-10 h-10 rounded-[8px] flex items-center justify-center mb-4 transition-colors ${
                    isDark
                      ? "bg-[#161718] border border-[#23252a] text-[#8b5cf6]"
                      : "bg-purple-50 border border-purple-200 text-[#7c3aed]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
                <h3
                  className={`text-[16px] font-[510] mb-1.5 ${
                    isDark ? "text-white" : "text-[#09090b]"
                  }`}
                >
                  Notices & AI Assistant
                </h3>
                <p
                  className={`text-[13px] leading-relaxed ${
                    isDark ? "text-[#8a8f98]" : "text-gray-600"
                  }`}
                >
                  Never miss an important society notice or update. Ask questions to our built-in AI assistant at any time.
                </p>
              </div>
              <div
                className={`mt-4 pt-3 border-t text-[12px] font-berkeley-mono flex items-center gap-1.5 ${
                  isDark
                    ? "border-[#161718] text-[#8b5cf6]"
                    : "border-gray-100 text-[#7c3aed]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isDark ? "bg-[#8b5cf6]" : "bg-[#7c3aed]"
                  }`}
                ></span>
                Real-time society updates
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Society Events Section (Color Flyers!) ──────────────────────────── */}
      <section
        id="events"
        className={`py-16 max-w-[1200px] mx-auto px-6 border-t transition-colors duration-200 ${
          isDark ? "border-[#23252a]" : "border-gray-200"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span
              className={`text-[12px] font-berkeley-mono uppercase tracking-wider block mb-2 ${
                isDark ? "text-[#8a8f98]" : "text-gray-500"
              }`}
            >
              PUBLIC WORKSHOPS & SESSIONS
            </span>
            <h2
              className={`text-[28px] sm:text-[36px] font-[510] tracking-[-0.02em] ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              Society Events
            </h2>
          </div>
          <p
            className={`text-[14px] max-w-[380px] ${
              isDark ? "text-[#8a8f98]" : "text-gray-600"
            }`}
          >
            Join public workshops, seminars, and networking sessions organized by the Actuarial & Data Science Society.
          </p>
        </div>

        {loadingEvents ? (
          <div
            className={`p-10 text-center font-berkeley-mono text-[13px] rounded-[12px] border ${
              isDark
                ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98]"
                : "bg-white border-gray-200 text-gray-500 shadow-xs"
            }`}
          >
            Loading society events...
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingEvents.map((ev) => {
              const formattedDate = new Date(ev.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const todayStr = new Date().toISOString().split("T")[0];
              const isFuture = ev.date >= todayStr;

              return (
                <div
                  key={ev.event_id}
                  className={`rounded-[12px] border overflow-hidden flex flex-col justify-between transition-all group ${
                    isDark
                      ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                      : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Full Color Event Flyer (NO grayscale!) */}
                    {ev.flyer_url ? (
                      <div
                        className={`h-48 overflow-hidden relative border-b ${
                          isDark
                            ? "border-[#23252a] bg-[#161718]"
                            : "border-gray-200 bg-gray-100"
                        }`}
                      >
                        <img
                          src={ev.flyer_url}
                          alt={ev.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div
                        className={`h-48 border-b flex flex-col items-center justify-center p-6 text-center ${
                          isDark
                            ? "bg-gradient-to-br from-[#161718] to-[#0f1011] border-[#23252a]"
                            : "bg-gradient-to-br from-gray-100 to-gray-50 border-gray-200"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-[6px] flex items-center justify-center mb-2.5 ${
                            isDark
                              ? "bg-[#08090a] border border-[#23252a] text-[#d0d6e0]"
                              : "bg-white border border-gray-200 text-gray-700 shadow-xs"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        </div>
                        <span
                          className={`font-berkeley-mono text-[11px] tracking-wider uppercase ${
                            isDark ? "text-[#8a8f98]" : "text-gray-500"
                          }`}
                        >
                          {ev.date}
                        </span>
                      </div>
                    )}
                    <div className="p-5">
                      <div
                        className={`flex items-center justify-between text-[11px] font-berkeley-mono mb-2.5 ${
                          isDark ? "text-[#8a8f98]" : "text-gray-500"
                        }`}
                      >
                        <span>{formattedDate}</span>
                        <span
                          className={`px-2 py-0.5 rounded-[4px] border ${
                            isDark
                              ? `bg-[#161718] border-[#23252a] ${
                                  isFuture ? "text-[#27a644]" : "text-[#8a8f98]"
                                }`
                              : `bg-gray-100 border-gray-200 ${
                                  isFuture ? "text-[#16a34a] font-medium" : "text-gray-600"
                                }`
                          }`}
                        >
                          {isFuture ? "Open Registration" : "Past Event"}
                        </span>
                      </div>
                      <h3
                        className={`text-[17px] font-[510] tracking-[-0.012em] mb-2 transition-colors ${
                          isDark
                            ? "text-white group-hover:text-white"
                            : "text-[#09090b] group-hover:text-[#4f46e5]"
                        }`}
                      >
                        {ev.name}
                      </h3>
                      <p
                        className={`text-[13px] line-clamp-2 leading-relaxed font-[400] ${
                          isDark ? "text-[#8a8f98]" : "text-gray-600"
                        }`}
                      >
                        {ev.description || "Public event organized by the Actuarial & Data Science Society."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <button
                      onClick={() => {
                        const eventUrl = `/event?id=${ev.event_id}`;
                        window.history.pushState({ path: eventUrl }, "", eventUrl);
                        window.dispatchEvent(new Event("popstate"));
                      }}
                      className={`w-full text-[13px] py-2 flex items-center justify-center gap-1.5 rounded-[6px] font-[510] transition-colors cursor-pointer ${
                        isDark
                          ? "linear-btn-ghost"
                          : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 shadow-xs"
                      }`}
                    >
                      <span>{isFuture ? "Register & View Details" : "View Event Details"}</span>
                      <span className="font-berkeley-mono text-[12px]">→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`rounded-[12px] border p-10 text-center ${
              isDark
                ? "bg-[#0f1011] border-[#23252a]"
                : "bg-white border-gray-200 shadow-xs"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-[6px] flex items-center justify-center mx-auto mb-3 ${
                isDark
                  ? "bg-[#161718] border border-[#23252a] text-[#8a8f98]"
                  : "bg-gray-100 border border-gray-200 text-gray-500"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
            <h4
              className={`text-[16px] font-[510] mb-1 ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              No Public Events Right Now
            </h4>
            <p
              className={`text-[13px] max-w-[360px] mx-auto ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              Please check back soon for upcoming workshops or log in to view internal member sessions.
            </p>
          </div>
        )}
      </section>

      {/* ── Closing Call to Action (Short & Friendly) ───────────────────────── */}
      <section className="py-14 max-w-[1200px] mx-auto px-6">
        <div
          className={`rounded-[12px] border p-8 md:p-12 text-center relative overflow-hidden transition-all ${
            isDark
              ? "bg-[#0f1011] border-[#23252a]"
              : "bg-gradient-to-b from-gray-50 to-white border-gray-200 shadow-xs"
          }`}
        >
          <div className="relative z-10 max-w-[560px] mx-auto space-y-4">
            <h2
              className={`text-[28px] sm:text-[34px] font-[510] tracking-[-0.02em] ${
                isDark ? "text-white" : "text-[#09090b]"
              }`}
            >
              Join the Society Today
            </h2>
            <p
              className={`text-[14px] leading-relaxed ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              Connect with fellow students, participate in workshops and competitions, and build valuable skills in actuarial science and data science.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {regEnabled ? (
                <button
                  onClick={handleRegister}
                  className={`px-5 py-2 rounded-[6px] font-[510] text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDark
                      ? "linear-btn-primary"
                      : "bg-[#09090b] text-white hover:bg-black shadow-sm"
                  }`}
                >
                  <span>Register for Membership</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className={`px-5 py-2 rounded-[6px] font-[510] text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDark
                      ? "linear-btn-primary"
                      : "bg-[#09090b] text-white hover:bg-black shadow-sm"
                  }`}
                >
                  <span>Login to Portal</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              )}
              <button
                onClick={handleLogin}
                className={`py-[10px] px-4 text-[13px] rounded-[6px] font-[510] transition-colors cursor-pointer ${
                  isDark
                    ? "linear-btn-ghost"
                    : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-400"
                }`}
              >
                Member Login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Clean, Compact Footer ───────────────────────────────────────────── */}
      <footer
        id="footer"
        className={`border-t py-10 transition-colors duration-200 ${
          isDark
            ? "border-[#23252a] bg-[#08090a]"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div
            className={`flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b ${
              isDark ? "border-[#23252a]" : "border-gray-200"
            }`}
          >
            {/* Brand column */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-[4px] flex items-center justify-center p-1 transition-colors ${
                  isDark
                    ? "bg-[#161718] border border-[#23252a]"
                    : "bg-gray-100 border border-gray-200"
                }`}
              >
                <img
                  alt="ADSS Logo"
                  className="w-full h-full object-contain"
                  src={`${import.meta.env.BASE_URL}${isDark ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
                />
              </div>
              <span
                className={`text-[14px] font-[510] ${
                  isDark ? "text-white" : "text-[#09090b]"
                }`}
              >
                Actuarial & Data Science Society
              </span>
            </div>

            {/* Quick Links */}
            <div
              className={`flex flex-wrap items-center gap-6 text-[13px] ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}
            >
              <button
                onClick={() => scrollToSection("events")}
                className={`transition-colors cursor-pointer ${
                  isDark ? "hover:text-white" : "hover:text-gray-900"
                }`}
              >
                Events
              </button>
              <button
                onClick={handleLogin}
                className={`transition-colors cursor-pointer ${
                  isDark ? "hover:text-white" : "hover:text-gray-900"
                }`}
              >
                Member Portal
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/privacy");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className={`transition-colors cursor-pointer ${
                  isDark ? "hover:text-white" : "hover:text-gray-900"
                }`}
              >
                Privacy Policy
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/terms");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className={`transition-colors cursor-pointer ${
                  isDark ? "hover:text-white" : "hover:text-gray-900"
                }`}
              >
                Terms
              </button>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.facebook.com/adssruhuna"
                target="_blank"
                rel="noreferrer"
                className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-colors ${
                  isDark
                    ? "border-[#23252a] bg-[#0f1011] text-[#8a8f98] hover:text-white hover:border-[#383b3f]"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100"
                }`}
                title="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/actuarial-data-science-society-university-of-ruhuna/"
                target="_blank"
                rel="noreferrer"
                className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-colors ${
                  isDark
                    ? "border-[#23252a] bg-[#0f1011] text-[#8a8f98] hover:text-white hover:border-[#383b3f]"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100"
                }`}
                title="LinkedIn"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45c-.89 0-1.61.72-1.61 1.61s.72 1.61 1.61 1.61a1.61 1.61 0 0 0 0-3.22z" />
                </svg>
              </a>
              <a
                href="mailto:bhanukadilshan2002@gmail.com"
                className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-colors ${
                  isDark
                    ? "border-[#23252a] bg-[#0f1011] text-[#8a8f98] hover:text-white hover:border-[#383b3f]"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100"
                }`}
                title="Email"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </a>
            </div>
          </div>

          <div
            className={`pt-6 text-center text-[12px] font-berkeley-mono ${
              isDark ? "text-[#62666d]" : "text-gray-500"
            }`}
          >
            © {new Date().getFullYear()} ADSS Ruhuna. All rights reserved.
          </div>

          <MinimalFooter session={null} isDark={isDark} className="pt-4" />
        </div>
      </footer>
    </div>
  );
}
