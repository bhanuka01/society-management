import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import PhoneContact from "./PhoneContact";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  GraduationCap,
  FileText,
  Share2,
  MessageSquare,
  ShieldCheck,
  Sparkles
} from "lucide-react";

export default function StudentProfileModal({ stId, onClose }) {
  const [profileTarget, setProfileTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "attendance" | "oc" | "letters"
  const [copiedField, setCopiedField] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1800);
    });
  };

  const copyDossierSummary = () => {
    if (!profileTarget) return;
    const issuedLettersCount = profileTarget.letters?.filter((l) => l.status === "done" || l.status === "completed").length || 0;
    const totalLettersCount = profileTarget.letters?.length || 0;
    const summary = `STUDENT DOSSIER: ${profileTarget.preferred_name || profileTarget.name}
ID: ${profileTarget.st_id}
Full Name: ${profileTarget.name || "—"}
Calling Name: ${profileTarget.preferred_name || "—"}
Academic Level: Year ${profileTarget.level || "—"}
Society Position: ${profileTarget.st_position || "General Member"}
Function: ${profileTarget.member_function || "Unassigned"}
Email: ${profileTarget.email || "—"}
Phone: ${profileTarget.mobile_number || "—"}
Attendance Rate: ${attendancePct}% (${yesAttCount}/${totalAttCount} events)
OC Positions: ${profileTarget.oc?.length || 0}
Letter Requests: ${totalLettersCount} (${issuedLettersCount} Issued)
LinkedIn: ${profileTarget.linkedin_url || "None"}`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  };

  useEffect(() => {
    if (!stId) return;
    let isMounted = true;

    // Keyboard ESC to close modal
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const loadProfile = async () => {
      setLoading(true);
      try {
        const cleanId = typeof stId === "string" ? stId.trim() : String(stId);

        // 1. Fetch Member info
        const { data: member, error: memberErr } = await supabase
          .from("members")
          .select("*")
          .eq("st_id", cleanId)
          .maybeSingle();

        if (memberErr) throw memberErr;
        if (!member) {
          alert(`Student profile not found for ID: ${cleanId}`);
          onClose?.();
          return;
        }

        const canonicalStId = member.st_id || cleanId;

        // 2. Fetch OC assignments
        const { data: ocRecords, error: ocErr } = await supabase
          .from("oc")
          .select("oc_position, apply_status, events(name, date), functions(function_name)")
          .eq("st_id", canonicalStId);
        if (ocErr) throw ocErr;

        // 3. Fetch Attendance history
        const { data: attRecords, error: attErr } = await supabase
          .from("attendance")
          .select("attend, events(name, date)")
          .eq("st_id", canonicalStId);
        if (attErr) throw attErr;

        // 4. Fetch Letter requests
        const { data: letterRecords, error: letterErr } = await supabase
          .from("letter_requests")
          .select("id, st_id, name_on_letter, selected_events, additional_details, status, created_at")
          .eq("st_id", canonicalStId)
          .order("created_at", { ascending: false });
        // Don't fail entire modal if letters fail
        if (letterErr) console.warn("Could not fetch letter requests:", letterErr);

        if (isMounted) {
          setProfileTarget({
            ...member,
            oc: ocRecords || [],
            attendance: attRecords || [],
            letters: letterRecords || [],
          });
        }
      } catch (err) {
        if (isMounted) {
          alert("Error loading profile: " + err.message);
          onClose?.();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stId, onClose]);

  if (!stId) return null;

  // Compute telemetry metrics
  const totalAttCount = profileTarget?.attendance?.length || 0;
  const yesAttCount = profileTarget?.attendance?.filter((a) => a.attend === "YES").length || 0;
  const attendancePct = totalAttCount > 0 ? Math.round((yesAttCount / totalAttCount) * 100) : 0;
  const acceptedOcCount = profileTarget?.oc?.filter((o) => o.apply_status === "Accept").length || 0;
  const issuedLettersCount = profileTarget?.letters?.filter((l) => l.status === "done" || l.status === "completed").length || 0;

  // Clean WhatsApp number
  const cleanPhone = (profileTarget?.mobile_number || "").replace(/\D/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("0") ? "94" + cleanPhone.substring(1) : cleanPhone}`
    : null;

  const linkedinLink = profileTarget?.linkedin_url
    ? profileTarget.linkedin_url.trim().toLowerCase().startsWith("http")
      ? profileTarget.linkedin_url.trim()
      : `https://${profileTarget.linkedin_url.trim()}`
    : null;

  const getInitials = (n) => {
    if (!n) return "S";
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-[#08090a]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#0f1011] border border-[#23252a] rounded-[12px] shadow-[0_24px_48px_rgba(0,0,0,0.8),inset_0_0_0_1px_#23252a] w-full max-w-[680px] max-h-[92vh] flex flex-col overflow-hidden text-[#d0d6e0] my-auto">
        {/* ── Top Bar / Header ── */}
        <div className="px-5 py-3.5 border-b border-[#23252a] bg-[#08090a]/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-berkeley-mono text-[10px] tracking-wider text-[#8a8f98] uppercase bg-[#161718] border border-[#23252a] px-2 py-0.5 rounded-[4px] font-[510]">
              STUDENT DOSSIER
            </span>
            {profileTarget && (
              <span className="font-berkeley-mono text-[11px] text-[#62666d] truncate">
                {profileTarget.st_id}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {profileTarget && (
              <button
                type="button"
                onClick={copyDossierSummary}
                className="h-7 px-2.5 rounded-[6px] bg-[#161718] border border-[#23252a] text-[#8a8f98] hover:text-[#ffffff] hover:border-[#383b3f] transition-colors font-berkeley-mono text-[11px] flex items-center gap-1.5"
                title="Copy dossier summary to clipboard"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3 h-3 text-[#27a644]" />
                    <span className="text-[#27a644]">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3 h-3" />
                    <span>Share</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] text-[#8a8f98] hover:text-[#ffffff] hover:border-[#383b3f] transition-colors flex items-center justify-center text-[13px]"
              title="Close (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body Content ── */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1 custom-scrollbar">
          {loading || !profileTarget ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#e4f222] border-t-transparent rounded-full animate-spin" />
              <p className="font-berkeley-mono text-[12px] text-[#8a8f98]">
                Retrieving student dossier telemetry...
              </p>
            </div>
          ) : (
            <>
              {/* ── Profile Hero Header ── */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-[#161718]/40 border border-[#23252a] rounded-[10px] p-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {profileTarget.profile_image_url ? (
                    <img
                      src={profileTarget.profile_image_url}
                      alt={profileTarget.preferred_name || profileTarget.name}
                      className="w-20 h-20 rounded-[10px] object-cover border border-[#23252a] shadow-sm bg-[#161718]"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://api.dicebear.com/7.x/initials/svg?seed=" +
                          encodeURIComponent(profileTarget.preferred_name || profileTarget.name);
                      }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-[10px] bg-[#161718] border border-[#23252a] flex items-center justify-center font-berkeley-mono text-[24px] font-[510] text-[#d0d6e0]">
                      {getInitials(profileTarget.preferred_name || profileTarget.name)}
                    </div>
                  )}

                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0f1011] ${
                      profileTarget.status === "active" || profileTarget.status === "approved" || !profileTarget.status
                        ? "bg-[#27a644]"
                        : "bg-[#f59e0b]"
                    }`}
                    title={profileTarget.status || "Active"}
                  />
                </div>

                {/* Main Identification */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    {/* Calling / Preferred Name */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h1 className="text-[20px] sm:text-[22px] font-[510] text-[#ffffff] tracking-[-0.022em] leading-tight">
                        {profileTarget.preferred_name || profileTarget.name}
                      </h1>
                      {profileTarget.preferred_name && (
                        <span className="font-berkeley-mono text-[10.5px] text-[#8a8f98] bg-[#161718] border border-[#23252a] px-1.5 py-0.5 rounded-[3px]">
                          Calling Name
                        </span>
                      )}
                    </div>

                    {/* Legal Full Name */}
                    {profileTarget.preferred_name && profileTarget.name && (
                      <div className="text-[12.5px] text-[#8a8f98] mt-0.5 font-[400] truncate">
                        Full Name: <span className="text-[#d0d6e0] font-[510]">{profileTarget.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Identification Pill & Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {/* ST ID with copy */}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(profileTarget.st_id, "st_id")}
                      className="font-berkeley-mono text-[11px] text-[#d0d6e0] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] px-2 py-0.5 rounded-[4px] inline-flex items-center gap-1.5 transition-colors group/copy"
                      title="Click to copy Student ID"
                    >
                      <span>{profileTarget.st_id}</span>
                      {copiedField === "st_id" ? (
                        <Check className="w-3 h-3 text-[#27a644]" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#62666d] group-hover/copy:text-white transition-colors" />
                      )}
                    </button>

                    {/* Academic Level */}
                    {profileTarget.level ? (
                      <span
                        className={`font-berkeley-mono text-[10.5px] px-2 py-0.5 rounded-[4px] border uppercase ${
                          profileTarget.level > 4
                            ? "bg-[#161718] text-[#8a8f98] border-[#23252a]"
                            : "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/30"
                        }`}
                      >
                        {profileTarget.level > 4 ? "ALUMNI" : `YEAR ${profileTarget.level}`}
                      </span>
                    ) : null}

                    {/* Society Position */}
                    {profileTarget.st_position && (
                      <span className="font-berkeley-mono text-[10.5px] px-2 py-0.5 rounded-[4px] bg-[#e4f222]/10 text-[#e4f222] border border-[#e4f222]/30">
                        {profileTarget.st_position}
                      </span>
                    )}

                    {/* Function */}
                    {profileTarget.member_function && (
                      <span className="font-berkeley-mono text-[10.5px] px-2 py-0.5 rounded-[4px] bg-[#161718] text-[#d0d6e0] border border-[#23252a]">
                        {profileTarget.member_function}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Fast Telemetry / Stat Chips Strip (4 metrics) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-berkeley-mono text-[11px]">
                <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-2.5 space-y-1">
                  <span className="text-[#62666d] text-[10px] uppercase block">Attendance Rate</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-[510] text-[#ffffff]">{attendancePct}%</span>
                    <span className="text-[#8a8f98] text-[10px]">{yesAttCount}/{totalAttCount}</span>
                  </div>
                  <div className="w-full bg-[#08090a] h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-[#27a644] h-full rounded-full transition-all duration-300"
                      style={{ width: `${attendancePct}%` }}
                    />
                  </div>
                </div>

                <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-2.5 space-y-1">
                  <span className="text-[#62666d] text-[10px] uppercase block">OC Engagements</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-[510] text-[#ffffff]">
                      {profileTarget.oc?.length || 0}
                    </span>
                    <span className="text-[#8a8f98] text-[10px]">{acceptedOcCount} Accepted</span>
                  </div>
                  <div className="text-[10px] text-[#8a8f98] truncate">
                    {profileTarget.oc?.length > 0 ? "Active committee" : "No assignments"}
                  </div>
                </div>

                <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-2.5 space-y-1">
                  <span className="text-[#62666d] text-[10px] uppercase block">Letter Requests</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-[510] text-[#ffffff]">
                      {profileTarget.letters?.length || 0}
                    </span>
                    <span className="text-[#8a8f98] text-[10px]">
                      {issuedLettersCount} Issued
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8a8f98] truncate">
                    {profileTarget.letters?.length > 0 ? "Dossier logged" : "No requests"}
                  </div>
                </div>

                <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-2.5 space-y-1">
                  <span className="text-[#62666d] text-[10px] uppercase block">Membership</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-[510] text-[#ffffff] uppercase truncate">
                      {profileTarget.role || "Member"}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#27a644] truncate">
                    ✓ Verified Profile
                  </div>
                </div>
              </div>

              {/* ── Quick Contact & Comms Action Strip ── */}
              <div className="flex items-center gap-2 flex-wrap bg-[#161718]/40 border border-[#23252a] p-2 rounded-[8px]">
                {/* Email Action */}
                {profileTarget.email ? (
                  <div className="flex items-center gap-1 bg-[#161718] border border-[#23252a] rounded-[6px] px-2.5 py-1">
                    <Mail className="w-3.5 h-3.5 text-[#8a8f98]" />
                    <a
                      href={`mailto:${profileTarget.email}`}
                      className="text-[11.5px] text-[#d0d6e0] hover:text-[#ffffff] transition-colors truncate max-w-[170px]"
                      title={`Send email to ${profileTarget.email}`}
                    >
                      {profileTarget.email}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(profileTarget.email, "email")}
                      className="p-1 text-[#62666d] hover:text-[#ffffff] rounded transition-colors ml-1"
                      title="Copy Email"
                    >
                      {copiedField === "email" ? (
                        <Check className="w-3 h-3 text-[#27a644]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-berkeley-mono text-[#62666d] px-2">No email provided</span>
                )}

                {/* Phone / WhatsApp Action */}
                {profileTarget.mobile_number ? (
                  <div className="flex items-center gap-1 bg-[#161718] border border-[#23252a] rounded-[6px] px-2.5 py-1 font-berkeley-mono text-[11px]">
                    <Phone className="w-3.5 h-3.5 text-[#8a8f98]" />
                    <PhoneContact phone={profileTarget.mobile_number} />
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-[10px] text-[#27a644] hover:underline flex items-center gap-0.5"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WA</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-berkeley-mono text-[#62666d] px-2">No phone provided</span>
                )}

                {/* LinkedIn Action */}
                {linkedinLink && (
                  <a
                    href={linkedinLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#818cf8] px-2.5 py-1 rounded-[6px] font-berkeley-mono text-[11px] transition-colors ml-auto"
                    title="Open LinkedIn in new tab"
                  >
                    <span>LinkedIn Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* ── Segmented Navigation Tabs ── */}
              <div className="border-b border-[#23252a] flex items-center gap-1 font-berkeley-mono text-[11.5px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`pb-2 px-3 transition-colors border-b-2 font-[510] flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "overview"
                      ? "border-[#e4f222] text-[#ffffff]"
                      : "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Dossier Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className={`pb-2 px-3 transition-colors border-b-2 font-[510] flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "attendance"
                      ? "border-[#e4f222] text-[#ffffff]"
                      : "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Attendance Record</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#161718] border border-[#23252a] text-[#8a8f98]">
                    {profileTarget.attendance?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("oc")}
                  className={`pb-2 px-3 transition-colors border-b-2 font-[510] flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "oc"
                      ? "border-[#e4f222] text-[#ffffff]"
                      : "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Committee (OC)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#161718] border border-[#23252a] text-[#8a8f98]">
                    {profileTarget.oc?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("letters")}
                  className={`pb-2 px-3 transition-colors border-b-2 font-[510] flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === "letters"
                      ? "border-[#e4f222] text-[#ffffff]"
                      : "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Letters</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#161718] border border-[#23252a] text-[#8a8f98]">
                    {profileTarget.letters?.length || 0}
                  </span>
                </button>
              </div>

              {/* ── Tab Panels ── */}
              <div>
                {/* 1. Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-3 font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Full Legal Name
                        </span>
                        <div className="text-[13px] font-[510] text-[#ffffff]">
                          {profileTarget.name || "—"}
                        </div>
                      </div>

                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Preferred Calling Name
                        </span>
                        <div className="text-[13px] font-[510] text-[#e4f222]">
                          {profileTarget.preferred_name || <span className="text-[#62666d] italic">Not provided</span>}
                        </div>
                      </div>

                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Functional Division
                        </span>
                        <div className="text-[13px] font-[510] text-[#ffffff]">
                          {profileTarget.member_function || <span className="text-[#62666d]">General Pool</span>}
                        </div>
                      </div>

                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Society Position / Rank
                        </span>
                        <div className="text-[13px] font-[510] text-[#ffffff]">
                          {profileTarget.st_position || "Active Society Member"}
                        </div>
                      </div>

                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Academic Standing
                        </span>
                        <div className="text-[13px] font-[510] text-[#ffffff]">
                          {profileTarget.level ? `Undergraduate Year ${profileTarget.level}` : "Undergraduate"}
                        </div>
                      </div>

                      <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 space-y-1">
                        <span className="font-berkeley-mono text-[10px] text-[#62666d] uppercase">
                          Profile Registration Date
                        </span>
                        <div className="font-berkeley-mono text-[12px] text-[#8a8f98]">
                          {profileTarget.created_at
                            ? new Date(profileTarget.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Legacy Database Record"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Attendance Record Tab */}
                {activeTab === "attendance" && (
                  <div className="space-y-3">
                    {profileTarget.attendance.length === 0 ? (
                      <div className="py-10 text-center bg-[#161718] border border-[#23252a] rounded-[8px] font-berkeley-mono text-[12px] text-[#8a8f98] space-y-1">
                        <Calendar className="w-5 h-5 mx-auto text-[#62666d]" />
                        <p>No event attendance records on file for this student.</p>
                      </div>
                    ) : (
                      <div className="border border-[#23252a] rounded-[8px] overflow-hidden bg-[#161718]/30">
                        <div className="max-h-[260px] overflow-y-auto">
                          <table className="w-full text-left font-sans text-[12.5px]">
                            <thead className="sticky top-0 bg-[#161718] border-b border-[#23252a] font-berkeley-mono text-[10px] uppercase text-[#8a8f98]">
                              <tr>
                                <th className="py-2 px-3 font-[510]">Event Name</th>
                                <th className="py-2 px-3 font-[510]">Event Date</th>
                                <th className="py-2 px-3 font-[510] text-right">Attendance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#23252a]">
                              {profileTarget.attendance.map((att, idx) => (
                                <tr key={idx} className="hover:bg-[#161718]/60 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-[510] text-[#ffffff] block">
                                      {att.events?.name || "Official Society Session"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-berkeley-mono text-[11px] text-[#8a8f98]">
                                    {att.events?.date || "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <span
                                      className={`font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] border uppercase inline-flex items-center gap-1 ${
                                        att.attend === "YES"
                                          ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                                          : "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                                      }`}
                                    >
                                      {att.attend === "YES" ? (
                                        <>
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                          <span>Attended</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-2.5 h-2.5" />
                                          <span>Absent</span>
                                        </>
                                      )}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Organizing Committee (OC) Tab */}
                {activeTab === "oc" && (
                  <div className="space-y-3">
                    {profileTarget.oc.length === 0 ? (
                      <div className="py-10 text-center bg-[#161718] border border-[#23252a] rounded-[8px] font-berkeley-mono text-[12px] text-[#8a8f98] space-y-1">
                        <Briefcase className="w-5 h-5 mx-auto text-[#62666d]" />
                        <p>No organizing committee appointments logged for this student.</p>
                      </div>
                    ) : (
                      <div className="border border-[#23252a] rounded-[8px] overflow-hidden bg-[#161718]/30">
                        <div className="max-h-[260px] overflow-y-auto">
                          <table className="w-full text-left font-sans text-[12.5px]">
                            <thead className="sticky top-0 bg-[#161718] border-b border-[#23252a] font-berkeley-mono text-[10px] uppercase text-[#8a8f98]">
                              <tr>
                                <th className="py-2 px-3 font-[510]">Event & Team</th>
                                <th className="py-2 px-3 font-[510]">Assigned Role(s)</th>
                                <th className="py-2 px-3 font-[510] text-right">Selection Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#23252a]">
                              {profileTarget.oc.map((o, idx) => (
                                <tr key={idx} className="hover:bg-[#161718]/60 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-[510] text-[#ffffff] block">
                                      {o.events?.name || "Official Event"}
                                    </span>
                                    <span className="font-berkeley-mono text-[10.5px] text-[#818cf8]">
                                      {o.functions?.function_name || "General Committee"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex flex-wrap gap-1">
                                      {o.oc_position ? (
                                        o.oc_position.split(",").map((pos, pIdx) => (
                                          <span
                                            key={pIdx}
                                            className="font-berkeley-mono text-[10.5px] px-2 py-0.5 rounded-[4px] bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/30"
                                          >
                                            {pos.trim()}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="font-berkeley-mono text-[10.5px] px-2 py-0.5 rounded-[4px] bg-[#161718] text-[#8a8f98] border border-[#23252a]">
                                          Committee Member
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {o.apply_status === "Accept" ? (
                                      <span className="font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[#27a644]/10 text-[#27a644] border border-[#27a644]/30 uppercase inline-flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Accepted
                                      </span>
                                    ) : o.apply_status === "Reject" ? (
                                      <span className="font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[#eb5757]/10 text-[#eb5757] border border-[#eb5757]/30 uppercase inline-flex items-center gap-1">
                                        <X className="w-2.5 h-2.5" /> Rejected
                                      </span>
                                    ) : o.apply_status === "Interview Scheduled" ? (
                                      <span className="font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[#02b8cc]/10 text-[#02b8cc] border border-[#02b8cc]/30 uppercase inline-flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> Interview
                                      </span>
                                    ) : (
                                      <span className="font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 uppercase inline-flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Letter Requests Tab */}
                {activeTab === "letters" && (
                  <div className="space-y-3">
                    {profileTarget.letters.length === 0 ? (
                      <div className="py-10 text-center bg-[#161718] border border-[#23252a] rounded-[8px] font-berkeley-mono text-[12px] text-[#8a8f98] space-y-1">
                        <Award className="w-5 h-5 mx-auto text-[#62666d]" />
                        <p>No letter requests or issued certificates found for this student.</p>
                      </div>
                    ) : (
                      <div className="border border-[#23252a] rounded-[8px] overflow-hidden bg-[#161718]/30">
                        <div className="max-h-[260px] overflow-y-auto">
                          <table className="w-full text-left font-sans text-[12.5px]">
                            <thead className="sticky top-0 bg-[#161718] border-b border-[#23252a] font-berkeley-mono text-[10px] uppercase text-[#8a8f98]">
                              <tr>
                                <th className="py-2 px-3 font-[510]">Document & Events</th>
                                <th className="py-2 px-3 font-[510]">Submitted</th>
                                <th className="py-2 px-3 font-[510] text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#23252a]">
                              {profileTarget.letters.map((l) => (
                                <tr key={l.id} className="hover:bg-[#161718]/60 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-[510] text-[#ffffff]">
                                        Appreciation Letter
                                      </span>
                                      {l.name_on_letter && (
                                        <span className="font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#161718] text-[#8a8f98] border border-[#23252a]">
                                          Name: {l.name_on_letter}
                                        </span>
                                      )}
                                    </div>
                                    {l.selected_events && Array.isArray(l.selected_events) && l.selected_events.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {l.selected_events.map((ev, eIdx) => (
                                          <span
                                            key={eIdx}
                                            className="font-berkeley-mono text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/30"
                                          >
                                            {ev}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {l.additional_details && (
                                      <p className="text-[11px] text-[#8a8f98] mt-1 line-clamp-2">
                                        {l.additional_details}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-berkeley-mono text-[11px] text-[#8a8f98] whitespace-nowrap align-top">
                                    {l.created_at
                                      ? new Date(l.created_at).toLocaleDateString()
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap align-top">
                                    <span
                                      className={`font-berkeley-mono text-[10px] px-2 py-0.5 rounded-[4px] border uppercase inline-flex items-center gap-1 ${
                                        l.status === "done" || l.status === "completed"
                                          ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                                          : l.status === "inprogress"
                                          ? "bg-[#818cf8]/10 text-[#818cf8] border-[#818cf8]/30"
                                          : l.status === "rejected"
                                          ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                                          : "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30"
                                      }`}
                                    >
                                      {l.status === "done" || l.status === "completed" ? (
                                        <>
                                          <CheckCircle2 className="w-2.5 h-2.5 text-[#27a644]" />
                                          <span>Issued</span>
                                        </>
                                      ) : l.status === "inprogress" ? (
                                        <>
                                          <Clock className="w-2.5 h-2.5 text-[#818cf8]" />
                                          <span>In Progress</span>
                                        </>
                                      ) : l.status === "rejected" ? (
                                        <>
                                          <XCircle className="w-2.5 h-2.5 text-[#eb5757]" />
                                          <span>Rejected</span>
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="w-2.5 h-2.5 text-[#f59e0b]" />
                                          <span>Pending</span>
                                        </>
                                      )}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer / Linear Actions Bar ── */}
        <div className="px-5 py-3.5 border-t border-[#23252a] bg-[#08090a]/50 flex items-center justify-between gap-3">
          <div className="font-berkeley-mono text-[11px] text-[#62666d] hidden sm:block">
            Press <kbd className="bg-[#161718] border border-[#23252a] px-1 py-0.5 rounded text-[#8a8f98]">ESC</kbd> to exit
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={copyDossierSummary}
              className="h-8 px-3.5 rounded-[6px] bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-[#d0d6e0] hover:text-[#ffffff] font-berkeley-mono text-[11.5px] transition-colors flex items-center gap-1.5"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#27a644]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? "Copied" : "Copy Summary"}</span>
            </button>

            {/* Sole chromatic CTA button: Acid Lime (#e4f222) */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-[6px] bg-[#e4f222] text-[#08090a] font-[510] text-[12.5px] hover:bg-[#d5e31f] transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
            >
              <span>Close Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
