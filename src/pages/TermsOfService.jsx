import { useState, useEffect } from "react";

export default function TermsOfService({ onBackToLanding }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      const scrollPosition = window.scrollY + 200;

      sections.forEach((section) => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute("id");

        if (scrollPosition >= top && scrollPosition < top + height) {
          setActiveSection(id);
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const sectionsList = [
    { id: "section-1", num: "1", title: "About ADSS Ruhuna" },
    { id: "section-2", num: "2", title: "Acceptance of Terms" },
    { id: "section-3", num: "3", title: "Permitted Use" },
    { id: "section-4", num: "4", title: "User Responsibilities" },
    { id: "section-5", num: "5", title: "Prohibited Activities" },
    { id: "section-6", num: "6", title: "Event Registration" },
    { id: "section-7", num: "7", title: "Membership" },
    { id: "section-8", num: "8", title: "Intellectual Property" },
    { id: "section-9", num: "9", title: "User-Submitted Content" },
    { id: "section-10", num: "10", title: "Third-Party Links" },
    { id: "section-11", num: "11", title: "Disclaimer" },
    { id: "section-12", num: "12", title: "Limitation of Liability" },
    { id: "section-13", num: "13", title: "Privacy" },
    { id: "section-14", num: "14", title: "Changes to These Terms" },
    { id: "section-15", num: "15", title: "Governing Law" },
    { id: "section-16", num: "16", title: "Contact Us" }
  ];

  const handleNavigateBack = () => {
    if (onBackToLanding) {
      onBackToLanding();
    } else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const matchesSearch = (text) => {
    if (!searchTerm.trim()) return true;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#e5e5ea] font-body-md selection:bg-white/20 selection:text-white pb-20">
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .terms-card { border: none !important; background: none !important; box-shadow: none !important; }
        }
        .glass-header {
          background: rgba(12, 12, 14, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .terms-card {
          background: rgba(24, 24, 28, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
        }
        .toc-item {
          transition: all 0.2s ease;
        }
        .toc-item.active {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-left: 3px solid #6366f1;
        }
      `}</style>

      {/* Navigation Header */}
      <nav className="fixed top-0 w-full z-50 glass-header flex justify-between items-center px-6 md:px-12 py-4 no-print">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleNavigateBack}>
          <img alt="ADSS Logo" className="h-9 w-auto" src="/logo_trans_light.png" />
          <span className="font-headline-md text-xl font-bold text-on-surface hidden md:block">ADSS Ruhuna</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
            title="Copy URL link"
          >
            <span className="material-symbols-outlined text-sm">share</span>
            <span>{copied ? "Copied!" : "Share"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer hidden sm:flex"
            title="Print Terms of Service"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span>Print</span>
          </button>
          <button
            onClick={handleNavigateBack}
            className="px-4 py-2 bg-[#e4e4e7] hover:bg-white text-[#09090b] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Home</span>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-28">
        
        {/* Banner Card */}
        <div className="terms-card p-6 md:p-10 mb-8 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Legal & Policy
            </span>
            <span className="text-zinc-400 text-xs font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">event</span>
              <strong>Effective Date:</strong> August 5, 2026
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Terms of Service
          </h1>

          <p className="text-zinc-300 text-base md:text-lg leading-relaxed max-w-4xl">
            Welcome to the official website of the <strong>Actuarial & Data Science Society (ADSS) Ruhuna</strong>, Faculty of Science, University of Ruhuna.
          </p>

          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 leading-relaxed">
            These Terms of Service ("Terms") govern your access to and use of the ADSS Ruhuna website and any services, events, or resources provided through it. By accessing or using this website, you agree to comply with these Terms. If you do not agree with any part of these Terms, please refrain from using our website.
          </div>

          {/* Quick Search */}
          <div className="mt-6 no-print">
            <div className="relative max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search terms of service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-400 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Table of Contents Sidebar */}
          <aside className="lg:col-span-4 no-print">
            <div className="terms-card p-5 sticky top-28 border border-white/10 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">toc</span>
                Table of Contents
              </h3>
              <nav className="flex flex-col gap-1 text-xs">
                {sectionsList.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className={`toc-item px-3 py-2 rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2 ${
                      activeSection === sec.id ? "active" : ""
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white/10 text-zinc-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {sec.num}
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Detailed Policy Sections */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Section 1 */}
            {matchesSearch("1. About ADSS Ruhuna student-led society Faculty of Science University of Ruhuna actuarial science data science statistics mathematics workshops seminars competitions") && (
              <section id="section-1" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    1
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">About ADSS Ruhuna</h2>
                </div>
                <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                  The <strong>Actuarial & Data Science Society (ADSS) Ruhuna</strong> is a student-led society under the <strong>Faculty of Science, University of Ruhuna</strong>, dedicated to promoting knowledge and professional development in actuarial science, data science, statistics, mathematics, and related fields through educational activities, workshops, seminars, competitions, and community engagement.
                </p>
              </section>
            )}

            {/* Section 2 */}
            {matchesSearch("2. Acceptance of Terms agree Terms of Service Privacy Policy laws responsible") && (
              <section id="section-2" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    2
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Acceptance of Terms</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">By using this website, you confirm that you:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
                  <li>Agree to these Terms of Service.</li>
                  <li>Agree to our Privacy Policy.</li>
                  <li>Will use the website responsibly and in accordance with applicable laws.</li>
                </ul>
              </section>
            )}

            {/* Section 3 */}
            {matchesSearch("3. Permitted Use learn register events workshops membership educational resources contact announcements") && (
              <section id="section-3" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    3
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Permitted Use</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">You may use this website to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-1.5 list-disc pl-5 mb-4">
                  <li>Learn about ADSS Ruhuna.</li>
                  <li>Register for events and workshops.</li>
                  <li>Apply for membership where applicable.</li>
                  <li>Access educational resources.</li>
                  <li>Contact the society.</li>
                  <li>Stay informed about society activities and announcements.</li>
                </ul>
                <p className="text-xs text-zinc-400">
                  You agree to use the website only for lawful purposes.
                </p>
              </section>
            )}

            {/* Section 4 */}
            {matchesSearch("4. User Responsibilities accurate information respect account security interfere University policies") && (
              <section id="section-4" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    4
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">User Responsibilities</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">When using this website, you agree to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5">
                  <li>Provide accurate and truthful information.</li>
                  <li>Respect other users and society members.</li>
                  <li>Keep any account credentials secure (if applicable).</li>
                  <li>Not interfere with the operation or security of the website.</li>
                  <li>Comply with all applicable laws and University of Ruhuna policies.</li>
                </ul>
              </section>
            )}

            {/* Section 5 */}
            {matchesSearch("5. Prohibited Activities unauthorized access malicious software viruses scrape scrape code impersonate false unlawful restricted") && (
              <section id="section-5" className="terms-card p-6 md:p-8 border border-red-500/30 bg-red-950/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-300 font-bold flex items-center justify-center text-sm border border-red-500/30">
                    5
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Prohibited Activities</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">You must not:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5 mb-4">
                  <li>Attempt to gain unauthorized access to the website or its systems.</li>
                  <li>Upload malicious software, viruses, or harmful code.</li>
                  <li>Use automated tools to scrape or copy website content without permission.</li>
                  <li>Impersonate another person or organization.</li>
                  <li>Submit false or misleading information.</li>
                  <li>Use the website for unlawful, fraudulent, or abusive activities.</li>
                  <li>Disrupt events, registrations, or website services.</li>
                </ul>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
                  <strong>Warning:</strong> Violation of these Terms may result in restricted access to the website.
                </div>
              </section>
            )}

            {/* Section 6 */}
            {matchesSearch("6. Event Registration accurate limits selection certificates schedule modify cancel") && (
              <section id="section-6" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    6
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Event Registration</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">When registering for ADSS Ruhuna events, you agree that:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5">
                  <li>Information provided is accurate and complete.</li>
                  <li>Registration does not guarantee selection where participant limits apply.</li>
                  <li>Attendance requirements may apply for receiving certificates.</li>
                  <li>Event schedules, speakers, or venues may change due to unforeseen circumstances.</li>
                  <li>ADSS Ruhuna reserves the right to cancel or modify events when necessary.</li>
                </ul>
              </section>
            )}

            {/* Section 7 */}
            {matchesSearch("7. Membership eligibility applications procedures termination rejection false information") && (
              <section id="section-7" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    7
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Membership</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  Membership eligibility, application procedures, and benefits are determined by ADSS Ruhuna and may change from time to time.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Providing false information during membership applications may result in rejection or termination of membership.
                </p>
              </section>
            )}

            {/* Section 8 */}
            {matchesSearch("8. Intellectual Property branding logos posters articles images videos documents materials credit non-commercial reproduction") && (
              <section id="section-8" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    8
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Intellectual Property</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">
                  Unless otherwise stated, all content available on this website is the property of ADSS Ruhuna or is used with permission. This includes:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {["Society name & branding", "Logos", "Event posters", "Articles", "Images", "Videos", "Documents", "Website design & materials"].map(item => (
                    <div key={item} className="p-2 rounded-lg bg-white/5 text-xs text-zinc-300 border border-white/5 text-center font-medium">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed mb-2">
                  You may view, download, and share content for personal, educational, and non-commercial purposes, provided appropriate credit is given and the content is not modified.
                </p>
                <p className="text-amber-300/90 text-xs font-semibold">
                  Commercial use, reproduction, or redistribution without prior written permission is prohibited.
                </p>
              </section>
            )}

            {/* Section 9 */}
            {matchesSearch("9. User-Submitted Content feedback registrations comments photographs competition submissions accurate permission promote") && (
              <section id="section-9" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    9
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">User-Submitted Content</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">If you submit content such as feedback, event registrations, comments, photographs, or competition submissions, you confirm that:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5">
                  <li>The information is accurate.</li>
                  <li>You own or have permission to submit the content.</li>
                  <li>ADSS Ruhuna may use the content for administrative purposes or to promote society activities, unless otherwise agreed.</li>
                </ul>
              </section>
            )}

            {/* Section 10 */}
            {matchesSearch("10. Third-Party Links external websites universities partners sponsors availability endorse responsible") && (
              <section id="section-10" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    10
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Third-Party Links</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  Our website may include links to external websites operated by universities, partners, sponsors, or service providers.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  These links are provided for convenience only. ADSS Ruhuna does not control or endorse the content, privacy practices, or availability of third-party websites and is not responsible for any information or services they provide.
                </p>
              </section>
            )}

            {/* Section 11 */}
            {matchesSearch("11. Disclaimer informational educational accuracy guarantees completeness reliability notice") && (
              <section id="section-11" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    11
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Disclaimer</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  The information provided on this website is for general informational and educational purposes.
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  While ADSS Ruhuna strives to keep information accurate and up to date, we make no guarantees regarding the completeness, reliability, or accuracy of any content.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Website content, event details, schedules, and resources may change without prior notice.
                </p>
              </section>
            )}

            {/* Section 12 */}
            {matchesSearch("12. Limitation of Liability committee volunteers University of Ruhuna direct indirect damage downtime technical errors cancellations") && (
              <section id="section-12" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    12
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Limitation of Liability</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3 leading-relaxed">
                  To the fullest extent permitted by law, ADSS Ruhuna, its committee members, volunteers, and the University of Ruhuna shall not be liable for any direct, indirect, incidental, or consequential loss or damage arising from:
                </p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-1.5 list-disc pl-5">
                  <li>Use of this website.</li>
                  <li>Website downtime or technical issues.</li>
                  <li>Errors or omissions in website content.</li>
                  <li>Third-party services linked from this website.</li>
                  <li>Event cancellations or schedule changes.</li>
                </ul>
              </section>
            )}

            {/* Section 13 */}
            {matchesSearch("13. Privacy Privacy Policy personal information collected protected") && (
              <section id="section-13" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    13
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Privacy</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                  Your use of this website is also governed by our <strong>Privacy Policy</strong>, which explains how personal information is collected, used, and protected.
                </p>
                <button
                  onClick={() => {
                    window.history.pushState({}, "", "/privacy");
                    window.dispatchEvent(new Event("popstate"));
                  }}
                  className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold rounded-xl text-xs border border-indigo-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">policy</span>
                  <span>View Privacy Policy</span>
                </button>
              </section>
            )}

            {/* Section 14 */}
            {matchesSearch("14. Changes to These Terms revise operational legal organizational effective date acceptance") && (
              <section id="section-14" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    14
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Changes to These Terms</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  ADSS Ruhuna may revise these Terms of Service at any time to reflect operational, legal, or organizational changes.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Updated versions will be published on this page with a revised effective date. Continued use of the website after changes become effective constitutes acceptance of the updated Terms.
                </p>
              </section>
            )}

            {/* Section 15 */}
            {matchesSearch("15. Governing Law Democratic Socialist Republic of Sri Lanka competent courts jurisdiction disputes") && (
              <section id="section-15" className="terms-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    15
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Governing Law</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  These Terms of Service shall be governed by and interpreted in accordance with the laws of the <strong>Democratic Socialist Republic of Sri Lanka</strong>.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Any disputes arising from the use of this website shall be subject to the jurisdiction of the competent courts of Sri Lanka.
                </p>
              </section>
            )}

            {/* Section 16 */}
            {matchesSearch("16. Contact Us Actuarial Data Science Society ADSS Ruhuna Faculty of Science University of Ruhuna Matara Sri Lanka website email") && (
              <section id="section-16" className="terms-card p-6 md:p-8 border border-indigo-500/30 bg-indigo-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    16
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Contact Us</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  If you have any questions regarding these Terms of Service, please contact us.
                </p>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs md:text-sm">
                  <div>
                    <strong className="text-white text-base block mb-1">Actuarial & Data Science Society (ADSS) Ruhuna</strong>
                    <span className="text-zinc-300 block">Faculty of Science</span>
                    <span className="text-zinc-300 block">University of Ruhuna</span>
                    <span className="text-zinc-300 block">Matara, Sri Lanka</span>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-wrap gap-4">
                    <div>
                      <span className="text-zinc-400 block text-xs">Official Website:</span>
                      <a 
                        href="https://www.math.ruh.ac.lk/adss/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-300 hover:text-white underline font-medium"
                      >
                        https://www.math.ruh.ac.lk/adss/
                      </a>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-xs">Email Contact:</span>
                      <a 
                        href="mailto:bhanukadilshan2002@gmail.com" 
                        className="text-indigo-300 hover:text-white underline font-medium"
                      >
                        bhanukadilshan2002@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Footer timestamp */}
            <div className="text-center py-6 text-xs text-zinc-500 border-t border-white/5">
              <strong>Last Updated:</strong> August 5, 2026 &bull; Actuarial & Data Science Society (ADSS) Ruhuna
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
