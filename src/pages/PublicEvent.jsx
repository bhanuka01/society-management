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

      let query = supabase.from("events").select("*").or("is_public.is.null,is_public.eq.true");
      if (targetId) {
        query = query.eq("event_id", targetId);
      } else {
        // Fallback: Show the closest upcoming event, or the latest past event
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: upcoming, error: upcomingErr } = await supabase
          .from("events")
          .select("*")
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
        .select("event_id, name, date, flyer_url")
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
    // Navigate by updating the search parameters to reload the correct event details
    const newUrl = `${window.location.pathname}?id=${id}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    // Dispatch popstate manually so the listener runs
    window.dispatchEvent(new Event("popstate"));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A11] text-white flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#0062ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-text-secondary text-sm font-semibold tracking-wider uppercase">Loading Event Details...</p>
      </div>
    );
  }

  if (errorMsg || !event) {
    return (
      <div className="min-h-screen bg-[#0B0A11] text-white flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-[#ff4d4f] mb-4">event_busy</span>
        <h1 className="text-3xl font-bold mb-2">Event Not Found</h1>
        <p className="text-text-secondary max-w-md mb-8">{errorMsg || "The event you are looking for may have been deleted or is not public."}</p>
        <button
          onClick={onBackToLanding}
          className="px-6 py-3 bg-[#0062ff] text-white font-bold rounded-xl hover:bg-[#0052d4] transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Return to Homepage
        </button>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isUpcoming = event.date >= today;

  return (
    <div className="min-h-screen bg-[#0B0A11] text-white font-body-md selection:bg-primary-container selection:text-white pb-16">
      <style>{`
        .glass-header {
          background: rgba(20, 18, 26, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .event-card {
          background: rgba(24, 23, 34, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
        }
        .other-card {
          background: rgba(24, 23, 34, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }
        .other-card:hover {
          background: rgba(24, 23, 34, 0.8);
          border-color: rgba(0, 98, 255, 0.3);
          transform: translateY(-4px);
        }
        .description-content {
          white-space: pre-wrap;
          line-height: 1.7;
        }
        .tally-iframe-container {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          overflow: hidden;
          height: 600px;
          transition: all 0.3s ease;
        }
        @media (max-w: 768px) {
          .tally-iframe-container {
            height: 750px;
          }
        }
      `}</style>

      {/* Public Header */}
      <nav className="fixed top-0 w-full z-50 glass-header flex justify-between items-center px-6 md:px-12 py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBackToLanding}>
          <img alt="ADSS Logo" className="h-9 w-auto" src="/logo_trans_light.png" />
          <span className="font-headline-md text-xl font-bold text-on-surface hidden md:block">ADSS Ruhuna</span>
        </div>
        <button
          onClick={onBackToLanding}
          className="text-text-secondary hover:text-white transition-colors duration-300 flex items-center gap-2 text-sm font-semibold"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Home
        </button>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-28">

        {/* Breadcrumb / Badge */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isUpcoming ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"}`}>
            {isUpcoming ? "Upcoming Event" : "Past Event"}
          </span>
          <span className="text-text-secondary text-sm">Event ID: {event.event_id}</span>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Side: Information & Flyer */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white mb-2">
              {event.name}
            </h1>

            {/* Meta details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 border border-white/5 p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#0062ff]">calendar_month</span>
                <div>
                  <div className="text-xs text-text-secondary uppercase font-semibold">Date</div>
                  <div className="text-sm font-bold">{formatDate(event.date)}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4">
                <span className="material-symbols-outlined text-2xl text-[#00C2FF]">schedule</span>
                <div>
                  <div className="text-xs text-text-secondary uppercase font-semibold">Time</div>
                  <div className="text-sm font-bold">{event.time || "To be announced"}</div>
                </div>
              </div>
            </div>

            {/* Flyer Image */}
            {event.flyer_url ? (
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl group max-w-full bg-[#181722]/50 flex justify-center items-center min-h-[300px]">
                <img
                  src={event.flyer_url}
                  alt={`${event.name} Flyer`}
                  className="w-full h-auto object-contain max-h-[600px] sm:max-h-[700px]"
                />
              </div>
            ) : (
              <div className="h-64 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-text-secondary p-6">
                <span className="material-symbols-outlined text-5xl text-white/25 mb-3">image</span>
                <p className="text-sm">No flyer available for this event</p>
              </div>
            )}

            {/* Description */}
            <div className="event-card p-6 md:p-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#85b5ff]">info</span> About this Event
              </h2>
              <div className="description-content text-text-secondary text-sm md:text-base leading-relaxed">
                {event.description || "Join us for this exciting acturial and data science event organized by ADSS Ruhuna. Register today using the form to secure your spot."}
              </div>
            </div>
          </div>

          {/* Right Side: Registration Iframe Embed */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 w-full">
            <div className="event-card p-4 sm:p-6 border-t-4 border-t-[#0062ff]">
              <div className="mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0062ff]">how_to_reg</span> Register Now
                </h2>
                <p className="text-xs text-text-secondary mt-1">Fill out the official Tally registration form below.</p>
              </div>

              {isUpcoming ? (
                <div className="tally-iframe-container relative">
                  {iframeLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#181722]/85 z-10 gap-3 rounded-2xl">
                      <div className="w-10 h-10 border-4 border-[#0062ff] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-text-secondary font-semibold uppercase tracking-wider">Loading Form...</p>
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
              ) : (
                <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5">
                  <span className="material-symbols-outlined text-4xl text-[#ff4d4f] mb-3">lock_clock</span>
                  <h3 className="text-base font-bold">Registration Closed</h3>
                  <p className="text-xs text-text-secondary mt-2">This event occurred in the past, and registration is now closed. Stay tuned for future ADSS events!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other Events Section */}
        {otherEvents.length > 0 && (
          <section className="mt-16 border-t border-white/5 pt-12">
            <h2 className="text-2xl font-bold mb-8">Other ADSS Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {otherEvents.map(oe => (
                <div
                  key={oe.event_id}
                  className="other-card rounded-2xl overflow-hidden flex flex-col cursor-pointer"
                  onClick={() => handleSelectEvent(oe.event_id)}
                >
                  {oe.flyer_url ? (
                    <img
                      src={oe.flyer_url}
                      alt={oe.name}
                      className="w-full h-40 object-cover border-b border-white/5"
                    />
                  ) : (
                    <div className="w-full h-40 bg-white/5 flex items-center justify-center text-white/20 border-b border-white/5">
                      <span className="material-symbols-outlined text-4xl">event</span>
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-grow justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-white text-base line-clamp-1 hover:text-[#0062ff] transition-colors">{oe.name}</h3>
                      <p className="text-xs text-text-secondary mt-1">{formatDate(oe.date)}</p>
                    </div>
                    <div className="text-[#85b5ff] text-xs font-semibold flex items-center gap-1">
                      View Details & Register <span className="material-symbols-outlined text-xs">arrow_forward</span>
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
