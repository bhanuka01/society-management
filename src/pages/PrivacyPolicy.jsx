import { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  Share2,
  Printer,
  ArrowLeft,
  Search,
  Check,
  Mail,
  Globe,
  ExternalLink,
  Server,
  UserCheck,
  Trash2,
  Copy
} from "lucide-react";

export default function PrivacyPolicy({ onBackToLanding, onNavigate }) {
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
      id: "collection",
      code: "SEC-01",
      category: "collection",
      title: "Data Ingestion (What We Collect)",
      icon: Eye,
      summary: "Minimal academic identity and technical telemetry collected exclusively for society operations.",
      items: [
        {
          label: "Member Identity",
          detail: "Full Name, Preferred Calling Name, Student ID (Index No.), University Email, Mobile/WhatsApp number, Academic Year (Level 1–4), and Society Functional Division.",
        },
        {
          label: "Event Telemetry",
          detail: "Event attendance timestamps, dynamic QR verification records, and Organizing Committee (OC) applications.",
        },
        {
          label: "System Security",
          detail: "Session authentication tokens and browser headers strictly for rate limiting, account verification, and fraud prevention.",
        },
      ],
    },
    {
      id: "usage",
      code: "SEC-02",
      category: "usage",
      title: "Processing & Purpose (How We Use It)",
      icon: Server,
      summary: "Data processing is strictly bound to academic management, event execution, and society administration.",
      items: [
        {
          label: "Credential Verification",
          detail: "Validating student enrollment and generating digital membership identity cards for gate scanners.",
        },
        {
          label: "Event & OC Operations",
          detail: "Coordinating workshops, hackathons, seminars, committee appointments, and volunteer assignments.",
        },
        {
          label: "Certificates & Letters",
          detail: "Issuing verifiable participation certificates, recommendation letters, and activity endorsements.",
        },
        {
          label: "Essential Announcements",
          detail: "Delivering important society notices, schedule shifts, and election announcements.",
        },
      ],
    },
    {
      id: "protection",
      code: "SEC-03",
      category: "protection",
      title: "Protection & Zero-Commercialization Guarantee",
      icon: Lock,
      summary: "We enforce strict confidentiality. Student data is never commercialized, sold, or shared with advertisers.",
      items: [
        {
          label: "Zero Data Brokerage",
          detail: "ADSS Ruhuna does NOT sell, rent, lease, or monetize personal information under any circumstance.",
        },
        {
          label: "Role-Based Access Control",
          detail: "Access to member rosters is strictly gated to authorized executive board members and system administrators.",
        },
        {
          label: "Infrastructure Security",
          detail: "Protected by modern TLS encryption in transit and secure database rules on Supabase cloud infrastructure.",
        },
        {
          label: "Automated Retention",
          detail: "Records are retained only for active academic tenure and certificate verification; obsolete datasets are purged.",
        },
      ],
    },
    {
      id: "rights",
      code: "SEC-04",
      category: "rights",
      title: "Student Rights & Governance",
      icon: UserCheck,
      summary: "Full transparency and autonomy over your personal information at all times.",
      items: [
        {
          label: "Right to Inspect & Export",
          detail: "Review your complete profile dossier, event history, and OC records at any time via My Info or admin request.",
        },
        {
          label: "Right to Rectification",
          detail: "Instantly update inaccurate contact details, photos, or preferred names through your member dashboard.",
        },
        {
          label: "Right to Erasure",
          detail: "Request deletion of your member account and non-essential records upon departure or graduation.",
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
                DOC-ADSS-PRIVACY-V2
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

      {/* ── Main Layout ── */}
      <main className="max-w-5xl mx-auto px-4 md:px-8 pt-24 space-y-8">
        {/* ── Document Classification Header Banner ── */}
        <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[inset_0_0_0_1px_#23252a] p-6 sm:p-8 space-y-5">
          {/* Classification Tags */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252a] pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-berkeley-mono text-[10px] font-[510] text-[#8a8f98] uppercase bg-[#161718] border border-[#23252a] px-2 py-0.5 rounded-[4px]">
                OFFICIAL POLICY // PRIVACY
              </span>
              <span className="font-berkeley-mono text-[10px] font-[510] text-[#27a644] bg-[#27a644]/10 border border-[#27a644]/30 px-2 py-0.5 rounded-[4px] inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#27a644] animate-pulse" />
                ACTIVE & ENFORCED
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
              Privacy Policy & Data Governance
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#8a8f98] leading-relaxed max-w-3xl">
              Official data protection commitments for the{" "}
              <strong className="text-[#d0d6e0] font-[510]">
                Actuarial & Data Science Society (ADSS)
              </strong>
              , Faculty of Science, University of Ruhuna. Built to safeguard student records with zero commercial monetization.
            </p>
          </div>

          {/* Interactive Search & Quick Filter Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f98]" />
              <input
                type="text"
                placeholder="Search policy clauses, telemetry, or rights..."
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
                { id: "collection", label: "Collection" },
                { id: "usage", label: "Purpose" },
                { id: "protection", label: "Protection" },
                { id: "rights", label: "Rights" },
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

        {/* ── Rapid Guarantee Matrix (4 Compact Core Commitments) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#27a644]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Zero Commercialization</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                We never sell, rent, or monetize student records to advertisers or third-party brokers.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#02b8cc]">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Academic Scope Only</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Data usage is bounded to memberships, event attendance, and official certificate issuance.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#6366f1]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Role-Gated Security</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Strict database access control restricted to authorized society officers and administrators.
              </p>
            </div>
          </div>

          <div className="bg-[#0f1011] border border-[#23252a] rounded-[10px] p-4 space-y-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center text-[#e4f222]">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[13px] font-[510] text-[#ffffff]">Total Student Control</h4>
              <p className="text-[11.5px] text-[#8a8f98] leading-relaxed mt-0.5">
                Inspect, update, or request immediate deletion of your records anytime with ease.
              </p>
            </div>
          </div>
        </div>

        {/* ── The 4 Shortened Policy Pillars ── */}
        <div className="space-y-4">
          {filteredPillars.length === 0 ? (
            <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] p-10 text-center font-berkeley-mono text-[12px] text-[#8a8f98] space-y-2">
              <Search className="w-6 h-6 mx-auto text-[#62666d]" />
              <p>No policy clauses match "{searchTerm}".</p>
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

        {/* ── Official Controller & Direct Contact Box ── */}
        <section className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[inset_0_0_0_1px_#23252a] p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#23252a] pb-4">
            <div>
              <span className="font-berkeley-mono text-[10px] text-[#8a8f98] uppercase">
                DATA CONTROLLER & INQUIRIES
              </span>
              <h3 className="text-[16px] font-[510] text-[#ffffff] mt-0.5">
                Actuarial & Data Science Society (ADSS)
              </h3>
              <p className="text-[12px] text-[#8a8f98]">
                Faculty of Science, University of Ruhuna, Matara, Sri Lanka
              </p>
            </div>

            {/* Quick Contact Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
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
              Status: <span className="text-[#8a8f98]">Student Body Data Protection Protocol</span>
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
