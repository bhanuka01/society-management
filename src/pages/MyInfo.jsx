import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { invalidateCache, CACHE_KEYS } from "../lib/queryCache";
import { resizeImage } from "../utils/imageOptimizer";
import PhoneContact from "../components/PhoneContact";
import MinimalFooter from "../components/MinimalFooter";
import { useStudentProfile } from "../components/StudentProfileContext";
import { 
  User, 
  Edit3, 
  FileText, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Briefcase, 
  Clock, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Upload,
  Video,
  Check,
  Copy,
  QrCode,
  ShieldCheck
} from "lucide-react";

export default function MyInfo({ session, theme }) {
  const { openStudentProfile } = useStudentProfile();
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || 
             (document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      const isDocDark = document.documentElement.classList.contains("dark") || 
                        document.documentElement.getAttribute("data-theme") === "dark";
      setCurrentTheme(isDocDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme === "dark";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    preferred_name: "",
    profile_image_url: "",
    mobile_number: "",
    linkedin_url: "",
    st_position: "",
    member_function: ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestModal, setRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ name_on_letter: "", selected_events: [], additional_details: "" });
  const [settings, setSettings] = useState({
    letter_show_name: true,
    letter_show_events: true,
    letter_show_details: true,
    member_edit_name: false,
    member_edit_preferred_name: true,
    member_edit_photo: true,
    member_edit_whatsapp: false,
    member_edit_linkedin: true,
    member_edit_position: false,
    member_edit_function: false
  });
  const [thisYearEvents, setThisYearEvents] = useState([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [staffMap, setStaffMap] = useState({});
  const [attPage, setAttPage] = useState(0);
  const [ocPage, setOcPage] = useState(0);

  const handleCopyId = () => {
    if (session?.stId) {
      navigator.clipboard.writeText(session.stId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "Please select a valid image file." });
        return;
      }
      setProfileImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openEditModal = () => {
    loadSettingsAndEvents();
    setEditForm({
      name: profile?.name || "",
      preferred_name: profile?.preferred_name || "",
      profile_image_url: profile?.profile_image_url || "",
      mobile_number: profile?.mobile_number || "",
      linkedin_url: profile?.linkedin_url || "",
      st_position: profile?.st_position || "",
      member_function: profile?.member_function || ""
    });
    setProfileImageFile(null);
    setPreviewUrl(null);
    setMsg(null);
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setProfileImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMsg(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updates = {};
      const profileUpdates = {};

      if (settings.member_edit_name) {
        if (!editForm.name.trim()) {
          throw new Error("Full Name cannot be empty.");
        }
        updates.name = editForm.name.trim();
        profileUpdates.full_name = editForm.name.trim();
      }

      if (settings.member_edit_preferred_name) {
        updates.preferred_name = editForm.preferred_name.trim() || null;
        profileUpdates.preferred_name = editForm.preferred_name.trim() || null;
      }

      if (settings.member_edit_photo) {
        let finalImageUrl = editForm.profile_image_url.trim() || null;

        if (profileImageFile) {
          const optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);
          const cleanStId = session.stId.replace(/\//g, "-");
          const fileName = `${cleanStId}_${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("profile_images")
            .upload(fileName, optimizedFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            throw new Error("Failed to upload profile image: " + uploadError.message);
          }

          const { data: urlData } = supabase.storage
            .from("profile_images")
            .getPublicUrl(fileName);

          finalImageUrl = urlData?.publicUrl || finalImageUrl;
        }

        updates.profile_image_url = finalImageUrl;
      }

      if (settings.member_edit_whatsapp) {
        updates.mobile_number = editForm.mobile_number.trim() || null;
      }

      if (settings.member_edit_linkedin) {
        updates.linkedin_url = editForm.linkedin_url.trim() || null;
      }

      if (settings.member_edit_position) {
        updates.st_position = editForm.st_position.trim() || null;
      }

      if (settings.member_edit_function) {
        updates.member_function = editForm.member_function.trim() || null;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No editable fields are enabled by the administrator.");
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("st_id", session.stId);

      if (error) throw error;

      if (Object.keys(profileUpdates).length > 0) {
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("st_id", session.stId);
      }

      setProfile(prev => ({
        ...prev,
        ...updates
      }));

      setMsg({ type: "success", text: "Profile updated successfully!" });
      setTimeout(closeEditModal, 800);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("letter_requests")
        .select("*")
        .eq("st_id", session.stId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("Error loading letter requests:", err);
    }
  };

  const loadSettingsAndEvents = async () => {
    try {
      const [settingsRes, eventsRes] = await Promise.all([
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", [
            "letter_show_name", "letter_show_events", "letter_show_details",
            "member_edit_name", "member_edit_preferred_name", "member_edit_photo", "member_edit_whatsapp",
            "member_edit_linkedin", "member_edit_position", "member_edit_function"
          ]),
        supabase
          .from("events")
          .select("event_id, name, date")
          .gte("date", `${new Date().getFullYear()}-01-01`)
          .lte("date", `${new Date().getFullYear()}-12-31`)
          .order("date", { ascending: false })
      ]);

      if (settingsRes.data) {
        const config = {};
        settingsRes.data.forEach(item => {
          config[item.key] = item.value === "true";
        });
        setSettings(prev => ({ ...prev, ...config }));
      }

      if (eventsRes.data) {
        setThisYearEvents(eventsRes.data);
      }
    } catch (err) {
      console.error("Error loading settings/events:", err);
    }
  };

  const getInterviewerName = (email) => {
    if (!email) return null;
    const key = email.toLowerCase();
    return staffMap[key] || email.split("@")[0];
  };

  useEffect(() => {
    if (!session.stId) return;

    const loadInfo = async () => {
      setLoading(true);
      try {
        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("st_id", session.stId)
          .maybeSingle();

        if (member) {
          const [ocRecords, attRecords] = await Promise.all([
            supabase
              .from("oc")
              .select("oc_position, apply_status, interviewer_email, interview_date, interview_link, events(name, date), functions(function_name)")
              .eq("st_id", session.stId),
            supabase
              .from("attendance")
              .select("attend, events(name, date)")
              .eq("st_id", session.stId)
          ]);

          const interviewerEmails = Array.from(
            new Set((ocRecords.data || []).map(o => o.interviewer_email).filter(Boolean))
          );

          const map = {};
          if (interviewerEmails.length > 0) {
            const [profileRes, memberRes] = await Promise.all([
              supabase
                .from("profiles")
                .select("email, full_name, preferred_name")
                .in("email", interviewerEmails),
              supabase
                .from("members")
                .select("email, name, preferred_name")
                .in("email", interviewerEmails)
            ]);

            if (profileRes.data) {
              profileRes.data.forEach(p => {
                if (p.email) map[p.email.toLowerCase()] = p.preferred_name || p.full_name || p.email;
              });
            }
            if (memberRes.data) {
              memberRes.data.forEach(m => {
                if (m.email && !map[m.email.toLowerCase()]) map[m.email.toLowerCase()] = m.preferred_name || m.name || m.email;
              });
            }
          }
          setStaffMap(map);

          setProfile({
            ...member,
            oc: ocRecords.data || [],
            attendance: attRecords.data || []
          });
        }
      } catch (err) {
        console.error("Error loading info:", err);
      } finally {
        setLoading(false);
      }
    };

    Promise.all([loadInfo(), loadRequests(), loadSettingsAndEvents()]);
  }, [session.stId]);

  const openRequestModal = () => {
    setRequestForm({
      name_on_letter: profile?.name || "",
      selected_events: [],
      additional_details: ""
    });
    setMsg(null);
    setRequestModal(true);
  };

  const closeRequestModal = () => {
    setRequestModal(false);
    setMsg(null);
  };

  const handleSubmitRequest = async () => {
    setSubmittingRequest(true);
    setMsg(null);
    try {
      const payload = {
        st_id: session.stId,
        name_on_letter: settings.letter_show_name ? requestForm.name_on_letter.trim() : null,
        selected_events: settings.letter_show_events ? requestForm.selected_events : [],
        additional_details: settings.letter_show_details ? requestForm.additional_details.trim() : null,
        status: "not start"
      };

      const { error } = await supabase.from("letter_requests").insert(payload);
      if (error) throw error;
      
      invalidateCache(CACHE_KEYS.DASHBOARD_STATS);
      setMsg({ type: "success", text: "Appreciation letter request submitted successfully!" });
      await loadRequests();
      setTimeout(closeRequestModal, 800);
    } catch (err) {
      console.error("Error submitting letter request:", err);
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (!session.stId) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className={`p-12 text-center flex flex-col items-center justify-center gap-3 rounded-[12px] border ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <User className={`w-10 h-10 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
          <p className={`text-[16px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Account Not Linked</p>
          <p className={`text-[13px] font-berkeley-mono max-w-sm ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            This account is not currently linked to any registered student member record in the database.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-24 gap-3 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
          isDark ? "border-[#23252a] border-t-white" : "border-gray-200 border-t-gray-900"
        }`}></div>
        <span className="text-[11px] font-berkeley-mono uppercase tracking-wider">Loading Member Credentials...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className={`p-12 text-center flex flex-col items-center justify-center gap-3 rounded-[12px] border ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <AlertCircle className="w-10 h-10 text-[#eb5757]" />
          <p className={`text-[16px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Student Record Not Found</p>
          <p className={`text-[13px] font-berkeley-mono max-w-sm ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Student index ({session.stId}) could not be retrieved from the members registry.
          </p>
        </div>
      </div>
    );
  }

  const attendanceList = profile?.attendance || [];
  const ocList = profile?.oc || [];

  const totalEvents = attendanceList.length;
  const attendedEvents = attendanceList.filter(a => a.attend === "YES").length;
  const absentEvents = totalEvents - attendedEvents;
  const attendanceRate = totalEvents ? Math.round((attendedEvents / totalEvents) * 100) : 0;

  const pageSize = 5;
  const totalAttPages = Math.ceil(attendanceList.length / pageSize) || 1;
  const paginatedAttendance = attendanceList.slice(attPage * pageSize, (attPage + 1) * pageSize);

  const totalOcPages = Math.ceil(ocList.length / pageSize) || 1;
  const paginatedOc = ocList.slice(ocPage * pageSize, (ocPage + 1) * pageSize);

  // Check if member has an upcoming interview scheduled
  const activeInterview = ocList.find(o => o.interview_date && new Date(o.interview_date) >= new Date());

  // Personal QR code URL for gate verification (300x300 high resolution for fast, accurate scanning)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(session.stId)}${
    isDark ? "&color=ffffff&bgcolor=08090a" : "&color=09090b&bgcolor=ffffff"
  }`;

  return (
    <div className={`w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-5 md:py-6 font-inter-variable space-y-5 transition-colors ${
      isDark ? "text-[#d0d6e0]" : "text-gray-800"
    }`}>
      {/* ── Top Header & Profile Actions ──────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 md:pb-4 border-b transition-colors ${
        isDark ? "border-[#23252a]" : "border-gray-200"
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${isDark ? "bg-[#27a644]" : "bg-[#16a34a]"}`}></span>
            <h1 className={`text-[20px] sm:text-[24px] font-[510] tracking-[-0.022em] ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Member Credentials & Identity
            </h1>
            <span className={`text-[9.5px] font-berkeley-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] border hidden sm:inline-block ${
              isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-gray-100 border-gray-200"
            }`}>
              VERIFIED
            </span>
          </div>
          <p className={`text-[12px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            Official credential pass, gate telemetry QR, and society engagement history
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openStudentProfile(session.stId)}
            className={`text-[12px] px-3 py-1.5 rounded-[6px] font-[510] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark 
                ? "linear-btn-ghost text-white hover:text-[#e4f222]" 
                : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 shadow-xs"
            }`}
            title="Inspect member details popup window (Student Dossier)"
          >
            <User className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
            <span>View Dossier</span>
          </button>

          <button
            onClick={openEditModal}
            className={`text-[12px] px-3 py-1.5 rounded-[6px] font-[510] inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark 
                ? "linear-btn-ghost text-[#d0d6e0] hover:text-white" 
                : "border border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 shadow-xs"
            }`}
          >
            <Edit3 className={`w-3.5 h-3.5 ${isDark ? "text-[#d0d6e0]" : "text-gray-600"}`} />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={openRequestModal}
            className={`text-[12px] px-3.5 py-1.5 rounded-[6px] font-[510] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              isDark 
                ? "linear-btn-primary" 
                : "bg-gray-900 text-white hover:bg-black shadow-sm"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Request Letter</span>
          </button>
        </div>
      </div>

      {/* ── DIGITAL MEMBER CREDENTIAL PASS (Compact Desktop Layout) ───────── */}
      <div className={`rounded-[12px] border overflow-hidden transition-colors ${
        isDark 
          ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
          : "bg-white border-gray-200 shadow-sm"
      }`}>
        {/* Pass Header Bar */}
        <div className={`px-4 sm:px-5 py-2 border-b flex items-center justify-between font-berkeley-mono text-[10.5px] sm:text-[11px] ${
          isDark 
            ? "bg-[#161718]/80 border-[#23252a]" 
            : "bg-gray-50/80 border-gray-200"
        }`}>
          <div className={`flex items-center gap-2 ${isDark ? "text-white" : "text-gray-800 font-[510]"}`}>
            <ShieldCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
            <span className="tracking-wide">ACTUARIAL & DATA SCIENCE SOCIETY · UNIVERSITY OF RUHUNA</span>
          </div>
          <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"} hidden sm:inline`}>
            DIGITAL GATE PASS · 2024/25
          </span>
        </div>

        {/* Pass Content: Compact Horizontal Row on Desktop */}
        <div className="linear-pass-body p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {/* Left: Avatar + Identity Details */}
          <div className="linear-pass-profile flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-4.5 flex-1 min-w-0 w-full text-center sm:text-left">
            {/* Profile Avatar */}
            <div 
              onClick={() => openStudentProfile(session.stId)}
              className={`linear-pass-avatar relative w-20 h-20 sm:w-20 sm:h-20 rounded-[10px] overflow-hidden border flex-shrink-0 cursor-pointer transition-colors group/dossier ${
                isDark 
                  ? "border-[#23252a] hover:border-[#e4f222]/50 bg-[#08090a] shadow-md" 
                  : "border-gray-200 hover:border-indigo-400 bg-gray-100 shadow-sm"
              }`}
              title="Click to inspect Student Dossier"
            >
              {profile.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(profile.name);
                  }}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-berkeley-mono text-xl font-[510] ${
                  isDark ? "text-[#8a8f98]" : "text-gray-400"
                }`}>
                  {profile.name ? profile.name.slice(0, 2).toUpperCase() : "??"}
                </div>
              )}
            </div>

            {/* Member Details */}
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 justify-center sm:justify-start">
                <h2 
                  onClick={() => openStudentProfile(session.stId)}
                  className={`text-[19px] sm:text-[21px] font-[510] tracking-[-0.015em] leading-tight truncate cursor-pointer transition-colors ${
                    isDark 
                      ? "text-white hover:text-[#e4f222]" 
                      : "text-gray-900 hover:text-indigo-600"
                  }`}
                  title="Click to inspect Student Dossier"
                >
                  {profile.preferred_name || profile.name}
                </h2>
                {profile.preferred_name && profile.name && (
                  <span className={`text-[12px] font-[400] truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    ({profile.name})
                  </span>
                )}
              </div>

              {/* Student ID Chip with 1-click copy + Year + Role */}
              <div className="linear-pass-badges flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5">
                <div 
                  onClick={handleCopyId}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[11px] cursor-pointer transition-colors ${
                    isDark 
                      ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-white" 
                      : "bg-gray-100 border-gray-200 hover:border-gray-300 text-gray-800"
                  }`}
                  title="Click to copy Student ID"
                >
                  <span>{profile.st_id}</span>
                  {copiedId ? (
                    <Check className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
                  ) : (
                    <Copy className={`w-3 h-3 ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`} />
                  )}
                </div>

                {profile.level && (
                  <span className={`px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[11px] ${
                    isDark 
                      ? "bg-[#08090a] border-[#23252a] text-[#8a8f98]" 
                      : "bg-gray-100 border-gray-200 text-gray-600"
                  }`}>
                    Year {profile.level}
                  </span>
                )}

                <span className={`px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[11px] ${
                  isDark 
                    ? "bg-[#27a644]/10 border-[#27a644]/20 text-[#27a644]" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>
                  {profile.st_position || "Society Member"}
                </span>

                {profile.member_function && (
                  <span className={`px-2 py-0.5 rounded-[4px] border font-berkeley-mono text-[11px] flex items-center gap-1 ${
                    isDark 
                      ? "bg-[#02b8cc]/10 border-[#02b8cc]/20 text-[#02b8cc]" 
                      : "bg-cyan-50 border-cyan-200 text-cyan-700"
                  }`}>
                    <Briefcase className="w-3 h-3" />
                    <span>{profile.member_function}</span>
                  </span>
                )}
              </div>

              {/* Track / Function & Contact Links */}
              <div className={`linear-pass-contacts pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-3.5 gap-y-1 text-[11px] font-berkeley-mono ${
                isDark ? "text-[#8a8f98]" : "text-gray-600"
              }`}>
                {profile.email && (
                  <a 
                    href={`mailto:${profile.email}`} 
                    className={`transition-colors flex items-center gap-1.5 ${
                      isDark ? "hover:text-white" : "hover:text-gray-900"
                    }`}
                  >
                    <Mail className={`w-3 h-3 ${isDark ? "text-[#6366f1]" : "text-indigo-600"}`} />
                    <span className="truncate max-w-[200px]">{profile.email}</span>
                  </a>
                )}

                {profile.mobile_number && (
                  <div className="flex items-center gap-1">
                    <PhoneContact phone={profile.mobile_number} />
                  </div>
                )}

                {profile.linkedin_url && (
                  <a 
                    href={profile.linkedin_url.trim().toLowerCase().startsWith("http") ? profile.linkedin_url.trim() : "https://" + profile.linkedin_url.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className={`transition-colors flex items-center gap-1 ${
                      isDark ? "hover:text-white" : "hover:text-gray-900"
                    }`}
                  >
                    <span>LinkedIn</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Digital Gate QR Pass (Large on mobile for accurate scanning, compact on desktop) */}
          <div className={`linear-pass-qr-wrap flex-shrink-0 w-full md:w-auto flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 p-4 md:p-0 md:bg-transparent rounded-[10px] md:rounded-none border md:border-0 md:pl-5 md:border-l ${
            isDark 
              ? "border-[#23252a] md:border-[#23252a]" 
              : "border-gray-200 md:border-gray-200 bg-gray-50/50"
          }`}>
            <div className={`linear-pass-qr-img w-[210px] h-[210px] md:w-[74px] md:h-[74px] rounded-[10px] md:rounded-[6px] p-2 md:p-1 border flex items-center justify-center overflow-hidden flex-shrink-0 ${
              isDark 
                ? "bg-[#08090a] border-[#23252a] shadow-lg md:shadow-none" 
                : "bg-white border-gray-200 shadow-sm md:shadow-none"
            }`}>
              <img
                src={qrCodeUrl}
                alt="Personal Gate QR Code"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col justify-center text-center md:text-left min-w-[125px]">
              <div className={`text-[11px] md:text-[10px] font-berkeley-mono uppercase tracking-wider flex items-center justify-center md:justify-start gap-1 font-[510] ${
                isDark ? "text-[#27a644]" : "text-emerald-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? "bg-[#27a644]" : "bg-emerald-600"}`}></span>
                GATE PASS VERIFIED
              </div>
              <p className={`text-[10.5px] md:text-[9px] font-berkeley-mono mt-1 md:mt-0.5 ${
                isDark ? "text-[#8a8f98]" : "text-gray-500"
              }`}>
                Present at event gate for instant check-in
              </p>
              <div className={`mt-1.5 md:mt-1 text-[11px] md:text-[9px] font-berkeley-mono ${
                isDark ? "text-[#d0d6e0] md:text-[#62666d]" : "text-gray-500 md:text-gray-500"
              }`}>
                TOKEN: <span className={`font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>{profile.st_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Interview / Committee Alert (if scheduled) ─────────────── */}
      {activeInterview && (
        <div className={`p-4 rounded-[12px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-[6px] border flex items-center justify-center ${
              isDark ? "bg-[#6366f1]/10 border-[#6366f1]/20 text-[#6366f1]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}>
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className={`text-[13px] font-[510] flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                <span>Upcoming Committee Interview Scheduled</span>
                <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[4px] border ${
                  isDark ? "text-[#6366f1] bg-[#6366f1]/20 border-[#6366f1]/30" : "text-indigo-700 bg-indigo-50 border-indigo-200"
                }`}>
                  {activeInterview.events?.name || "Society Role"}
                </span>
              </div>
              <p className={`text-[12px] font-berkeley-mono mt-0.5 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                Slot: {new Date(activeInterview.interview_date).toLocaleString()} · Interviewer: {getInterviewerName(activeInterview.interviewer_email) || "Assigned Executive"}
              </p>
            </div>
          </div>

          {activeInterview.interview_link && (
            <a
              href={activeInterview.interview_link}
              target="_blank"
              rel="noreferrer"
              className={`text-[12px] py-1.5 px-3 self-end sm:self-center inline-flex items-center gap-1.5 rounded-[6px] font-[510] transition-colors ${
                isDark ? "linear-btn-primary" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Join Interview Call</span>
            </a>
          )}
        </div>
      )}

      {/* ── 3-Point Personal Attendance Reliability Matrix ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className={`p-3.5 sm:p-4 rounded-[12px] border space-y-1.5 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className={`flex items-center justify-between text-[10.5px] font-berkeley-mono ${
            isDark ? "text-[#8a8f98]" : "text-gray-500"
          }`}>
            <span>ATTENDED SESSIONS</span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
          </div>
          <div className={`text-[24px] sm:text-[26px] font-berkeley-mono font-[510] leading-none ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            {attendedEvents}
          </div>
          <p className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
            Events officially checked in via QR
          </p>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-[12px] border space-y-1.5 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className={`flex items-center justify-between text-[10.5px] font-berkeley-mono ${
            isDark ? "text-[#8a8f98]" : "text-gray-500"
          }`}>
            <span>MISSED SESSIONS</span>
            <XCircle className={`w-3.5 h-3.5 ${isDark ? "text-[#eb5757]" : "text-rose-600"}`} />
          </div>
          <div className={`text-[24px] sm:text-[26px] font-berkeley-mono font-[510] leading-none ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            {absentEvents}
          </div>
          <p className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
            Sessions missed in active semester
          </p>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-[12px] border space-y-1.5 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className={`flex items-center justify-between text-[10.5px] font-berkeley-mono ${
            isDark ? "text-[#8a8f98]" : "text-gray-500"
          }`}>
            <span>RELIABILITY RATE</span>
            <span className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] border ${
              attendanceRate >= 80 
                ? isDark 
                  ? "text-[#27a644] bg-[#27a644]/10 border-[#27a644]/20" 
                  : "text-emerald-700 bg-emerald-50 border-emerald-200"
                : isDark 
                  ? "text-[#d0d6e0] bg-[#161718] border-[#23252a]" 
                  : "text-gray-600 bg-gray-100 border-gray-200"
            }`}>
              {attendanceRate >= 80 ? "HONOR ROLL" : "ACTIVE"}
            </span>
          </div>
          <div className={`text-[24px] sm:text-[26px] font-berkeley-mono font-[510] leading-none ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            {attendanceRate}%
          </div>
          <div className={`h-1.5 w-full rounded-full overflow-hidden mt-1 ${isDark ? "bg-[#161718]" : "bg-gray-100"}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceRate >= 80 
                  ? isDark ? "bg-[#27a644]" : "bg-emerald-500" 
                  : isDark ? "bg-[#6366f1]" : "bg-indigo-500"
              }`}
              style={{ width: `${attendanceRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ── 2-Column Ledger: Attendance & OC Assignments ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Attendance History */}
        <div className={`rounded-[12px] border p-4 sm:p-5 flex flex-col justify-between space-y-3 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
              isDark ? "border-[#23252a]" : "border-gray-200"
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <h3 className={`text-[13.5px] font-[510] tracking-[-0.012em] ${isDark ? "text-white" : "text-gray-900"}`}>
                  Attendance History
                </h3>
              </div>
              <span className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                {attendanceList.length} LOGGED
              </span>
            </div>

            {attendanceList.length === 0 ? (
              <div className={`py-8 text-center font-berkeley-mono text-[11.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`}>
                No event attendance records on file.
              </div>
            ) : (
              <div className={`divide-y font-berkeley-mono text-[11.5px] ${isDark ? "divide-[#161718]" : "divide-gray-100"}`}>
                {paginatedAttendance.map((att, idx) => (
                  <div key={idx} className={`py-2 flex items-center justify-between gap-3 transition-colors ${
                    isDark ? "hover:bg-[#161718]/30" : "hover:bg-gray-50"
                  }`}>
                    <div className="min-w-0">
                      <div className={`text-[12.5px] truncate font-[510] ${isDark ? "text-white" : "text-gray-800"}`}>
                        {att.events?.name || "Society Session"}
                      </div>
                      <div className={`text-[10.5px] mt-0.5 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                        {att.events?.date || "—"}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-[4px] text-[10.5px] border ${
                      att.attend === "YES"
                        ? isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isDark ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/20" : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {att.attend === "YES" ? "ATTENDED" : "ABSENT"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalAttPages > 1 && (
            <div className={`flex items-center justify-between pt-2.5 border-t text-[10.5px] font-berkeley-mono ${
              isDark ? "border-[#23252a] text-[#8a8f98]" : "border-gray-200 text-gray-500"
            }`}>
              <button
                onClick={() => setAttPage(p => Math.max(0, p - 1))}
                disabled={attPage === 0}
                className={`text-[10.5px] py-1 px-2.5 rounded-[4px] border font-[510] disabled:opacity-30 transition-colors ${
                  isDark ? "linear-btn-ghost" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                ← Prev
              </button>
              <span>Page {attPage + 1} of {totalAttPages}</span>
              <button
                onClick={() => setAttPage(p => Math.min(totalAttPages - 1, p + 1))}
                disabled={attPage >= totalAttPages - 1}
                className={`text-[10.5px] py-1 px-2.5 rounded-[4px] border font-[510] disabled:opacity-30 transition-colors ${
                  isDark ? "linear-btn-ghost" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Committee (OC) Assignments */}
        <div className={`rounded-[12px] border p-4 sm:p-5 flex flex-col justify-between space-y-3 transition-colors ${
          isDark 
            ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
            : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
              isDark ? "border-[#23252a]" : "border-gray-200"
            }`}>
              <div className="flex items-center gap-2">
                <Briefcase className={`w-3.5 h-3.5 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
                <h3 className={`text-[13.5px] font-[510] tracking-[-0.012em] ${isDark ? "text-white" : "text-gray-900"}`}>
                  Committee (OC) Assignments
                </h3>
              </div>
              <span className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                {ocList.length} ROLES
              </span>
            </div>

            {ocList.length === 0 ? (
              <div className={`py-8 text-center font-berkeley-mono text-[11.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`}>
                No committee assignments recorded.
              </div>
            ) : (
              <div className="space-y-2.5 font-berkeley-mono text-[11.5px]">
                {paginatedOc.map((o, idx) => (
                  <div key={idx} className={`p-2.5 sm:p-3 rounded-[8px] border space-y-1.5 transition-colors ${
                    isDark ? "bg-[#08090a] border-[#23252a]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-[12.5px] font-[510] truncate max-w-[240px] ${isDark ? "text-white" : "text-gray-900"}`}>
                        {o.events?.name || "Society Operation"}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] border ${
                        o.apply_status === "Accept"
                          ? isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : o.apply_status === "Reject"
                          ? isDark ? "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/20" : "bg-rose-50 text-rose-700 border-rose-200"
                          : isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {o.apply_status ? o.apply_status.toUpperCase() : "PENDING"}
                      </span>
                    </div>

                    <div className={`flex items-center gap-2 text-[10.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                      <span>{o.functions?.function_name || "General Sub-team"}</span>
                      {o.oc_position && (
                        <>
                          <span className={isDark ? "text-[#383b3f]" : "text-gray-300"}>/</span>
                          <span className={`font-[510] ${isDark ? "text-white" : "text-gray-800"}`}>{o.oc_position}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalOcPages > 1 && (
            <div className={`flex items-center justify-between pt-2.5 border-t text-[10.5px] font-berkeley-mono ${
              isDark ? "border-[#23252a] text-[#8a8f98]" : "border-gray-200 text-gray-500"
            }`}>
              <button
                onClick={() => setOcPage(p => Math.max(0, p - 1))}
                disabled={ocPage === 0}
                className={`text-[10.5px] py-1 px-2.5 rounded-[4px] border font-[510] disabled:opacity-30 transition-colors ${
                  isDark ? "linear-btn-ghost" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                ← Prev
              </button>
              <span>Page {ocPage + 1} of {totalOcPages}</span>
              <button
                onClick={() => setOcPage(p => Math.min(totalOcPages - 1, p + 1))}
                disabled={ocPage >= totalOcPages - 1}
                className={`text-[10.5px] py-1 px-2.5 rounded-[4px] border font-[510] disabled:opacity-30 transition-colors ${
                  isDark ? "linear-btn-ghost" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Appreciation Letter Requests History ──────────────────────────── */}
      <div className={`rounded-[12px] border p-4 sm:p-5 space-y-3 transition-colors ${
        isDark 
          ? "bg-[#0f1011] border-[#23252a] shadow-[inset_0_0_0_1px_#23252a]" 
          : "bg-white border-gray-200 shadow-sm"
      }`}>
        <div className={`flex items-center justify-between border-b pb-2.5 ${
          isDark ? "border-[#23252a]" : "border-gray-200"
        }`}>
          <div className="flex items-center gap-2">
            <Award className={`w-3.5 h-3.5 ${isDark ? "text-[#8b5cf6]" : "text-purple-600"}`} />
            <h3 className={`text-[13.5px] font-[510] tracking-[-0.012em] ${isDark ? "text-white" : "text-gray-900"}`}>
              Appreciation Letter Requests History
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openStudentProfile(session.stId)}
              className={`text-[10.5px] font-berkeley-mono transition-colors flex items-center gap-1 ${
                isDark ? "text-[#8a8f98] hover:text-[#e4f222]" : "text-gray-500 hover:text-indigo-600"
              }`}
              title="Inspect Member Details in Student Dossier"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Inspect Dossier</span>
            </button>
            <span className={isDark ? "text-[#23252a]" : "text-gray-300"}>·</span>
            <button
              onClick={openRequestModal}
              className={`text-[10.5px] font-berkeley-mono transition-colors ${
                isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              + New Request
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className={`py-8 text-center font-berkeley-mono text-[11.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`}>
            No letter requests submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-berkeley-mono text-[11.5px]">
              <thead className={`border-b ${isDark ? "border-[#23252a] text-[#8a8f98]" : "border-gray-200 text-gray-500"}`}>
                <tr>
                  <th className="pb-2.5 px-2 font-[400]">NAME ON LETTER</th>
                  <th className="pb-2.5 px-2 font-[400]">EVENTS INCLUDED</th>
                  <th className="pb-2.5 px-2 font-[400]">DATE SUBMITTED</th>
                  <th className="pb-2.5 px-2 text-right font-[400]">STATUS</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-[#161718]" : "divide-gray-100"}`}>
                {requests.map(r => (
                  <tr key={r.id} className={`transition-colors ${isDark ? "hover:bg-[#161718]/30" : "hover:bg-gray-50"}`}>
                    <td className={`py-2.5 px-2 font-[510] ${isDark ? "text-white" : "text-gray-800"}`}>
                      {r.name_on_letter || "—"}
                    </td>
                    <td className={`py-2.5 px-2 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                      {r.selected_events && Array.isArray(r.selected_events) && r.selected_events.length > 0 ? (
                        r.selected_events.join(", ")
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`py-2.5 px-2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[9.5px] border ${
                        r.status === "done" || r.status === "completed"
                          ? isDark ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : r.status === "inprogress"
                          ? isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200"
                          : isDark ? "bg-[#161718] text-[#8a8f98] border-[#23252a]" : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}>
                        {r.status === "not start" ? "PENDING" : r.status ? r.status.toUpperCase() : "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Minimal Footer Credit & Contact Issues ── */}
      <MinimalFooter session={session} className="mt-10 mb-4" />

      {/* ── EDIT PROFILE MODAL ─────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={closeEditModal}>
          <div 
            className={`w-full max-w-md rounded-[12px] border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors ${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? "border-[#23252a]" : "border-gray-200"
            }`}>
              <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Edit Member Details</h3>
              <button onClick={closeEditModal} className={`transition-colors ${
                isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-600"
              }`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {msg && (
              <div className={`mx-5 mt-4 p-2.5 rounded-[6px] border text-[12px] font-berkeley-mono flex items-center gap-2 ${
                msg.type === "error" 
                  ? isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700" 
                  : isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                <span>{msg.text}</span>
              </div>
            )}

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-[13px]">
              {settings.member_edit_name && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Legal full name"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {settings.member_edit_preferred_name && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Preferred Name (Calling Name)</label>
                  <input
                    type="text"
                    placeholder="Calling name"
                    value={editForm.preferred_name}
                    onChange={e => setEditForm({ ...editForm, preferred_name: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {settings.member_edit_photo && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Profile Photo</label>
                  <div className={`flex items-center gap-3 p-3 rounded-[6px] border ${
                    isDark ? "bg-[#08090a] border-[#23252a]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className={`w-12 h-12 rounded-[6px] border overflow-hidden flex-shrink-0 ${
                      isDark ? "bg-[#161718] border-[#23252a]" : "bg-white border-gray-200"
                    }`}>
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : editForm.profile_image_url ? (
                        <img src={editForm.profile_image_url} alt="Current" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`}>👤</div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="profile-img-edit"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="profile-img-edit"
                        className={`text-[11px] py-1 px-2.5 cursor-pointer inline-flex items-center gap-1.5 rounded-[6px] border font-[510] transition-colors ${
                          isDark 
                            ? "linear-btn-ghost" 
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-xs"
                        }`}
                      >
                        <Upload className="w-3 h-3" /> Select Photo
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {settings.member_edit_whatsapp && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>WhatsApp / Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 0770458751"
                    value={editForm.mobile_number}
                    onChange={e => setEditForm({ ...editForm, mobile_number: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {settings.member_edit_linkedin && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>LinkedIn URL</label>
                  <input
                    type="text"
                    placeholder="https://www.linkedin.com/in/username"
                    value={editForm.linkedin_url}
                    onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {settings.member_edit_position && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Student Position</label>
                  <input
                    type="text"
                    placeholder="e.g. President, Secretary, Member..."
                    value={editForm.st_position}
                    onChange={e => setEditForm({ ...editForm, st_position: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {settings.member_edit_function && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Member Function</label>
                  <input
                    type="text"
                    placeholder="e.g. Finance, Logistics, PR, Editorial..."
                    value={editForm.member_function}
                    onChange={e => setEditForm({ ...editForm, member_function: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}

              {!(
                settings.member_edit_name ||
                settings.member_edit_preferred_name ||
                settings.member_edit_photo ||
                settings.member_edit_whatsapp ||
                settings.member_edit_linkedin ||
                settings.member_edit_position ||
                settings.member_edit_function
              ) && (
                <div className={`p-6 text-center rounded-[8px] border ${
                  isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-500"
                }`}>
                  <p className="text-[13px] font-[510]">No self-editable fields are enabled.</p>
                  <p className="text-[11px] mt-1 text-[#62666d]">Please contact an administrator if you need to update your profile details.</p>
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex items-center justify-end gap-2 ${
              isDark ? "border-[#23252a] bg-[#161718]/40" : "border-gray-200 bg-gray-50/80"
            }`}>
              <button 
                onClick={closeEditModal} 
                className={`text-[12px] py-1.5 px-3 rounded-[6px] font-[510] transition-colors ${
                  isDark ? "linear-btn-ghost" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-xs"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={
                  saving ||
                  !(
                    settings.member_edit_name ||
                    settings.member_edit_preferred_name ||
                    settings.member_edit_photo ||
                    settings.member_edit_whatsapp ||
                    settings.member_edit_linkedin ||
                    settings.member_edit_position ||
                    settings.member_edit_function
                  )
                }
                className={`text-[12px] py-1.5 px-3 rounded-[6px] font-[510] transition-all ${
                  saving ||
                  !(
                    settings.member_edit_name ||
                    settings.member_edit_preferred_name ||
                    settings.member_edit_photo ||
                    settings.member_edit_whatsapp ||
                    settings.member_edit_linkedin ||
                    settings.member_edit_position ||
                    settings.member_edit_function
                  )
                    ? "opacity-50 cursor-not-allowed bg-gray-600 text-white"
                    : isDark ? "linear-btn-primary cursor-pointer" : "bg-gray-900 text-white hover:bg-black shadow-sm cursor-pointer"
                }`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST APPRECIATION LETTER MODAL ─────────────── */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={closeRequestModal}>
          <div 
            className={`w-full max-w-md rounded-[12px] border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors ${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? "border-[#23252a]" : "border-gray-200"
            }`}>
              <h3 className={`text-[15px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Request Appreciation Letter</h3>
              <button onClick={closeRequestModal} className={`transition-colors ${
                isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-600"
              }`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {msg && (
              <div className={`mx-5 mt-4 p-2.5 rounded-[6px] border text-[12px] font-berkeley-mono flex items-center gap-2 ${
                msg.type === "error" 
                  ? isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700" 
                  : isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                <span>{msg.text}</span>
              </div>
            )}

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-[13px]">
              {settings.letter_show_name && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Name on Official Letter</label>
                  <input
                    type="text"
                    value={requestForm.name_on_letter}
                    onChange={e => setRequestForm({ ...requestForm, name_on_letter: e.target.value })}
                    className={`w-full rounded-[6px] px-3 py-2 text-[13px] border focus:outline-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                    required
                  />
                </div>
              )}

              {settings.letter_show_events && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Select Events Participated / Organized</label>
                  {thisYearEvents.length === 0 ? (
                    <p className={`text-[12px] italic font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>No events logged for this academic cycle.</p>
                  ) : (
                    <div className={`space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-[6px] border font-berkeley-mono text-[11px] ${
                      isDark ? "bg-[#08090a] border-[#23252a]" : "bg-gray-50 border-gray-200"
                    }`}>
                      {thisYearEvents.map(e => (
                        <label key={e.event_id} className={`flex items-center gap-2 cursor-pointer transition-colors ${
                          isDark ? "text-[#d0d6e0] hover:text-white" : "text-gray-700 hover:text-gray-900"
                        }`}>
                          <input
                            type="checkbox"
                            checked={requestForm.selected_events.includes(e.name)}
                            onChange={(evt) => {
                              const name = e.name;
                              if (evt.target.checked) {
                                setRequestForm(prev => ({ ...prev, selected_events: [...prev.selected_events, name] }));
                              } else {
                                setRequestForm(prev => ({ ...prev, selected_events: prev.selected_events.filter(n => n !== name) }));
                              }
                            }}
                            className={`rounded cursor-pointer ${
                              isDark ? "border-[#23252a] bg-[#161718] text-[#e4f222] focus:ring-0" : "border-gray-300 bg-white text-indigo-600"
                            }`}
                          />
                          <span>{e.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {settings.letter_show_details && (
                <div>
                  <label className={`block text-[12px] mb-1 font-[510] ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>Specific Roles & Contributions</label>
                  <textarea
                    rows={3}
                    value={requestForm.additional_details}
                    onChange={e => setRequestForm({ ...requestForm, additional_details: e.target.value })}
                    placeholder="Describe specific tasks, roles, or awards received..."
                    className={`w-full rounded-[6px] p-2.5 text-[13px] border focus:outline-none resize-none transition-colors ${
                      isDark 
                        ? "bg-[#08090a] border-[#23252a] text-white focus:border-[#d0d6e0]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex items-center justify-end gap-2 ${
              isDark ? "border-[#23252a] bg-[#161718]/40" : "border-gray-200 bg-gray-50/80"
            }`}>
              <button 
                onClick={closeRequestModal} 
                className={`text-[12px] py-1.5 px-3 rounded-[6px] font-[510] transition-colors ${
                  isDark ? "linear-btn-ghost" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-xs"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submittingRequest}
                className={`text-[12px] py-1.5 px-3 rounded-[6px] font-[510] transition-all ${
                  isDark ? "linear-btn-primary" : "bg-gray-900 text-white hover:bg-black shadow-sm"
                }`}
              >
                {submittingRequest ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
