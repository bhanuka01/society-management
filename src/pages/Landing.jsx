import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function Landing({ theme = "dark", onThemeToggle, onLoginClick, onRegisterClick, regEnabled = true, aiEnabled = true }) {
  const glowRef = useRef(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const { data, error } = await supabase
          .from("events")
          .select("event_id, name, date, time, flyer_url, description")
          .or("is_public.is.null,is_public.eq.true")
          .gte("date", todayStr)
          .order("date", { ascending: true })
          .limit(3);

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

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (glowRef.current) {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        glowRef.current.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(99, 102, 241, 0.09) 0%, transparent 40%)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Intersection Observer for fade-in animations
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
          entry.target.classList.remove("opacity-0", "translate-y-10");
        }
      });
    }, observerOptions);

    const sections = document.querySelectorAll(".animate-section");
    sections.forEach(section => {
      section.classList.add("transition-all", "duration-1000", "opacity-0", "translate-y-10");
      observer.observe(section);
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      sections.forEach(section => observer.unobserve(section));
    };
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className={`landing-page ${theme === "light" ? "landing-light" : ""} bg-[#0c0c0e] text-[#e5e5ea] min-h-screen font-body-md overflow-x-hidden selection:bg-white/20 selection:text-white`}>
      <style>{`
        .glass-card {
          background: rgba(24, 24, 28, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          transform: translateY(-6px) scale(1.01);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
        }
        .hero-glow {
          background: radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.08) 0%, transparent 60%);
        }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
        }
        @media (min-width: 768px) {
          .mobile-nav { display: none !important; }
        }
        @media (max-width: 640px) {
          .hero-buttons-wrapper {
            flex-direction: column !important;
            width: 100% !important;
          }
          .hero-buttons-wrapper > button {
            width: 100% !important;
          }
        }
        @media (min-width: 641px) {
          .hero-buttons-wrapper {
            flex-direction: row !important;
          }
          .hero-buttons-wrapper > button {
            width: auto !important;
          }
        }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex items-center px-6 md:px-12 py-4 bg-[#0c0c0e]/85 backdrop-blur-xl border-b border-white/10">
        
        {/* Desktop Layout */}
        <div className="desktop-nav justify-between items-center w-full flex">
          <div className="flex items-center gap-3">
            <img alt="ADSS Logo" className="h-10 w-auto" src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`} />
            <span className="font-headline-md text-2xl font-bold text-on-surface">ADSS Ruhuna</span>
          </div>
          <div className="flex items-center gap-8">
            <button
              onClick={() => scrollToSection(upcomingEvents.length > 0 ? "upcoming-events" : "features")}
              className="font-body-md text-zinc-400 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              Events
            </button>
            <button
              onClick={() => scrollToSection("cta")}
              className="font-body-md text-zinc-400 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              Membership
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="font-body-md text-zinc-400 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              Insights
            </button>
            <button
              onClick={() => scrollToSection("footer")}
              className="font-body-md text-zinc-400 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              Contact
            </button>
            {aiEnabled && (
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/assistant");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className="font-body-md text-zinc-400 hover:text-white transition-colors duration-300 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg text-zinc-300">auto_awesome</span>
                <span>AI Assistant</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              onClick={onThemeToggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="material-symbols-outlined text-sm">
                {theme === "dark" ? "light_mode" : "dark_mode"}
              </span>
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button
              onClick={onLoginClick}
              className="bg-[#e4e4e7] text-[#09090b] px-6 py-2.5 rounded-full font-bold text-body-md hover:bg-white active:scale-95 transition-all shadow-sm"
            >
              Join Society
            </button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="mobile-nav justify-between items-center w-full flex">
          {/* Logo on the left */}
          <div className="flex items-center">
            <img alt="ADSS Logo" className="h-10 w-auto" src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`} />
          </div>
          
          <div className="flex items-center gap-2">
            {aiEnabled && (
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/assistant");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className="bg-white/10 border border-white/20 text-white p-2 rounded-full active:scale-95 transition-all flex items-center justify-center"
                title="AI Assistant"
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
              </button>
            )}
          </div>
          <button
            onClick={onLoginClick}
            className="bg-[#e4e4e7] text-[#09090b] px-5 py-2 rounded-full font-bold text-sm active:scale-95 transition-all shadow-sm"
          >
            Join Society
          </button>

          {/* Theme Switch (icon-only, circular) on the right */}
          <button
            type="button"
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all border ${
              theme === "dark" 
                ? "bg-white/10 hover:bg-white/20 text-white border-white/10" 
                : "bg-black/5 hover:bg-black/10 text-gray-800 border-black/10"
            }`}
            onClick={onThemeToggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="material-symbols-outlined text-xl leading-none">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center pt-24 overflow-hidden">
        <div ref={glowRef} className="absolute inset-0 z-0 hero-glow transition-all duration-300"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-zinc-300 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">New Academic Session 2024/25</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight">
            Where Data Meets <br /><span className="text-[#e4e4e7]">Decision-Making</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Explore how data-driven insights guide smarter business, financial, and risk-based decisions within the University of Ruhuna's premier tech society.
          </p>
          <div 
            className="hero-buttons-wrapper flex flex-col md:flex-row items-center justify-center gap-4 w-full max-w-3xl mx-auto"
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px' }}
          >
            <button
              onClick={onLoginClick}
              className="px-7 py-3.5 bg-[#e4e4e7] text-[#09090b] rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_4px_20px_rgba(255,255,255,0.1)] active:scale-95 cursor-pointer"
            >
              Login Society <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
            {regEnabled && (
              <button
                onClick={onRegisterClick}
                className="px-7 py-3.5 bg-transparent border border-white/20 text-white rounded-xl font-bold text-base hover:bg-white/5 transition-all cursor-pointer"
              >
                Join Membership
              </button>
            )}
            {aiEnabled && (
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/assistant");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className="px-6 py-3.5 bg-white/10 border border-white/20 text-[#e4e4e7] rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-white/15 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg text-zinc-300">auto_awesome</span> Ask AI Assistant
              </button>
            )}
          </div>
        </div>

        {/* Floating Dashboard Preview (Cinematic Utility) */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-full max-w-5xl px-4 hidden lg:block opacity-40 hover:opacity-85 transition-opacity duration-700">
          <div className="glass-card rounded-t-3xl p-6 border-b-0">
            <div className="flex items-center gap-4 mb-6 opacity-40">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="h-2 w-48 bg-white/10 rounded-full ml-4"></div>
            </div>
            <div className="grid grid-cols-3 gap-6 h-48">
              <div className="rounded-xl bg-white/5 border border-white/5"></div>
              <div className="col-span-2 rounded-xl bg-white/5 border border-white/5"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <section id="upcoming-events" className="animate-section py-20 bg-[#0c0c0e] border-y border-white/10 relative">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <span className="text-zinc-300 uppercase tracking-widest text-xs font-bold bg-white/10 border border-white/15 px-3 py-1 rounded-full">Stay Connected</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4">Upcoming Events</h2>
              <p className="text-zinc-400 text-base md:text-lg max-w-xl mx-auto">Register for our upcoming workshops, guest lectures, and hackathons.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {upcomingEvents.map(ev => {
                const formattedDate = new Date(ev.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  weekday: "short"
                });

                return (
                  <div key={ev.event_id} className="glass-card rounded-3xl overflow-hidden flex flex-col justify-between group h-full">
                    <div>
                      {/* Flyer / Header */}
                      {ev.flyer_url ? (
                        <div className="h-48 overflow-hidden relative">
                          <img 
                            src={ev.flyer_url} 
                            alt={ev.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent opacity-60"></div>
                        </div>
                      ) : (
                        <div className="h-48 bg-white/5 flex items-center justify-center text-white/20 relative">
                          <span className="material-symbols-outlined text-5xl">event</span>
                        </div>
                      )}

                      <div className="p-6">
                        {/* Date badge */}
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold mb-3">
                          <span className="material-symbols-outlined text-sm">calendar_month</span>
                          {formattedDate}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#e4e4e7] transition-colors">{ev.name}</h3>
                        <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                          {ev.description || "Join us for this actuarial and data science event. Click register to see full details and form."}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 pt-0">
                      <button
                        onClick={() => {
                          const eventUrl = `/event?id=${ev.event_id}`;
                          window.history.pushState({ path: eventUrl }, "", eventUrl);
                          window.dispatchEvent(new Event("popstate"));
                        }}
                        className="w-full py-3 bg-white/10 text-white border border-white/20 rounded-xl font-bold text-sm hover:bg-white/20 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                      >
                        Register & View Details <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Features Bento Grid */}
      <section id="features" className="animate-section py-24 bg-[#0c0c0e] transition-all duration-1000">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Society Management Intelligence</h2>
            <p className="text-zinc-400 text-base md:text-lg max-w-xl mx-auto">Advanced tools for organizing events, managing members, and tracking progress.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Large Card */}
            <div className="md:col-span-8 glass-card rounded-3xl p-10 flex flex-col justify-between group">
              <div>
                <span className="material-symbols-outlined text-4xl text-zinc-300 mb-6">event_available</span>
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Event Excellence</h3>
                <p className="text-zinc-400 text-base">Seamless management and real-time attendance tracking for all society workshops and seminars.</p>
              </div>
              <div className="mt-12 flex gap-4">
                <div className="h-12 w-full bg-white/5 rounded-lg border border-white/5 group-hover:border-white/20 transition-all"></div>
                <div className="h-12 w-12 bg-white/10 rounded-lg flex items-center justify-center text-zinc-200 flex-shrink-0">
                  <span className="material-symbols-outlined">analytics</span>
                </div>
              </div>
            </div>
            {/* Tall Card */}
            <div className="md:col-span-4 glass-card rounded-3xl p-10 flex flex-col group justify-between">
              <div>
                <span className="material-symbols-outlined text-4xl text-zinc-300 mb-6">groups</span>
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Member Intelligence</h3>
                <p className="text-zinc-400 text-base mb-8">Deep profiles and performance tracking for our community of future actuaries.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="h-4 w-full bg-white/10 rounded-full"></div>
                <div className="h-4 w-2/3 bg-white/10 rounded-full"></div>
                <div className="h-4 w-5/6 bg-white/10 rounded-full"></div>
              </div>
            </div>
            {/* Bottom Cards */}
            <div className="md:col-span-6 glass-card rounded-3xl p-10 group">
              <span className="material-symbols-outlined text-4xl text-zinc-300 mb-6">query_stats</span>
              <h3 className="text-2xl font-bold mb-4">Attendance Insights</h3>
              <p className="text-zinc-400 text-base">Data-driven analysis of member engagement and participation across all activities.</p>
            </div>
            <div className="md:col-span-6 glass-card rounded-3xl p-10 group">
              <span className="material-symbols-outlined text-4xl text-zinc-300 mb-6">checklist_rtl</span>
              <h3 className="text-2xl font-bold mb-4">Task Orchestration</h3>
              <p className="text-zinc-400 text-base">Efficient coordination of society goals, board tasks, and academic projects.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bold CTA Section */}
      <section id="cta" className="animate-section py-24 transition-all duration-1000">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="relative bg-[#18181b] rounded-[48px] p-12 md:p-24 overflow-hidden text-center border border-white/5">
            {/* Background Decoration */}
            <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-bold mb-8">Join the Future of Data Science</h2>
              <p className="text-lg text-zinc-400 mb-12 leading-relaxed">Become a part of the most influential society at the Faculty of Science, University of Ruhuna. Connect with peers, learn from experts, and shape your career.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                {regEnabled ? (
                  <button
                    onClick={onRegisterClick}
                    className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-white/95 transition-all transform hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                  >
                    Register Today
                  </button>
                ) : (
                  <button
                    onClick={onLoginClick}
                    className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-white/95 transition-all transform hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                  >
                    Login to Portal
                  </button>
                )}
                <button
                  onClick={() => scrollToSection("footer")}
                  className="w-full sm:w-auto px-10 py-5 bg-transparent border border-white/20 text-white rounded-2xl font-bold text-lg hover:bg-white/5 transition-all"
                >
                  Talk to Us
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="bg-[#09090b] border-t border-white/5">
        <div className="w-full py-16 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <img alt="ADSS Logo" className="h-10 w-auto" src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`} />
              <span className="text-2xl font-bold text-white">ADSS Ruhuna</span>
            </div>
            <p className="text-[#94A3B8] text-base mb-8 leading-relaxed">Empowering the next generation of Actuaries and Data Scientists at the University of Ruhuna through education, research, and industry engagement.</p>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-white transition-all text-[#94A3B8] hover:text-white" href="https://www.facebook.com/adssruhuna" target="_blank" rel="noreferrer">
                <span className="material-symbols-outlined text-lg">face_nod</span>
              </a>
              <a className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-white transition-all text-[#94A3B8] hover:text-white" href="https://www.linkedin.com/company/actuarial-data-science-society-university-of-ruhuna/" target="_blank" rel="noreferrer">
                <span className="material-symbols-outlined text-lg">group</span>
              </a>
              <a className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-white transition-all text-[#94A3B8] hover:text-white" href="mailto:bhanukadilshan2002@gmail.com">
                <span className="material-symbols-outlined text-lg">mail</span>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold mb-2">Explore</h4>
              <button onClick={() => scrollToSection("features")} className="text-[#94A3B8] hover:text-white transition-colors text-left">Student Activities</button>
              <button onClick={() => scrollToSection("features")} className="text-[#94A3B8] hover:text-white transition-colors text-left">Upcoming Events</button>
              <button onClick={onLoginClick} className="text-[#94A3B8] hover:text-white transition-colors text-left">Committee</button>
              <button onClick={onLoginClick} className="text-[#94A3B8] hover:text-white transition-colors text-left">Insights</button>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white font-bold mb-2">Resources</h4>
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/privacy");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className="text-[#94A3B8] hover:text-white transition-colors text-left cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/terms");
                  window.dispatchEvent(new Event("popstate"));
                }}
                className="text-[#94A3B8] hover:text-white transition-colors text-left cursor-pointer"
              >
                Terms of Service
              </button>
              <a className="text-[#94A3B8] hover:text-white transition-colors" href="https://www.ruh.ac.lk/" target="_blank" rel="noreferrer">University of Ruhuna</a>
              <a className="text-[#94A3B8] hover:text-white transition-colors" href="https://www.sci.ruh.ac.lk/" target="_blank" rel="noreferrer">Faculty of Science</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 py-8">
          <div className="max-w-6xl mx-auto px-6 text-center md:text-left text-[#94A3B8] text-sm">
            © 2026 Actuarial & Data Science Society, University of Ruhuna. Built for the future of analytics.
          </div>
        </div>
      </footer>
    </div>
  );
}
