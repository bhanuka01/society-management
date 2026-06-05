import { useEffect, useRef } from "react";

export default function Landing({ theme = "dark", onThemeToggle, onLoginClick, onRegisterClick }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (glowRef.current) {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        glowRef.current.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255, 107, 0, 0.09) 0%, transparent 40%)`;
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
    <div className={`landing-page ${theme === "light" ? "landing-light" : ""} bg-[#0B0A11] text-white min-h-screen font-body-md overflow-x-hidden selection:bg-primary-container selection:text-white`}>
      <style>{`
        .glass-card {
          background: rgba(24, 23, 34, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          transform: translateY(-6px) scale(1.01);
          border-color: rgba(255, 107, 0, 0.25);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
        }
        .hero-glow {
          background: radial-gradient(circle at 50% 100%, rgba(255, 107, 0, 0.2) 0%, transparent 60%);
        }
      `}</style>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-12 py-4 bg-[#14121a]/85 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <img alt="ADSS Logo" className="h-10 w-auto" src="/logo.png" />
          <span className="font-headline-md text-2xl font-bold text-on-surface hidden md:block">ADSS Ruhuna</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection("features")}
            className="font-body-md text-text-secondary hover:text-[#ffb693] transition-colors duration-300 cursor-pointer"
          >
            Events
          </button>
          <button
            onClick={() => scrollToSection("cta")}
            className="font-body-md text-text-secondary hover:text-[#ffb693] transition-colors duration-300 cursor-pointer"
          >
            Membership
          </button>
          <button
            onClick={() => scrollToSection("features")}
            className="font-body-md text-text-secondary hover:text-[#ffb693] transition-colors duration-300 cursor-pointer"
          >
            Insights
          </button>
          <button
            onClick={() => scrollToSection("footer")}
            className="font-body-md text-text-secondary hover:text-[#ffb693] transition-colors duration-300 cursor-pointer"
          >
            Contact
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="theme-switch landing-theme-switch"
            onClick={onThemeToggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="theme-switch-track">
              <span className="theme-switch-thumb">{theme === "dark" ? "D" : "L"}</span>
            </span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button
            onClick={onLoginClick}
            className="bg-[#ff6b00] text-white px-6 py-2.5 rounded-full font-bold text-body-md hover:bg-[#ff8a00] active:scale-95 transition-all shadow-[0_0_15px_rgba(255,107,0,0.2)]"
          >
            Join Society
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center pt-24 overflow-hidden">
        <div ref={glowRef} className="absolute inset-0 z-0 hero-glow transition-all duration-300"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#ff6b00] animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">New Academic Session 2024/25</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight">
            Where Data Meets <br /><span className="text-[#ff6b00]">Decision-Making</span>
          </h1>
          <p className="text-lg md:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-12 leading-relaxed">
            Explore how data-driven insights guide smarter business, financial, and risk-based decisions within the University of Ruhuna's premier tech society.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
            <button
              onClick={() => scrollToSection("features")}
              className="w-full sm:w-auto px-8 py-4 bg-[#ff6b00] text-white rounded-xl font-bold text-body-md flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(255,107,0,0.4)] transition-all"
            >
              Explore Society <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
            <button
              onClick={onRegisterClick}
              className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/20 text-white rounded-xl font-bold text-body-md hover:bg-white/5 transition-all"
            >
              Join Membership
            </button>
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

      {/* Features Bento Grid */}
      <section id="features" className="animate-section py-24 bg-[#14121a] transition-all duration-1000">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Society Management Intelligence</h2>
            <p className="text-[#94A3B8] text-base md:text-lg max-w-xl mx-auto">Advanced tools for organizing events, managing members, and tracking progress.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Large Card */}
            <div className="md:col-span-8 glass-card rounded-3xl p-10 flex flex-col justify-between group">
              <div>
                <span className="material-symbols-outlined text-4xl text-[#ffb693] mb-6">event_available</span>
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Event Excellence</h3>
                <p className="text-[#94A3B8] text-base">Seamless management and real-time attendance tracking for all society workshops and seminars.</p>
              </div>
              <div className="mt-12 flex gap-4">
                <div className="h-12 w-full bg-white/5 rounded-lg border border-white/5 group-hover:border-[#ffb693]/30 transition-all"></div>
                <div className="h-12 w-12 bg-[#ffb693]/20 rounded-lg flex items-center justify-center text-[#ffb693] flex-shrink-0">
                  <span className="material-symbols-outlined">analytics</span>
                </div>
              </div>
            </div>
            {/* Tall Card */}
            <div className="md:col-span-4 glass-card rounded-3xl p-10 flex flex-col group justify-between">
              <div>
                <span className="material-symbols-outlined text-4xl text-[#00C2FF] mb-6">groups</span>
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Member Intelligence</h3>
                <p className="text-[#94A3B8] text-base mb-8">Deep profiles and performance tracking for our community of future actuaries.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="h-4 w-full bg-white/10 rounded-full"></div>
                <div className="h-4 w-2/3 bg-white/10 rounded-full"></div>
                <div className="h-4 w-5/6 bg-white/10 rounded-full"></div>
              </div>
            </div>
            {/* Bottom Cards */}
            <div className="md:col-span-6 glass-card rounded-3xl p-10 group">
              <span className="material-symbols-outlined text-4xl text-[#FF8A00] mb-6">query_stats</span>
              <h3 className="text-2xl font-bold mb-4">Attendance Insights</h3>
              <p className="text-[#94A3B8] text-base">Data-driven analysis of member engagement and participation across all activities.</p>
            </div>
            <div className="md:col-span-6 glass-card rounded-3xl p-10 group">
              <span className="material-symbols-outlined text-4xl text-[#ffb693] mb-6">checklist_rtl</span>
              <h3 className="text-2xl font-bold mb-4">Task Orchestration</h3>
              <p className="text-[#94A3B8] text-base">Efficient coordination of society goals, board tasks, and academic projects.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bold CTA Section */}
      <section id="cta" className="animate-section py-24 transition-all duration-1000">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="relative bg-[#181722] rounded-[48px] p-12 md:p-24 overflow-hidden text-center border border-white/5">
            {/* Background Decoration */}
            <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] bg-[#ffb693]/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-[#00C2FF]/5 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-bold mb-8">Join the Future of Data Science</h2>
              <p className="text-lg text-[#94A3B8] mb-12 leading-relaxed">Become a part of the most influential society at the Faculty of Science, University of Ruhuna. Connect with peers, learn from experts, and shape your career.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button
                  onClick={onRegisterClick}
                  className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-bold text-lg hover:bg-white/95 transition-all transform hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                >
                  Register Today
                </button>
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
      <footer id="footer" className="bg-[#0B0A11] border-t border-white/5">
        <div className="w-full py-16 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <img alt="ADSS Logo" className="h-10 w-auto" src="/logo.png" />
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
              <a className="text-[#94A3B8] hover:text-white transition-colors" href="#">Privacy Policy</a>
              <a className="text-[#94A3B8] hover:text-white transition-colors" href="#">Terms of Service</a>
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
