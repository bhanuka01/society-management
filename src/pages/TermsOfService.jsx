import { useState } from "react";
import {
  ShieldAlert,
  FileCheck2,
  Lock,
  QrCode,
  Share2,
  Printer,
  ArrowLeft,
  Search,
  Check,
  Mail,
  Globe,
  ExternalLink,
  BookOpen,
  Award,
  AlertTriangle,
  Scale,
  Copy,
  FileText
} from "lucide-react";

export default function TermsOfService({ onBackToLanding, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const handleNavigateBack = () => {
    if (onNavigate) {
      onNavigate("dashboard");
    } else if (onBackToLanding) {
      onBackToLanding();
    } else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleNavigatePrivacy = () => {
    if (onNavigate) {
      onNavigate("privacy");
    } else {
      window.history.pushState({}, "", "/privacy");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("bhanukadilshan2002@gmail.com").then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const matchesSearch = (text) => {
    if (!searchTerm.trim()) return true;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const pillars = [
    {
      id: "conduct",
      code: "TERMS-01",
      category: "conduct",
      title: "Permitted Use & Code of Conduct",
      icon: BookOpen,
      summary: "Academic participation is welcomed for educational growth; abusive or malicious actions are strictly prohibited.",
      items: [
        {
          label: "Permitted Activities",
          detail: "Accessing educational materials, registering for hackathons and seminars, applying for executive roles, and participating in society initiatives.",
        },
        {
          label: "User Responsibilities",
          detail: "Providing genuine student credentials, respecting peer participants, maintaining account security, and upholding University of Ruhuna student ethics.",
        },
        {
          label: "Prohibited Actions",
          detail: "Automated scraping, injecting malicious scripts, credential sharing, impersonating society officials, or disrupting live event registrations.",
        },
        {
          label: "Enforcement & Suspension",
          detail: "Violation of conduct terms may lead to immediate revocation of society membership and reporting to faculty authorities.",
        },
      ],
    },
    {
      id: "events",
      code: "TERMS-02",
      category: "events",
      title: "Membership, Events & Dynamic QR Passes",
      icon: QrCode,
      summary: "Rules governing event admission, rotating digital attendance tokens, and official letter requisitions.",
      items: [
        {
          label: "Registration & Capacity",
          detail: "Event registration secures seat allocation subject to venue and resource limits; inaccurate details may invalidate registration.",
        },
        {
          label: "Anti-Fraud Dynamic QR Passes",
          detail: "Attendance QR codes feature time-rotating signatures. Screenshots and shared links are voided by gate scanners to prevent proxy attendance.",
        },
        {
          label: "Official Certificates & Letters",
          detail: "Issuance of participation certificates and recommendation letters requires meeting minimum attendance thresholds validated in the system.",
        },
        {
          label: "Schedule Modifications",
          detail: "ADSS Ruhuna reserves the right to reschedule, change speakers, or modify session formats due to university academic calendar adjustments.",
        },
      ],
    },
    {
      id: "ip",
      code: "TERMS-03",
      category: "ip",
      title: "Intellectual Property & Educational License",
      icon: Award,
      summary: "Society branding, slide decks, and code repositories are provided freely for personal, non-commercial education.",
      items: [
        {
          label: "Protected Materials",
          detail: "ADSS Ruhuna logos, event graphics, curated workshop presentations, competition challenge datasets, and software codebase.",
        },
        {
          label: "Permitted Educational License",
          detail: "You may view, download, and study workshop materials for personal educational purposes with proper attribution.",
        },
        {
          label: "Commercial Prohibition",
          detail: "Reproduction, redistribution, or commercial sale of society assets without written consent from the executive board is strictly prohibited.",
        },
        {
          label: "Student Submissions",
          detail: "Hackathon project code and presentation materials submitted by participants remain their intellectual property, with a promotional showcase license to ADSS.",
        },
      ],
    },
    {
      id: "governance",
      code: "TERMS-04",
      category: "governance",
      title: "Governance, Disclaimers & Inquiries",
      icon: Scale,
      summary: "Legal jurisdiction, warranty disclaimers for voluntary student activities, and governing society contacts.",
      items: [
        {
          label: "Disclaimer of Warranty",
          detail: "All resources, tutorials, and events are organized on a voluntary student basis in good faith without commercial fitness warranties.",
        },
        {
          label: "Limitation of Liability",
          detail: "ADSS Ruhuna and the University of Ruhuna are not liable for incidental technical downtime, third-party link availability, or event date shifts.",
        },
        {
          label: "Governing Jurisdiction",
          detail: "These Terms are governed by the laws of the Democratic Socialist Republic of Sri Lanka and University of Ruhuna student council regulations.",
        },
        {
          label: "Amendments",
          detail: "Terms may be updated periodically to reflect revised society constitution bylaws; continued use signifies acceptance of updated terms.",
        },
      ],
    },
  ];

  const filteredPillars = pillars.filter((p) => {
    const categoryMatch = selectedCategory === "all" || p.category === selectedCategory;
    const textToSearch = `${p.title} ${p.summary} ${p.items.map((i) => `${i.label} ${i.detail}`).join(" ")}`;
    return categoryMatch && matchesSearch(textToSearch);
  });

  return (
    <div className="min-h-screen bg-[#08090a] text-[#d0d6e0] font-sans selection:bg-[#e4f222]/20 selection:text-[#ffffff] pb-20">
      {/* ── Print Styling ── */}
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: #ffffff !important; color: #000000 !important; }
          .linear-card { border: 1px solid #ddd !important; background: none !important; box-shadow: none !important; color: #000 !important; }
          .text-white { color: #000 !important; }
          .text-[#d0d6e0], .text-[#8a8f98] { color: #333 !important; }
        }
      `}</style>

      {/* ── Precision Top Navigation Bar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#08090a]/85 backdrop-blur-md border-b border-[#23252a] px-4 md:px-8 py-3 no-print">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Document ID */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={handleNavigateBack}
            title="Return to home"
          >
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#e4f222] font-berkeley-mono text-[11px] font-[510]">
              §
            </div>
            <div className="flex flex-col">
              <span className="font-[510] text-[#ffffff] text-[13px] group-hover:text-[#e4f222] transition-colors leading-tight">
                ADSS Ruhuna
              </span>
              <span className="font-berkeley-mono text-[10px] text-[#8a8f98]">
                DOC-ADSS-TERMS-V2
              </span>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-8 px-3 rounded-[6px] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#8a8f98] hover:text-[#ffffff] transition-colors font-berkeley-mono text-[11px] flex items-center gap-1.5 cursor-pointer"
              title="Copy link to clipboard"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#27a644]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3 rounded-[6px] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#8a8f98] hover:text-[#ffffff] transition-colors font-berkeley-mono text-[11px] hidden sm:flex items-center gap-1.5 cursor-pointer"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Acid-Lime Primary CTA */}
            <button
              type="button"
              onClick={handleNavigateBack}
              className="h-8 px-3.5 rounded-[6px] bg-[#e4f222] text-[#08090a] font-[510] text-[12px] hover:bg-[#d5e31f] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main Content Container ── */}
      <main className="max-w-5xl mx-auto px-4 md:px-8 pt-24 space-y-8">
        {/* ── Document Classification Header Banner ── */}
        <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[inset_0_0_0_1px_#23252a] p-6 sm:p-8 space-y-5">
          {/* Classification Tags */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252a] pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-berkeley-mono text-[10px] font-[510] text-[#8a8f98] uppercase bg-[#161718] border border-[#23252a] px-2 py-0.5 rounded-[4px]">
                OFFICIAL TERMS // GOVERNANCE
              </span>
              <span className="font-berkeley-mono text-[10px] font-[510] text-[#27a644] bg-[#27a644]/10 border border-[#27a644]/30 px-2 py-0.5 rounded-[4px] inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#27a644] animate-pulse" />
                ENFORCED BY ADSS COUNCIL
              </span>
              <span className="font-berkeley-mono text-[10px] text-[#62666d]">
                REV 2026.08
              </span>
            </div>

            <div className="font-berkeley-mono text-[11px] text-[#8a8f98]">
              Effective: <span className="text-[#ffffff]">August 2026</span>
            </div>
          </div>

          {/* Hero Title Block */}
          <div className="space-y-2">
            <h1 className="text-[28px] sm:text-[36px] font-[510] text-[#ffffff] tracking-[-0.022em] leading-tight">
              Terms of Service & Member Charter
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#8a8f98] leading-relaxed max-w-3xl">
              Binding operational standards, digital credential rules, and code of conduct for members, event participants, and website visitors of the{" "}
              <strong className="text-[#d0d6e0] font-[510]">
                Actuarial & Data Science Society (ADSS)
              </strong>
              , Faculty of Science, University of Ruhuna.
            </p>
          </div>

          {/* Interactive Search & Quick Filter Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f98]" />
              <input
                type="text"
                placeholder="Search terms, QR pass rules, or conduct guidelines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#161718] border border-[#23252a] focus:border-[#d0d6e0] rounded-[6px] pl-9 pr-8 py-2 text-[12.5px] text-[#ffffff] placeholder-[#62666d] outline-none transition-colors font-sans"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8f98] hover:text-[#ffffff] text-[11px] font-berkeley-mono"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Segment Filter Pills */}
            <div className="flex items-center gap-1 bg-[#161718] p-1 rounded-[6px] border border-[#23252a] overflow-x-auto">
              {[
                { id: "all", label: "All" },
                { id: "conduct", label: "Conduct" },
                { id: "events", label: "Events & Pass" },
                { id: "ip", label: "IP & Assets" },
                { id: "governance", label: "Governance" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono text-[10.5px] whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === tab.id
                      ? "bg-[#08090a] text-[#ffffff] border border-[#383b3f]"
                      : "text-[#8a8f98] hover:text-[#ffffff]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Student Charter Matrix (4 Core Ground Rules) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#27a644]">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Academic Integrity</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                All participant engagement must reflect University of Ruhuna student ethics and mutual respect.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#02b8cc]">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Anti-Fraud QR Passes</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Dynamic QR credentials are non-transferable and verified live at gate scanners.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#6366f1]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Platform Security</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Zero tolerance for credential sharing, automated scraping, or unauthorized access attempts.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#e4f222]">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Educational Licensing</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Society slide decks and resources are strictly for non-commercial personal learning.
              </p>
            </div>
          </div>
        </div>

        {/* ── The 4 Shortened Policy Pillars ── */}
        <div className="space-y-4">
          {filteredPillars.length === 0 ? (
            <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] p-10 text-center font-berkeley-mono text-[12px] text-[#8a8f98] space-y-2">
              <Search className="w-6 h-6 mx-auto text-[#62666d]" />
              <p>No terms clauses match "{searchTerm}".</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                className="text-[#e4f222] hover:underline"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filteredPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <section
                  key={pillar.id}
                  id={pillar.id}
                  className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[inset_0_0_0_1px_#23252a] p-6 sm:p-7 space-y-4"
                >
                  {/* Pillar Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#23252a] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#d0d6e0] flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-berkeley-mono text-[10.5px] text-[#e4f222]">
                            {pillar.code}
                          </span>
                          <h2 className="text-[16px] sm:text-[18px] font-[510] text-[#ffffff] tracking-[-0.012em]">
                            {pillar.title}
                          </h2>
                        </div>
                        <p className="text-[12px] text-[#8a8f98] mt-0.5">
                          {pillar.summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pillar Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {pillar.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3.5 space-y-1"
                      >
                        <h3 className="text-[12.5px] font-[510] text-[#ffffff] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#383b3f]" />
                          {item.label}
                        </h3>
                        <p className="text-[11.5px] text-[#8a8f98] leading-relaxed pl-3">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* ── Privacy Policy Bridge & Official Governing Council ── */}
        <section className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[inset_0_0_0_1px_#23252a] p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#23252a] pb-4">
            <div>
              <span className="font-berkeley-mono text-[10px] text-[#8a8f98] uppercase">
                GOVERNING COUNCIL & INQUIRIES
              </span>
              <h3 className="text-[16px] font-[510] text-[#ffffff] mt-0.5">
                Actuarial & Data Science Society (ADSS)
              </h3>
              <p className="text-[12px] text-[#8a8f98]">
                Faculty of Science, University of Ruhuna, Matara, Sri Lanka
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Privacy Policy Link */}
              <button
                type="button"
                onClick={handleNavigatePrivacy}
                className="h-8 px-3 rounded-[6px] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#818cf8] hover:text-[#ffffff] font-berkeley-mono text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View Privacy Policy"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Privacy Policy</span>
              </button>

              <a
                href="https://www.math.ruh.ac.lk/adss/"
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-[6px] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#d0d6e0] hover:text-[#ffffff] font-berkeley-mono text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#02b8cc]" />
                <span>math.ruh.ac.lk/adss</span>
                <ExternalLink className="w-3 h-3 text-[#62666d]" />
              </a>

              <div className="flex items-center bg-[#161718] border border-[#23252a] rounded-[6px] overflow-hidden">
                <a
                  href="mailto:bhanukadilshan2002@gmail.com"
                  className="h-8 px-3 text-[#d0d6e0] hover:text-[#ffffff] font-berkeley-mono text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#e4f222]" />
                  <span>bhanukadilshan2002@gmail.com</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="h-8 px-2.5 border-l border-[#23252a] hover:bg-[#23252a] text-[#8a8f98] hover:text-[#ffffff] transition-colors flex items-center justify-center cursor-pointer"
                  title="Copy email address"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-[#27a644]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-berkeley-mono text-[#62666d]">
            <div>
              Legal Authority: <span className="text-[#8a8f98]">University of Ruhuna Student Society Charter</span>
            </div>
            <div>
              Last Revised: <span className="text-[#8a8f98]">August 2026</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
