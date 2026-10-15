import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../supabaseClient";
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Upload,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  Zap,
  Phone,
  Mail,
  Briefcase,
  Search,
  Sparkles,
  ArrowRight
} from "lucide-react";

export default function GatePassScannerModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  societyMembers = [],
  onAttendanceUpdated,
  theme
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") || 
             document.documentElement.getAttribute("data-theme") === "dark" 
             ? "dark" : "light";
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

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanningMode, setScanningMode] = useState("camera"); // "camera" | "manual" | "upload"
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verifiedMember, setVerifiedMember] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState(null); // { type: "success" | "warning" | "error", message: "", timestamp: "" }
  const [scannedCount, setScannedCount] = useState(0);
  const [copiedToken, setCopiedToken] = useState(false);

  // Auto-scan timer
  const [autoResumeSecs, setAutoResumeSecs] = useState(null);
  const autoTimerRef = useRef(null);

  const html5QrCodeRef = useRef(null);
  const isStartingRef = useRef(false);

  // Audio Beep
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } catch (e) {
      console.warn("Audio playback not supported or blocked:", e);
    }
  };

  // Haptic Feedback
  const triggerHaptic = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch {}
  };

  // Start Camera
  const startCamera = async (camId) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError("");

    try {
      // Cleanup previous instance
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {}
      }

      const qrCode = new Html5Qrcode("gate-pass-reader");
      html5QrCodeRef.current = qrCode;

      const cameraConfig = camId ? { deviceId: { exact: camId } } : { facingMode: "environment" };

      await qrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        onQrDecoded,
        () => {} // frame error handler (no-op)
      );

      setScannerActive(true);
    } catch (err) {
      console.error("Camera start error:", err);
      setCameraError(
        err.message?.includes("Permission") || err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser settings or use manual input below."
          : "Unable to start camera stream. " + (err.message || "")
      );
      setScannerActive(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      }
    }
    setScannerActive(false);
  };

  // Initialize Cameras when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (isMounted && devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment / back camera
          const backCam = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear") || d.label.toLowerCase().includes("environment"));
          const chosenId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(chosenId);
          startCamera(chosenId);
        } else if (isMounted) {
          startCamera();
        }
      })
      .catch((err) => {
        console.warn("Could not enumerate cameras, falling back to facingMode:", err);
        if (isMounted) startCamera();
      });

    return () => {
      isMounted = false;
      stopCamera();
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [isOpen]);

  // Normalize Student ID for comparison
  const normalizeStId = (id) => {
    if (!id) return "";
    return String(id).toLowerCase().replace(/^sc\//i, "").replace(/\s+/g, "");
  };

  // Clean raw token text into Student ID
  const parseTokenToStId = (raw) => {
    if (!raw) return "";
    let clean = String(raw).trim();

    // Check if it's a JSON payload
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        clean = parsed.st_id || parsed.id || parsed.token || clean;
      } catch {}
    }

    // Check if it's a URL
    if (clean.includes("http://") || clean.includes("https://") || clean.includes("?")) {
      try {
        const url = new URL(clean, window.location.origin);
        const stIdParam = url.searchParams.get("st_id") || url.searchParams.get("id") || url.searchParams.get("token");
        if (stIdParam) clean = stIdParam;
      } catch {}
    }

    // Check if token contains "TOKEN:" prefix
    if (clean.toUpperCase().includes("TOKEN:")) {
      clean = clean.split(/TOKEN:/i)[1]?.trim() || clean;
    }

    // Remove quotes
    clean = clean.replace(/['"]+/g, "").trim();

    // Match Faculty/YYYY/NNNN pattern with potential spaces: SC/2022/12984, SC / 2022 / 12984
    const facultyMatch = clean.match(/([A-Z]{2,4})\s*\/\s*(\d{4})\s*\/\s*(\d{3,6})/i);
    if (facultyMatch) {
      return `${facultyMatch[1].toUpperCase()}/${facultyMatch[2]}/${facultyMatch[3]}`;
    }

    // Match raw digits YYYY/NNNNN with potential spaces
    const numMatch = clean.match(/(\d{4})\s*\/\s*(\d{3,6})/);
    if (numMatch) {
      return `${numMatch[1]}/${numMatch[2]}`;
    }

    return clean;
  };

  // Helper to ensure public profile image URL from Supabase storage or direct URL
  const resolvePhotoUrl = (url) => {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      return trimmed;
    }
    try {
      const { data } = supabase.storage.from("profile_images").getPublicUrl(trimmed);
      return data?.publicUrl || trimmed;
    } catch {
      return trimmed;
    }
  };

  // QR Code Decoded handler
  const onQrDecoded = async (decodedText) => {
    if (verifying || verifiedMember) return;
    const stId = parseTokenToStId(decodedText);
    if (!stId) return;

    // Pause camera scanning temporarily
    await stopCamera();
    processGatePass(stId);
  };

  // Process Gate Pass & Mark Attendance in BOTH tables
  const processGatePass = async (inputStId) => {
    const cleanId = parseTokenToStId(inputStId);
    if (!cleanId) return;

    setVerifying(true);
    setVerifyStatus(null);
    setVerifiedMember(null);

    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      const raw = cleanId.trim();
      const norm = normalizeStId(raw);
      const scVariant = `SC/${norm}`;

      // ──────────────────────────────────────────────
      // 1. ALWAYS MATCH SOCIETY MEMBER DB (Gate Pass belongs exclusively to society members)
      // ──────────────────────────────────────────────
      let memberData = null;

      // Check preloaded directory first (has photos and complete profiles)
      if (societyMembers && societyMembers.length > 0) {
        memberData = societyMembers.find(m => normalizeStId(m.st_id) === norm) || null;
      }

      // Query database table `members` using .select("*") to get complete profile & photo without column mismatch errors
      try {
        const { data: memberCandidates, error: memberErr } = await supabase
          .from("members")
          .select("*")
          .or(`st_id.ilike.${scVariant},st_id.ilike.${norm},st_id.ilike.${raw}`);

        if (memberErr) console.warn("Member lookup candidate warning:", memberErr);

        if (memberCandidates && memberCandidates.length > 0) {
          const directMatch = memberCandidates.find(m => normalizeStId(m.st_id) === norm) || memberCandidates[0];
          if (directMatch) {
            memberData = { ...(memberData || {}), ...directMatch };
          }
        }

        // Wildcard fallback if not found yet (handles whitespace/casing subtleties)
        if (!memberData && norm.length >= 4) {
          const { data: wildcardMembers } = await supabase
            .from("members")
            .select("*")
            .ilike("st_id", `%${norm}%`)
            .limit(10);
          if (wildcardMembers && wildcardMembers.length > 0) {
            const wildcardMatch = wildcardMembers.find(m => normalizeStId(m.st_id) === norm) || wildcardMembers[0];
            if (wildcardMatch) {
              memberData = { ...(memberData || {}), ...wildcardMatch };
            }
          }
        }

        // Email fallback if raw input looks like email
        if (!memberData && raw.includes("@")) {
          const { data: emailMember } = await supabase
            .from("members")
            .select("*")
            .ilike("email", raw)
            .maybeSingle();
          if (emailMember) memberData = { ...(memberData || {}), ...emailMember };
        }
      } catch (err) {
        console.warn("Direct members query error:", err);
      }

      // ──────────────────────────────────────────────
      // IF SOCIETY MEMBER IS DETECTED (Show photo from DB & update both):
      // ──────────────────────────────────────────────
      if (memberData) {
        const memberNorm = normalizeStId(memberData.st_id);
        const memberSc = `SC/${memberNorm}`;
        const photoUrl = resolvePhotoUrl(memberData.profile_image_url);

        // Step A: Mark attendance in Society Member DB (attendance table)
        const { error: attError } = await supabase
          .from("attendance")
          .upsert({
            st_id: memberData.st_id,
            event_id: eventId,
            attend: "YES"
          }, { onConflict: "st_id,event_id" });

        if (attError) console.error("Error upserting to attendance table:", attError);

        // Step B: Query CSV Registrations (event_registrations table) for this event
        let regQuery = supabase
          .from("event_registrations")
          .select("*")
          .eq("event_id", eventId);

        if (memberData.email) {
          regQuery = regQuery.or(`st_id.ilike.${memberData.st_id},st_id.ilike.${memberNorm},st_id.ilike.${memberSc},email.ilike.${memberData.email}`);
        } else {
          regQuery = regQuery.or(`st_id.ilike.${memberData.st_id},st_id.ilike.${memberNorm},st_id.ilike.${memberSc}`);
        }

        const { data: regRows } = await regQuery;

        const existingReg = regRows?.find(r => 
          normalizeStId(r.st_id) === memberNorm ||
          (memberData.email && r.email?.toLowerCase().trim() === memberData.email.toLowerCase().trim())
        ) || regRows?.[0] || null;

        let wasAlreadyInCSV = false;

        if (existingReg) {
          wasAlreadyInCSV = true;
          // Member ALREADY exists in CSV roster:
          // Update CSV record to Present ('YES') and ensure is_member: true
          const { error: updateRegErr } = await supabase
            .from("event_registrations")
            .update({
              attend: "YES",
              is_member: true,
              name: existingReg.name || memberData.name,
              email: existingReg.email || memberData.email,
              phone: existingReg.phone || memberData.mobile_number,
              level: existingReg.level || (memberData.level ? `Year ${memberData.level}` : null),
              degree_program: existingReg.degree_program || memberData.member_function || "Society Member"
            })
            .eq("id", existingReg.id);

          if (updateRegErr) console.error("Error updating existing event_registration:", updateRegErr);
        } else {
          // Member is NOT in CSV roster:
          // AUTO-DETECT & INSERT into event_registrations as is_member: true and attend: 'YES'
          const { error: insertRegErr } = await supabase
            .from("event_registrations")
            .insert([{
              event_id: eventId,
              st_id: memberData.st_id,
              name: memberData.name,
              email: memberData.email || null,
              phone: memberData.mobile_number || null,
              degree_program: memberData.member_function || "Society Member",
              level: memberData.level ? `Year ${memberData.level}` : null,
              attend: "YES",
              is_member: true
            }]);

          if (insertRegErr) {
            if (insertRegErr.code === "23505") {
              // Unique constraint conflict on (event_id, st_id) -> update existing row to YES
              await supabase
                .from("event_registrations")
                .update({ attend: "YES", is_member: true })
                .eq("event_id", eventId)
                .eq("st_id", memberData.st_id);
            } else {
              console.error("Error inserting auto-detected member into event_registrations:", insertRegErr);
            }
          }
        }

        playBeep();
        triggerHaptic();

        // Populate verified state to display their credential pass with photo!
        setVerifiedMember({
          st_id: memberData.st_id,
          name: memberData.name,
          preferred_name: memberData.preferred_name,
          level: memberData.level,
          st_position: memberData.st_position,
          member_function: memberData.member_function,
          email: memberData.email,
          mobile_number: memberData.mobile_number,
          profile_image_url: photoUrl,
          linkedin_url: memberData.linkedin_url,
          isMember: true,
          wasAlreadyInCSV,
          autoEnrolledInCSV: !wasAlreadyInCSV
        });

        setVerifyStatus({
          type: "success",
          message: wasAlreadyInCSV
            ? "GATE PASS VERIFIED · MARKED PRESENT IN MEMBER DB & CSV"
            : "GATE PASS VERIFIED · AUTO-ENROLLED & PRESENT IN BOTH",
          timestamp: nowStr,
          detail: wasAlreadyInCSV
            ? "Matched Society Member DB & Event CSV Roster"
            : "Auto-detected society member, added to Event CSV & updated both"
        });

        setScannedCount(prev => prev + 1);
        if (onAttendanceUpdated) onAttendanceUpdated();
        startAutoResume(5);
        return;
      }

      // ──────────────────────────────────────────────
      // 2. FALLBACK: CHECK EVENT REGISTRATIONS (External Guest / non-member)
      // ──────────────────────────────────────────────
      const { data: regRows } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .or(`st_id.ilike.${raw},st_id.ilike.${norm},st_id.ilike.${scVariant}`);

      const regData = regRows?.find(r => normalizeStId(r.st_id) === norm) || regRows?.[0] || null;

      if (regData) {
        // Mark present in event_registrations
        await supabase
          .from("event_registrations")
          .update({ attend: "YES" })
          .eq("id", regData.id);

        // Check if this student is actually in the society members DB (even if not found above)
        const regNorm = normalizeStId(regData.st_id);
        const fallbackDbMember = societyMembers?.find(m => normalizeStId(m.st_id) === regNorm);
        const fallbackPhoto = resolvePhotoUrl(fallbackDbMember?.profile_image_url);

        // If marked as is_member in CSV or found in members DB, also update attendance table
        if (regData.is_member || fallbackDbMember) {
          await supabase
            .from("attendance")
            .upsert({
              st_id: fallbackDbMember?.st_id || regData.st_id,
              event_id: eventId,
              attend: "YES"
            }, { onConflict: "st_id,event_id" });
        }

        playBeep();
        triggerHaptic();

        setVerifiedMember({
          st_id: fallbackDbMember?.st_id || regData.st_id,
          name: fallbackDbMember?.name || regData.name,
          preferred_name: fallbackDbMember?.preferred_name || "",
          level: fallbackDbMember?.level || regData.level,
          st_position: fallbackDbMember?.st_position || "",
          member_function: fallbackDbMember?.member_function || regData.degree_program || "External Attendee",
          email: fallbackDbMember?.email || regData.email,
          mobile_number: fallbackDbMember?.mobile_number || regData.phone,
          profile_image_url: fallbackPhoto || "",
          isMember: Boolean(regData.is_member || fallbackDbMember),
          isExternal: !regData.is_member && !fallbackDbMember,
          wasAlreadyInCSV: true
        });

        setVerifyStatus({
          type: "success",
          message: (regData.is_member || fallbackDbMember)
            ? "MEMBER REGISTRATION VERIFIED · MARKED PRESENT"
            : "EXTERNAL REGISTRATION VERIFIED · MARKED PRESENT IN CSV",
          timestamp: nowStr,
          detail: (regData.is_member || fallbackDbMember)
            ? "Updated both Society Member DB and CSV"
            : "Updated Event CSV Registrations"
        });

        setScannedCount(prev => prev + 1);
        if (onAttendanceUpdated) onAttendanceUpdated();
        startAutoResume(5);
        return;
      }

      // ──────────────────────────────────────────────
      // 3. NOT FOUND IN EITHER
      // ──────────────────────────────────────────────
      setVerifiedMember({
        st_id: raw,
        name: "Unregistered Student",
        isUnregistered: true
      });

      setVerifyStatus({
        type: "warning",
        message: `Student ID ${raw} not enrolled in roster.`,
        timestamp: nowStr,
        detail: "Not found in Society Members or CSV Registrations."
      });
    } catch (err) {
      console.error("Verification error:", err);
      setVerifyStatus({
        type: "error",
        message: "Failed to verify check-in: " + err.message,
        timestamp: nowStr,
        detail: "Database error occurred."
      });
    } finally {
      setVerifying(false);
    }
  };

  // Enroll Walk-in directly into BOTH tables
  const handleEnrollWalkin = async () => {
    if (!verifiedMember?.st_id) return;
    setVerifying(true);
    try {
      const stId = verifiedMember.st_id.trim();
      const norm = normalizeStId(stId);
      const scVariant = `SC/${norm}`;

      // Check if they are a member in members table
      const { data: memberData } = await supabase
        .from("members")
        .select("st_id, name, preferred_name, level, st_position, member_function, email, mobile_number, profile_image_url")
        .or(`st_id.ilike.${stId},st_id.ilike.${scVariant},st_id.ilike.${norm}`)
        .maybeSingle();

      const isMember = Boolean(memberData);
      const finalName = memberData?.name || `Student ${stId}`;

      // 1. Upsert attendance table
      await supabase
        .from("attendance")
        .upsert({
          st_id: memberData?.st_id || stId,
          event_id: eventId,
          attend: "YES"
        }, { onConflict: "st_id,event_id" });

      // 2. Upsert event_registrations table
      await supabase
        .from("event_registrations")
        .upsert([{
          event_id: eventId,
          st_id: memberData?.st_id || stId,
          name: finalName,
          email: memberData?.email || null,
          phone: memberData?.mobile_number || null,
          degree_program: memberData?.member_function || (isMember ? "Society Member" : "Walk-in Attendee"),
          level: memberData?.level ? `Year ${memberData.level}` : null,
          attend: "YES",
          is_member: isMember
        }], { onConflict: "event_id,st_id" });

      playBeep();
      triggerHaptic();

      setVerifyStatus({
        type: "success",
        message: "ENROLLED & MARKED PRESENT IN BOTH DB & CSV",
        timestamp: new Date().toLocaleTimeString(),
        detail: "Recorded in both Society Member DB and Event CSV Roster."
      });
      setVerifiedMember(prev => ({
        ...prev,
        name: finalName,
        isUnregistered: false,
        isMember,
        profile_image_url: resolvePhotoUrl(memberData?.profile_image_url) || "",
        level: memberData?.level || prev?.level,
        st_position: memberData?.st_position || "",
        member_function: memberData?.member_function || "",
        email: memberData?.email || prev?.email,
        mobile_number: memberData?.mobile_number || prev?.mobile_number,
        wasAlreadyInCSV: false,
        autoEnrolledInCSV: true
      }));
      setScannedCount(prev => prev + 1);
      if (onAttendanceUpdated) onAttendanceUpdated();
      startAutoResume(5);
    } catch (err) {
      alert("Failed to enroll: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  // Undo attendance (Mark Absent in BOTH tables)
  const handleUndoAttendance = async () => {
    if (!verifiedMember?.st_id) return;
    try {
      const norm = normalizeStId(verifiedMember.st_id);
      const scVariant = `SC/${norm}`;

      // 1. Revoke in attendance table
      await supabase
        .from("attendance")
        .update({ attend: "NO" })
        .eq("event_id", eventId)
        .or(`st_id.ilike.${verifiedMember.st_id},st_id.ilike.${norm},st_id.ilike.${scVariant}`);

      // 2. Revoke in event_registrations table
      await supabase
        .from("event_registrations")
        .update({ attend: "NO" })
        .eq("event_id", eventId)
        .or(`st_id.ilike.${verifiedMember.st_id},st_id.ilike.${norm},st_id.ilike.${scVariant}`);

      setVerifyStatus({
        type: "warning",
        message: "Attendance revoked (Marked Absent in DB & CSV)",
        timestamp: new Date().toLocaleTimeString(),
        detail: "Presence cleared from both Society Member DB and CSV roster."
      });
      setScannedCount(prev => Math.max(0, prev - 1));
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      alert("Failed to revoke: " + err.message);
    }
  };

  // Auto-resume timer
  const startAutoResume = (seconds = 5) => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    setAutoResumeSecs(seconds);

    autoTimerRef.current = setInterval(() => {
      setAutoResumeSecs(prev => {
        if (prev <= 1) {
          clearInterval(autoTimerRef.current);
          resumeScanning();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelAutoResume = () => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    setAutoResumeSecs(null);
  };

  const resumeScanning = () => {
    cancelAutoResume();
    setVerifiedMember(null);
    setVerifyStatus(null);
    setManualInput("");
    startCamera(selectedCameraId);
  };

  // Handle Manual Submit
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    const stId = parseTokenToStId(manualInput);
    if (!stId) return;
    processGatePass(stId);
  };

  // Handle File Upload QR scan
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setVerifying(true);
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("gate-pass-reader");
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      const stId = parseTokenToStId(decodedText);
      processGatePass(stId);
    } catch (err) {
      alert("Could not detect a valid QR code in this image: " + err);
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[1200] ${isDark ? "bg-[#08090a] text-white selection:bg-[#e4f222]/30" : "bg-[#f4f5f6] text-gray-900 selection:bg-indigo-500/20"} flex flex-col overflow-hidden font-inter-variable animate-in fade-in duration-150`}>
      {/* ── STICKY TOP CONTROL BAR (Fixed at top for easy 1-tap exit) ── */}
      <header className={`flex-shrink-0 z-20 w-full ${isDark ? "bg-[#0c0c0e]/95 border-[#23252a]" : "bg-white/95 border-gray-200 shadow-xs"} backdrop-blur-md border-b px-3.5 sm:px-6 py-2.5 sm:py-3`}>
        <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-indigo-50 border-indigo-200"} border flex items-center justify-center flex-shrink-0`}>
              <Camera className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-[590] ${isDark ? "text-white" : "text-gray-900"} tracking-[-0.011em]`}>Gate Pass Scanner</span>
                <span className={`px-1.5 py-0.2 rounded-[3px] ${isDark ? "bg-[#27a644]/15 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"} border font-berkeley-mono text-[9px] uppercase font-[510]`}>
                  Live
                </span>
              </div>
              <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} truncate`}>
                {eventName || "Selected Event"}
              </div>
            </div>
          </div>

          {/* Right actions: Audio toggle, Close */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-8 h-8 rounded-[6px] ${isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#8a8f98] hover:text-white" : "bg-white hover:bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-900 shadow-xs"} border flex items-center justify-center transition-colors cursor-pointer`}
              title={soundEnabled ? "Mute beep sound" : "Enable beep sound"}
            >
              {soundEnabled ? (
                <Volume2 className={`w-4 h-4 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} />
              ) : (
                <VolumeX className={`w-4 h-4 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              )}
            </button>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className={`w-8 h-8 rounded-[6px] ${isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#8a8f98] hover:text-white" : "bg-white hover:bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-900 shadow-xs"} border flex items-center justify-center transition-colors cursor-pointer`}
              title="Close scanner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN VERTICAL SCROLLABLE CONTENT (Mobile Responsive, Pure Vertical Scroll) ── */}
      <main className="flex-1 w-full overflow-y-auto overscroll-contain px-3 sm:px-6 py-4">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-4">
          {verifying ? (
            /* VERIFYING LOADING STATE */
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className={`w-8 h-8 ${isDark ? "text-[#e4f222]" : "text-indigo-600"} animate-spin`} />
              <span className={`text-[13px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                Verifying Gate Pass & recording presence...
              </span>
            </div>
          ) : verifiedMember ? (
            /* ── VERIFIED MEMBER PROFILE PASS (MATCHING USER'S IMAGE!) ── */
            <div className={`w-full ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xl"} border rounded-[14px] overflow-hidden animate-in zoom-in-95 duration-150`}>
              {/* Top Pass Brand Banner */}
              <div className={`px-3.5 sm:px-4 py-2 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border-b flex items-center justify-between font-berkeley-mono text-[10px]`}>
                <div className={`flex items-center gap-1.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                  <ShieldCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#27a644]" : "text-emerald-600"} flex-shrink-0`} />
                  <span className="tracking-wide truncate">ACTUARIAL & DATA SCIENCE SOCIETY · UNIVERSITY OF RUHUNA</span>
                </div>
                <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"} hidden sm:inline flex-shrink-0 font-[590]`}>GATE PASS</span>
              </div>

              <div className="p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5 sm:space-y-4">
                {/* Member Avatar */}
                <div className={`relative w-22 h-22 sm:w-24 sm:h-24 rounded-[12px] overflow-hidden border-2 ${isDark ? "border-[#23252a] bg-[#08090a]" : "border-gray-200 bg-gray-100"} shadow-lg flex-shrink-0`}>
                  {verifiedMember.profile_image_url ? (
                    <img
                      src={verifiedMember.profile_image_url}
                      alt={verifiedMember.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(verifiedMember.name);
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? "text-[#8a8f98] bg-[#161718]" : "text-gray-500 bg-gray-100"} font-berkeley-mono text-2xl font-[590]`}>
                      {verifiedMember.name?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                  )}
                  {verifiedMember.isMember && (
                    <div className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[#27a644] border-2 ${isDark ? "border-[#0f1011]" : "border-white"}`} title="Active Society Member" />
                  )}
                </div>

                {/* Names */}
                <div>
                  <h2 className={`text-[18px] sm:text-[20px] font-[590] ${isDark ? "text-white" : "text-gray-900"} tracking-tight leading-snug`}>
                    {verifiedMember.name}
                  </h2>
                  {verifiedMember.preferred_name && (
                    <p className={`text-[12px] sm:text-[12.5px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5`}>
                      ({verifiedMember.preferred_name})
                    </p>
                  )}
                </div>

                {/* Badges Strip (ST_ID, Year, Position, Function) */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  {/* Student ID Badge with Copy */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-white" : "bg-gray-100 border-gray-200 text-gray-900"} border font-berkeley-mono text-[11px]`}>
                    <span>{verifiedMember.st_id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(verifiedMember.st_id);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 1500);
                      }}
                      className={`${isDark ? "text-[#62666d] hover:text-white" : "text-gray-400 hover:text-gray-700"} transition-colors cursor-pointer`}
                    >
                      {copiedToken ? <Check className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"}`} /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Level / Year Badge */}
                  {verifiedMember.level && (
                    <span className={`px-2.5 py-1 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#d0d6e0]" : "bg-indigo-50 border-indigo-200 text-indigo-700"} border font-berkeley-mono text-[11px]`}>
                      Year {verifiedMember.level}
                    </span>
                  )}

                  {/* Position Badge */}
                  {verifiedMember.st_position && (
                    <span className={`px-2.5 py-1 rounded-[6px] ${isDark ? "bg-[#27a644]/10 border-[#27a644]/25 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"} border font-berkeley-mono text-[11px] font-[510]`}>
                      {verifiedMember.st_position}
                    </span>
                  )}

                  {/* Function Badge */}
                  {verifiedMember.member_function && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] ${isDark ? "bg-[#02b8cc]/10 border-[#02b8cc]/25 text-[#02b8cc]" : "bg-cyan-50 border-cyan-200 text-cyan-700"} border font-berkeley-mono text-[11px] font-[510]`}>
                      <Briefcase className="w-3 h-3 flex-shrink-0" />
                      <span>{verifiedMember.member_function}</span>
                    </span>
                  )}
                </div>

                {/* Contact Information Snippet */}
                {(verifiedMember.email || verifiedMember.mobile_number || verifiedMember.linkedin_url) && (
                  <div className={`flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} pt-1`}>
                    {verifiedMember.email && (
                      <span className="flex items-center gap-1">
                        <Mail className={`w-3 h-3 ${isDark ? "text-[#62666d]" : "text-gray-400"} flex-shrink-0`} />
                        <span className={isDark ? "text-[#d0d6e0]" : "text-gray-700"}>{verifiedMember.email}</span>
                      </span>
                    )}
                    {verifiedMember.mobile_number && (
                      <a
                        href={`https://wa.me/${verifiedMember.mobile_number.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 font-[590] ${isDark ? "text-white hover:text-[#27a644]" : "text-gray-900 hover:text-emerald-600"} transition-colors`}
                      >
                        <Phone className={`w-3 h-3 ${isDark ? "text-[#27a644]" : "text-emerald-600"} flex-shrink-0`} />
                        <span>{verifiedMember.mobile_number}</span>
                      </a>
                    )}
                    {verifiedMember.linkedin_url && (
                      <a
                        href={verifiedMember.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 ${isDark ? "hover:text-white" : "text-blue-600 hover:text-blue-700"} transition-colors`}
                      >
                        <span>LinkedIn</span>
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                )}

                {/* STATUS BANNER & DUAL-DATABASE SYNC INDICATORS */}
                {verifyStatus && (
                  <div
                    className={`w-full p-3 sm:p-3.5 rounded-[10px] border flex flex-col items-center gap-2 ${
                      verifyStatus.type === "success"
                        ? isDark
                          ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : verifyStatus.type === "warning"
                        ? isDark
                          ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                        : isDark
                          ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]"
                          : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    <div className="font-berkeley-mono text-[12px] font-[590] flex items-center justify-center gap-1.5 uppercase tracking-wider text-center">
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse flex-shrink-0" />
                      <span>{verifyStatus.message}</span>
                    </div>

                    {/* Dual Sync Confirmation Badges */}
                    {verifyStatus.type === "success" && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-0.5 font-berkeley-mono text-[10.5px]">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] ${isDark ? "bg-[#27a644]/20 border border-[#27a644]/40 text-[#27a644]" : "bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium"}`}>
                          <Check className="w-3 h-3 flex-shrink-0" />
                          <span>Member DB: Present</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] ${isDark ? "bg-[#27a644]/20 border border-[#27a644]/40 text-[#27a644]" : "bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium"}`}>
                          <Check className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {verifiedMember.autoEnrolledInCSV ? "CSV: Auto-Enrolled & Present" : "CSV Roster: Present"}
                          </span>
                        </span>
                      </div>
                    )}

                    {verifyStatus.detail && (
                      <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"} text-center`}>
                        {verifyStatus.detail}
                      </div>
                    )}

                    <div className="text-[10px] font-berkeley-mono opacity-70 text-center">
                      Checked in at {verifyStatus.timestamp} · Event: {eventName}
                    </div>
                  </div>
                )}

                {/* Unregistered Student Actions */}
                {verifiedMember.isUnregistered && (
                  <div className="w-full pt-1">
                    <button
                      onClick={handleEnrollWalkin}
                      className={`w-full py-2.5 ${isDark ? "bg-[#e4f222] text-[#08090a] hover:brightness-105" : "bg-gray-900 text-white hover:bg-black"} font-[510] rounded-[6px] text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]`}
                    >
                      <UserCheck className="w-4 h-4 flex-shrink-0" />
                      <span>Enroll & Mark Present as Walk-in</span>
                    </button>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="w-full space-y-2 pt-1">
                  <button
                    onClick={resumeScanning}
                    className={`w-full min-h-[46px] ${isDark ? "bg-[#e4f222] text-[#08090a] hover:brightness-105" : "bg-gray-900 text-white hover:bg-black"} font-[590] rounded-[6px] text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]`}
                  >
                    <Camera className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {autoResumeSecs ? `Scan Next Member (${autoResumeSecs}s)...` : "Scan Next Member"}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    {autoResumeSecs && (
                      <button
                        onClick={cancelAutoResume}
                        className={`flex-1 py-2.5 ${isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-[#8a8f98] hover:text-white" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-xs"} border rounded-[6px] text-[12px] font-berkeley-mono transition-colors cursor-pointer`}
                      >
                        Pause Auto-Scan
                      </button>
                    )}

                    {!verifiedMember.isUnregistered && (
                      <button
                        onClick={handleUndoAttendance}
                        className={`flex-1 py-2.5 ${isDark ? "bg-transparent hover:bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 hover:bg-red-100 border-red-200 text-red-700"} border rounded-[6px] text-[12px] font-berkeley-mono transition-colors cursor-pointer`}
                      >
                        Revoke (Mark Absent in DB & CSV)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── CAMERA / INPUT SCANNER VIEW (Mobile Responsive) ── */
            <div className="w-full space-y-4">
              {/* Camera Viewport Container */}
              <div className={`relative w-full aspect-square max-w-[280px] sm:max-w-[340px] mx-auto bg-black rounded-[14px] overflow-hidden border-2 ${isDark ? "border-[#23252a] shadow-2xl" : "border-gray-300 shadow-lg"} flex items-center justify-center`}>
                {/* HTML5 QR Code Mount Element */}
                <div id="gate-pass-reader" className="w-full h-full" />

                {/* Targeting HUD Overlay */}
                {scannerActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Viewfinder corners */}
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 border border-white/20 rounded-[8px]">
                      <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 ${isDark ? "border-[#e4f222]" : "border-indigo-500"}`} />
                      <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 ${isDark ? "border-[#e4f222]" : "border-indigo-500"}`} />
                      <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 ${isDark ? "border-[#e4f222]" : "border-indigo-500"}`} />
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 ${isDark ? "border-[#e4f222]" : "border-indigo-500"}`} />

                      {/* Red Scanning Laser Line */}
                      <div className={`absolute left-0 right-0 h-[2px] ${isDark ? "bg-[#e4f222]/80 shadow-[0_0_8px_#e4f222]" : "bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.5)]"} animate-pulse top-1/2 -translate-y-1/2`} />
                    </div>
                  </div>
                )}

                {/* Camera Error Display */}
                {cameraError && (
                  <div className={`absolute inset-0 ${isDark ? "bg-[#0f1011]" : "bg-white"} p-6 flex flex-col items-center justify-center text-center space-y-3 z-10`}>
                    <AlertTriangle className={`w-8 h-8 ${isDark ? "text-[#eb5757]" : "text-red-500"} flex-shrink-0`} />
                    <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>{cameraError}</p>
                    <button
                      onClick={() => startCamera(selectedCameraId)}
                      className={`px-3.5 py-1.5 ${isDark ? "bg-[#161718] hover:bg-[#23252a] border-[#23252a] text-white" : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800 shadow-xs"} border font-[510] text-[12px] rounded-[6px] cursor-pointer`}
                    >
                      Retry Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Switcher & Sub-Tools */}
              {cameras.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Camera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className={`${isDark ? "bg-[#161718] border-[#23252a] text-white" : "bg-white border-gray-300 text-gray-900 shadow-xs"} border text-[11px] font-berkeley-mono rounded-[6px] px-2 py-1 outline-none`}
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera ${c.id.slice(0, 4)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Manual ST ID Input Fallback */}
              <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border rounded-[10px] p-3.5 space-y-2`}>
                <span className={`text-[10.5px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500 font-semibold"} uppercase`}>
                  Manual / Backup Input
                </span>
                <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter ST ID (e.g. SC/2022/12984)..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className={`flex-1 min-w-0 px-3 py-1.5 ${isDark ? "bg-[#161718] border-[#23252a] text-white focus:border-[#d0d6e0]" : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs"} border text-xs font-berkeley-mono rounded-[6px] outline-none`}
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim() || verifying}
                    className={`h-8 px-3.5 ${isDark ? "bg-[#e4f222] text-[#08090a] hover:brightness-105" : "bg-gray-900 text-white hover:bg-black"} disabled:opacity-40 font-[510] text-xs rounded-[6px] flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer`}
                  >
                    <span>Verify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Image Upload Fallback */}
                <div className={`pt-2 border-t ${isDark ? "border-[#1a1b1e] text-[#62666d]" : "border-gray-100 text-gray-500"} flex items-center justify-between text-[11px] font-berkeley-mono`}>
                  <span>Have a screenshot of Gate Pass?</span>
                  <label className={`cursor-pointer ${isDark ? "text-[#e4f222]" : "text-indigo-600 font-medium"} hover:underline flex items-center gap-1`}>
                    <Upload className="w-3 h-3 flex-shrink-0" />
                    <span>Scan Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── STICKY BOTTOM STATS FOOTER (Fixed at bottom) ── */}
      <footer className={`flex-shrink-0 z-20 w-full ${isDark ? "bg-[#0c0c0e]/95 border-[#23252a] text-[#8a8f98]" : "bg-white/95 border-gray-200 text-gray-500 shadow-xs"} backdrop-blur-md border-t px-3.5 sm:px-6 py-2.5`}>
        <div className="w-full max-w-lg mx-auto flex items-center justify-between font-berkeley-mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isDark ? "bg-[#27a644]" : "bg-emerald-500"} flex-shrink-0`} />
            <span>Session Scans: <strong className={`${isDark ? "text-white" : "text-gray-900"} font-[590]`}>{scannedCount}</strong></span>
          </div>
          <span className="truncate ml-2 text-right">Point camera at Gate Pass QR</span>
        </div>
      </footer>
    </div>
  );
}
