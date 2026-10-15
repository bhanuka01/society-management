import { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  KeyRound,
  Users,
  UserPlus,
  Sparkles,
  Globe,
  Zap,
  Check,
  Copy,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  CheckCircle2,
  XCircle,
  X,
  ExternalLink,
  SlidersHorizontal,
  Clock,
  FolderArchive,
  Calendar,
  FileSpreadsheet,
  FileCheck,
  FileText,
  Folder
} from "lucide-react";
import {
  ALLOWED_CATEGORIES,
  ALL_CATEGORY_IDS,
  normalizeDocAccessMap,
  getMemberCategoriesFromMap
} from "../lib/documentService";

const CATEGORY_ICONS = {
  Events: Calendar,
  Budgets: FileSpreadsheet,
  Permissions: FileCheck,
  Guidance: FileText
};

const EMPTY_FORM = { email: "", role: "editor" };

export default function Access({
  role = "guest",
  session = {},
  theme,
  docAccessMembers: propDocAccessMembers = [],
  setDocAccessMembers: propSetDocAccessMembers
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || 
             (document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
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

  const isDark = (theme || currentTheme) === "dark";

  const [invites, setInvites] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // System Security Gates
  const [regEnabled, setRegEnabled] = useState(true);
  const [updatingReg, setUpdatingReg] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [updatingAutoApprove, setUpdatingAutoApprove] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [updatingAi, setUpdatingAi] = useState(false);

  // Document Section Member Access (Granular category permissions)
  const [docAccessMap, setDocAccessMap] = useState(() => normalizeDocAccessMap(propDocAccessMembers));
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [allMembersList, setAllMembersList] = useState([]);
  const [tempDocAccessMap, setTempDocAccessMap] = useState({});
  const [docMemberSearch, setDocMemberSearch] = useState("");
  const [savingDocAccess, setSavingDocAccess] = useState(false);

  // UI state: Search, Filters, Tabs & Modals
  const [activeTab, setActiveTab] = useState("staff"); // 'staff' | 'invites' | 'matrix'
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);

  // Confirmation Modals
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, confirmText, isDanger, onConfirm }
  const [promoteModal, setPromoteModal] = useState(null); // { profile, targetRole }

  const load = async () => {
    setLoading(true);
    try {
      const [inviteRes, profileRes, settingsRes, membersRes, profRes] = await Promise.all([
        supabase
          .from("access_invites")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, email, full_name, role, st_id, created_at")
          .in("role", ["admin", "editor"])
          .order("created_at", { ascending: false }),
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["registration_enabled", "registration_auto_approve", "ai_feature_enabled", "document_access_members"]),
        supabase
          .from("members")
          .select("st_id, name, level, email")
          .order("name"),
        supabase
          .from("profiles")
          .select("id, email, full_name, preferred_name, st_id, role")
      ]);

      if (inviteRes.error) {
        setMsg({ type: "error", text: inviteRes.error.message });
      } else {
        setInvites(inviteRes.data || []);
      }

      if (profileRes.error) {
        setMsg({ type: "error", text: profileRes.error.message });
      } else {
        setProfiles(profileRes.data || []);
      }

      if (settingsRes.data) {
        const regEnabledSetting = settingsRes.data.find(s => s.key === "registration_enabled");
        const autoApproveSetting = settingsRes.data.find(s => s.key === "registration_auto_approve");
        const aiSetting = settingsRes.data.find(s => s.key === "ai_feature_enabled");
        const docSetting = settingsRes.data.find(s => s.key === "document_access_members");
        setRegEnabled(regEnabledSetting ? regEnabledSetting.value === "true" : true);
        setAutoApprove(autoApproveSetting ? autoApproveSetting.value === "true" : false);
        setAiEnabled(aiSetting ? aiSetting.value === "true" : true);
        if (docSetting) {
          try {
            const list = JSON.parse(docSetting.value);
            setDocAccessMap(normalizeDocAccessMap(list));
          } catch (_) {
            setDocAccessMap({});
          }
        }
      }

      // Fetch all members & merge profiles for document access modal
      const memberMap = new Map();
      (membersRes.data || []).forEach(m => {
        const key = (m.st_id || m.email || "").trim().toUpperCase();
        if (key) {
          memberMap.set(key, {
            st_id: m.st_id || "",
            name: m.name || "",
            level: m.level || "",
            email: m.email || "",
            idKey: m.st_id || m.email || ""
          });
        }
      });
      (profRes.data || []).forEach(p => {
        const key = (p.st_id || p.email || "").trim().toUpperCase();
        if (key) {
          const existing = memberMap.get(key) || {};
          memberMap.set(key, {
            st_id: p.st_id || existing.st_id || "",
            name: existing.name || p.preferred_name || p.full_name || p.email,
            level: existing.level || "",
            email: p.email || existing.email || "",
            role: p.role || "member",
            idKey: p.st_id || existing.st_id || p.email || ""
          });
        }
      });
      setAllMembersList(Array.from(memberMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to load access telemetry." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Staff creation / invite workflow
  const handleCreateInvite = async (e) => {
    if (e) e.preventDefault();
    setMsg(null);
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setMsg({ type: "error", text: "Valid email address is required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ type: "error", text: "Please enter a valid email format (e.g. name@domain.com)." });
      return;
    }

    setSaving(true);
    try {
      // Check if user already exists in profiles
      const { data: existingProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, st_id")
        .eq("email", email)
        .maybeSingle();

      if (profileErr) {
        setMsg({ type: "error", text: profileErr.message });
        setSaving(false);
        return;
      }

      if (existingProfile) {
        setSaving(false);
        setPromoteModal({
          profile: existingProfile,
          targetRole: form.role
        });
        return;
      }

      // If user does not exist in profiles, create an access invite
      const { error } = await supabase
        .from("access_invites")
        .upsert(
          { email, role: form.role, created_by: session.userId || null, used_at: null },
          { onConflict: "email,role" }
        );

      if (error) {
        setMsg({ type: "error", text: error.message });
      } else {
        setForm(EMPTY_FORM);
        setMsg({
          type: "success",
          text: `Registration authorization provisioned for ${email} as [${form.role.toUpperCase()}].`
        });
        load();
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to provision access invite." });
    } finally {
      setSaving(false);
    }
  };

  const confirmDirectPromotion = async () => {
    if (!promoteModal) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: promoteModal.targetRole })
        .eq("id", promoteModal.profile.id);

      if (error) {
        setMsg({ type: "error", text: error.message });
      } else {
        setMsg({
          type: "success",
          text: `Promoted ${promoteModal.profile.full_name || promoteModal.profile.email} to [${promoteModal.targetRole.toUpperCase()}] successfully.`
        });
        setForm(EMPTY_FORM);
        setPromoteModal(null);
        load();
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Toggle System Gates
  const toggleRegistration = async (checked) => {
    setUpdatingReg(true);
    setMsg(null);
    const val = checked ? "true" : "false";
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "registration_enabled", value: val }, { onConflict: "key" });

    setUpdatingReg(false);
    if (error) {
      setMsg({ type: "error", text: "Failed to update public registration gate: " + error.message });
    } else {
      setRegEnabled(checked);
      setMsg({
        type: "success",
        text: `Public Member Self-Registration is now ${checked ? "OPEN (Active)" : "RESTRICTED (Closed)"}.`
      });
    }
  };

  const toggleAutoApprove = async (checked) => {
    setUpdatingAutoApprove(true);
    setMsg(null);
    const val = checked ? "true" : "false";
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "registration_auto_approve", value: val }, { onConflict: "key" });

    setUpdatingAutoApprove(false);
    if (error) {
      setMsg({ type: "error", text: "Failed to update auto-approval setting: " + error.message });
    } else {
      setAutoApprove(checked);
      setMsg({
        type: "success",
        text: `Instant Auto-Approval engine is now ${checked ? "ENABLED (Instant)" : "DISABLED (Manual Review Required)"}.`
      });
    }
  };

  const toggleAiFeature = async (checked) => {
    setUpdatingAi(true);
    setMsg(null);
    const val = checked ? "true" : "false";
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "ai_feature_enabled", value: val }, { onConflict: "key" });

    setUpdatingAi(false);
    if (error) {
      setMsg({ type: "error", text: "Failed to update AI feature setting: " + error.message });
    } else {
      setAiEnabled(checked);
      setMsg({
        type: "success",
        text: `Member & Guest AI Assistant Access is now ${checked ? "ACTIVE" : "RESTRICTED"}.`
      });
    }
  };

  // Revoke Invite
  const handleRevokeInvite = (invite) => {
    setConfirmModal({
      title: "Revoke Registration Invite",
      message: `Are you sure you want to revoke registration authorization for ${invite.email}? They will no longer be able to register as an ${invite.role}.`,
      confirmText: "Revoke Authorization",
      isDanger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("access_invites").delete().eq("id", invite.id);
        if (error) {
          setMsg({ type: "error", text: error.message });
        } else {
          setMsg({ type: "success", text: `Authorization for ${invite.email} revoked.` });
          load();
        }
        setConfirmModal(null);
      }
    });
  };

  // Modify Staff Role
  const handleRoleChange = async (profile, newRole) => {
    if (session.userId === profile.id) {
      setMsg({ type: "error", text: "Self-modification protection: You cannot alter your own administrative role." });
      return;
    }

    if (newRole === "member") {
      setConfirmModal({
        title: "Demote Staff Member",
        message: `Are you sure you want to remove staff privileges for ${profile.full_name || profile.email}? They will be demoted to a regular Member.`,
        confirmText: "Demote to Member",
        isDanger: true,
        onConfirm: async () => {
          const { error } = await supabase.from("profiles").update({ role: "member" }).eq("id", profile.id);
          if (error) {
            setMsg({ type: "error", text: error.message });
          } else {
            setMsg({ type: "success", text: `Privileges removed for ${profile.email}. User demoted to Member.` });
            load();
          }
          setConfirmModal(null);
        }
      });
    } else {
      setConfirmModal({
        title: `Change Role to ${newRole.toUpperCase()}`,
        message: `Update role for ${profile.full_name || profile.email} from [${profile.role.toUpperCase()}] to [${newRole.toUpperCase()}]?`,
        confirmText: `Confirm ${newRole.toUpperCase()}`,
        isDanger: false,
        onConfirm: async () => {
          const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
          if (error) {
            setMsg({ type: "error", text: error.message });
          } else {
            setMsg({ type: "success", text: `Updated ${profile.email} role to ${newRole.toUpperCase()}.` });
            load();
          }
          setConfirmModal(null);
        }
      });
    }
  };

  // Telemetry Calculations
  const adminCount = useMemo(() => profiles.filter(p => p.role === "admin").length, [profiles]);
  const editorCount = useMemo(() => profiles.filter(p => p.role === "editor").length, [profiles]);
  const openInvitesCount = useMemo(() => invites.filter(i => !i.used_at).length, [invites]);
  const claimedInvitesCount = useMemo(() => invites.filter(i => !!i.used_at).length, [invites]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    return profiles.filter(p => {
      const matchQuery =
        !staffSearch ||
        (p.full_name && p.full_name.toLowerCase().includes(staffSearch.toLowerCase())) ||
        (p.email && p.email.toLowerCase().includes(staffSearch.toLowerCase())) ||
        (p.st_id && p.st_id.toLowerCase().includes(staffSearch.toLowerCase()));

      const matchRole =
        staffRoleFilter === "all" ||
        p.role === staffRoleFilter;

      return matchQuery && matchRole;
    });
  }, [profiles, staffSearch, staffRoleFilter]);

  // Filtered Invites
  const filteredInvites = useMemo(() => {
    return invites.filter(inv => {
      const matchQuery =
        !inviteSearch ||
        inv.email.toLowerCase().includes(inviteSearch.toLowerCase()) ||
        inv.role.toLowerCase().includes(inviteSearch.toLowerCase());

      const matchStatus =
        inviteStatusFilter === "all" ||
        (inviteStatusFilter === "open" && !inv.used_at) ||
        (inviteStatusFilter === "used" && !!inv.used_at);

      return matchQuery && matchStatus;
    });
  }, [invites, inviteSearch, inviteStatusFilter]);

  // Non-admin guard
  if (role !== "admin") {
    return (
      <div className="access-page-container min-h-[70vh] flex items-center justify-center p-6" data-theme={currentTheme}>
        <div className={`max-w-md w-full ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xl"} border rounded-[12px] p-8 text-center`}>
          <div className="w-12 h-12 rounded-[10px] bg-[#eb5757]/10 border border-[#eb5757]/20 flex items-center justify-center mx-auto mb-4 text-[#eb5757]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className={`text-[18px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight mb-2`}>
            Cryptographic Access Restricted
          </h2>
          <p className={`text-[13px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed mb-6`}>
            Only authenticated system administrators possess authorization to inspect access control policies, provision staff credentials, or adjust governance gates.
          </p>
          <div className={`p-3 ${isDark ? "bg-[#161718] border-[#23252a] text-[#62666d]" : "bg-gray-50 border-gray-200 text-gray-500"} border rounded-[6px] text-[11px] font-berkeley-mono`}>
            CURRENT CREDENTIAL ROLE: <span className="text-[#eb5757] uppercase font-bold">{role}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="access-page-container space-y-6 pb-12" data-theme={currentTheme}>
      {/* ── Page Header ── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-5`}>
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className={`access-key-emblem w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-amber-50 border-amber-200 text-amber-600"} border flex items-center justify-center`}>
              <KeyRound className="w-4 h-4" />
            </span>
            <h1 className={`text-[20px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
              Access Governance & Security
            </h1>
            <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#6366f1]/10 text-[#818cf8] border-[#6366f1]/20" : "bg-indigo-50 text-indigo-700 border-indigo-200"} border`}>
              Admin Console
            </span>
          </div>
          <p className={`text-[13px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} tracking-tight`}>
            Cryptographic role management, staff credential provisioning, and public onboarding gates.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRoleMatrix(!showRoleMatrix)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[400] rounded-[6px] border transition-colors ${
              showRoleMatrix
                ? isDark
                  ? "bg-[#161718] border-[#818cf8] text-[#ffffff]"
                  : "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs"
                : isDark
                  ? "border-[#23252a] text-[#8a8f98] hover:text-[#d0d6e0] hover:bg-[#161718] bg-[#0f1011]"
                  : "border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 bg-white shadow-xs"
            }`}
          >
            <Shield className={`w-3.5 h-3.5 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
            <span>Role Matrix</span>
            {showRoleMatrix ? <ChevronUp className={`w-3 h-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} /> : <ChevronDown className={`w-3 h-3 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />}
          </button>

          <button
            onClick={load}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[400] ${isDark ? "text-[#8a8f98] hover:text-[#d0d6e0] bg-[#0f1011] hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200 shadow-xs"} border rounded-[6px] transition-colors`}
            title="Refresh access records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? `animate-spin ${isDark ? "text-[#e4f222]" : "text-indigo-600"}` : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Status Message Alert ── */}
      {msg && (
        <div
          className={`p-3 rounded-[6px] text-[13px] flex items-center justify-between border ${
            msg.type === "error"
              ? isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700"
              : isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="p-1 hover:opacity-75 transition-opacity text-current"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Interactive Telemetry KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Staff */}
        <div
          onClick={() => { setActiveTab("staff"); setStaffRoleFilter("all"); }}
          className={`p-3.5 rounded-[12px] border transition-all cursor-pointer ${
            activeTab === "staff" && staffRoleFilter === "all"
              ? isDark ? "border-[#e4f222]/40 bg-[#161718]" : "border-gray-900 bg-gray-50 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
            <span className="text-[11px] font-[400] uppercase tracking-wider">Total Staff</span>
            <Users className={`w-3.5 h-3.5 ${isDark ? "text-[#d0d6e0]" : "text-gray-600"}`} />
          </div>
          <div className={`text-[22px] font-berkeley-mono font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
            {profiles.length}
          </div>
          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mt-1`}>
            Admins + Editors
          </div>
        </div>

        {/* System Admins */}
        <div
          onClick={() => { setActiveTab("staff"); setStaffRoleFilter("admin"); }}
          className={`p-3.5 rounded-[12px] border transition-all cursor-pointer ${
            activeTab === "staff" && staffRoleFilter === "admin"
              ? isDark ? "border-[#818cf8]/60 bg-[#161718]" : "border-indigo-500 bg-indigo-50/50 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
            <span className="text-[11px] font-[400] uppercase tracking-wider">Admins</span>
            <ShieldCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
          </div>
          <div className={`text-[22px] font-berkeley-mono font-[510] ${isDark ? "text-[#818cf8]" : "text-indigo-600"} tracking-tight`}>
            {adminCount}
          </div>
          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mt-1`}>
            Full Governance
          </div>
        </div>

        {/* Operational Editors */}
        <div
          onClick={() => { setActiveTab("staff"); setStaffRoleFilter("editor"); }}
          className={`p-3.5 rounded-[12px] border transition-all cursor-pointer ${
            activeTab === "staff" && staffRoleFilter === "editor"
              ? isDark ? "border-[#02b8cc]/60 bg-[#161718]" : "border-cyan-500 bg-cyan-50/50 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
            <span className="text-[11px] font-[400] uppercase tracking-wider">Editors</span>
            <UserCheck className={`w-3.5 h-3.5 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
          </div>
          <div className={`text-[22px] font-berkeley-mono font-[510] ${isDark ? "text-[#d0d6e0]" : "text-gray-900"} tracking-tight`}>
            {editorCount}
          </div>
          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mt-1`}>
            Operational Staff
          </div>
        </div>

        {/* Open Invites */}
        <div
          onClick={() => { setActiveTab("invites"); setInviteStatusFilter("open"); }}
          className={`p-3.5 rounded-[12px] border transition-all cursor-pointer ${
            activeTab === "invites" && inviteStatusFilter === "open"
              ? isDark ? "border-[#f59e0b]/60 bg-[#161718]" : "border-amber-400 bg-amber-50/70 shadow-sm"
              : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
          }`}
        >
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
            <span className="text-[11px] font-[400] uppercase tracking-wider">Open Invites</span>
            <UserPlus className={`w-3.5 h-3.5 ${isDark ? "text-[#f59e0b]" : "text-amber-600"}`} />
          </div>
          <div className={`text-[22px] font-berkeley-mono font-[510] ${isDark ? "text-[#f59e0b]" : "text-amber-600"} tracking-tight`}>
            {openInvitesCount}
          </div>
          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mt-1`}>
            {claimedInvitesCount} claimed
          </div>
        </div>

        {/* Public Gate Status */}
        <div className={`p-3.5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border col-span-2 sm:col-span-1`}>
          <div className={`flex items-center justify-between ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
            <span className="text-[11px] font-[400] uppercase tracking-wider">Onboarding Gate</span>
            <Globe className={`w-3.5 h-3.5 ${regEnabled ? isDark ? "text-[#27a644]" : "text-emerald-600" : isDark ? "text-[#eb5757]" : "text-rose-600"}`} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${regEnabled ? isDark ? "bg-[#27a644] shadow-[0_0_8px_#27a644]" : "bg-emerald-600" : isDark ? "bg-[#eb5757]" : "bg-rose-600"}`} />
            <span className={`text-[15px] font-berkeley-mono font-[510] uppercase ${regEnabled ? isDark ? "text-[#27a644]" : "text-emerald-700" : isDark ? "text-[#eb5757]" : "text-rose-600"}`}>
              {regEnabled ? "Public Open" : "Closed"}
            </span>
          </div>
          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mt-1`}>
            Auto-Approve: {autoApprove ? "ON" : "OFF"}
          </div>
        </div>
      </div>

      {/* ── Collapsible Role Matrix Reference ── */}
      {showRoleMatrix && (
        <div className={`p-5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#6366f1]/30" : "bg-white border-indigo-200 shadow-sm"} border space-y-4`}>
          <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
              <h3 className={`text-[14px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
                Cryptographic Access Hierarchy & Capabilities Matrix
              </h3>
            </div>
            <button
              onClick={() => setShowRoleMatrix(false)}
              className={`${isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-500 hover:text-gray-900"} text-[12px]`}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Admin */}
            <div className={`p-3.5 rounded-[8px] ${isDark ? "bg-[#161718] border-[#818cf8]/30" : "bg-indigo-50/50 border-indigo-200"} border space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-berkeley-mono font-bold ${isDark ? "text-[#818cf8] bg-[#6366f1]/15 border-[#6366f1]/30" : "text-indigo-700 bg-indigo-100 border-indigo-300"} px-1.5 py-0.5 rounded-[3px] border`}>
                  ADMIN
                </span>
                <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Level 3 (Root)</span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"} leading-relaxed`}>
                Full authority across society data, system parameters, member moderation, and staff delegation.
              </p>
              <ul className={`text-[11px] ${isDark ? "text-[#8a8f98] border-[#23252a]" : "text-gray-600 border-indigo-100"} space-y-1 pt-1 border-t`}>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Configure System Gates & AI</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Grant & Revoke Staff Roles</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Permanent Record Deletions</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Export & Audit Database</li>
              </ul>
            </div>

            {/* Editor */}
            <div className={`p-3.5 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-cyan-50/40 border-cyan-200"} border space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-berkeley-mono font-bold ${isDark ? "text-[#02b8cc] bg-[#02b8cc]/15 border-[#02b8cc]/30" : "text-cyan-700 bg-cyan-100 border-cyan-300"} px-1.5 py-0.5 rounded-[3px] border`}>
                  EDITOR
                </span>
                <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Level 2 (Operational)</span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"} leading-relaxed`}>
                Management of active society lifecycle: creating notices, organizing events, tracking attendance, and issuing letters.
              </p>
              <ul className={`text-[11px] ${isDark ? "text-[#8a8f98] border-[#23252a]" : "text-gray-600 border-cyan-100"} space-y-1 pt-1 border-t`}>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Create/Edit Events & Notices</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Take Attendance & Review Letters</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Approve Pending Member Signups</li>
                <li className="flex items-center gap-1.5"><X className="w-3 h-3 text-[#eb5757]" /> Cannot change Security Gates</li>
              </ul>
            </div>

            {/* Member */}
            <div className={`p-3.5 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-berkeley-mono font-bold ${isDark ? "text-[#8a8f98] bg-[#ffffff]/5 border-[#23252a]" : "text-gray-700 bg-gray-200 border-gray-300"} px-1.5 py-0.5 rounded-[3px] border`}>
                  MEMBER
                </span>
                <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Level 1 (Self-Service)</span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#d0d6e0]" : "text-gray-700"} leading-relaxed`}>
                Standard university society member. Can browse society intelligence, apply for event OC, and request letters.
              </p>
              <ul className={`text-[11px] ${isDark ? "text-[#8a8f98] border-[#23252a]" : "text-gray-600 border-gray-200"} space-y-1 pt-1 border-t`}>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Self-Service Info Management</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Request Appreciation Letters</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#27a644]" /> Direct Chat / Messaging</li>
                <li className="flex items-center gap-1.5"><X className="w-3 h-3 text-[#eb5757]" /> Read-only directory access</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Precision System Security Governance (Toggles) ── */}
      <div className={`p-5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border space-y-5`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
          <div>
            <h2 className={`text-[14px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight flex items-center gap-2`}>
              <SlidersHorizontal className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
              System Security & Access Controls
            </h2>
            <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
              Immediate toggle gates for public registration, automated onboarding, and computational AI limits.
            </p>
          </div>
          <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
            Supabase System Settings
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. General Member Registration */}
          <div className={`p-4 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Globe className={`w-4 h-4 ${isDark ? "text-[#818cf8]" : "text-indigo-600"}`} />
                  <h3 className={`text-[13px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                    Public Self-Registration
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] font-bold ${
                    regEnabled
                      ? "bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30"
                      : "bg-[#eb5757]/15 text-[#eb5757] border border-[#eb5757]/30"
                  }`}
                >
                  {regEnabled ? "OPEN" : "OFF"}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
                Permit new students to sign up from the public landing page. If closed, only invited staff or pre-listed members can create accounts.
              </p>
            </div>

            <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-200"}`}>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                {regEnabled ? "Signups allowed" : "Signups restricted"}
              </span>
              <button
                type="button"
                disabled={updatingReg}
                onClick={() => toggleRegistration(!regEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  regEnabled ? isDark ? "bg-[#e4f222]" : "bg-emerald-600" : isDark ? "bg-[#23252a]" : "bg-gray-300"
                }`}
                title={regEnabled ? "Click to disable public registration" : "Click to enable public registration"}
              >
                <div
                  className={`w-5 h-5 rounded-full ${isDark ? "bg-[#08090a]" : "bg-white shadow-sm"} transition-transform shadow-md ${
                    regEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 2. Auto-Approve Registrations */}
          <div className={`p-4 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${isDark ? "text-[#f59e0b]" : "text-amber-500"}`} />
                  <h3 className={`text-[13px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                    Auto-Approve Engine
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] font-bold ${
                    autoApprove
                      ? "bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30"
                      : isDark ? "bg-[#23252a] text-[#8a8f98] border border-[#383b3f]" : "bg-gray-200 text-gray-700 border border-gray-300"
                  }`}
                >
                  {autoApprove ? "INSTANT" : "MANUAL"}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
                Automatically approve new member signups upon email verification. When disabled, users remain in `Pending Review` until verified by staff.
              </p>
            </div>

            <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-200"}`}>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                {autoApprove ? "Instant access" : "Manual verification"}
              </span>
              <button
                type="button"
                disabled={updatingAutoApprove}
                onClick={() => toggleAutoApprove(!autoApprove)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  autoApprove ? isDark ? "bg-[#e4f222]" : "bg-emerald-600" : isDark ? "bg-[#23252a]" : "bg-gray-300"
                }`}
                title={autoApprove ? "Click to require manual review" : "Click to enable automatic approval"}
              >
                <div
                  className={`w-5 h-5 rounded-full ${isDark ? "bg-[#08090a]" : "bg-white shadow-sm"} transition-transform shadow-md ${
                    autoApprove ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Member AI Feature Access */}
          <div className={`p-4 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${isDark ? "text-[#02b8cc]" : "text-cyan-600"}`} />
                  <h3 className={`text-[13px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                    Member AI Assistant
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] font-bold ${
                    aiEnabled
                      ? "bg-[#27a644]/15 text-[#27a644] border border-[#27a644]/30"
                      : "bg-[#eb5757]/15 text-[#eb5757] border border-[#eb5757]/30"
                  }`}
                >
                  {aiEnabled ? "ACTIVE" : "OFF"}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
                Permit general members and public guests to query the embedded AI Assistant. Staff users always maintain assistant access for operations.
              </p>
            </div>

            <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-200"}`}>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                {aiEnabled ? "Tokens authorized" : "Service locked"}
              </span>
              <button
                type="button"
                disabled={updatingAi}
                onClick={() => toggleAiFeature(!aiEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  aiEnabled ? isDark ? "bg-[#e4f222]" : "bg-emerald-600" : isDark ? "bg-[#23252a]" : "bg-gray-300"
                }`}
                title={aiEnabled ? "Click to disable AI for members" : "Click to enable AI for members"}
              >
                <div
                  className={`w-5 h-5 rounded-full ${isDark ? "bg-[#08090a]" : "bg-white shadow-sm"} transition-transform shadow-md ${
                    aiEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 4. Document Section Member Access */}
          <div className={`p-4 rounded-[8px] ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <FolderArchive className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
                  <h3 className={`text-[13px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                    Documents Access
                  </h3>
                </div>
                <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] font-bold ${isDark ? "bg-[#e4f222]/15 text-[#e4f222] border-[#e4f222]/30" : "bg-amber-100 text-amber-800 border-amber-300"} border`}>
                  {Object.keys(docAccessMap).length} MEMBERS
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
                The document repository is restricted to administrator-selected members. Officers always have management access.
              </p>
            </div>

            <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-200"}`}>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                {Object.keys(docAccessMap).length > 0 ? `${Object.keys(docAccessMap).length} configured` : "None authorized"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTempDocAccessMap({ ...docAccessMap });
                  setDocMemberSearch("");
                  setDocModalOpen(true);
                }}
                className={`h-6 px-2.5 rounded-[4px] ${isDark ? "bg-[#23252a] hover:bg-[#383b3f] text-white" : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 shadow-xs"} text-[11px] font-medium transition-colors`}
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Staff Provisioning Engine (Add / Promote Staff) ── */}
      <div className={`p-5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border space-y-4`}>
        <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"} pb-3`}>
          <div className="flex items-center gap-2">
            <UserPlus className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-amber-500"}`} />
            <h2 className={`text-[14px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
              Staff Provisioning Engine
            </h2>
          </div>
          <span className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
            Invite new staff or promote existing registered users
          </span>
        </div>

        <form onSubmit={handleCreateInvite} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Email Address */}
          <div className="md:col-span-6 space-y-1.5">
            <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
              Target Email Address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. staff.member@domain.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`w-full h-9 px-3 text-[13px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff] focus:border-[#d0d6e0] placeholder-[#62666d]" : "bg-white border-gray-200 text-gray-900 focus:border-gray-900 placeholder-gray-400 shadow-xs"} border rounded-[6px] outline-none transition-colors`}
            />
          </div>

          {/* Role Choice */}
          <div className="md:col-span-3 space-y-1.5">
            <label className={`text-[11px] font-[510] uppercase tracking-wider ${isDark ? "text-[#8a8f98]" : "text-gray-700"}`}>
              Privilege Level
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={`w-full h-9 px-3 text-[13px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff] focus:border-[#d0d6e0]" : "bg-white border-gray-200 text-gray-900 focus:border-gray-900 shadow-xs"} border rounded-[6px] outline-none transition-colors cursor-pointer`}
            >
              <option value="editor">Editor (Level 2)</option>
              <option value="admin">Administrator (Level 3)</option>
            </select>
          </div>

          {/* Provision Action */}
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving || !form.email.trim()}
              className={`w-full h-9 px-4 text-[13px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"} rounded-[6px] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0px_2px_4px_rgba(0,0,0,0.2)]`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Authorize Staff Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Section Views Navigation Tabs ── */}
      <div className={`flex items-center justify-between border-b ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 text-[13px] font-[510] tracking-tight border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "staff"
                ? isDark ? "border-[#e4f222] text-[#ffffff]" : "border-gray-900 text-gray-900"
                : isDark ? "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Active Staff Directory</span>
            <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.2 rounded-full ${isDark ? "bg-[#161718] text-[#8a8f98] border-[#23252a]" : "bg-gray-100 text-gray-600 border-gray-200"} border`}>
              {profiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("invites")}
            className={`px-4 py-2 text-[13px] font-[510] tracking-tight border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "invites"
                ? isDark ? "border-[#e4f222] text-[#ffffff]" : "border-gray-900 text-gray-900"
                : isDark ? "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Registration Authorizations</span>
            <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.2 rounded-full ${isDark ? "bg-[#161718] text-[#8a8f98] border-[#23252a]" : "bg-gray-100 text-gray-600 border-gray-200"} border`}>
              {invites.length}
            </span>
          </button>
        </div>

        <div className={`hidden sm:block text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
          {activeTab === "staff"
            ? `${filteredStaff.length} users displayed`
            : `${filteredInvites.length} invites displayed`}
        </div>
      </div>

      {/* ── TAB 1: Active Staff Directory ── */}
      {activeTab === "staff" && (
        <div className={`p-5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border space-y-4`}>
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff by name, email, or ST ID..."
                className={`w-full h-8 pl-8 pr-7 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] focus:border-[#d0d6e0] text-[#ffffff] placeholder-[#62666d]" : "bg-white border-gray-200 focus:border-gray-900 text-gray-900 placeholder-gray-400 shadow-xs"} border rounded-[6px] outline-none transition-colors`}
              />
              {staffSearch && (
                <button
                  onClick={() => setStaffSearch("")}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-900"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className={`text-[11px] uppercase tracking-wider font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Role:</span>
              <div className={`flex items-center ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border rounded-[6px] p-0.5 text-[11px]`}>
                <button
                  onClick={() => setStaffRoleFilter("all")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    staffRoleFilter === "all"
                      ? isDark ? "bg-[#23252a] text-[#ffffff]" : "bg-white text-gray-900 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All ({profiles.length})
                </button>
                <button
                  onClick={() => setStaffRoleFilter("admin")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    staffRoleFilter === "admin"
                      ? isDark ? "bg-[#23252a] text-[#818cf8]" : "bg-white text-indigo-700 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Admin ({adminCount})
                </button>
                <button
                  onClick={() => setStaffRoleFilter("editor")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    staffRoleFilter === "editor"
                      ? isDark ? "bg-[#23252a] text-[#02b8cc]" : "bg-white text-cyan-700 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Editor ({editorCount})
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={`overflow-x-auto border ${isDark ? "border-[#23252a]" : "border-gray-200"} rounded-[8px]`}>
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className={`${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"} border-b font-berkeley-mono text-[11px] uppercase`}>
                  <th className="py-2.5 px-4 font-normal">Staff User</th>
                  <th className="py-2.5 px-4 font-normal">Email Contact</th>
                  <th className="py-2.5 px-4 font-normal">Privilege Tier</th>
                  <th className="py-2.5 px-4 font-normal">Created / Linked</th>
                  <th className="py-2.5 px-4 font-normal text-right">Access Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-200"}`}>
                {loading ? (
                  <tr>
                    <td colSpan="5" className={`py-8 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      <RefreshCw className={`w-5 h-5 animate-spin mx-auto mb-2 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                      <span>Synchronizing staff directory...</span>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={`py-8 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <span>No staff users match your search criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((p) => {
                    const isSelf = session.userId === p.id;
                    return (
                      <tr key={p.id} className={`${isDark ? "hover:bg-[#161718]/50" : "hover:bg-gray-50/80"} transition-colors`}>
                        {/* Name + Avatar */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#ffffff]" : "bg-gray-100 border-gray-200 text-gray-800"} border flex items-center justify-center font-berkeley-mono text-[11px] font-bold`}>
                              {p.full_name
                                ? p.full_name.substring(0, 2).toUpperCase()
                                : p.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className={`font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} flex items-center gap-1.5`}>
                                <span>{p.full_name || "Unnamed Staff"}</span>
                                {isSelf && (
                                  <span className={`text-[9px] font-berkeley-mono px-1.5 py-0.2 rounded-[3px] ${isDark ? "bg-[#e4f222]/15 text-[#e4f222] border-[#e4f222]/30" : "bg-amber-100 text-amber-800 border-amber-300"} border`}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              {p.st_id && (
                                <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                                  {p.st_id}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className={`py-3 px-4 align-middle font-berkeley-mono ${isDark ? "text-[#d0d6e0]" : "text-gray-700"}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{p.email}</span>
                            <button
                              onClick={() => copyToClipboard(p.email, p.id)}
                              className={`p-1 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-900"} rounded-[3px] transition-colors`}
                              title="Copy email"
                            >
                              {copiedId === p.id ? (
                                <Check className="w-3 h-3 text-[#27a644]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4 align-middle">
                          {p.role === "admin" ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#6366f1]/15 text-[#818cf8] border-[#6366f1]/30" : "bg-indigo-50 text-indigo-700 border-indigo-200"} border`}>
                              <ShieldCheck className="w-3 h-3" />
                              ADMIN
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#02b8cc]/15 text-[#02b8cc] border-[#02b8cc]/30" : "bg-cyan-50 text-cyan-700 border-cyan-200"} border`}>
                              <UserCheck className="w-3 h-3" />
                              EDITOR
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className={`py-3 px-4 align-middle font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Historical"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isSelf ? (
                              <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} italic`}>
                                Active Session
                              </span>
                            ) : (
                              <>
                                {p.role === "editor" ? (
                                  <button
                                    onClick={() => handleRoleChange(p, "admin")}
                                    className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#818cf8] hover:text-[#ffffff] hover:bg-[#818cf8]/15 border-[#818cf8]/30" : "text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border-indigo-200 bg-white shadow-xs"} border rounded-[4px] transition-colors`}
                                    title="Promote to Admin"
                                  >
                                    Promote to Admin
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRoleChange(p, "editor")}
                                    className={`px-2 py-1 text-[11px] font-[400] ${isDark ? "text-[#02b8cc] hover:text-[#ffffff] hover:bg-[#02b8cc]/15 border-[#02b8cc]/30" : "text-cyan-700 hover:text-cyan-900 hover:bg-cyan-50 border-cyan-200 bg-white shadow-xs"} border rounded-[4px] transition-colors`}
                                    title="Demote to Editor"
                                  >
                                    Set as Editor
                                  </button>
                                )}

                                <button
                                  onClick={() => handleRoleChange(p, "member")}
                                  className={`p-1.5 ${isDark ? "text-[#eb5757] hover:bg-[#eb5757]/15" : "text-rose-600 hover:bg-rose-50"} rounded-[4px] transition-colors`}
                                  title="Revoke all staff privileges (demote to member)"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Registration Authorizations (Invites) ── */}
      {activeTab === "invites" && (
        <div className={`p-5 rounded-[12px] ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"} border space-y-4`}>
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d]" : "text-gray-400"}`} />
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search invites by email or role..."
                className={`w-full h-8 pl-8 pr-7 text-[12px] ${isDark ? "bg-[#161718] border-[#23252a] focus:border-[#d0d6e0] text-[#ffffff] placeholder-[#62666d]" : "bg-white border-gray-200 focus:border-gray-900 text-gray-900 placeholder-gray-400 shadow-xs"} border rounded-[6px] outline-none transition-colors`}
              />
              {inviteSearch && (
                <button
                  onClick={() => setInviteSearch("")}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-900"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className={`text-[11px] uppercase tracking-wider font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Status:</span>
              <div className={`flex items-center ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} border rounded-[6px] p-0.5 text-[11px]`}>
                <button
                  onClick={() => setInviteStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    inviteStatusFilter === "all"
                      ? isDark ? "bg-[#23252a] text-[#ffffff]" : "bg-white text-gray-900 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All ({invites.length})
                </button>
                <button
                  onClick={() => setInviteStatusFilter("open")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    inviteStatusFilter === "open"
                      ? isDark ? "bg-[#23252a] text-[#f59e0b]" : "bg-white text-amber-600 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Open ({openInvitesCount})
                </button>
                <button
                  onClick={() => setInviteStatusFilter("used")}
                  className={`px-2.5 py-1 rounded-[4px] font-berkeley-mono transition-colors ${
                    inviteStatusFilter === "used"
                      ? isDark ? "bg-[#23252a] text-[#27a644]" : "bg-white text-emerald-700 shadow-xs"
                      : isDark ? "text-[#8a8f98] hover:text-[#ffffff]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Claimed ({claimedInvitesCount})
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={`overflow-x-auto border ${isDark ? "border-[#23252a]" : "border-gray-200"} rounded-[8px]`}>
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className={`${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"} border-b font-berkeley-mono text-[11px] uppercase`}>
                  <th className="py-2.5 px-4 font-normal">Authorized Email</th>
                  <th className="py-2.5 px-4 font-normal">Target Role</th>
                  <th className="py-2.5 px-4 font-normal">Authorization Status</th>
                  <th className="py-2.5 px-4 font-normal">Issued At</th>
                  <th className="py-2.5 px-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-200"}`}>
                {loading ? (
                  <tr>
                    <td colSpan="5" className={`py-8 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      <RefreshCw className={`w-5 h-5 animate-spin mx-auto mb-2 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                      <span>Loading registration authorizations...</span>
                    </td>
                  </tr>
                ) : filteredInvites.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={`py-8 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                      <KeyRound className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <span>No registration authorizations found.</span>
                    </td>
                  </tr>
                ) : (
                  filteredInvites.map((inv) => {
                    const isClaimed = !!inv.used_at;
                    return (
                      <tr key={inv.id} className={`${isDark ? "hover:bg-[#161718]/50" : "hover:bg-gray-50/80"} transition-colors`}>
                        {/* Email */}
                        <td className={`py-3 px-4 align-middle font-berkeley-mono ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{inv.email}</span>
                            <button
                              onClick={() => copyToClipboard(inv.email, `inv-${inv.id}`)}
                              className={`p-1 ${isDark ? "text-[#62666d] hover:text-[#ffffff]" : "text-gray-400 hover:text-gray-900"} rounded-[3px] transition-colors`}
                              title="Copy email"
                            >
                              {copiedId === `inv-${inv.id}` ? (
                                <Check className="w-3 h-3 text-[#27a644]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] ${
                              inv.role === "admin"
                                ? isDark ? "bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/30" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : isDark ? "bg-[#02b8cc]/15 text-[#02b8cc] border border-[#02b8cc]/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                            }`}
                          >
                            {inv.role.toUpperCase()}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 align-middle font-berkeley-mono text-[11px]">
                          {isClaimed ? (
                            <span className={`inline-flex items-center gap-1 ${isDark ? "text-[#27a644]" : "text-emerald-700"}`}>
                              <CheckCircle2 className="w-3 h-3" />
                              Claimed ({new Date(inv.used_at).toLocaleDateString()})
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 ${isDark ? "text-[#f59e0b]" : "text-amber-600"}`}>
                              <Clock className="w-3 h-3" />
                              Open (Awaiting Signup)
                            </span>
                          )}
                        </td>

                        {/* Issued At */}
                        <td className={`py-3 px-4 align-middle font-berkeley-mono text-[11px] ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "-"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isClaimed && (
                              <button
                                onClick={() => handleRevokeInvite(inv)}
                                className={`px-2.5 py-1 text-[11px] font-[400] ${isDark ? "text-[#eb5757] hover:bg-[#eb5757]/15 border-[#eb5757]/30" : "text-rose-600 hover:bg-rose-50 border-rose-200 bg-white shadow-xs"} border rounded-[4px] transition-colors`}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Direct Promotion Confirmation ── */}
      {promoteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[8px] ${isDark ? "bg-[#818cf8]/10 border-[#818cf8]/30 text-[#818cf8]" : "bg-indigo-50 border-indigo-200 text-indigo-600"} border flex items-center justify-center`}>
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-[15px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
                  Direct Staff Promotion
                </h3>
                <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                  Existing member account detected
                </p>
              </div>
            </div>

            <div className={`p-3.5 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border rounded-[8px] space-y-2 text-[12px]`}>
              <div className="flex justify-between">
                <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>User Name:</span>
                <span className={`font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"}`}>{promoteModal.profile.full_name || "Unnamed"}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Email:</span>
                <span className={`font-berkeley-mono ${isDark ? "text-[#d0d6e0]" : "text-gray-700"}`}>{promoteModal.profile.email}</span>
              </div>
              {promoteModal.profile.st_id && (
                <div className="flex justify-between">
                  <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Student ID:</span>
                  <span className={`font-berkeley-mono ${isDark ? "text-[#d0d6e0]" : "text-gray-700"}`}>{promoteModal.profile.st_id}</span>
                </div>
              )}
              <div className={`flex justify-between pt-1 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
                <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Current Role:</span>
                <span className={`font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} uppercase`}>[{promoteModal.profile.role}]</span>
              </div>
              <div className="flex justify-between">
                <span className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Promote To:</span>
                <span className={`font-berkeley-mono font-bold ${isDark ? "text-[#e4f222]" : "text-indigo-600"} uppercase`}>[{promoteModal.targetRole}]</span>
              </div>
            </div>

            <p className={`text-[12px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
              This account is already registered. Promoting will immediately grant them administrative access to society tools.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromoteModal(null)}
                className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-[#ffffff] hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-200"} border rounded-[6px] transition-colors`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDirectPromotion}
                className={`px-4 py-1.5 text-[12px] font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"} rounded-[6px] flex items-center gap-1.5 transition-colors`}
              >
                {saving ? "Promoting..." : `Confirm Promotion to ${promoteModal.targetRole.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: General Confirmation ── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-[8px] flex items-center justify-center ${
                  confirmModal.isDanger
                    ? isDark ? "bg-[#eb5757]/10 border border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 border border-red-200 text-red-600"
                    : isDark ? "bg-[#818cf8]/10 border border-[#818cf8]/30 text-[#818cf8]" : "bg-indigo-50 border border-indigo-200 text-indigo-600"
                }`}
              >
                {confirmModal.isDanger ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <h3 className={`text-[15px] font-[510] ${isDark ? "text-[#ffffff]" : "text-gray-900"} tracking-tight`}>
                {confirmModal.title}
              </h3>
            </div>

            <p className={`text-[13px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed`}>
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className={`px-3.5 py-1.5 text-[12px] ${isDark ? "text-[#8a8f98] hover:text-[#ffffff] hover:bg-[#161718] border-[#23252a]" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-200"} border rounded-[6px] transition-colors`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-1.5 text-[12px] font-[510] rounded-[6px] transition-colors ${
                  confirmModal.isDanger
                    ? "bg-[#eb5757] hover:bg-[#d64545] text-white"
                    : isDark ? "bg-[#e4f222] hover:bg-[#d8e61e] text-[#08090a]" : "bg-gray-900 hover:bg-black text-white"
                }`}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Member Access Modal in Access.jsx ── */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-2xl"} border rounded-[12px] w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden`}>
            {/* Modal Header */}
            <div className={`p-4 border-b ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-[6px] ${isDark ? "bg-[#e4f222]/10 border-[#e4f222]/20 text-[#e4f222]" : "bg-amber-100 border-amber-300 text-amber-700"} border flex items-center justify-center`}>
                  <FolderArchive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Document Repository Member Access</h3>
                  <p className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    Select which society members can view documents and choose their permitted categories
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDocModalOpen(false)}
                className={`${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#23252a]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"} p-1 rounded`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Controls: Search & Batch Category Presets */}
            <div className={`p-4 border-b ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"} space-y-3`}>
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`} />
                <input
                  type="text"
                  value={docMemberSearch}
                  onChange={(e) => setDocMemberSearch(e.target.value)}
                  placeholder="Search members by name, student ID (e.g. SC/2022/12345), or email..."
                  className={`w-full h-8 pl-9 pr-3 text-xs ${isDark ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#e4f222]" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-900 shadow-xs"} border rounded-[6px] focus:outline-none`}
                />
              </div>

              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                  <span className={`${isDark ? "text-[#e4f222]" : "text-amber-600 font-bold"}`}>{Object.keys(tempDocAccessMap).length}</span> of {allMembersList.length} members with access
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"}`}>Apply to matching:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const q = docMemberSearch.trim().toLowerCase();
                      const filtered = allMembersList.filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
                      setTempDocAccessMap(prev => {
                        const copy = { ...prev };
                        filtered.forEach(m => {
                          const k = (m.idKey || m.st_id || m.email || "").trim();
                          if (k) copy[k] = [...ALL_CATEGORY_IDS];
                        });
                        return copy;
                      });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-white hover:border-[#e4f222]/40 hover:text-[#e4f222]" : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200"} border transition-colors`}
                  >
                    All Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = docMemberSearch.trim().toLowerCase();
                      const filtered = allMembersList.filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
                      setTempDocAccessMap(prev => {
                        const copy = { ...prev };
                        filtered.forEach(m => {
                          const k = (m.idKey || m.st_id || m.email || "").trim();
                          if (k) copy[k] = ["Guidance"];
                        });
                        return copy;
                      });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222] hover:bg-[#e4f222]/10 hover:border-[#e4f222]/40" : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"} border transition-colors`}
                  >
                    Guidance Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = docMemberSearch.trim().toLowerCase();
                      const filtered = allMembersList.filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
                      setTempDocAccessMap(prev => {
                        const copy = { ...prev };
                        filtered.forEach(m => {
                          const k = (m.idKey || m.st_id || m.email || "").trim();
                          if (k) copy[k] = ["Permissions"];
                        });
                        return copy;
                      });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-amber-300 hover:bg-amber-400/10 hover:border-amber-400/40" : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"} border transition-colors`}
                  >
                    Permissions Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = docMemberSearch.trim().toLowerCase();
                      const filtered = allMembersList.filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
                      setTempDocAccessMap(prev => {
                        const copy = { ...prev };
                        filtered.forEach(m => {
                          const k = (m.idKey || m.st_id || m.email || "").trim();
                          if (k) copy[k] = ["Guidance", "Permissions"];
                        });
                        return copy;
                      });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#818cf8] hover:bg-[#818cf8]/10 hover:border-[#818cf8]/40" : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"} border transition-colors`}
                  >
                    Both
                  </button>
                  <span className={`${isDark ? "text-[#383b3f]" : "text-gray-300"}`}>•</span>
                  <button
                    type="button"
                    onClick={() => setTempDocAccessMap({})}
                    className="text-[10px] text-[#eb5757] hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Member Checklist with Category Chips */}
            <div className={`flex-1 overflow-y-auto p-4 ${isDark ? "divide-[#23252a]/60" : "divide-gray-100"} divide-y space-y-2.5`}>
              {allMembersList
                .filter(m => {
                  const q = docMemberSearch.trim().toLowerCase();
                  return !q || (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
                })
                .map((member) => {
                  const memberIdKey = (member.idKey || member.st_id || member.email || "").trim();
                  const memberCategories = getMemberCategoriesFromMap(tempDocAccessMap, member);
                  const hasAll = ALL_CATEGORY_IDS.every(c => memberCategories.includes(c));
                  const hasAny = memberCategories.length > 0;

                  return (
                    <div
                      key={memberIdKey || member.name}
                      className={`p-3 rounded-[8px] transition-colors border ${
                        hasAny
                          ? isDark ? "bg-[#161718] border-[#e4f222]/25 shadow-sm" : "bg-amber-50/40 border-amber-200 shadow-xs"
                          : isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
                      }`}
                    >
                      {/* Top Row: Member Details & Quick All/None Action */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className={`font-[510] text-xs ${isDark ? "text-white" : "text-gray-900"} truncate flex items-center gap-2`}>
                            <span>{member.name}</span>
                            {member.level && (
                              <span className={`text-[9px] font-berkeley-mono ${isDark ? "text-[#8a8f98] bg-[#0f1011] border-[#23252a]" : "text-gray-600 bg-gray-100 border-gray-200"} px-1.5 py-0.2 rounded border`}>
                                L{member.level}
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5 truncate`}>
                            {member.st_id || ""} {member.email ? `${member.st_id ? "• " : ""}${member.email}` : ""}
                          </div>
                        </div>

                        {/* Status Badge & Quick Action */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasAll ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-berkeley-mono text-[#27a644] bg-[#27a644]/15 border border-[#27a644]/30 px-2 py-0.5 rounded-[4px]">
                              <Check className="w-3 h-3" />
                              All 4 Categories
                            </span>
                          ) : hasAny ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono ${isDark ? "text-[#e4f222] bg-[#e4f222]/15 border-[#e4f222]/30" : "text-amber-800 bg-amber-100 border-amber-300"} border px-2 py-0.5 rounded-[4px]`}>
                              {memberCategories.length} Categories
                            </span>
                          ) : (
                            <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d] bg-[#0f1011] border-[#23252a]" : "text-gray-500 bg-gray-100 border-gray-200"} px-2 py-0.5 rounded-[4px] border`}>
                              No Access
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setTempDocAccessMap(prev => {
                                const copy = { ...prev };
                                const stId = (member.st_id || "").trim().toUpperCase();
                                const email = (member.email || "").trim().toLowerCase();
                                let matchedKey = memberIdKey;
                                for (const k of Object.keys(copy)) {
                                  const kTrim = k.trim();
                                  if ((stId && kTrim.toUpperCase() === stId) || (email && kTrim.toLowerCase() === email)) {
                                    matchedKey = k;
                                    break;
                                  }
                                }
                                if (hasAny) {
                                  delete copy[matchedKey];
                                } else {
                                  copy[matchedKey] = [...ALL_CATEGORY_IDS];
                                }
                                return copy;
                              });
                            }}
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border transition-colors ${
                              hasAny
                                ? isDark ? "bg-[#23252a] text-[#8a8f98] hover:text-[#eb5757] hover:border-[#eb5757]/40 border-transparent" : "bg-gray-100 text-gray-600 hover:text-rose-600 border-gray-200"
                                : isDark ? "bg-[#e4f222]/10 text-[#e4f222] hover:bg-[#e4f222]/20 border-[#e4f222]/30" : "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300"
                            }`}
                            title={hasAny ? "Remove all categories for this member" : "Grant all 4 categories"}
                          >
                            {hasAny ? "Clear" : "+ Grant All"}
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Category Pills */}
                      <div className={`flex items-center gap-1.5 flex-wrap pt-1.5 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-200"}`}>
                        <span className={`text-[9px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-500"} mr-1 uppercase tracking-wider`}>
                          Can View:
                        </span>
                        {ALLOWED_CATEGORIES.map(cat => {
                          const isActive = memberCategories.includes(cat.id);
                          const IconComp = CATEGORY_ICONS[cat.id] || Folder;

                          let activeClass = "";
                          if (cat.id === "Guidance") {
                            activeClass = isDark
                              ? "bg-[#e4f222]/15 text-[#e4f222] border-[#e4f222]/40 shadow-[0_0_8px_rgba(228,242,34,0.15)]"
                              : "bg-amber-100 text-amber-800 border-amber-300";
                          } else if (cat.id === "Permissions") {
                            activeClass = isDark
                              ? "bg-amber-400/15 text-amber-300 border-amber-400/40 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
                              : "bg-amber-100 text-amber-800 border-amber-300";
                          } else if (cat.id === "Budgets") {
                            activeClass = isDark
                              ? "bg-[#27a644]/15 text-[#27a644] border-[#27a644]/40 shadow-[0_0_8px_rgba(39,166,68,0.15)]"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300";
                          } else {
                            activeClass = isDark
                              ? "bg-indigo-400/15 text-indigo-300 border-indigo-400/40 shadow-[0_0_8px_rgba(129,140,248,0.15)]"
                              : "bg-indigo-100 text-indigo-800 border-indigo-300";
                          }

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setTempDocAccessMap(prev => {
                                  const copy = { ...prev };
                                  const stId = (member.st_id || "").trim().toUpperCase();
                                  const email = (member.email || "").trim().toLowerCase();
                                  let matchedKey = memberIdKey;
                                  let existing = [];
                                  for (const [k, cats] of Object.entries(copy)) {
                                    const kTrim = k.trim();
                                    if ((stId && kTrim.toUpperCase() === stId) || (email && kTrim.toLowerCase() === email) || kTrim.toUpperCase() === memberIdKey.toUpperCase()) {
                                      matchedKey = k;
                                      existing = Array.isArray(cats) ? [...cats] : [];
                                      break;
                                    }
                                  }
                                  let updatedCats = existing.includes(cat.id)
                                    ? existing.filter(c => c !== cat.id)
                                    : [...existing, cat.id];
                                  if (updatedCats.length === 0) {
                                    delete copy[matchedKey];
                                  } else {
                                    copy[matchedKey] = updatedCats;
                                  }
                                  return copy;
                                });
                              }}
                              className={`h-6 px-2 rounded-[4px] text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                isActive
                                  ? activeClass
                                  : isDark
                                    ? "bg-[#0f1011] text-[#62666d] border-[#23252a] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                                    : "bg-gray-100 text-gray-500 border-gray-200 hover:text-gray-800 hover:border-gray-300"
                              }`}
                              title={`${isActive ? "Remove" : "Grant"} access to ${cat.label} documents`}
                            >
                              <IconComp className="w-2.5 h-2.5" />
                              <span>{cat.label}</span>
                              {isActive && <Check className="w-2.5 h-2.5 ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} flex items-center justify-between`}>
              <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                Changes apply immediately to navigation and document permissions.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDocModalOpen(false)}
                  className={`h-8 px-3 text-xs ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingDocAccess}
                  onClick={async () => {
                    setSavingDocAccess(true);
                    try {
                      const { error } = await supabase
                        .from("system_settings")
                        .upsert({
                          key: "document_access_members",
                          value: JSON.stringify(tempDocAccessMap)
                        }, { onConflict: "key" });

                      if (error) throw error;
                      setDocAccessMap(tempDocAccessMap);
                      if (propSetDocAccessMembers) propSetDocAccessMembers(tempDocAccessMap);
                      const authorizedCount = Object.keys(tempDocAccessMap).length;
                      setMsg({
                        type: "success",
                        text: `Document section access updated: ${authorizedCount} member(s) configured.`
                      });
                      setDocModalOpen(false);
                    } catch (err) {
                      setMsg({ type: "error", text: "Failed to save: " + err.message });
                    } finally {
                      setSavingDocAccess(false);
                    }
                  }}
                  className={`h-8 px-4 text-xs font-[510] ${isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-gray-900 hover:bg-black text-white"} rounded-[6px] transition-colors flex items-center gap-1.5`}
                >
                  {savingDocAccess ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Access Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
