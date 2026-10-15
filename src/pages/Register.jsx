import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  GraduationCap,
  Briefcase,
  Camera,
  Check,
  AlertCircle,
  ShieldAlert,
  Info,
  CheckCircle2,
  Trash2,
  UploadCloud,
  FileCheck
} from "lucide-react";

export default function Register({
  regEnabled = true,
  onNavigate,
  onRegisterSuccess,
  theme,
}) {
  const isDark = theme ? theme === "dark" : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);
  const [roleMode, setRoleMode] = useState("member"); // "member" | "staff"
  const [staffRole, setStaffRole] = useState("editor"); // "editor" | "admin"

  // Form fields
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [stId, setStId] = useState("");
  const [level, setLevel] = useState("1");
  const [phone, setPhone] = useState("");
  const [memberFunction, setMemberFunction] = useState("Finance");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Photo
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleNavigateHome = () => {
    if (onNavigate) {
      onNavigate("home");
    } else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleNavigateLogin = () => {
    if (onNavigate) {
      onNavigate("login");
    } else {
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select a valid image file (JPG, PNG, WEBP).");
        return;
      }
      setProfileImageFile(file);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage("");
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setProfileImageFile(null);
    setPreviewUrl(null);
  };

  // Live ST ID validation
  const trimmedStId = stId.trim();
  const isValidStIdFormat = /^(?:SC\/)?\d{4}\/\d{5}$/i.test(trimmedStId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const targetRole = roleMode === "member" ? "member" : staffRole;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPreferredName = preferredName.trim() || null;

    if (!cleanEmail || !password || !cleanName) {
      setErrorMessage("Full Name, Email, and Password are required.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-check both fields.");
      return;
    }

    if (!agreedTerms) {
      setErrorMessage("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setLoading(true);

    try {
      let v_st_id = null;
      let v_name = cleanName;
      let v_preferred_name = cleanPreferredName;

      // 1. Check if email exists in members table (pre-registered directory)
      const { data: memberRows, error: memberErr } = await supabase
        .rpc("get_member_by_email", { p_email: cleanEmail });

      if (memberErr) {
        setErrorMessage("Database directory check failed: " + memberErr.message);
        setLoading(false);
        return;
      }

      const isPreRegistered = memberRows && memberRows.length > 0;
      if (isPreRegistered) {
        const memberData = memberRows[0];
        v_st_id = memberData.st_id;
        if (!v_name) {
          v_name = memberData.name;
        }
        if (!v_preferred_name && memberData.preferred_name) {
          v_preferred_name = memberData.preferred_name;
        }
      }

      // 2. Check if staff invite exists for editor or admin
      const { data: canRegisterStaff } = await supabase
        .rpc("can_register_staff", { p_email: cleanEmail, p_role: targetRole });

      // 3. If registration is disabled and user is neither pre-registered nor invited staff
      if (!regEnabled && !isPreRegistered && !canRegisterStaff) {
        setErrorMessage("General membership registration is currently closed. If you are authorized staff, ensure your invite is active.");
        setLoading(false);
        return;
      }

      // 4. Validate Student ID and Phone for new members
      if (!isPreRegistered && !canRegisterStaff && targetRole === "member") {
        if (!trimmedStId || !phone.trim()) {
          setErrorMessage("Student ID and Phone Number are required for member registration.");
          setLoading(false);
          return;
        }
      }

      // Format Student ID: auto-prefix SC/ if formatted as YYYY/NNNNN
      let finalStId = isPreRegistered ? v_st_id : "";
      if (!isPreRegistered) {
        if (targetRole === "member" || trimmedStId) {
          if (!trimmedStId) {
            setErrorMessage("Student ID is required.");
            setLoading(false);
            return;
          }
          if (/^\d{4}\/\d{5}$/.test(trimmedStId)) {
            finalStId = "SC/" + trimmedStId;
          } else if (/^sc\/\d{4}\/\d{5}$/i.test(trimmedStId)) {
            finalStId = "SC/" + trimmedStId.substring(3);
          } else {
            setErrorMessage("Invalid Student ID format. Expected format: SC/2022/12984");
            setLoading(false);
            return;
          }
        }
      }

      // 5. Upload profile picture if chosen
      let profileImageUrl = null;
      if (profileImageFile) {
        try {
          const optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);
          const cleanStId = (finalStId || "user").replace(/\//g, "-");
          const fileName = `${cleanStId}_${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("profile_images")
            .upload(fileName, optimizedFile, {
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) {
            throw new Error("Failed to upload profile image: " + uploadError.message);
          }

          const { data: urlData } = supabase.storage
            .from("profile_images")
            .getPublicUrl(fileName);

          profileImageUrl = urlData?.publicUrl;
        } catch (imgErr) {
          setErrorMessage(imgErr.message || "Failed to process photo upload.");
          setLoading(false);
          return;
        }
      }

      // 6. Sign up user via Supabase
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: v_name,
            preferred_name: v_preferred_name,
            role: targetRole,
            st_id: finalStId,
            level: level || "1",
            mobile_number: isPreRegistered ? null : phone.trim(),
            member_function: isPreRegistered ? null : (targetRole === "member" ? memberFunction : null),
            profile_image_url: profileImageUrl,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // 7. Check if session was returned immediately or requires email confirmation
      if (data?.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role, st_id, full_name, preferred_name, email")
          .eq("id", data.user.id)
          .maybeSingle();

        const userStatus = profile?.status || "approved";
        const userRole = profile?.role || targetRole;

        const profileData = {
          role: userRole,
          stId: isPreRegistered ? v_st_id : finalStId,
          name: v_preferred_name || v_name,
          fullName: v_name,
          preferredName: v_preferred_name || "",
          email: cleanEmail,
          userId: data.user.id,
          status: userStatus,
        };

        if (onRegisterSuccess) {
          onRegisterSuccess(profileData, userStatus === "pending");
        } else {
          try {
            localStorage.setItem("adss-profile-cache", JSON.stringify(profileData));
          } catch { }
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }
      } else {
        // Confirmation email required
        setSuccessInfo({
          email: cleanEmail,
          name: v_name,
        });
      }
    } catch (err) {
      console.error("Registration exception:", err);
      setErrorMessage(err.message || "An unexpected error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0] selection:bg-[#e4f222] selection:text-[#08090a]" : "bg-[#f8f9fa] text-gray-800 selection:bg-gray-900 selection:text-white"} font-inter-variable relative flex flex-col justify-between overflow-x-hidden`}>
      {/* Background Subtle Radial Grid Dots (Linear style) */}
      <div
        className={`absolute inset-0 pointer-events-none ${isDark ? "opacity-[0.03]" : "opacity-[0.05]"}`}
        style={{
          backgroundImage: `radial-gradient(${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Atmospheric Glow at top */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[300px] bg-gradient-to-b ${
        isDark ? "from-white/[0.04]" : "from-black/[0.02]"
      } to-transparent blur-3xl pointer-events-none`} />

      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <header className="relative z-10 w-full max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Back to Home Button */}
        <button
          onClick={handleNavigateHome}
          className={`inline-flex items-center gap-2 text-[13px] transition-colors cursor-pointer group ${
            isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <ArrowLeft className={`w-4 h-4 group-hover:-translate-x-0.5 transition-transform ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`} />
          <span>Back to ADSS Ruhuna</span>
        </button>

        {/* Brand Wordmark & Logo */}
        <div
          onClick={handleNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className={`w-6 h-6 rounded-[4px] border flex items-center justify-center p-1 ${
            isDark ? "bg-[#161718] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
          }`}>
            <img
              alt="ADSS Logo"
              className="w-full h-full object-contain"
              src={`${import.meta.env.BASE_URL}${isDark ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
            />
          </div>
          <span className={`text-[14px] font-[510] tracking-[-0.015em] hidden sm:inline ${
            isDark ? "text-white" : "text-gray-900 font-semibold"
          }`}>
            ADSS Ruhuna
          </span>
        </div>

        {/* Login CTA Link */}
        <button
          onClick={handleNavigateLogin}
          className={`text-[13px] transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 ${
            isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>Already registered?</span>
          <span className={`font-[510] hover:underline ${isDark ? "text-[#d0d6e0]" : "text-gray-900 font-semibold"}`}>Log in</span>
        </button>
      </header>

      {/* ── Main Content Container ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[620px]">
          {/* Card Container */}
          <div className={`rounded-[12px] border p-6 sm:p-9 relative ${
            isDark
              ? "bg-[#0f1011] border-[#23252a] shadow-[rgb(35,37,42)_0px_0px_0px_1px_inset]"
              : "bg-white border-gray-200 shadow-lg shadow-gray-200/50"
          }`}>

            {/* Success View: Confirmation Required */}
            {successInfo ? (
              <div className="py-4 text-center">
                <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center mx-auto mb-4 ${
                  isDark ? "bg-[#27a644]/10 border border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border border-emerald-200 text-emerald-600"
                }`}>
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className={`text-[24px] font-[510] tracking-[-0.022em] mb-2 ${
                  isDark ? "text-white" : "text-gray-900 font-semibold"
                }`}>
                  Account Created Successfully
                </h2>
                <p className={`text-[14px] max-w-[440px] mx-auto leading-relaxed mb-6 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-600"
                }`}>
                  A verification confirmation link was dispatched to{" "}
                  <strong className={`font-[510] font-berkeley-mono ${isDark ? "text-white" : "text-gray-900 font-semibold"}`}>
                    {successInfo.email}
                  </strong>
                  . Please check your inbox or spam folder to activate your account, then sign in.
                </p>
                <button
                  onClick={handleNavigateLogin}
                  className="linear-btn-primary px-6 py-2.5 text-[14px]"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Top Badge & Cycle */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border text-[11px] font-berkeley-mono tracking-wider ${
                    isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#e4f222]" : "bg-lime-500"}`} />
                    <span>ONBOARDING // 2024-25 CYCLE</span>
                  </div>
                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                    STUDENT REGISTRY
                  </span>
                </div>

                {/* Title & Subtitle */}
                <h1 className={`text-[24px] sm:text-[28px] font-[510] tracking-[-0.022em] leading-tight mb-2 ${
                  isDark ? "text-white" : "text-gray-900 font-semibold"
                }`}>
                  Join ADSS Ruhuna
                </h1>
                <p className={`text-[13.5px] font-[400] leading-relaxed mb-6 ${
                  isDark ? "text-[#8a8f98]" : "text-gray-600"
                }`}>
                  Create your student member identity to receive your digital membership pass, access attendance telemetry, and join society operations.
                </p>

                {/* General Registration Closed Notice */}
                {!regEnabled && roleMode === "member" && (
                  <div className={`mb-5 p-3.5 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                    isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}>
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-[510] block mb-0.5">General Registration Closed</strong>
                      <span>
                        Undergraduate registration is currently offline. If you have been appointed as society staff or faculty, switch to Staff Invite below.
                      </span>
                    </div>
                  </div>
                )}

                {/* Role Mode Selector Tabs */}
                <div className={`grid grid-cols-2 gap-2 p-1 rounded-[8px] border mb-6 ${
                  isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMode("member");
                      setErrorMessage("");
                    }}
                    className={`py-2 px-3 rounded-[6px] text-[13px] font-[510] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      roleMode === "member"
                        ? isDark
                          ? "bg-[#0f1011] text-white border border-[#23252a] shadow-sm"
                          : "bg-white text-gray-900 shadow-sm border border-gray-200 font-semibold"
                        : isDark
                          ? "text-[#8a8f98] hover:text-white"
                          : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student Member</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMode("staff");
                      setErrorMessage("");
                    }}
                    className={`py-2 px-3 rounded-[6px] text-[13px] font-[510] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      roleMode === "staff"
                        ? isDark
                          ? "bg-[#0f1011] text-white border border-[#23252a] shadow-sm"
                          : "bg-white text-gray-900 shadow-sm border border-gray-200 font-semibold"
                        : isDark
                          ? "text-[#8a8f98] hover:text-white"
                          : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Staff / Executive</span>
                  </button>
                </div>

                {/* Staff Role Specific Selector */}
                {roleMode === "staff" && (
                  <div className={`mb-6 p-3 rounded-[6px] border flex items-center justify-between ${
                    isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div>
                      <span className={`text-[13px] font-[510] block ${isDark ? "text-white" : "text-gray-900 font-semibold"}`}>
                        Assigned Staff Role
                      </span>
                      <span className={`text-[11.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                        Requires an authorized invitation in system records
                      </span>
                    </div>
                    <select
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                      className={`px-3 py-1.5 rounded-[6px] border text-[13px] focus:outline-none ${
                        isDark 
                          ? "bg-[#08090a] border-[#23252a] text-[#d0d6e0] focus:border-[#d0d6e0]" 
                          : "bg-white border-gray-200 text-gray-800 shadow-sm focus:border-gray-900"
                      }`}
                    >
                      <option value="editor">Editor / Executive</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className={`mb-5 p-3 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                    isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug">{errorMessage}</div>
                  </div>
                )}

                {/* Registration Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* ── Section: Academic Identity ── */}
                  <div className="space-y-4">
                    <div className={`flex items-center gap-2 pb-1 border-b ${
                      isDark ? "border-[#23252a]/60" : "border-gray-200"
                    }`}>
                      <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                      }`}>
                        01 // Academic Identity
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div>
                        <label className={`block text-[13px] font-[510] mb-1.5 ${
                          isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                        }`}>
                          Full Name <span className="text-[#eb5757]">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. A.B. Pathum Nissanka"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Preferred / Calling Name */}
                      <div>
                        <label className={`block text-[13px] font-[510] mb-1.5 ${
                          isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                        }`}>
                          Calling Name <span className={`font-[400] text-[12px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>(Badge / ID)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Pathum"
                          value={preferredName}
                          onChange={(e) => setPreferredName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                            isDark
                              ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                              : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Member Specific Fields: ST ID & Level */}
                    {roleMode === "member" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Student ID */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className={`text-[13px] font-[510] ${
                                isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                              }`}>
                                Student ID (ST ID) <span className="text-[#eb5757]">*</span>
                              </label>
                              {trimmedStId && (
                                <span
                                  className={`text-[11px] font-berkeley-mono inline-flex items-center gap-1 ${isValidStIdFormat
                                    ? "text-[#27a644]"
                                    : "text-[#eb5757]"
                                    }`}
                                >
                                  {isValidStIdFormat ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Valid ID</span>
                                    </>
                                  ) : (
                                    <span>SC/YYYY/NNNNN</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              required
                              placeholder="e.g. SC/2022/12984"
                              value={stId}
                              onChange={(e) => setStId(e.target.value)}
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] font-berkeley-mono transition-colors focus:outline-none ${
                                isDark
                                  ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                  : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                              }`}
                            />
                          </div>

                          {/* Academic Year / Level */}
                          <div>
                            <label className={`block text-[13px] font-[510] mb-1.5 ${
                              isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                            }`}>
                              Academic Year / Level
                            </label>
                            <select
                              value={level}
                              onChange={(e) => setLevel(e.target.value)}
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                isDark
                                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                                  : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 shadow-sm"
                              }`}
                            >
                              <option value="1">Year 1 (Level I)</option>
                              <option value="2">Year 2 (Level II)</option>
                              <option value="3">Year 3 (Level III)</option>
                              <option value="4">Year 4 (Level IV)</option>
                            </select>
                          </div>
                        </div>

                        {/* Functional Division */}
                        <div>
                          <label className={`block text-[13px] font-[510] mb-1.5 ${
                            isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                          }`}>
                            Society Functional Team
                          </label>
                          <select
                            value={memberFunction}
                            onChange={(e) => setMemberFunction(e.target.value)}
                            className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 shadow-sm"
                            }`}
                          >
                            <option value="Finance">Finance</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Operation & Academic Management">
                              Operation & Academic Management
                            </option>
                            <option value="Personal Development">
                              Personal Development
                            </option>
                            <option value="Public Relations">
                              Public Relations
                            </option>
                            <option value="Research & Analyst">
                              Research & Analyst
                            </option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Section: Profile Photo for Digital Pass ── */}
                  <div className="space-y-3 pt-2">
                    <div className={`flex items-center gap-2 pb-1 border-b ${
                      isDark ? "border-[#23252a]/60" : "border-gray-200"
                    }`}>
                      <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                      }`}>
                        02 // Member Photo (For Digital Pass)
                      </span>
                    </div>

                    <div className={`p-3.5 rounded-[8px] border flex items-center gap-4 ${
                      isDark ? "bg-[#161718]/60 border-[#23252a]" : "bg-gray-50 border-gray-200"
                    }`}>
                      {/* Avatar preview */}
                      <div className="relative flex-shrink-0">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-14 h-14 rounded-full object-cover border-2 border-[#e4f222]"
                          />
                        ) : (
                          <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${
                            isDark ? "bg-[#08090a] border-[#23252a] text-[#62666d]" : "bg-white border-gray-200 text-gray-400"
                          }`}>
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Photo actions */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label
                            htmlFor="register-photo-upload"
                            className={`text-[12px] px-3 py-1.5 rounded-[6px] border cursor-pointer inline-flex items-center font-[510] transition-colors ${
                              isDark
                                ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] hover:text-white hover:border-[#383b3f]"
                                : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-100 shadow-sm"
                            }`}
                          >
                            <UploadCloud className="w-3.5 h-3.5 mr-1" />
                            <span>Choose Photo</span>
                          </label>
                          {previewUrl && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="text-[12px] text-[#eb5757] hover:underline cursor-pointer flex items-center gap-1 p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                        <input
                          id="register-photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <p className={`text-[11.5px] truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                          {profileImageFile
                            ? profileImageFile.name
                            : "Auto-optimized to 500×600px for gate scanner identity"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Contact & Security ── */}
                  <div className="space-y-4 pt-2">
                    <div className={`flex items-center gap-2 pb-1 border-b ${
                      isDark ? "border-[#23252a]/60" : "border-gray-200"
                    }`}>
                      <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                        isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                      }`}>
                        03 // Contact & Credentials
                      </span>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <label className={`block text-[13px] font-[510] mb-1.5 ${
                          isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                        }`}>
                          Email address <span className="text-[#eb5757]">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="student@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className={`block text-[13px] font-[510] mb-1.5 ${
                          isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                        }`}>
                          Mobile / WhatsApp{" "}
                          {roleMode === "member" && (
                            <span className="text-[#eb5757]">*</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required={roleMode === "member"}
                            placeholder="+94 77 123 4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password & Confirm Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password */}
                      <div>
                        <label className={`block text-[13px] font-[510] mb-1.5 ${
                          isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                        }`}>
                          Password <span className="text-[#eb5757]">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            autoComplete="new-password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full pl-3 pr-9 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-0.5 ${
                              isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"
                            }`}
                          >
                            {showPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={`text-[13px] font-[510] ${
                            isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                          }`}>
                            Confirm Password <span className="text-[#eb5757]">*</span>
                          </label>
                          {confirmPassword && (
                            <span
                              className={`text-[11px] font-berkeley-mono ${password === confirmPassword
                                ? "text-[#27a644]"
                                : "text-[#eb5757]"
                                }`}
                            >
                              {password === confirmPassword ? "Match" : "Mismatch"}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            autoComplete="new-password"
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full pl-3 pr-9 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                              isDark
                                ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-0.5 ${
                              isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"
                            }`}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Agreement Checkbox */}
                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className={`mt-1 w-4 h-4 rounded-[4px] cursor-pointer ${
                          isDark
                            ? "border-[#23252a] text-[#e4f222] bg-[#08090a] focus:ring-0"
                            : "border-gray-300 text-gray-900 bg-white focus:ring-0"
                        }`}
                      />
                      <span className={`text-[12.5px] leading-snug ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                        I agree to the society{" "}
                        <button
                          type="button"
                          onClick={() => {
                            window.history.pushState({}, "", "/terms");
                            window.dispatchEvent(new Event("popstate"));
                          }}
                          className={`hover:underline font-medium ${isDark ? "text-[#d0d6e0]" : "text-gray-900"}`}
                        >
                          Terms of Service
                        </button>{" "}
                        and{" "}
                        <button
                          type="button"
                          onClick={() => {
                            window.history.pushState({}, "", "/privacy");
                            window.dispatchEvent(new Event("popstate"));
                          }}
                          className={`hover:underline font-medium ${isDark ? "text-[#d0d6e0]" : "text-gray-900"}`}
                        >
                          Privacy Policy
                        </button>
                        . My details will be preserved for academic verification.
                      </span>
                    </label>
                  </div>

                  {/* Primary Acid Lime CTA Button */}
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      (!regEnabled && roleMode === "member") ||
                      !agreedTerms
                    }
                    className="linear-btn-primary w-full mt-6 py-2.5 text-[14px] font-[510] tracking-[-0.011em] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <span className={`w-4 h-4 border-2 ${isDark ? "border-[#08090a]" : "border-white"} border-t-transparent rounded-full animate-spin`} />
                        <span>Creating member profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Switch to Login */}
                <div className={`border-t mt-6 pt-5 text-center ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
                  <p className={`text-[13px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                    Already registered with the society?{" "}
                    <button
                      type="button"
                      onClick={handleNavigateLogin}
                      className={`hover:underline font-[510] cursor-pointer inline-flex items-center gap-1 ${
                        isDark ? "text-white" : "text-gray-900 font-semibold"
                      }`}
                    >
                      Sign in to Console
                      <ArrowRight className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-gray-900"}`} />
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`relative z-10 w-full max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] ${
        isDark ? "text-[#62666d]" : "text-gray-400"
      }`}>
        <div className="flex items-center gap-2">
          <span>Actuarial & Data Science Society</span>
          <span>•</span>
          <span>University of Ruhuna</span>
        </div>
        <div className={`flex items-center gap-4 ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
          <button
            onClick={() => {
              window.history.pushState({}, "", "/privacy");
              window.dispatchEvent(new Event("popstate"));
            }}
            className={`transition-colors cursor-pointer ${isDark ? "hover:text-white" : "hover:text-gray-900"}`}
          >
            Privacy
          </button>
          <button
            onClick={() => {
              window.history.pushState({}, "", "/terms");
              window.dispatchEvent(new Event("popstate"));
            }}
            className={`transition-colors cursor-pointer ${isDark ? "hover:text-white" : "hover:text-gray-900"}`}
          >
            Terms
          </button>
        </div>
      </footer>
    </div>
  );
}
