import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import { useCycle } from "../context/CycleContext";
import {
  OFFICIAL_FUNCTIONAL_TEAMS,
  EXECUTIVE_FUNCTION_MANAGERS,
  EXECUTIVE_FUNCTION_VICE_PRESIDENTS,
  getValidExecutivePositions,
  FUNCTION_INFO_CARDS,
  DEFAULT_FUNCTION_AVAILABILITY,
  normalizeFunctionName,
} from "../components/PlacementQuestionnaire";
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
  FileCheck,
  Sparkles,
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
  const { activeCycle } = useCycle();

  // Form fields
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [stId, setStId] = useState("");
  const [level, setLevel] = useState("1");
  const [phone, setPhone] = useState("");
  const [memberFunction, setMemberFunction] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Executive vs Member & Dependent Function/Manager + Appeal State
  const [memberType, setMemberType] = useState(null); // null | "executive" | "member"
  const [executiveTier, setExecutiveTier] = useState("manager"); // "manager" | "vice_president"
  const [executiveFunction, setExecutiveFunction] = useState("");
  const [executiveManager, setExecutiveManager] = useState("");
  const [functionAvailability, setFunctionAvailability] = useState(DEFAULT_FUNCTION_AVAILABILITY);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [memberRegEnabled, setMemberRegEnabled] = useState(regEnabled);
  const [executiveRegEnabled, setExecutiveRegEnabled] = useState(regEnabled);
  const [memberAutoApprove, setMemberAutoApprove] = useState(false);
  const [executiveAutoApprove, setExecutiveAutoApprove] = useState(false);
  const [wantsAppeal, setWantsAppeal] = useState(null); // null | "yes" | "no"
  const [appealFunction, setAppealFunction] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Multi-step Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = roleMode === "member" && memberType === "member" ? 3 : 2;

  // Clamp currentStep if totalSteps changes
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  // Load Function Availability settings & live member counts
  useEffect(() => {
    let alive = true;
    const loadAvailability = async () => {
      try {
        const [settingsRes, countsRes] = await Promise.all([
          supabase
            .from("system_settings")
            .select("key, value")
            .in("key", [
              "function_availability",
              "registration_enabled",
              "registration_enabled_member",
              "registration_enabled_executive",
              "registration_auto_approve",
              "registration_auto_approve_member",
              "registration_auto_approve_executive",
            ]),
          (async () => { try { return await supabase.rpc("get_function_member_counts"); } catch { return { data: null }; } })(),
        ]);

        const settingsMap = {};
        if (Array.isArray(settingsRes?.data)) {
          settingsRes.data.forEach((row) => {
            settingsMap[row.key] = row.value;
          });
        }

        const fallbackReg =
          settingsMap.registration_enabled !== undefined
            ? settingsMap.registration_enabled === "true"
            : regEnabled;
        const mRegOpen =
          settingsMap.registration_enabled_member !== undefined
            ? settingsMap.registration_enabled_member === "true"
            : fallbackReg;
        const eRegOpen =
          settingsMap.registration_enabled_executive !== undefined
            ? settingsMap.registration_enabled_executive === "true"
            : fallbackReg;

        const fallbackAuto = settingsMap.registration_auto_approve === "true";
        const mAuto =
          settingsMap.registration_auto_approve_member !== undefined
            ? settingsMap.registration_auto_approve_member === "true"
            : fallbackAuto;
        const eAuto =
          settingsMap.registration_auto_approve_executive !== undefined
            ? settingsMap.registration_auto_approve_executive === "true"
            : fallbackAuto;

        let parsedSettings = {};
        if (settingsMap.function_availability) {
          try {
            parsedSettings = JSON.parse(settingsMap.function_availability) || {};
          } catch (_) {
            parsedSettings = {};
          }
        }

        const liveCounts = {};
        if (Array.isArray(countsRes?.data)) {
          countsRes.data.forEach((row) => {
            const norm = normalizeFunctionName(row.function_name);
            if (norm) {
              liveCounts[norm] = (liveCounts[norm] || 0) + Number(row.member_count || 0);
            }
          });
        }

        const nextAvailability = {};
        FUNCTION_INFO_CARDS.forEach((card) => {
          const fn = card.functionName;
          const saved = parsedSettings[fn] || {};
          const capacity = Number.isFinite(Number(saved.capacity)) && Number(saved.capacity) >= 0
            ? Number(saved.capacity)
            : card.defaultCapacity || 30;
          const filled = liveCounts[fn] !== undefined
            ? liveCounts[fn]
            : (Number.isFinite(Number(saved.filled)) ? Number(saved.filled) : 0);
          const isFull = Boolean(saved.isFull) || (capacity >= 0 && filled >= capacity);
          nextAvailability[fn] = { filled, capacity, isFull };
        });

        if (alive) {
          setFunctionAvailability(nextAvailability);
          setMemberRegEnabled(mRegOpen);
          setExecutiveRegEnabled(eRegOpen);
          setMemberAutoApprove(mAuto);
          setExecutiveAutoApprove(eAuto);
        }
      } catch (err) {
        console.warn("Could not load function availability:", err);
      } finally {
        if (alive) setAvailabilityLoading(false);
      }
    };

    loadAvailability();
    return () => {
      alive = false;
    };
  }, []);

  const stepLabels = totalSteps === 3
    ? [
        { num: 1, title: "Identity & Function", desc: "Academic & function" },
        { num: 2, title: "Make an Appeal", desc: "Optional appeal" },
        { num: 3, title: "Credentials", desc: "Photo & account" },
      ]
    : [
        { num: 1, title: "Identity", desc: "Academic & role" },
        { num: 2, title: "Credentials", desc: "Photo & account" },
      ];

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

  // Clean toggle between Executive and Member: re-initialize dependent state without stale data
  const handleMemberTypeChange = (type) => {
    setMemberType(type);
    setErrorMessage("");
    setValidationErrors({});
    if (type === "executive") {
      setMemberFunction("");
      setExecutiveTier("manager");
      setWantsAppeal(null);
      setAppealFunction("");
      setAppealReason("");
    } else if (type === "member") {
      setExecutiveTier("manager");
      setExecutiveFunction("");
      setExecutiveManager("");
      setWantsAppeal(null);
      setAppealFunction("");
      setAppealReason("");
    }
  };

  // Toggle between Function Manager and Function-wise Vice President
  const handleExecutiveTierChange = (tier) => {
    setExecutiveTier(tier);
    setErrorMessage("");
    setValidationErrors((prev) => ({
      ...prev,
      executiveManager: null,
    }));
    if (tier === "vice_president") {
      setExecutiveManager(
        executiveFunction ? EXECUTIVE_FUNCTION_VICE_PRESIDENTS[executiveFunction] || "" : ""
      );
    } else if (executiveManager.startsWith("Vice President")) {
      setExecutiveManager("");
    }
  };

  // Dependent Dropdown Handler: changing Function updates/resets Manager or Vice President role
  const handleExecutiveFunctionChange = (fn) => {
    setExecutiveFunction(fn);
    if (fn && executiveTier === "vice_president") {
      setExecutiveManager(EXECUTIVE_FUNCTION_VICE_PRESIDENTS[fn] || "");
    } else {
      setExecutiveManager("");
    }
    setErrorMessage("");
    setValidationErrors((prev) => ({
      ...prev,
      executiveFunction: null,
      executiveManager: null,
    }));
  };

  const handleSelectMemberFunction = (fn) => {
    const info = functionAvailability[fn] || { filled: 0, capacity: 30, isFull: false };
    if (info.isFull || info.filled >= info.capacity) {
      return;
    }
    setMemberFunction(fn);
    if (appealFunction === fn) {
      setAppealFunction("");
    }
    setErrorMessage("");
    setValidationErrors((prev) => ({ ...prev, memberFunction: null }));
  };

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

  // Smooth scroll helper to focus on the first invalid field
  const scrollToFirstError = (errs) => {
    setTimeout(() => {
      const keys = Object.keys(errs);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const el = document.getElementById(`field-${firstKey}`) || document.getElementById(`field-${firstKey}-input`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = el.querySelector("input, textarea, select") || el;
          if (input && typeof input.focus === "function") {
            try { input.focus(); } catch (_) {}
          }
        }
      }
    }, 60);
  };

  const validateCurrentStep = () => {
    setErrorMessage("");
    const errs = {};

    if (currentStep === 1) {
      if (!name.trim()) {
        errs.name = "Full Name is required.";
      }
      if (roleMode === "member") {
        if (!trimmedStId) {
          errs.stId = "Student ID is required.";
        } else if (!isValidStIdFormat) {
          errs.stId = "Invalid Student ID format. Expected format: SC/2022/12984";
        }
        if (memberType === null) {
          errs.memberType = "Please select whether you are an executive or a member.";
        } else if (memberType === "executive" && !executiveRegEnabled) {
          errs.memberType = "Executive registration is currently closed by administrator.";
        } else if (memberType === "member" && !memberRegEnabled) {
          errs.memberType = "Member registration is currently closed by administrator.";
        } else if (memberType === "executive") {
          const validPositions = getValidExecutivePositions(executiveFunction);
          if (!executiveFunction) {
            errs.executiveFunction = "Please select your Executive Board Function.";
          }
          if (!executiveManager) {
            errs.executiveManager =
              executiveTier === "vice_president"
                ? "Please select your Vice President role."
                : "Please select your Manager or Vice President role.";
          } else if (!validPositions.includes(executiveManager)) {
            errs.executiveManager = "Selected role does not belong to the chosen function.";
          }
        } else if (memberType === "member") {
          if (!memberFunction) {
            errs.memberFunction = "Please register for an available function below.";
          } else {
            const avail = functionAvailability[memberFunction];
            if (avail && (avail.isFull || avail.filled >= avail.capacity)) {
              errs.memberFunction = "Selected function is currently full. Please choose an available function.";
            }
          }
        }
      }

      if (Object.keys(errs).length > 0) {
        setValidationErrors(errs);
        setErrorMessage(Object.values(errs)[0]);
        scrollToFirstError(errs);
        return false;
      }
      setValidationErrors({});
      return true;
    }

    if (totalSteps === 3 && currentStep === 2) {
      if (wantsAppeal === null) {
        errs.wantsAppeal = "Please select Yes or No to indicate whether you want to make an appeal.";
      } else if (wantsAppeal === "yes") {
        if (!appealFunction) {
          errs.appealFunction = "Please select the function you want to appeal for.";
        } else if (appealFunction === memberFunction) {
          errs.appealFunction = "Appeal function must be different from your currently selected function.";
        }
        if (!appealReason || appealReason.trim().length < 5) {
          errs.appealReason = "Please explain your skills and reason for appeal (minimum 5 characters).";
        }
      }

      if (Object.keys(errs).length > 0) {
        setValidationErrors(errs);
        setErrorMessage(Object.values(errs)[0]);
        scrollToFirstError(errs);
        return false;
      }
      setValidationErrors({});
      return true;
    }

    return true;
  };

  const validateFinalStep = () => {
    setErrorMessage("");
    const errs = {};

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errs.email = "Please enter a valid email address.";
    }

    if (roleMode === "member" && !phone.trim()) {
      errs.phone = "Mobile / WhatsApp number is required.";
    }

    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match. Please re-check both fields.";
    }

    if (!agreedTerms) {
      errs.agreedTerms = "You must agree to the Terms of Service & Privacy Policy.";
    }

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      setErrorMessage(Object.values(errs)[0] || "Please fill all required credentials.");
      scrollToFirstError(errs);
      return false;
    }
    setValidationErrors({});
    return true;
  };

  const handleNextStep = (e) => {
    if (e) e.preventDefault();
    if (validateCurrentStep()) {
      setErrorMessage("");
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setErrorMessage("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleJumpToStep = (targetStep) => {
    if (targetStep < currentStep) {
      setErrorMessage("");
      setCurrentStep(targetStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (targetStep > currentStep) {
      if (validateCurrentStep()) {
        setErrorMessage("");
        setCurrentStep(targetStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (currentStep < totalSteps) {
      handleNextStep(e);
    } else {
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage("");

    if (!validateFinalStep()) {
      return;
    }

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

    if (roleMode === "member") {
      if (memberType === null) {
        setErrorMessage("Please answer the required question: Are you an executive or a member?");
        return;
      }

      if (memberType === "executive") {
        const validPositions = getValidExecutivePositions(executiveFunction);
        if (!executiveFunction || !executiveManager || !validPositions.includes(executiveManager)) {
          setErrorMessage("Please select a valid Executive Board Function and corresponding Manager or Vice President role.");
          return;
        }
      } else {
        if (!memberFunction) {
          setErrorMessage("Please select an available function under Function-wise information.");
          return;
        }
        const avail = functionAvailability[memberFunction];
        if (avail && (avail.isFull || avail.filled >= avail.capacity)) {
          setErrorMessage("The selected function is full. Please choose an available function.");
          return;
        }
        if (wantsAppeal === null) {
          setErrorMessage("Please indicate whether you want to make an appeal.");
          return;
        }
        if (wantsAppeal === "yes") {
          if (!appealFunction || appealFunction === memberFunction) {
            setErrorMessage("Please select a valid target function for your appeal.");
            return;
          }
          if (!appealReason || appealReason.trim().length < 5) {
            setErrorMessage("Please explain your skills and reason for appeal (minimum 5 characters).");
            return;
          }
        }
      }
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

      // 3. Check if registration is closed for the selected track (or globally)
      const selectedTrackOpen =
        roleMode !== "member"
          ? regEnabled
          : memberType === "executive"
          ? executiveRegEnabled
          : memberRegEnabled;
      if ((!regEnabled || !selectedTrackOpen) && !isPreRegistered && !canRegisterStaff) {
        setErrorMessage(
          memberType === "executive"
            ? "Executive registration is currently closed by administrator."
            : memberType === "member"
            ? "Member registration is currently closed by administrator."
            : "General membership registration is currently closed. If you are authorized staff, ensure your invite is active."
        );
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

          // Ensure this Student ID is not already claimed by another registered member
          try {
            const { data: stIdAvailable, error: stIdCheckErr } = await supabase
              .rpc("check_st_id_available", { p_st_id: finalStId });
            if (!stIdCheckErr && stIdAvailable === false) {
              setErrorMessage(`Student ID ${finalStId} is already registered to another member. Please check your Student ID or sign in to your existing account.`);
              setLoading(false);
              return;
            }
          } catch (_) {
            // Ignore if RPC is not yet deployed; handle_new_user trigger still enforces uniqueness
          }
        }
      }

      // 5. Upload profile picture if chosen
      let profileImageUrl = null;
      let optimizedFile = null;
      let photoUploadDeferred = false;

      if (profileImageFile) {
        try {
          optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);
          const cleanStId = (finalStId || "user").replace(/\//g, "-");
          const fileName = `${cleanStId}_${Date.now()}.jpg`;

          // Attempt upload before signup (works when bucket has public insert policy)
          const { error: uploadError } = await supabase.storage
            .from("profile_images")
            .upload(fileName, optimizedFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            // Check if error is due to RLS policy or unauthenticated anon upload restriction
            const isRlsOrAuthError =
              uploadError.message?.toLowerCase().includes("row-level security") ||
              uploadError.message?.toLowerCase().includes("violates") ||
              uploadError.statusCode === "42501" ||
              uploadError.statusCode === 403 ||
              uploadError.error === "Unauthorized";

            if (isRlsOrAuthError) {
              console.warn("Storage RLS prevented pre-signup upload. Photo upload will be retried after session is established.");
              photoUploadDeferred = true;
            } else {
              throw new Error("Failed to upload profile image: " + uploadError.message);
            }
          } else {
            const { data: urlData } = supabase.storage
              .from("profile_images")
              .getPublicUrl(fileName);

            profileImageUrl = urlData?.publicUrl || null;
          }
        } catch (imgErr) {
          if (!photoUploadDeferred) {
            setErrorMessage(imgErr.message || "Failed to process photo upload.");
            setLoading(false);
            return;
          }
        }
      }

      const finalLevel = level || "1";
      const isExecutive = roleMode === "member" && memberType === "executive";
      const isMemberAppeal = roleMode === "member" && memberType === "member" && wantsAppeal === "yes";

      const applicantStatus = isExecutive
        ? (executiveAutoApprove ? "approved" : "pending")
        : isMemberAppeal
        ? "pending_editor_review"
        : (memberAutoApprove ? "approved" : "pending");
      const finalMemberFunction = isPreRegistered
        ? null
        : targetRole === "member"
        ? isExecutive
          ? executiveFunction
          : memberFunction
        : null;
      const finalStPosition = isPreRegistered
        ? null
        : targetRole === "member"
        ? isExecutive
          ? executiveManager
          : "Member"
        : null;
      const membershipStatusValue = isExecutive ? "executive" : "member";
      const assessmentPayload = isExecutive
        ? {
            type: "executive_board",
            executiveTier: executiveManager.startsWith("Vice President") ? "vice_president" : "manager",
            executiveFunction,
            executiveManager,
            academicStanding: `Level ${finalLevel === "4" ? "IV" : finalLevel === "3" ? "III" : finalLevel === "2" ? "II" : "I"}`,
          }
        : isMemberAppeal
        ? {
            type: "function_appeal",
            isAppeal: true,
            assignedFunction: memberFunction,
            appealFunction,
            appealReason: appealReason.trim(),
            firstChoiceFunction: appealFunction,
            secondChoiceFunction: memberFunction,
            contributionNote: appealReason.trim(),
            academicStanding: `Level ${finalLevel === "4" ? "IV" : finalLevel === "3" ? "III" : finalLevel === "2" ? "II" : "I"}`,
          }
        : null;

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
            level: finalLevel,
            mobile_number: isPreRegistered ? null : phone.trim(),
            member_function: finalMemberFunction,
            st_position: finalStPosition,
            executive_function: isExecutive ? executiveFunction : null,
            executive_manager: isExecutive ? executiveManager : null,
            profile_image_url: profileImageUrl,
            is_existing_member: true,
            membership_status: membershipStatusValue,
            applicant_status: applicantStatus,
            skills_assessment: assessmentPayload,
            portfolio_url: null,
            contribution_note: isMemberAppeal ? appealReason.trim() : null,
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
        // If photo upload was deferred due to RLS, retry now with the authenticated user session
        if (photoUploadDeferred && optimizedFile) {
          try {
            const cleanStId = (finalStId || "user").replace(/\//g, "-");
            const fileName = `${cleanStId}_${Date.now()}.jpg`;
            const { error: authUploadErr } = await supabase.storage
              .from("profile_images")
              .upload(fileName, optimizedFile, {
                cacheControl: "3600",
                upsert: false,
              });

            if (!authUploadErr) {
              const { data: urlData } = supabase.storage
                .from("profile_images")
                .getPublicUrl(fileName);
              profileImageUrl = urlData?.publicUrl || null;

              if (profileImageUrl) {
                const targetStId = isPreRegistered ? v_st_id : finalStId;
                if (targetStId) {
                  await supabase
                    .from("members")
                    .update({ profile_image_url: profileImageUrl })
                    .eq("st_id", targetStId);
                }
                try {
                  await supabase.auth.updateUser({
                    data: { profile_image_url: profileImageUrl }
                  });
                } catch (_) {}
              }
            } else {
              console.warn("Authenticated photo upload failed:", authUploadErr.message);
            }
          } catch (postUploadErr) {
            console.warn("Deferred photo upload error:", postUploadErr);
          }
        }

        // Persist Executive or Appeal metadata cleanly if session is active
        if (roleMode === "member") {
          const profilePatch = {
            membership_status: membershipStatusValue,
            skills_assessment: assessmentPayload,
            contribution_note: isMemberAppeal ? appealReason.trim() : null,
          };
          if (isMemberAppeal) {
            profilePatch.status = "pending_editor_review";
          }
          try {
            await supabase
              .from("profiles")
              .update(profilePatch)
              .eq("id", data.user.id);
          } catch (_) {}

          if (finalStId && !isPreRegistered) {
            try {
              await supabase
                .from("members")
                .update({
                  member_function: finalMemberFunction,
                  st_position: finalStPosition,
                  membership_status: membershipStatusValue,
                  skills_assessment: assessmentPayload,
                })
                .eq("st_id", finalStId);
            } catch (_) {}
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role, st_id, full_name, preferred_name, email")
          .eq("id", data.user.id)
          .maybeSingle();

        const userStatus = isMemberAppeal
          ? "pending_editor_review"
          : (profile?.status || "approved");

        const userRole = profile?.role || targetRole;

        const profileData = {
          role: userRole,
          stId: profile?.st_id || (isPreRegistered ? v_st_id : finalStId),
          name: v_preferred_name || v_name,
          fullName: v_name,
          preferredName: v_preferred_name || "",
          email: cleanEmail,
          userId: data.user.id,
          status: userStatus,
        };

        if (onRegisterSuccess) {
          onRegisterSuccess(
            profileData,
            userStatus === "pending" || userStatus === "pending_editor_review"
          );
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
          photoDeferred: photoUploadDeferred,
          pendingEditorReview: isMemberAppeal,
          autoApproved: !isMemberAppeal && (isPreRegistered || (isExecutive ? executiveAutoApprove : memberAutoApprove)),
          memberType: roleMode === "member" ? memberType : "staff",
          appealFunction: isMemberAppeal ? appealFunction : null,
          assignedFunction: memberType === "member" ? memberFunction : executiveFunction,
          executiveManager: isExecutive ? executiveManager : null,
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
          <div className={`w-9 h-9 rounded-[7px] border flex items-center justify-center p-1 ${
            isDark ? "bg-[#161718] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
          }`}>
            <img
              alt="ADSS Logo"
              className="w-full h-full object-contain"
              src={`${import.meta.env.BASE_URL}${isDark ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
            />
          </div>
          <span className={`text-[15px] font-[590] tracking-[-0.015em] hidden sm:inline ${
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

                {successInfo.pendingEditorReview ? (
                  <div className={`max-w-[480px] mx-auto mb-6 p-4 rounded-[8px] border text-[13px] text-left flex items-start gap-3 ${
                    isDark ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]" : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}>
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#f59e0b]" />
                    <div>
                      <strong className="block text-[13.5px] font-[510] mb-0.5">
                        Function Appeal Submitted for Executive Review
                      </strong>
                      <span className="leading-relaxed block">
                        You registered under <strong>{successInfo.assignedFunction}</strong> and submitted an appeal to move to <strong>{successInfo.appealFunction}</strong>. The executive committee will review your skills explanation.
                      </span>
                    </div>
                  </div>
                ) : successInfo.autoApproved ? (
                  <div className={`max-w-[480px] mx-auto mb-6 p-4 rounded-[8px] border text-[13px] text-left flex items-start gap-3 ${
                    isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}>
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#27a644]" />
                    <div>
                      <strong className="block text-[13.5px] font-[510] mb-0.5">
                        Auto-Approval Enabled
                      </strong>
                      <span className="leading-relaxed block">
                        Your registration is pre-approved. Once you verify your email link, you can sign in immediately.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[480px] mx-auto mb-6 p-4 rounded-[8px] border text-[13px] text-left flex items-start gap-3 ${
                    isDark ? "bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "bg-gray-50 border-gray-200 text-gray-800"
                  }`}>
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-sky-400" />
                    <div>
                      <strong className="block text-[13.5px] font-[510] mb-0.5">
                        Pending Administrator Approval
                      </strong>
                      <span className="leading-relaxed block">
                        After confirming your email, an administrator will review and approve your registration.
                      </span>
                    </div>
                  </div>
                )}

                {successInfo.photoDeferred && (
                  <div className={`max-w-[440px] mx-auto mb-6 p-3 rounded-[8px] border text-[12.5px] text-left flex items-start gap-2.5 ${
                    isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}>
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#e4f222]" />
                    <span>Your account details were registered. Once you confirm your email and log in, you can add your digital pass photo under <strong>My Info</strong>.</span>
                  </div>
                )}

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
                    <span>ONBOARDING // {activeCycle?.name || "2024/2025"} CYCLE</span>
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

                {/* Registration Multi-Step Form */}
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  {/* Stepper Progress Bar */}
                  <div className="space-y-2.5 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded-[4px] border ${
                          isDark
                            ? "bg-[#161718] border-[#23252a] text-[#e4f222]"
                            : "bg-lime-50 border-lime-200 text-lime-800"
                        }`}>
                          STEP {currentStep} OF {totalSteps}
                        </span>
                        <span className={`text-[13px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                          {stepLabels[currentStep - 1]?.title}
                        </span>
                      </div>
                      <span className={`text-[11.5px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                        {Math.round((currentStep / totalSteps) * 100)}% Complete
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-[#161718]" : "bg-gray-100"}`}>
                      <div
                        className="h-full bg-gradient-to-r from-[#e4f222] to-emerald-400 transition-all duration-300 ease-out"
                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                      />
                    </div>

                    {/* Segmented Step Buttons */}
                    <div className={`grid ${totalSteps === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1.5 pt-1`}>
                      {stepLabels.map((s) => {
                        const isPast = s.num < currentStep;
                        const isCurrent = s.num === currentStep;
                        return (
                          <button
                            key={s.num}
                            type="button"
                            onClick={() => handleJumpToStep(s.num)}
                            disabled={!isPast && !isCurrent}
                            className={`text-left py-1.5 px-2 rounded-[5px] border transition-all text-[11px] truncate flex items-center gap-1.5 ${
                              isCurrent
                                ? isDark
                                  ? "bg-[#161718] border-[#e4f222]/50 text-white font-[510]"
                                  : "bg-white border-lime-500 text-gray-900 shadow-sm font-semibold"
                                : isPast
                                ? isDark
                                  ? "bg-[#0f1011] border-[#23252a] text-[#27a644] hover:border-[#383b3f] cursor-pointer"
                                  : "bg-gray-50 border-gray-200 text-emerald-600 hover:border-gray-300 cursor-pointer"
                                : isDark
                                ? "bg-transparent border-transparent text-[#62666d] cursor-not-allowed opacity-50"
                                : "bg-transparent border-transparent text-gray-400 cursor-not-allowed opacity-50"
                            }`}
                          >
                            {isPast ? (
                              <Check className="w-3 h-3 text-[#27a644] flex-shrink-0" />
                            ) : (
                              <span className={`w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-berkeley-mono flex-shrink-0 ${
                                isCurrent
                                  ? isDark
                                    ? "bg-[#e4f222] text-[#08090a] font-bold"
                                    : "bg-gray-900 text-white font-bold"
                                  : isDark
                                  ? "bg-[#23252a] text-[#8a8f98]"
                                  : "bg-gray-200 text-gray-600"
                              }`}>
                                {s.num}
                              </span>
                            )}
                            <span className="truncate">{s.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── STEP 1: Academic Identity & Membership Status ── */}
                  {currentStep === 1 && (
                    <div className="space-y-4 animate-in fade-in-50 duration-200">
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
                        <div id="field-name">
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
                              onChange={(e) => {
                                setName(e.target.value);
                                if (validationErrors.name) {
                                  setValidationErrors((prev) => ({ ...prev, name: null }));
                                }
                              }}
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                validationErrors.name
                                  ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                  : isDark
                                  ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                  : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                              }`}
                            />
                          </div>
                          {validationErrors.name && (
                            <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{validationErrors.name}</span>
                            </p>
                          )}
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
                            <div id="field-stId">
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
                                onChange={(e) => {
                                  setStId(e.target.value);
                                  if (validationErrors.stId) {
                                    setValidationErrors((prev) => ({ ...prev, stId: null }));
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] font-berkeley-mono transition-colors focus:outline-none ${
                                  validationErrors.stId
                                    ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                    : isDark
                                    ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                    : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                                }`}
                              />
                              {validationErrors.stId && (
                                <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{validationErrors.stId}</span>
                                </p>
                              )}
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

                          {/* ── Required Question: Are you an executive or a member? ── */}
                          <div id="field-memberType" className={`space-y-2 pt-1 p-2.5 -mx-2.5 rounded-[8px] transition-all ${
                            validationErrors.memberType
                              ? "border border-[#eb5757] ring-1 ring-[#eb5757] bg-[#eb5757]/5"
                              : ""
                          }`}>
                            <div className="flex items-center justify-between">
                              <label className={`block text-[13px] font-[510] ${
                                isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                              }`}>
                                Are you an executive or a member? <span className="text-[#eb5757]">*</span>
                              </label>
                              <span className={`text-[11px] font-berkeley-mono ${
                                validationErrors.memberType
                                  ? "text-[#eb5757] font-semibold"
                                  : isDark ? "text-[#8a8f98]" : "text-gray-500"
                              }`}>
                                Required
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {/* Option: Executive */}
                              <label className={`p-3 rounded-[6px] border flex items-center gap-3 transition-all ${
                                !executiveRegEnabled
                                  ? isDark
                                    ? "bg-[#111214] border-[#23252a] text-[#62666d] opacity-60 cursor-not-allowed"
                                    : "bg-gray-100 border-gray-200 text-gray-400 opacity-70 cursor-not-allowed"
                                  : memberType === "executive"
                                  ? isDark
                                    ? "bg-[#161718] border-[#e4f222] text-white shadow-sm cursor-pointer"
                                    : "bg-indigo-50 border-indigo-500 text-indigo-900 font-medium shadow-sm cursor-pointer"
                                  : isDark
                                  ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f] cursor-pointer"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 cursor-pointer"
                              }`}>
                                <input
                                  type="radio"
                                  name="member_type"
                                  disabled={!executiveRegEnabled}
                                  checked={memberType === "executive"}
                                  onChange={() => executiveRegEnabled && handleMemberTypeChange("executive")}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                  memberType === "executive"
                                    ? isDark
                                      ? "border-[#e4f222] bg-[#e4f222]"
                                      : "border-indigo-600 bg-indigo-600"
                                    : isDark
                                    ? "border-[#383b3f] bg-[#0f1011]"
                                    : "border-gray-300 bg-white"
                                }`}>
                                  {memberType === "executive" && <div className="w-1.5 h-1.5 rounded-full bg-[#08090a]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-[510] block leading-tight">Executive</span>
                                    <span className={`font-berkeley-mono text-[9px] px-1.5 py-0.5 rounded-[3px] border ${
                                      executiveRegEnabled
                                        ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                                        : "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                                    }`}>
                                      {executiveRegEnabled ? "OPEN" : "CLOSED"}
                                    </span>
                                  </div>
                                  <span className={`text-[11px] block truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                    ADSS Ruhuna Elected Executive Board
                                  </span>
                                </div>
                              </label>

                              {/* Option: Member */}
                              <label className={`p-3 rounded-[6px] border flex items-center gap-3 transition-all ${
                                !memberRegEnabled
                                  ? isDark
                                    ? "bg-[#111214] border-[#23252a] text-[#62666d] opacity-60 cursor-not-allowed"
                                    : "bg-gray-100 border-gray-200 text-gray-400 opacity-70 cursor-not-allowed"
                                  : memberType === "member"
                                  ? isDark
                                    ? "bg-[#161718] border-[#e4f222] text-white shadow-sm cursor-pointer"
                                    : "bg-indigo-50 border-indigo-500 text-indigo-900 font-medium shadow-sm cursor-pointer"
                                  : isDark
                                  ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f] cursor-pointer"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 cursor-pointer"
                              }`}>
                                <input
                                  type="radio"
                                  name="member_type"
                                  disabled={!memberRegEnabled}
                                  checked={memberType === "member"}
                                  onChange={() => memberRegEnabled && handleMemberTypeChange("member")}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                  memberType === "member"
                                    ? isDark
                                      ? "border-[#e4f222] bg-[#e4f222]"
                                      : "border-indigo-600 bg-indigo-600"
                                    : isDark
                                    ? "border-[#383b3f] bg-[#0f1011]"
                                    : "border-gray-300 bg-white"
                                }`}>
                                  {memberType === "member" && <div className="w-1.5 h-1.5 rounded-full bg-[#08090a]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-[510] block leading-tight">Member</span>
                                    <span className={`font-berkeley-mono text-[9px] px-1.5 py-0.5 rounded-[3px] border ${
                                      memberRegEnabled
                                        ? "bg-[#27a644]/10 text-[#27a644] border-[#27a644]/30"
                                        : "bg-[#eb5757]/10 text-[#eb5757] border-[#eb5757]/30"
                                    }`}>
                                      {memberRegEnabled ? "OPEN" : "CLOSED"}
                                    </span>
                                  </div>
                                  <span className={`text-[11px] block truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                    Select a functional team & register
                                  </span>
                                </div>
                              </label>
                            </div>
                            {validationErrors.memberType && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.memberType}</span>
                              </p>
                            )}
                          </div>

                          {/* ── EXECUTIVE FLOW: Function-wise Dependent Dropdown System ── */}
                          {memberType === "executive" && (
                            <div className={`p-4 rounded-[10px] border space-y-4 animate-in fade-in-50 duration-200 ${
                              isDark ? "bg-[#131416] border-[#27292e]" : "bg-gray-50/80 border-gray-200"
                            }`}>
                              <div className="flex items-start gap-2.5">
                                <Briefcase className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                                <div>
                                  <span className={`text-[13px] font-[510] block ${isDark ? "text-white" : "text-gray-900"}`}>
                                    ADSS Ruhuna Elected Executive Board
                                  </span>
                                  <span className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                                    Choose whether you are applying as a Function Manager or Function-wise Vice President, then select your Function.
                                  </span>
                                </div>
                              </div>

                              {/* Executive Role Type: Function Manager vs Vice President */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleExecutiveTierChange("manager")}
                                  className={`p-2.5 rounded-[6px] border text-left transition-all cursor-pointer ${
                                    executiveTier === "manager"
                                      ? isDark
                                        ? "bg-[#161718] border-[#e4f222] text-white shadow-sm"
                                        : "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm"
                                      : isDark
                                      ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                  }`}
                                >
                                  <span className="text-[12.5px] font-[510] block">Function Manager</span>
                                  <span className={`text-[11px] block ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                    Select Function & Manager role
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExecutiveTierChange("vice_president")}
                                  className={`p-2.5 rounded-[6px] border text-left transition-all cursor-pointer ${
                                    executiveTier === "vice_president"
                                      ? isDark
                                        ? "bg-[#161718] border-[#e4f222] text-white shadow-sm"
                                        : "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm"
                                      : isDark
                                      ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                                  }`}
                                >
                                  <span className="text-[12.5px] font-[510] block">Vice President</span>
                                  <span className={`text-[11px] block ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                    Function-wise Vice President
                                  </span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Function Dropdown */}
                                <div id="field-executiveFunction">
                                  <label
                                    htmlFor="field-executiveFunction-select"
                                    className={`block text-[13px] font-[510] mb-1.5 ${
                                      isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                                    }`}
                                  >
                                    Function <span className="text-[#eb5757]">*</span>
                                  </label>
                                  <select
                                    id="field-executiveFunction-select"
                                    value={executiveFunction}
                                    required
                                    onChange={(e) => handleExecutiveFunctionChange(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                      validationErrors.executiveFunction
                                        ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                        : isDark
                                        ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                                        : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                                    }`}
                                  >
                                    <option value="">Select a function</option>
                                    {OFFICIAL_FUNCTIONAL_TEAMS.map((fn) => (
                                      <option key={fn} value={fn}>
                                        {fn}
                                      </option>
                                    ))}
                                  </select>
                                  {validationErrors.executiveFunction && (
                                    <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span>{validationErrors.executiveFunction}</span>
                                    </p>
                                  )}
                                </div>

                                {/* Manager / Vice President Dependent Dropdown */}
                                <div id="field-executiveManager">
                                  <label
                                    htmlFor="field-executiveManager-select"
                                    className={`block text-[13px] font-[510] mb-1.5 ${
                                      isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                                    }`}
                                  >
                                    {executiveTier === "vice_president" ? "Vice President Role" : "Manager"}{" "}
                                    <span className="text-[#eb5757]">*</span>
                                  </label>
                                  <select
                                    id="field-executiveManager-select"
                                    value={executiveManager}
                                    disabled={!executiveFunction}
                                    required
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setExecutiveManager(val);
                                      if (val) {
                                        setExecutiveTier(val.startsWith("Vice President") ? "vice_president" : "manager");
                                      }
                                      if (validationErrors.executiveManager) {
                                        setValidationErrors((prev) => ({ ...prev, executiveManager: null }));
                                      }
                                    }}
                                    className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                      !executiveFunction
                                        ? isDark
                                          ? "bg-[#111214] border-[#23252a] text-[#62666d] cursor-not-allowed opacity-70"
                                          : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                        : validationErrors.executiveManager
                                        ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                        : isDark
                                        ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                                        : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                                    }`}
                                  >
                                    <option value="">
                                      {!executiveFunction
                                        ? "Select a function first"
                                        : executiveTier === "vice_president"
                                        ? "Select Vice President role"
                                        : "Select a manager"}
                                    </option>
                                    {executiveFunction && EXECUTIVE_FUNCTION_VICE_PRESIDENTS[executiveFunction] && (
                                      <optgroup label="Function Vice President">
                                        <option value={EXECUTIVE_FUNCTION_VICE_PRESIDENTS[executiveFunction]}>
                                          {EXECUTIVE_FUNCTION_VICE_PRESIDENTS[executiveFunction]}
                                        </option>
                                      </optgroup>
                                    )}
                                    {executiveFunction && (EXECUTIVE_FUNCTION_MANAGERS[executiveFunction] || []).length > 0 && (
                                      <optgroup label="Function Managers">
                                        {(EXECUTIVE_FUNCTION_MANAGERS[executiveFunction] || []).map((mgr) => (
                                          <option key={mgr} value={mgr}>
                                            {mgr}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  {validationErrors.executiveManager && (
                                    <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span>{validationErrors.executiveManager}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── MEMBER FLOW: Function-wise information cards ── */}
                          {memberType === "member" && (
                            <div id="field-memberFunction" className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <h3 className={`text-[14px] font-[590] ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Function-wise information. <span className="text-[#eb5757]">*</span>
                                  </h3>
                                  <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                                    Read each function&apos;s scope and click Register on an available function. Full functions cannot be selected.
                                  </p>
                                </div>
                                {availabilityLoading && (
                                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                    Syncing...
                                  </span>
                                )}
                              </div>

                              <div className={`space-y-3 p-1 rounded-[10px] ${
                                validationErrors.memberFunction
                                  ? isDark
                                    ? "border border-[#eb5757]/60 bg-[#eb5757]/5"
                                    : "border border-rose-400 bg-rose-50/40"
                                  : ""
                              }`}>
                                {FUNCTION_INFO_CARDS.map((card) => {
                                  const Icon = card.icon;
                                  const avail = functionAvailability[card.functionName] || {
                                    filled: 0,
                                    capacity: card.defaultCapacity || 30,
                                    isFull: false,
                                  };
                                  const isFull = Boolean(avail.isFull) || avail.filled >= avail.capacity;
                                  const isSelected = memberFunction === card.functionName;

                                  return (
                                    <div
                                      key={card.id}
                                      className={`rounded-[10px] border p-4 transition-all ${
                                        isFull
                                          ? isDark
                                            ? "bg-[#0c0d0e] border-[#1f2126] opacity-55 grayscale cursor-not-allowed"
                                            : "bg-gray-100/90 border-gray-200 opacity-60 grayscale cursor-not-allowed"
                                          : isSelected
                                          ? isDark
                                            ? "bg-[#15171b] border-[#e4f222] shadow-sm shadow-[#e4f222]/10"
                                            : "bg-indigo-50/70 border-indigo-500 shadow-sm"
                                          : isDark
                                          ? "bg-[#121316] border-[#25272d] hover:border-[#3a3d45]"
                                          : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
                                      }`}
                                    >
                                      {/* Card Header: Function Name + Availability Badge */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0"
                                            style={{
                                              backgroundColor: `${card.color}18`,
                                              color: card.color,
                                              border: `1px solid ${card.color}35`,
                                            }}
                                          >
                                            <Icon className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0">
                                            <span className={`text-[14px] font-[590] block leading-tight ${
                                              isDark ? "text-white" : "text-gray-900"
                                            }`}>
                                              {card.functionName}
                                            </span>
                                            <span className={`text-[11px] font-berkeley-mono ${
                                              isDark ? "text-[#8a8f98]" : "text-gray-500"
                                            }`}>
                                              {card.badge}
                                            </span>
                                          </div>
                                        </div>

                                        <span
                                          className={`text-[11.5px] font-berkeley-mono px-2.5 py-1 rounded-[6px] border flex-shrink-0 ${
                                            isFull
                                              ? isDark
                                                ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]"
                                                : "bg-red-50 border-red-200 text-red-700"
                                              : isDark
                                              ? "bg-[#181a1f] border-[#2e3138] text-[#d0d6e0]"
                                              : "bg-gray-50 border-gray-300 text-gray-800"
                                          }`}
                                        >
                                          {isFull
                                            ? `Full ${avail.filled}/${avail.capacity}`
                                            : `Now available ${avail.filled}/${avail.capacity}`}
                                        </span>
                                      </div>

                                      {/* 4-Line Function Description */}
                                      <div className={`space-y-1 text-[12.5px] leading-relaxed mb-3.5 ${
                                        isDark ? "text-[#9ca3af]" : "text-gray-600"
                                      }`}>
                                        {card.descriptionLines.map((line, idx) => (
                                          <p key={idx}>{line}</p>
                                        ))}
                                      </div>

                                      {/* Register / Selected Action */}
                                      <div className="flex justify-center sm:justify-end">
                                        <button
                                          type="button"
                                          disabled={isFull}
                                          onClick={() => handleSelectMemberFunction(card.functionName)}
                                          className={`px-5 py-1.5 rounded-[6px] border text-[12.5px] font-[510] transition-all flex items-center gap-1.5 ${
                                            isFull
                                              ? isDark
                                                ? "bg-[#161718] border-[#23252a] text-[#62666d] cursor-not-allowed"
                                                : "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed"
                                              : isSelected
                                              ? isDark
                                                ? "bg-[#e4f222] border-[#e4f222] text-[#08090a] font-semibold cursor-pointer"
                                                : "bg-indigo-600 border-indigo-600 text-white font-semibold cursor-pointer"
                                              : isDark
                                              ? "bg-[#161718] border-[#32353e] text-[#d0d6e0] hover:text-white hover:border-[#e4f222]/60 cursor-pointer"
                                              : "bg-white border-gray-300 text-gray-800 hover:border-indigo-500 hover:text-indigo-700 cursor-pointer shadow-sm"
                                          }`}
                                        >
                                          {isFull ? (
                                            <>
                                              <Lock className="w-3.5 h-3.5" />
                                              <span>Full — Cannot Select</span>
                                            </>
                                          ) : isSelected ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                              <span>Registered ({card.functionName})</span>
                                            </>
                                          ) : (
                                            <span>Register</span>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {validationErrors.memberFunction && (
                                <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{validationErrors.memberFunction}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Step 1 Inline Error Banner */}
                      {errorMessage && (
                        <div className={`p-3 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                          isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="leading-snug">{errorMessage}</div>
                        </div>
                      )}

                      {/* Step 1 Actions */}
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="linear-btn-primary px-5 py-2.5 text-[13.5px] font-[510] flex items-center gap-2 cursor-pointer"
                        >
                          <span>
                            {roleMode === "member" && memberType === "member"
                              ? "Next: Make an Appeal"
                              : "Next: Pass Photo & Credentials"}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 2 (when Member flow = 3 steps): Make an Appeal ── */}
                  {totalSteps === 3 && currentStep === 2 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-200">
                      <div className={`flex items-center justify-between pb-1 border-b ${
                        isDark ? "border-[#23252a]/60" : "border-gray-200"
                      }`}>
                        <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                          isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                        }`}>
                          02 // Function Appeal
                        </span>
                        <span className={`text-[11.5px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                          isDark
                            ? "bg-[#161718] border-[#27292e] text-[#e4f222]"
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"
                        }`}>
                          Registered: {memberFunction}
                        </span>
                      </div>

                      {/* Ask whether member wants to make an appeal */}
                      <div id="field-wantsAppeal" className={`space-y-2.5 p-2.5 -mx-2.5 rounded-[8px] transition-all ${
                        validationErrors.wantsAppeal
                          ? "border border-[#eb5757] ring-1 ring-[#eb5757] bg-[#eb5757]/5"
                          : ""
                      }`}>
                        <div className="flex items-center justify-between">
                          <label className={`block text-[13.5px] font-[510] ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}>
                            Do you want to make an appeal for another function? <span className="text-[#eb5757]">*</span>
                          </label>
                          <span className={`text-[11px] font-berkeley-mono ${
                            validationErrors.wantsAppeal
                              ? "text-[#eb5757] font-semibold"
                              : isDark ? "text-[#8a8f98]" : "text-gray-500"
                          }`}>
                            Required
                          </span>
                        </div>
                        <p className={`text-[12px] leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                          If your first-choice function was full or you want to move to another function based on your skills, select <strong>Yes</strong> to submit an appeal.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <label className={`p-3 rounded-[6px] border flex items-center gap-3 cursor-pointer transition-all ${
                            wantsAppeal === "no"
                              ? isDark
                                ? "bg-[#161718] border-[#e4f222] text-white shadow-sm"
                                : "bg-indigo-50 border-indigo-500 text-indigo-900 font-medium shadow-sm"
                              : isDark
                              ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}>
                            <input
                              type="radio"
                              name="wants_appeal"
                              checked={wantsAppeal === "no"}
                              onChange={() => {
                                setWantsAppeal("no");
                                setAppealFunction("");
                                setAppealReason("");
                                setErrorMessage("");
                                setValidationErrors((prev) => ({
                                  ...prev,
                                  wantsAppeal: null,
                                  appealFunction: null,
                                  appealReason: null,
                                }));
                              }}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                              wantsAppeal === "no"
                                ? isDark
                                  ? "border-[#e4f222] bg-[#e4f222]"
                                  : "border-indigo-600 bg-indigo-600"
                                : isDark
                                ? "border-[#383b3f] bg-[#0f1011]"
                                : "border-gray-300 bg-white"
                            }`}>
                              {wantsAppeal === "no" && <div className="w-1.5 h-1.5 rounded-full bg-[#08090a]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[13px] font-[510] block leading-tight">No, keep {memberFunction}</span>
                              <span className={`text-[11px] block truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                Continue without an appeal
                              </span>
                            </div>
                          </label>

                          <label className={`p-3 rounded-[6px] border flex items-center gap-3 cursor-pointer transition-all ${
                            wantsAppeal === "yes"
                              ? isDark
                                ? "bg-[#161718] border-[#e4f222] text-white shadow-sm"
                                : "bg-indigo-50 border-indigo-500 text-indigo-900 font-medium shadow-sm"
                              : isDark
                              ? "bg-[#0f1011] border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}>
                            <input
                              type="radio"
                              name="wants_appeal"
                              checked={wantsAppeal === "yes"}
                              onChange={() => {
                                setWantsAppeal("yes");
                                setErrorMessage("");
                                setValidationErrors((prev) => ({ ...prev, wantsAppeal: null }));
                              }}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                              wantsAppeal === "yes"
                                ? isDark
                                  ? "border-[#e4f222] bg-[#e4f222]"
                                  : "border-indigo-600 bg-indigo-600"
                                : isDark
                                ? "border-[#383b3f] bg-[#0f1011]"
                                : "border-gray-300 bg-white"
                            }`}>
                              {wantsAppeal === "yes" && <div className="w-1.5 h-1.5 rounded-full bg-[#08090a]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[13px] font-[510] block leading-tight">Yes, make an appeal</span>
                              <span className={`text-[11px] block truncate ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                                Request a move & explain skills
                              </span>
                            </div>
                          </label>
                        </div>
                        {validationErrors.wantsAppeal && (
                          <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{validationErrors.wantsAppeal}</span>
                          </p>
                        )}
                      </div>

                      {/* Make an appeal Panel (shown when Yes is selected) */}
                      {wantsAppeal === "yes" && (
                        <div className={`p-5 rounded-[10px] border space-y-4 animate-in fade-in-50 duration-200 ${
                          isDark ? "bg-[#131416] border-[#2a2d34]" : "bg-gray-50/80 border-gray-200"
                        }`}>
                          <div>
                            <h3 className={`text-[18px] font-[590] tracking-[-0.015em] ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}>
                              Make an appeal
                            </h3>
                            <p className={`text-[12.5px] mt-1 leading-relaxed ${
                              isDark ? "text-[#8a8f98]" : "text-gray-600"
                            }`}>
                              Tell the executive committee which function you want to move to and explain your relevant skills.
                            </p>
                            <p className={`text-[13px] font-[510] mt-2 ${
                              isDark ? "text-[#d0d6e0]" : "text-gray-800"
                            }`}>
                              What are your skills — explain
                            </p>
                          </div>

                          {/* Target Function Dropdown */}
                          <div id="field-appealFunction" className="max-w-sm">
                            <label
                              htmlFor="field-appealFunction-select"
                              className={`block text-[12.5px] font-[510] mb-1.5 ${
                                isDark ? "text-[#d0d6e0]" : "text-gray-700"
                              }`}
                            >
                              Function <span className="text-[#eb5757]">*</span>
                            </label>
                            <select
                              id="field-appealFunction-select"
                              value={appealFunction}
                              onChange={(e) => {
                                setAppealFunction(e.target.value);
                                if (validationErrors.appealFunction) {
                                  setValidationErrors((prev) => ({ ...prev, appealFunction: null }));
                                }
                              }}
                              className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                validationErrors.appealFunction
                                  ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                  : isDark
                                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0]"
                                  : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 shadow-sm"
                              }`}
                            >
                              <option value="">Select target function...</option>
                              {FUNCTION_INFO_CARDS.filter((c) => c.functionName !== memberFunction).map((c) => {
                                const avail = functionAvailability[c.functionName];
                                const isFull = avail && (avail.isFull || avail.filled >= avail.capacity);
                                return (
                                  <option key={c.functionName} value={c.functionName}>
                                    {c.functionName}{isFull ? " (Full — Appeal)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            {validationErrors.appealFunction && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.appealFunction}</span>
                              </p>
                            )}
                          </div>

                          {/* Type / Skills Explanation Textarea */}
                          <div id="field-appealReason">
                            <label
                              htmlFor="field-appealReason-input"
                              className={`block text-[12.5px] font-[510] mb-1.5 ${
                                isDark ? "text-[#d0d6e0]" : "text-gray-700"
                              }`}
                            >
                              Your skills & reason for appeal <span className="text-[#eb5757]">*</span>
                            </label>
                            <textarea
                              id="field-appealReason-input"
                              rows={4}
                              placeholder="Type your skills, relevant experience, and why you want to join this function..."
                              value={appealReason}
                              onChange={(e) => {
                                setAppealReason(e.target.value);
                                if (validationErrors.appealReason) {
                                  setValidationErrors((prev) => ({ ...prev, appealReason: null }));
                                }
                              }}
                              className={`w-full px-3 py-2.5 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none resize-y ${
                                validationErrors.appealReason
                                  ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                  : isDark
                                  ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]"
                                  : "bg-white border-gray-200 hover:border-gray-300 focus:border-gray-900 text-gray-900 placeholder:text-gray-400 shadow-sm"
                              }`}
                            />
                            {validationErrors.appealReason && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.appealReason}</span>
                              </p>
                            )}
                          </div>

                          {/* Done Button */}
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleNextStep}
                              className="linear-btn-primary px-5 py-2 text-[13px] font-[510] flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>Done</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 2 Inline Error Banner */}
                      {errorMessage && (
                        <div className={`p-3 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                          isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="leading-snug">{errorMessage}</div>
                        </div>
                      )}

                      {/* Step 2 Navigation Footer */}
                      <div className={`pt-4 flex items-center justify-between border-t ${
                        isDark ? "border-[#23252a]/60" : "border-gray-200"
                      }`}>
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          className={`px-4 py-2 rounded-[6px] border text-[13px] font-[510] flex items-center gap-2 cursor-pointer transition-colors ${
                            isDark
                              ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] hover:text-white hover:border-[#383b3f]"
                              : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-sm"
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back to Identity</span>
                        </button>

                        {wantsAppeal !== "yes" && (
                          <button
                            type="button"
                            onClick={handleNextStep}
                            className="linear-btn-primary px-5 py-2 text-[13.5px] font-[510] flex items-center gap-2 cursor-pointer"
                          >
                            <span>Next: Pass Photo & Credentials</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── FINAL STEP: Digital Pass Photo & Account Credentials ── */}
                  {currentStep === totalSteps && (
                    <div className="space-y-5 animate-in fade-in-50 duration-200">
                      {/* Photo Section */}
                      <div className="space-y-3">
                        <div className={`flex items-center gap-2 pb-1 border-b ${
                          isDark ? "border-[#23252a]/60" : "border-gray-200"
                        }`}>
                          <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                            isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                          }`}>
                            {totalSteps === 3 ? "03" : "02"} // Member Photo (For Digital Pass)
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

                      {/* Contact & Security Credentials */}
                      <div className="space-y-4 pt-1">
                        <div className={`flex items-center gap-2 pb-1 border-b ${
                          isDark ? "border-[#23252a]/60" : "border-gray-200"
                        }`}>
                          <span className={`text-[11px] font-berkeley-mono uppercase tracking-wider ${
                            isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"
                          }`}>
                            Contact & Credentials
                          </span>
                        </div>

                        {/* Email & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Email */}
                          <div id="field-email">
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
                                onChange={(e) => {
                                  setEmail(e.target.value);
                                  if (validationErrors.email) {
                                    setValidationErrors((prev) => ({ ...prev, email: null }));
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                  validationErrors.email
                                    ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                    : isDark
                                    ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                    : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                                }`}
                              />
                            </div>
                            {validationErrors.email && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.email}</span>
                              </p>
                            )}
                          </div>

                          {/* Phone */}
                          <div id="field-phone">
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
                                onChange={(e) => {
                                  setPhone(e.target.value);
                                  if (validationErrors.phone) {
                                    setValidationErrors((prev) => ({ ...prev, phone: null }));
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                  validationErrors.phone
                                    ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                    : isDark
                                    ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]"
                                    : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                                }`}
                              />
                            </div>
                            {validationErrors.phone && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.phone}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Password & Confirm Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Password */}
                          <div id="field-password">
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
                                onChange={(e) => {
                                  setPassword(e.target.value);
                                  if (validationErrors.password) {
                                    setValidationErrors((prev) => ({ ...prev, password: null }));
                                  }
                                }}
                                className={`w-full pl-3 pr-9 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                  validationErrors.password
                                    ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                    : isDark
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
                            {validationErrors.password && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.password}</span>
                              </p>
                            )}
                          </div>

                          {/* Confirm Password */}
                          <div id="field-confirmPassword">
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
                                onChange={(e) => {
                                  setConfirmPassword(e.target.value);
                                  if (validationErrors.confirmPassword) {
                                    setValidationErrors((prev) => ({ ...prev, confirmPassword: null }));
                                  }
                                }}
                                className={`w-full pl-3 pr-9 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                                  validationErrors.confirmPassword
                                    ? "border-[#eb5757] focus:border-[#eb5757] ring-1 ring-[#eb5757] bg-rose-500/5"
                                    : isDark
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
                            {validationErrors.confirmPassword && (
                              <p className="text-[11.5px] text-[#eb5757] mt-1 font-berkeley-mono flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{validationErrors.confirmPassword}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Terms & Agreement Touch-Friendly Card */}
                      <div id="field-agreedTerms" className="pt-2">
                        <label
                          className={`p-3.5 sm:p-4 rounded-[8px] border transition-all cursor-pointer select-none flex items-start gap-3.5 group ${
                            validationErrors.agreedTerms
                              ? "border-[#eb5757] ring-1 ring-[#eb5757] bg-[#eb5757]/5"
                              : agreedTerms
                              ? isDark
                                ? "bg-[#e4f222]/[0.05] border-[#e4f222]/50 shadow-sm shadow-[#e4f222]/5"
                                : "bg-lime-50/80 border-lime-500 shadow-sm"
                              : isDark
                              ? "bg-[#121316] border-[#2d3038] hover:border-[#424652] hover:bg-[#16171b]"
                              : "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white"
                          }`}
                        >
                          {/* Hidden native input for full screen-reader and form accessibility */}
                          <input
                            type="checkbox"
                            required
                            checked={agreedTerms}
                            onChange={(e) => {
                              setAgreedTerms(e.target.checked);
                              if (validationErrors.agreedTerms) {
                                setValidationErrors((prev) => ({ ...prev, agreedTerms: null }));
                              }
                            }}
                            className="sr-only"
                          />

                          {/* Custom Touch-Friendly Checkbox (Highly visible on all screens & mobile) */}
                          <div
                            className={`w-5 h-5 min-w-[20px] min-h-[20px] rounded-[5px] border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-all ${
                              validationErrors.agreedTerms
                                ? "border-[#eb5757] bg-[#eb5757]/10"
                                : agreedTerms
                                ? isDark
                                  ? "bg-[#e4f222] border-[#e4f222] text-[#08090a] shadow-sm shadow-[#e4f222]/20 scale-105"
                                  : "bg-gray-900 border-gray-900 text-white shadow-sm scale-105"
                                : isDark
                                ? "border-[#4e5360] bg-[#090a0b] group-hover:border-[#e4f222] group-hover:bg-[#16171a]"
                                : "border-gray-400 bg-white group-hover:border-gray-900 group-hover:bg-gray-50"
                            }`}
                          >
                            {agreedTerms ? (
                              <Check className="w-3.5 h-3.5 stroke-[3] animate-in zoom-in-75 duration-150" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-40 bg-[#e4f222] transition-opacity" />
                            )}
                          </div>

                          {/* Terms Agreement Label & Links */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={`text-[13px] font-[510] leading-snug transition-colors ${
                                  agreedTerms
                                    ? isDark
                                      ? "text-white"
                                      : "text-gray-900"
                                    : isDark
                                    ? "text-[#d0d6e0] group-hover:text-white"
                                    : "text-gray-800"
                                }`}
                              >
                                Society Terms & Academic Consent <span className="text-[#eb5757]">*</span>
                              </span>

                              {/* Status Badge */}
                              <span
                                className={`text-[10.5px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border uppercase tracking-wider flex-shrink-0 transition-colors ${
                                  agreedTerms
                                    ? isDark
                                      ? "bg-[#27a644]/15 border-[#27a644]/30 text-[#27a644] font-medium"
                                      : "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium"
                                    : isDark
                                    ? "bg-[#1c1d21] border-[#2e3138] text-[#8a8f98] group-hover:border-[#e4f222]/40 group-hover:text-[#e4f222]"
                                    : "bg-gray-100 border-gray-200 text-gray-500 group-hover:border-gray-400 group-hover:text-gray-700"
                                }`}
                              >
                                {agreedTerms ? "Agreed ✓" : "Tap to Agree"}
                              </span>
                            </div>

                            <p className={`text-[12px] leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                              I agree to the society{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.history.pushState({}, "", "/terms");
                                  window.dispatchEvent(new Event("popstate"));
                                }}
                                className={`underline font-medium hover:text-[#e4f222] transition-colors ${
                                  isDark ? "text-[#d0d6e0]" : "text-gray-900 font-semibold"
                                }`}
                              >
                                Terms of Service
                              </button>{" "}
                              and{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.history.pushState({}, "", "/privacy");
                                  window.dispatchEvent(new Event("popstate"));
                                }}
                                className={`underline font-medium hover:text-[#e4f222] transition-colors ${
                                  isDark ? "text-[#d0d6e0]" : "text-gray-900 font-semibold"
                                }`}
                              >
                                Privacy Policy
                              </button>
                              . My details will be preserved for academic verification.
                            </p>
                          </div>
                        </label>
                        {validationErrors.agreedTerms && (
                          <p className="text-[11.5px] text-[#eb5757] mt-1.5 font-berkeley-mono flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{validationErrors.agreedTerms}</span>
                          </p>
                        )}
                      </div>

                      {/* Appeal Notice Banner (when Member selected Yes to Make an appeal) */}
                      {roleMode === "member" && memberType === "member" && wantsAppeal === "yes" && (
                        <div className={`p-3.5 rounded-[8px] border text-[13px] flex items-start gap-2.5 ${
                          isDark
                            ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]"
                            : "bg-amber-50 border-amber-200 text-amber-900"
                        }`}>
                          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#f59e0b]" />
                          <div className="leading-relaxed">
                            <strong className="font-[510] block mb-0.5">
                              Function Appeal Included ({memberFunction} → {appealFunction})
                            </strong>
                            <span>
                              Your initial selection ({memberFunction}) and your appeal for {appealFunction} will be reviewed by the executive committee.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Final Step Inline Error Banner */}
                      {errorMessage && (
                        <div className={`p-3 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                          isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="leading-snug">{errorMessage}</div>
                        </div>
                      )}

                      {/* Final Step Navigation Actions */}
                      <div className={`pt-4 flex items-center justify-between border-t ${
                        isDark ? "border-[#23252a]/60" : "border-gray-200"
                      } gap-3`}>
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          className={`px-4 py-2.5 rounded-[6px] border text-[13px] font-[510] flex items-center gap-2 cursor-pointer transition-colors ${
                            isDark
                              ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] hover:text-white hover:border-[#383b3f]"
                              : "bg-white border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-sm"
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>

                        <button
                          type="submit"
                          disabled={
                            loading ||
                            (roleMode === "member" &&
                              (!regEnabled ||
                                (memberType === "executive" && !executiveRegEnabled) ||
                                (memberType === "member" && !memberRegEnabled)))
                          }
                          className="linear-btn-primary flex-1 py-2.5 text-[14px] font-[510] tracking-[-0.011em] disabled:opacity-50 disabled:cursor-not-allowed justify-center"
                        >
                          {loading ? (
                            <>
                              <span className={`w-4 h-4 border-2 ${isDark ? "border-[#08090a]" : "border-white"} border-t-transparent rounded-full animate-spin`} />
                              <span>Creating member profile...</span>
                            </>
                          ) : (
                            <>
                              <span>
                                {roleMode === "member" && memberType === "member" && wantsAppeal === "yes"
                                  ? "Submit Registration & Appeal"
                                  : "Complete Registration"}
                              </span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
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
