import { useState, useEffect } from "react";

export default function PrivacyPolicy({ onBackToLanding }) {
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
    { id: "section-1", num: "1", title: "Information We Collect" },
    { id: "section-2", num: "2", title: "How We Use Your Information" },
    { id: "section-3", num: "3", title: "Cookies" },
    { id: "section-4", num: "4", title: "Third-Party Services" },
    { id: "section-5", num: "5", title: "Sharing of Information" },
    { id: "section-6", num: "6", title: "Data Security" },
    { id: "section-7", num: "7", title: "Data Retention" },
    { id: "section-8", num: "8", title: "Email Communications" },
    { id: "section-9", num: "9", title: "Your Rights" },
    { id: "section-10", num: "10", title: "External Links" },
    { id: "section-11", num: "11", title: "Children's Privacy" },
    { id: "section-12", num: "12", title: "Changes to Privacy Policy" },
    { id: "section-13", num: "13", title: "Contact Us" }
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
          .privacy-card { border: none !important; background: none !important; box-shadow: none !important; }
        }
        .glass-header {
          background: rgba(12, 12, 14, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .privacy-card {
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
            title="Print Privacy Policy"
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

      {/* Content Layout */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-28">
        
        {/* Banner Card */}
        <div className="privacy-card p-6 md:p-10 mb-8 border border-white/10 relative overflow-hidden">
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
            Privacy Policy
          </h1>

          <p className="text-zinc-300 text-base md:text-lg leading-relaxed max-w-4xl">
            Welcome to the official website of the <strong>Actuarial & Data Science Society (ADSS) Ruhuna</strong>, Faculty of Science, University of Ruhuna.
          </p>

          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 leading-relaxed">
            At ADSS Ruhuna, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and safeguard information when you visit our website, register for events, become a member, or communicate with us.
            <br />
            <span className="text-white font-medium mt-2 block">By using this website, you agree to the practices described in this Privacy Policy.</span>
          </div>

          {/* Quick Search */}
          <div className="mt-6 no-print">
            <div className="relative max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</span>
              <input
                type="text"
                placeholder="Search privacy topics..."
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
            <div className="privacy-card p-5 sticky top-28 border border-white/10 max-h-[80vh] overflow-y-auto">
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
            {matchesSearch("1. Information We Collect Personal Technical name email phone university faculty student registration membership event IP address browser device") && (
              <section id="section-1" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    1
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Information We Collect</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-4 leading-relaxed">
                  Depending on how you interact with our website, we may collect the following information:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h3 className="text-indigo-300 font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">person</span>
                      Personal Information
                    </h3>
                    <ul className="text-xs text-zinc-300 space-y-1.5 list-disc pl-4">
                      <li>Full name</li>
                      <li>Email address</li>
                      <li>Phone number (if provided)</li>
                      <li>University or educational institution</li>
                      <li>Faculty, department, or academic program</li>
                      <li>Student registration number (only when required)</li>
                      <li>Membership information</li>
                      <li>Event registration details</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h3 className="text-indigo-300 font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">devices</span>
                      Technical Information
                    </h3>
                    <p className="text-xs text-zinc-400 mb-2">Collected automatically when you visit:</p>
                    <ul className="text-xs text-zinc-300 space-y-1.5 list-disc pl-4">
                      <li>IP address</li>
                      <li>Browser type</li>
                      <li>Device type</li>
                      <li>Operating system</li>
                      <li>Pages visited</li>
                      <li>Date and time of access</li>
                      <li>Referring website</li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Section 2 */}
            {matchesSearch("2. How We Use Your Information register participants workshops seminars manage memberships event confirmations certificates inquiries analyze newsletters legal") && (
              <section id="section-2" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    2
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">How We Use Your Information</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">The information we collect may be used to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
                  <li>Register participants for events, workshops, seminars, and competitions.</li>
                  <li>Manage ADSS Ruhuna memberships.</li>
                  <li>Send event confirmations, reminders, and updates.</li>
                  <li>Issue participation certificates where applicable.</li>
                  <li>Respond to inquiries submitted through our contact forms.</li>
                  <li>Improve our website and user experience.</li>
                  <li>Analyze website usage and visitor statistics.</li>
                  <li>Share newsletters and announcements, where you have chosen to receive them.</li>
                  <li>Comply with applicable legal obligations.</li>
                </ul>
              </section>
            )}

            {/* Section 3 */}
            {matchesSearch("3. Cookies preferences traffic functionality disable") && (
              <section id="section-3" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    3
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Cookies</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">Our website may use cookies and similar technologies to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-1.5 list-disc pl-5 mb-4">
                  <li>Improve website functionality.</li>
                  <li>Remember user preferences.</li>
                  <li>Analyze website traffic.</li>
                  <li>Enhance user experience.</li>
                </ul>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                  <strong>Note:</strong> You may disable cookies through your browser settings; however, some features of the website may not function properly.
                </div>
              </section>
            )}

            {/* Section 4 */}
            {matchesSearch("4. Third-Party Services Google Forms Drive Analytics Zoom Teams YouTube LinkedIn Facebook Canva Email") && (
              <section id="section-4" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    4
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Third-Party Services</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-4 leading-relaxed">
                  To organize events and communicate with our community, we may use trusted third-party services, including but not limited to:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                  {[
                    "Google Forms", "Google Drive", "Google Analytics", 
                    "Zoom", "Microsoft Teams", "YouTube", 
                    "LinkedIn", "Facebook", "Canva", "Email service providers"
                  ].map((service) => (
                    <div key={service} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-zinc-200 text-center">
                      {service}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 italic">
                  These services have their own privacy policies, and we encourage you to review them before providing personal information.
                </p>
              </section>
            )}

            {/* Section 5 */}
            {matchesSearch("5. Sharing of Information sell rent trade consent legal authorities service providers") && (
              <section id="section-5" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    5
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Sharing of Information</h2>
                </div>
                
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">verified_user</span>
                  <span>ADSS Ruhuna does NOT sell, rent, or trade your personal information.</span>
                </div>

                <p className="text-zinc-300 text-sm mb-3">Your information may be shared only when necessary:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5">
                  <li>With trusted service providers assisting in event management.</li>
                  <li>When required by law or legal authorities.</li>
                  <li>To protect the rights, safety, or property of ADSS Ruhuna or others.</li>
                  <li>With your consent.</li>
                </ul>
              </section>
            )}

            {/* Section 6 */}
            {matchesSearch("6. Data Security security administrative technical protection unauthorized access") && (
              <section id="section-6" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    6
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Data Security</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  We take reasonable administrative and technical measures to protect your personal information against unauthorized access, disclosure, alteration, or destruction.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  While we strive to use commercially acceptable means to protect your information, no method of internet transmission or electronic storage is completely secure.
                </p>
              </section>
            )}

            {/* Section 7 */}
            {matchesSearch("7. Data Retention retention delete anonymize records memberships certificates") && (
              <section id="section-7" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    7
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Data Retention</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">Personal information is retained only for as long as necessary to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-1.5 list-disc pl-5 mb-4">
                  <li>Manage memberships.</li>
                  <li>Maintain event participation records.</li>
                  <li>Issue certificates.</li>
                  <li>Fulfill legal or administrative obligations.</li>
                  <li>Improve our services.</li>
                </ul>
                <p className="text-zinc-400 text-xs">
                  Information that is no longer required will be securely deleted or anonymized where appropriate.
                </p>
              </section>
            )}

            {/* Section 8 */}
            {matchesSearch("8. Email Communications announcements reminders news opportunities updates unsubscribe") && (
              <section id="section-8" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    8
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Email Communications</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">
                  If you register for an event or subscribe to our communications, we may send you:
                </p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-1.5 list-disc pl-5 mb-4">
                  <li>Event announcements</li>
                  <li>Workshop reminders</li>
                  <li>Society news</li>
                  <li>Educational opportunities</li>
                  <li>Important organizational updates</li>
                </ul>
                <p className="text-zinc-400 text-xs">
                  You may unsubscribe from non-essential communications at any time by following the instructions provided in our emails or by contacting us.
                </p>
              </section>
            )}

            {/* Section 9 */}
            {matchesSearch("9. Your Rights access correct deletion withdraw consent clarification") && (
              <section id="section-9" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    9
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Your Rights</h2>
                </div>
                <p className="text-zinc-300 text-sm mb-3">Subject to applicable laws, you may have the right to:</p>
                <ul className="text-xs md:text-sm text-zinc-300 space-y-2 list-disc pl-5 mb-4">
                  <li>Request access to your personal information.</li>
                  <li>Correct inaccurate or incomplete information.</li>
                  <li>Request deletion of your personal information.</li>
                  <li>Withdraw consent where processing is based on consent.</li>
                  <li>Request clarification regarding how your information is used.</li>
                </ul>
                <p className="text-zinc-400 text-xs">
                  Requests may be submitted using the contact information below.
                </p>
              </section>
            )}

            {/* Section 10 */}
            {matchesSearch("10. External Links external websites university sponsors partners third-party") && (
              <section id="section-10" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    10
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">External Links</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  Our website may contain links to external websites operated by universities, sponsors, partners, or other organizations.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  ADSS Ruhuna is not responsible for the privacy practices or content of third-party websites. We encourage you to review their privacy policies before providing personal information.
                </p>
              </section>
            )}

            {/* Section 11 */}
            {matchesSearch("11. Children's Privacy students graduates academics professionals children age consent") && (
              <section id="section-11" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    11
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Children's Privacy</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  Our website and activities are primarily intended for university students, graduates, academics, and professionals.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  We do not knowingly collect personal information from children under the age required by applicable law without appropriate consent.
                </p>
              </section>
            )}

            {/* Section 12 */}
            {matchesSearch("12. Changes to This Privacy Policy update revised effective date practices legal requirements") && (
              <section id="section-12" className="privacy-card p-6 md:p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    12
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Changes to This Privacy Policy</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  ADSS Ruhuna may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or website functionality.
                </p>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Any updates will be published on this page together with the revised effective date.
                </p>
              </section>
            )}

            {/* Section 13 */}
            {matchesSearch("13. Contact Us Actuarial Data Science Society ADSS Ruhuna Faculty of Science University of Ruhuna Matara Sri Lanka website email") && (
              <section id="section-13" className="privacy-card p-6 md:p-8 border border-indigo-500/30 bg-indigo-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                    13
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Contact Us</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  If you have any questions regarding this Privacy Policy or the handling of your personal information, please contact us.
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
