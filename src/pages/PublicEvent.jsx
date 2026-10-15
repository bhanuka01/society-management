import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function PublicEvent({ onBackToLanding }) {
  const [event, setEvent] = useState(null);
  const [otherEvents, setOtherEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    setIframeLoading(true);
  }, [event?.event_id]);

  // Parse event_id from query params or route path
  const getEventIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id");
    if (queryId) return queryId;

    // Check path-based params e.g. /event/20261 or #/event/20261
    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const pathParts = pathname.split("/");
    const hashParts = hash.split("/");

    if (pathParts[1] === "event" && pathParts[2]) return pathParts[2];
    if (hashParts[1] === "#/event" && hashParts[2]) return hashParts[2];
    if (hashParts[1] === "event" && hashParts[2]) return hashParts[2];

    return null;
  };

  const loadEvent = async () => {
    try {
      setLoading(true);
      const targetId = getEventIdFromUrl();

      let query = supabase
        .from("events")
        .select("event_id, name, date, time, description, flyer_url, is_public, tally_link")
        .or("is_public.is.null,is_public.eq.true");

      if (targetId) {
        query = query.eq("event_id", targetId);
      } else {
        // Fallback: Show the closest upcoming event, or the latest past event
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: upcoming, error: upcomingErr } = await supabase
          .from("events")
          .select("event_id, name, date, time, description, flyer_url, is_public, tally_link")
          .or("is_public.is.null,is_public.eq.true")
          .gte("date", todayStr)
          .order("date", { ascending: true })
          .limit(1);

        if (!upcomingErr && upcoming && upcoming.length > 0) {
          setEvent(upcoming[0]);
          loadOtherEvents(upcoming[0].event_id);
          setLoading(false);
          return;
        }

        // If no upcoming, get latest past event
        query = query.order("date", { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (data) {
        setEvent(data);
        loadOtherEvents(data.event_id);
      } else {
        setErrorMsg("No active events found.");
      }
    } catch (err) {
      console.error("Error loading public event:", err);
      setErrorMsg("Failed to load event details.");
    } finally {
      setLoading(false);
    }
  };

  const loadOtherEvents = async (currentId) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("event_id, name, date, time, flyer_url, description")
        .or("is_public.is.null,is_public.eq.true")
        .neq("event_id", currentId)
        .order("date", { ascending: false })
        .limit(3);

      if (!error && data) {
        setOtherEvents(data);
      }
    } catch (err) {
      console.error("Error loading other events:", err);
    }
  };

  useEffect(() => {
    loadEvent();

    // Listen for URL changes
    const handleUrlChange = () => {
      loadEvent();
    };
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  const handleSelectEvent = (id) => {
    const newUrl = `${window.location.pathname}?id=${id}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    window.dispatchEvent(new Event("popstate"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getTallyEmbedUrl = (link) => {
    const defaultEmbed = "https://tally.so/embed/mBQKkN?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";
    if (!link) return defaultEmbed;
    let src = link.trim();
    if (!src.startsWith("http")) {
      src = `https://tally.so/embed/${src}`;
    }
    if (!src.includes("?")) {
      src += "?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";
    } else {
      if (!src.includes("alignLeft")) src += "&alignLeft=1";
      if (!src.includes("hideTitle")) src += "&hideTitle=1";
      if (!src.includes("transparentBackground")) src += "&transparentBackground=1";
      if (!src.includes("dynamicHeight")) src += "&dynamicHeight=1";
    }
    return src;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const options = { year: "numeric", month: "long", day: "numeric", weekday: "long" };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  };

  // Safe parse of OC positions
  let ocPositions = [];
  try {
    if (event?.available_oc_positions) {
      ocPositions = typeof event.available_oc_positions === "string"
        ? JSON.parse(event.available_oc_positions)
        : event.available_oc_positions;
    }
  } catch (e) {
    ocPositions = [];
  }

  // Loading State (Linear Midnight Precision)
  if (loading) {
    return (
      <div className="linear-landing min-h-screen bg-[#08090a] text-[#d0d6e0] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#23252a] border-t-[#ffffff] rounded-full animate-spin"></div>
        <p className="font-berkeley-mono text-[11px] text-[#8a8f98] uppercase tracking-wider">
          Querying Event Telemetry...
        </p>
      </div>
    );
  }

  // Not Found / Error State
  if (errorMsg || !event) {
    return (
      <div className="linear-landing min-h-screen bg-[#08090a] text-[#d0d6e0] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-8 md:p-12 max-w-[480px] w-full">
          <div className="w-10 h-10 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center mx-auto mb-4 text-[#eb5757]">
            <span className="material-symbols-outlined text-[22px]">event_busy</span>
          </div>
          <h1 className="text-white text-[22px] font-[510] tracking-[-0.015em] mb-2">Event Not Found</h1>
          <p className="text-[#8a8f98] text-[13px] leading-relaxed mb-6">
            {errorMsg || "The event you are attempting to view does not exist, has been archived, or is restricted to internal members."}
          </p>
          <button
            onClick={onBackToLanding}
            className="linear-btn-ghost w-full py-2 text-[13px]"
          >
            <span>Return to Homepage</span>
            <span className="font-berkeley-mono text-[11px]">→</span>
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isUpcoming = event.date >= today;

  return (
    <div className="linear-landing min-h-screen bg-[#08090a] text-[#d0d6e0] font-inter-variable selection:bg-[#e4f222] selection:text-[#08090a] pb-24">
      {/* ── Fixed Top Navigation ────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#08090a]/85 backdrop-blur-md border-b border-[#23252a]">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onBackToLanding}>
            <div className="w-6 h-6 rounded-[4px] bg-[#161718] border border-[#23252a] flex items-center justify-center p-1">
              <img
                alt="ADSS Logo"
                className="w-full h-full object-contain"
                src={`${import.meta.env.BASE_URL}logo_trans_light.png`}
              />
            </div>
            <span className="text-white text-[15px] font-[510] tracking-[-0.015em] flex items-center gap-2">
              ADSS Ruhuna
              <span className="text-[10px] font-berkeley-mono text-[#62666d] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[#161718] border border-[#23252a]">
                EVENT SPEC
              </span>
            </span>
          </div>

          <button
            onClick={onBackToLanding}
            className="linear-btn-ghost text-[13px] px-3 py-1.5 rounded-[6px]"
          >
            <span>← Back to Platform</span>
          </button>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────────────────────── */}
      <main className="max-w-[1200px] mx-auto px-6 pt-24 md:pt-28">
        {/* Breadcrumb & Telemetry Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-[12px] font-berkeley-mono text-[#8a8f98]">
            <span className="hover:text-white cursor-pointer transition-colors" onClick={onBackToLanding}>
              ADSS
            </span>
            <span className="text-[#383b3f]">/</span>
            <span>EVENTS</span>
            <span className="text-[#383b3f]">/</span>
            <span className="text-white">{event.event_id}</span>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[9999px] bg-[#0f1011] border border-[#23252a] text-[11px] font-berkeley-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isUpcoming ? "bg-[#27a644] animate-pulse" : "bg-[#8a8f98]"
                }`}
            ></span>
            <span className={isUpcoming ? "text-[#27a644]" : "text-[#8a8f98]"}>
              {isUpcoming ? "OPEN REGISTRATION" : "ARCHIVED SESSION"}
            </span>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Event Overview & Information (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Event Title */}
            <div>
              <h1 className="text-white text-[32px] sm:text-[42px] font-[510] tracking-[-0.022em] leading-[1.1] mb-3">
                {event.name}
              </h1>
              <p className="text-[#8a8f98] text-[14px] font-[400] leading-relaxed">
                Official society session hosted by the Actuarial & Data Science Society, Department of Mathematics, University of Ruhuna.
              </p>
            </div>

            {/* Precision Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-4 font-berkeley-mono">
              <div className="p-3 bg-[#08090a] rounded-[6px] border border-[#23252a]">
                <div className="text-[11px] text-[#8a8f98] uppercase mb-1">DATE & SCHEDULE</div>
                <div className="text-white text-[13px] font-[510]">{formatDate(event.date)}</div>
              </div>

              <div className="p-3 bg-[#08090a] rounded-[6px] border border-[#23252a]">
                <div className="text-[11px] text-[#8a8f98] uppercase mb-1">SESSION TIME</div>
                <div className="text-white text-[13px] font-[510]">{event.time || "To be announced"}</div>
              </div>

              {/* <div className="p-3 bg-[#08090a] rounded-[6px] border border-[#23252a]">
                <div className="text-[11px] text-[#8a8f98] uppercase mb-1">LOCATION & VENUE</div>
                <div className="text-white text-[13px] font-[510]">Faculty of Science / Hybrid</div>
              </div> */}

              {/* <div className="p-3 bg-[#08090a] rounded-[6px] border border-[#23252a]">
                <div className="text-[11px] text-[#8a8f98] uppercase mb-1">ADMISSION STATUS</div>
                <div className={`text-[13px] font-[510] ${isUpcoming ? "text-[#27a644]" : "text-[#8a8f98]"}`}>
                  {isUpcoming ? "Public Registration Open" : "Session Concluded"}
                </div>
              </div> */}
            </div>

            {/* Event Flyer Container */}
            {event.flyer_url ? (
              <div className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-3 overflow-hidden">
                <div className="relative rounded-[8px] overflow-hidden bg-[#08090a] border border-[#23252a] flex items-center justify-center">
                  <img
                    src={event.flyer_url}
                    alt={`${event.name} Flyer`}
                    className="w-full h-auto object-contain max-h-[640px]"
                  />
                </div>
              </div>
            ) : (
              <div className="h-48 bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center mb-2.5 text-[#8a8f98]">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
                <span className="font-berkeley-mono text-[11px] text-[#62666d] uppercase tracking-wider">
                  EVT-{event.event_id} · ADSS OFFICIAL EVENT
                </span>
              </div>
            )}

            {/* Description & Detailed Agenda */}
            <div className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-6 md:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-[#23252a] pb-3">
                <span className="text-[12px] font-berkeley-mono text-white tracking-wide">
                  SPECIFICATION & DETAILS
                </span>
                <span className="text-[11px] font-berkeley-mono text-[#62666d]">
                  OVERVIEW
                </span>
              </div>
              <div className="text-[#d0d6e0] text-[14px] leading-relaxed whitespace-pre-wrap font-[400]">
                {event.description ||
                  "Join us for this actuarial and data science event organized by the Actuarial & Data Science Society, University of Ruhuna. Review the schedule, register using the form, and attend with your university credentials."}
              </div>
            </div>

            {/* Available OC Positions (if available) */}
            {/* {ocPositions.length > 0 && (
              <div className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#23252a] pb-3">
                  <span className="text-[12px] font-berkeley-mono text-white tracking-wide">
                    ORGANIZING COMMITTEE (OC) POSITIONS
                  </span>
                  <span className="text-[11px] font-berkeley-mono text-[#6366f1]">
                    OPEN ROLES
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ocPositions.map((pos, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-[4px] bg-[#161718] border border-[#23252a] text-[#d0d6e0] text-[12px] font-berkeley-mono"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            )} */}
          </div>

          {/* Right Column: Registration Terminal (5 cols, Sticky) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 w-full space-y-4">
            <div className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] p-5">
              {/* Terminal Titlebar */}
              <div className="flex items-center justify-between border-b border-[#23252a] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#27a644]"></span>
                  <span className="text-[12px] font-berkeley-mono text-white uppercase tracking-wider">
                    REGISTRATION TERMINAL
                  </span>
                </div>
                <span className="text-[11px] font-berkeley-mono text-[#8a8f98]">
                  {isUpcoming ? "LIVE" : "CLOSED"}
                </span>
              </div>

              {isUpcoming ? (
                <div className="space-y-4">
                  <div className="relative h-[620px] rounded-[8px] bg-[#08090a] border border-[#23252a] overflow-hidden">
                    {iframeLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08090a] z-10 gap-3">
                        <div className="w-8 h-8 border-2 border-[#23252a] border-t-white rounded-full animate-spin"></div>
                        <p className="font-berkeley-mono text-[11px] text-[#8a8f98] uppercase tracking-wider">
                          Loading Registration Form...
                        </p>
                      </div>
                    )}
                    <iframe
                      src={getTallyEmbedUrl(event.tally_link)}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      marginHeight="0"
                      marginWidth="0"
                      title={`Register for ${event.name}`}
                      className="w-full h-full bg-transparent"
                      onLoad={() => setIframeLoading(false)}
                    ></iframe>
                  </div>

                  {event.tally_link && (
                    <div className="pt-2 text-center">
                      <a
                        href={event.tally_link}
                        target="_blank"
                        rel="noreferrer"
                        className="linear-btn-ghost w-full py-2 text-[12px] font-berkeley-mono"
                      >
                        <span>Open form in full window</span>
                        <span>↗</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#08090a] rounded-[8px] border border-[#23252a] space-y-3">
                  <div className="w-10 h-10 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center mx-auto text-[#8a8f98]">
                    <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                  </div>
                  <h3 className="text-white text-[15px] font-[510]">Registration Closed</h3>
                  <p className="text-[#8a8f98] text-[12px] leading-relaxed font-berkeley-mono">
                    This session has already taken place. Attendee records have been archived into the society database.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={onBackToLanding}
                      className="linear-btn-ghost w-full py-2 text-[12px]"
                    >
                      <span>Explore Other Public Sessions</span>
                      <span className="font-berkeley-mono text-[11px]">→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Other Society Events Section ───────────────────────────────────── */}
        {otherEvents.length > 0 && (
          <section className="mt-24 pt-16 border-t border-[#23252a]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <span className="text-[11px] font-berkeley-mono text-[#8a8f98] uppercase tracking-wider block mb-1">
                  MORE FROM ADSS
                </span>
                <h2 className="text-white text-[24px] font-[510] tracking-[-0.015em]">
                  Other Society Events
                </h2>
              </div>
              <p className="text-[#8a8f98] text-[13px] font-berkeley-mono">
                Browse official sessions in the public index
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {otherEvents.map((oe) => (
                <div
                  key={oe.event_id}
                  className="bg-[#0f1011] rounded-[12px] border border-[#23252a] shadow-[inset_0_0_0_1px_#23252a] overflow-hidden flex flex-col justify-between hover:border-[#383b3f] transition-colors cursor-pointer group"
                  onClick={() => handleSelectEvent(oe.event_id)}
                >
                  <div>
                    {oe.flyer_url ? (
                      <div className="h-40 overflow-hidden relative border-b border-[#23252a]">
                        <img
                          src={oe.flyer_url}
                          alt={oe.name}
                          className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 transition-all duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-[#161718] border-b border-[#23252a] flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-8 h-8 rounded-[4px] bg-[#08090a] border border-[#23252a] flex items-center justify-center mb-2 text-[#8a8f98]">
                          <span className="material-symbols-outlined text-[16px]">event</span>
                        </div>
                        <span className="font-berkeley-mono text-[10px] text-[#62666d]">
                          {oe.date}
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      <div className="text-[11px] font-berkeley-mono text-[#8a8f98] mb-2">
                        {formatDate(oe.date)}
                      </div>
                      <h3 className="text-white text-[16px] font-[510] tracking-[-0.012em] mb-2 group-hover:text-white transition-colors line-clamp-1">
                        {oe.name}
                      </h3>
                      <p className="text-[#8a8f98] text-[12px] line-clamp-2 leading-relaxed font-[400]">
                        {oe.description || "Public event organized by the Actuarial & Data Science Society, University of Ruhuna."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <div className="text-[#d0d6e0] text-[12px] font-berkeley-mono flex items-center justify-between pt-3 border-t border-[#161718] group-hover:text-white transition-colors">
                      <span>View Session</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
