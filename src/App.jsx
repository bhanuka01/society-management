import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./supabaseClient";

// Code-split pages for high performance and fast initial load
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Members = lazy(() => import("./pages/Members"));
const Events = lazy(() => import("./pages/Events"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Committee = lazy(() => import("./pages/Committee"));
const Setup = lazy(() => import("./pages/Setup"));
const Access = lazy(() => import("./pages/Access"));
const MyInfo = lazy(() => import("./pages/MyInfo"));
const Messages = lazy(() => import("./pages/Messages"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Landing = lazy(() => import("./pages/Landing"));
const PublicEvent = lazy(() => import("./pages/PublicEvent"));
const Notices = lazy(() => import("./pages/Notices"));
const PublicNotice = lazy(() => import("./pages/PublicNotice"));
const ScanAttendance = lazy(() => import("./pages/ScanAttendance"));
const Letters = lazy(() => import("./pages/Letters"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Documents = lazy(() => import("./pages/Documents"));

import ChatWidget from "./components/ChatWidget";
import ErrorBoundary from "./components/ErrorBoundary";
import MobileNav from "./components/MobileNav";
import MinimalFooter from "./components/MinimalFooter";

function PageFallback() {
  return (
    <div style={{ display: "flex", minHeight: "50vh", alignItems: "center", justifyContent: "center", width: "100%" }}>
      <div style={{ width: "32px", height: "32px", border: "2px solid rgba(129, 140, 248, 0.2)", borderTop: "2px solid #818cf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}
import {
  LayoutDashboard,
  Megaphone,
  UserCheck,
  CalendarCheck,
  Users,
  Briefcase,
  Calendar,
  Mail,
  FileText,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Shield,
  FolderArchive
} from "lucide-react";
import "./App.css";

const NAV_SECTIONS = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "notices", label: "Notices", icon: Megaphone },
      { id: "my_info", label: "My Credentials", icon: UserCheck },
      { id: "messages", label: "Messages", icon: Mail },
    ]
  },
  {
    title: "Operations",
    items: [
      { id: "events", label: "Events", icon: Calendar },
      { id: "attendance", label: "Attendance", icon: CalendarCheck },
      { id: "committee", label: "Committee (OC)", icon: Briefcase },
      { id: "letters", label: "Letter Requests", icon: FileText },
      { id: "documents", label: "Documents", icon: FolderArchive },
    ]
  },
  {
    title: "Directory & Intel",
    items: [
      { id: "members", label: "Members", icon: Users },
      { id: "assistant", label: "AI Assistant", icon: Sparkles },
      { id: "access", label: "Access Control", icon: ShieldCheck },
    ]
  }
];

const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

const ROLE_LABELS = {
  guest: "Guest",
  member: "Member",
  editor: "Editor",
  admin: "Admin",
};

const canEdit = (role) => role === "admin" || role === "editor";

// Helper to get allowed document categories for a member (supports legacy array and granular category map)
export const getMemberDocCategories = (stId, email, docAccessData) => {
  if (!docAccessData) return [];
  const myStId = (stId || "").trim().toUpperCase();
  const myEmail = (email || "").trim().toLowerCase();

  // 1. Array format (legacy): all categories allowed
  if (Array.isArray(docAccessData)) {
    const isPresent = docAccessData.some(id => {
      const val = (id || "").trim();
      return (myStId && val.toUpperCase() === myStId) ||
             (myEmail && val.toLowerCase() === myEmail);
    });
    return isPresent ? ["Events", "Budgets", "Permissions", "Guidance"] : [];
  }

  // 2. Object format (granular): { [key]: ["Guidance", "Permissions"] }
  if (typeof docAccessData === "object") {
    for (const [key, categories] of Object.entries(docAccessData)) {
      const normKey = (key || "").trim();
      if (
        (myStId && normKey.toUpperCase() === myStId) ||
        (myEmail && normKey.toLowerCase() === myEmail)
      ) {
        return Array.isArray(categories) ? categories : [];
      }
    }
  }

  return [];
};

// --- Profile cache for instant startup (like Facebook) ---
const PROFILE_CACHE_KEY = 'adss-profile-cache';
const getCachedProfile = () => { try { const c = localStorage.getItem(PROFILE_CACHE_KEY); return c ? JSON.parse(c) : null; } catch { return null; } };
const setCachedProfile = (p) => { try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch {} };
const clearCachedProfile = () => { try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch {} };

// Check if Supabase has a stored auth token (synchronous localStorage read)
const hasStoredAuth = () => { try { const s = localStorage.getItem('adss-auth'); return s && JSON.parse(s)?.user; } catch { return false; } };

export default function App() {
  // Read cached profile synchronously on startup — instant dashboard, no loading screen
  const _cached = getCachedProfile();
  const _hasAuth = hasStoredAuth();
  const _isReturningUser = !!(_cached && _hasAuth);

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [page, setPage] = useState(() => {
    if (_isReturningUser) {
      // Instantly set the correct page from cache
      return _cached.role === "member" ? "attendance" : (_cached.role === "admin" ? "dashboard" : "members");
    }
    return "dashboard";
  });
  const [connected, setConnected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [session, setSession] = useState(() => {
    if (_isReturningUser) return _cached;  // Instant session from cache!
    return { role: "guest", stId: "", name: "", email: "", userId: "", status: "approved" };
  });
  // If we have a cached profile, skip loading entirely — dashboard renders instantly
  const [authLoading, setAuthLoading] = useState(!_isReturningUser);
  const [regEnabled, setRegEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [docAccessMembers, setDocAccessMembers] = useState([]);
  const [viewAsMember, setViewAsMember] = useState(false);
  const [pendingMsgCount, setPendingMsgCount] = useState(0);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);
    };
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  const isEventRoute = currentPath.startsWith("/event") || currentHash.startsWith("#/event") || currentHash.startsWith("#event");
  const isNoticeRoute = currentPath.startsWith("/notice") || currentHash.startsWith("#/notice") || currentHash.startsWith("#notice");
  const isScanAttendanceRoute = currentPath.startsWith("/scan-attendance") || currentHash.startsWith("#/scan-attendance") || currentHash.startsWith("#scan-attendance");
  const isAssistantRoute = currentPath.startsWith("/assistant") || currentHash.startsWith("#/assistant") || currentHash.startsWith("#assistant");
  const isPrivacyRoute = currentPath.startsWith("/privacy") || currentHash.startsWith("#/privacy") || currentHash.startsWith("#privacy");
  const isTermsRoute = currentPath.startsWith("/terms") || currentHash.startsWith("#/terms") || currentHash.startsWith("#terms");
  const isLoginRoute = currentPath === "/login" || currentHash === "#/login" || currentHash === "#login";
  const isRegisterRoute = currentPath === "/register" || currentHash === "#/register" || currentHash === "#register";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.background = theme === "dark" ? "#08090a" : "#ffffff";
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    supabase.from("members").select("count", { count: "exact", head: true })
      .then(({ error }) => setConnected(!error));

    const loadSettings = () => {
      supabase.from("system_settings").select("key, value").in("key", ["registration_enabled", "ai_feature_enabled", "document_access_members"])
        .then(({ data }) => {
          if (data) {
            const regSetting = data.find(s => s.key === "registration_enabled");
            const aiSetting = data.find(s => s.key === "ai_feature_enabled");
            const docSetting = data.find(s => s.key === "document_access_members");
            if (regSetting) setRegEnabled(regSetting.value === "true");
            if (aiSetting) setAiEnabled(aiSetting.value === "true");
            if (docSetting) {
              try {
                const parsed = JSON.parse(docSetting.value);
                setDocAccessMembers(parsed || {});
              } catch (_) {
                setDocAccessMembers({});
              }
            }
          }
        });
    };
    loadSettings();

    // Subscribe to system settings changes so permissions update in real-time
    const settingsSub = supabase
      .channel("app-system-settings-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, (payload) => {
        const record = payload.new;
        if (!record || !record.key) {
          loadSettings();
          return;
        }
        if (record.key === "registration_enabled") setRegEnabled(record.value === "true");
        if (record.key === "ai_feature_enabled") setAiEnabled(record.value === "true");
        if (record.key === "document_access_members") {
          try {
            const parsed = JSON.parse(record.value);
            setDocAccessMembers(parsed || {});
          } catch (_) {
            setDocAccessMembers({});
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSub);
    };
  }, []);

  /* ─ Pending message badge count ─ */
  useEffect(() => {
    if (!session.stId) { setPendingMsgCount(0); return; }

    const fetchCount = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .eq("receiver_st_id", session.stId)
        .eq("status", "pending");
      setPendingMsgCount(data?.length ?? 0);
    };
    fetchCount();

    const sub = supabase
      .channel(`nav-pending-${session.stId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchCount())
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [session.stId]);

  useEffect(() => {
    let alive = true;

    const loadProfile = async (authSession) => {
      const user = authSession?.user;
      if (!user) {
        if (alive) {
          setSession({ role: "guest", stId: "", name: "", email: "", userId: "" });
          setViewAsMember(false);
          setPage("dashboard");
          setAuthLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, preferred_name, role, st_id, status")
        .eq("id", user.id)
        .maybeSingle();

      if (alive) {
        let resolvedStId = (data?.st_id || "").trim();
        const userEmail = (data?.email || user.email || "").trim();

        // Fallback: If st_id is missing in profile, resolve from members table via email
        if (!resolvedStId && userEmail) {
          try {
            const { data: memRecord } = await supabase
              .from("members")
              .select("st_id")
              .ilike("email", userEmail)
              .maybeSingle();
            if (memRecord?.st_id) {
              resolvedStId = memRecord.st_id.trim();
              // Sync to profiles table in background so Postgres functions and RLS can also read it
              supabase
                .from("profiles")
                .update({ st_id: resolvedStId })
                .eq("id", user.id)
                .then(() => {});
            }
          } catch (_) {}
        }

        const userRole = data?.role || "member";
        const userStatus = data?.status || "approved";
        const profileData = {
          role: userRole,
          stId: resolvedStId,
          name: data?.preferred_name || data?.full_name || user.email || "",
          fullName: data?.full_name || "",
          preferredName: data?.preferred_name || "",
          email: userEmail,
          userId: user.id,
          status: userStatus,
        };
        setSession(profileData);
        setCachedProfile(profileData);  // Cache for instant startup next time
        setViewAsMember(false);
        setPage(prev => {
          if (userStatus === "pending" || userStatus === "pending_editor_review") {
            return userRole === "member" ? "attendance" : (userRole === "admin" ? "dashboard" : "members");
          }
          if (userRole === "member") {
            // Normal members are NEVER allowed to access dashboard or staff-only pages
            if (prev === "dashboard" || prev === "members" || prev === "access" || prev === "letters" || prev === "about") {
              return "attendance";
            }
          }
          if (prev === "about") {
            return userRole === "admin" ? "dashboard" : "members";
          }
          return prev;
        });
        setAuthLoading(false);

        // If user is already logged in and visits /login or /register, redirect to home
        const path = window.location.pathname;
        const hash = window.location.hash;
        if (path === "/login" || hash === "#/login" || hash === "#login" || path === "/register" || hash === "#/register" || hash === "#register") {
          window.history.replaceState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setAuthLoading(true);
      loadProfile(authSession);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Auto-transition when an admin approves this user in real-time
  useEffect(() => {
    if (!session.userId || (session.status !== "pending" && session.status !== "pending_editor_review")) {
      return;
    }
    const profileSub = supabase
      .channel(`profile-status-${session.userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.userId}` }, (payload) => {
        const updated = payload.new;
        if (updated && (updated.status === "approved" || updated.status === "active")) {
          const userRole = updated.role || session.role || "member";
          const updatedProfile = {
            ...session,
            status: updated.status,
            role: userRole,
            stId: updated.st_id || session.stId,
            name: updated.preferred_name || updated.full_name || session.name,
            fullName: updated.full_name || session.fullName,
            preferredName: updated.preferred_name || session.preferredName,
          };
          setCachedProfile(updatedProfile);
          setSession(updatedProfile);
          const isStaff = userRole === "admin" || userRole === "editor";
          setPage(isStaff ? (userRole === "admin" ? "dashboard" : "members") : "attendance");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileSub);
    };
  }, [session.userId, session.status]);

  const isRealStaff = canEdit(session.role);
  const effectiveRole = (viewAsMember && isRealStaff) ? "member" : session.role;
  const isEditor = canEdit(effectiveRole);
  const canAccessAi = isEditor || aiEnabled;

  // Active route guard: Non-editors (members) can NEVER view dashboard or staff-only pages
  useEffect(() => {
    if (session.role === "guest" || session.status === "pending" || session.status === "pending_editor_review" || session.status === "rejected") {
      return;
    }
    if (!isEditor && (page === "dashboard" || page === "members" || page === "access" || page === "letters")) {
      setPage("attendance");
    }
  }, [page, isEditor, session.role, session.status]);

  const navigateSafe = (dest) => {
    if (!isEditor && (dest === "dashboard" || dest === "members" || dest === "access" || dest === "letters")) {
      setPage("attendance");
    } else {
      setPage(dest);
    }
  };

  const pages = { dashboard: Dashboard, notices: Notices, members: Members, committee: Committee, events: Events, attendance: Attendance, access: Access, setup: Setup, my_info: MyInfo, profile: MyInfo, messages: Messages, tasks: Tasks, letters: Letters, assistant: AssistantPage, privacy: PrivacyPolicy, terms: TermsOfService, documents: Documents };

  // Fallback: If non-editor attempts to render dashboard or staff pages, render Attendance
  const PageComponent = (!isEditor && (page === "dashboard" || page === "members" || page === "access" || page === "letters"))
    ? Attendance
    : (pages[page] || (isEditor ? Dashboard : Attendance));

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, status, role, st_id, full_name, preferred_name, email")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          let resolvedStId = (profile.st_id || session.stId || "").trim();
          const userEmail = (profile.email || user.email || session.email || "").trim();

          if (!resolvedStId && userEmail) {
            try {
              const { data: memRecord } = await supabase
                .from("members")
                .select("st_id")
                .ilike("email", userEmail)
                .maybeSingle();
              if (memRecord?.st_id) {
                resolvedStId = memRecord.st_id.trim();
              }
            } catch (_) {}
          }

          const userRole = profile.role || "member";
          const userStatus = profile.status || "approved";
          const updatedProfile = {
            ...session,
            status: userStatus,
            role: userRole,
            stId: resolvedStId,
            name: profile.preferred_name || profile.full_name || session.name,
            fullName: profile.full_name || session.fullName || "",
            preferredName: profile.preferred_name || session.preferredName || "",
            email: userEmail,
            userId: user.id,
          };

          setCachedProfile(updatedProfile);
          setSession(updatedProfile);
          setViewAsMember(false);

          if (userStatus !== "pending" && userStatus !== "pending_editor_review") {
            const isStaff = userRole === "admin" || userRole === "editor";
            setPage(isStaff ? (userRole === "admin" ? "dashboard" : "members") : "attendance");
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing status:", err);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const filterNavItem = (item) => {
    if (effectiveRole === "guest") {
      return item.id === "privacy" || item.id === "terms" || (item.id === "assistant" && canAccessAi);
    }
    if (item.id === "access") return effectiveRole === "admin";
    if (item.id === "letters") return isEditor;
    if (item.id === "my_info") return !!session.stId;
    if (item.id === "members") return isEditor;
    if (item.id === "assistant") return canAccessAi;
    if (item.id === "documents") {
      if (isEditor) return true;
      const allowedCats = getMemberDocCategories(session.stId, session.email, docAccessMembers);
      return allowedCats.length > 0;
    }
    return isEditor || item.id !== "dashboard";
  };

  const visibleNavItems = NAV_ITEMS.filter(filterNavItem);

  const visibleSections = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(filterNavItem)
  })).filter(sec => sec.items.length > 0);


  const handleLogout = async () => {
    clearCachedProfile();  // Clear cached profile so next visit shows login
    await supabase.auth.signOut();
    setSession({ role: "guest", stId: "", name: "", email: "", userId: "", status: "approved" });
    setViewAsMember(false);
    setPage("dashboard");
  };

  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");

  const handleToggleViewAsMember = () => {
    setViewAsMember(prev => {
      const nextVal = !prev;
      if (nextVal) {
        if (page === "dashboard" || page === "members" || page === "access") {
          setPage("attendance");
        }
      } else {
        if (page === "attendance") {
          setPage(session.role === "admin" ? "dashboard" : "members");
        }
      }
      return nextVal;
    });
  };

  if (isEventRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <PublicEvent
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isNoticeRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <PublicNotice
          theme={theme}
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isScanAttendanceRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <ScanAttendance
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isPrivacyRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <PrivacyPolicy
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isTermsRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <TermsOfService
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isAssistantRoute) {
    if (!canAccessAi) {
      return (
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "2rem", color: "var(--text)" }}>
          <div className="card" style={{ maxWidth: "440px", width: "100%", textAlign: "center", padding: "2.5rem 2rem", boxShadow: "var(--shadow-xl)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--amber)", marginBottom: "1rem" }}>lock</span>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px" }}>AI Assistant Disabled</h2>
            <p style={{ color: "var(--text3)", fontSize: "14px", margin: 0, lineHeight: 1.5 }}>
              The AI Assistant feature is currently disabled for members by an administrator.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: "1.5rem", width: "100%" }}
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new Event("popstate"));
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }
    return (
      <Suspense fallback={<PageFallback />}>
        <AssistantPage
          onBackToLanding={() => {
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
          role={effectiveRole}
          session={session}
          theme={theme}
        />
      </Suspense>
    );
  }

  if (isLoginRoute) {
    if (session.userId && session.role !== "guest") {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
      return null;
    }
    return (
      <Suspense fallback={<PageFallback />}>
        <Login
          theme={theme}
          onNavigate={(dest) => {
            window.history.pushState({}, "", dest === "register" ? "/register" : "/");
            window.dispatchEvent(new Event("popstate"));
          }}
          onLoginSuccess={(profileData) => {
            setSession(profileData);
            setCachedProfile(profileData);
            setViewAsMember(false);
            setPage(profileData.status === "pending" || profileData.status === "pending_editor_review"
              ? (profileData.role === "member" ? "attendance" : (profileData.role === "admin" ? "dashboard" : "members"))
              : profileData.role === "member" ? "attendance" : profileData.role === "admin" ? "dashboard" : "members");
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (isRegisterRoute) {
    if (session.userId && session.role !== "guest") {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
      return null;
    }
    return (
      <Suspense fallback={<PageFallback />}>
        <Register
          theme={theme}
          regEnabled={regEnabled}
          onNavigate={(dest) => {
            window.history.pushState({}, "", dest === "login" ? "/login" : "/");
            window.dispatchEvent(new Event("popstate"));
          }}
          onRegisterSuccess={(profileData, isPending) => {
            setSession(profileData);
            setCachedProfile(profileData);
            setViewAsMember(false);
            setPage(isPending
              ? (profileData.role === "member" ? "attendance" : (profileData.role === "admin" ? "dashboard" : "members"))
              : profileData.role === "member" ? "attendance" : profileData.role === "admin" ? "dashboard" : "members");
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      </Suspense>
    );
  }

  if (session.userId && (session.status === "pending" || session.status === "pending_editor_review")) {
    const isEditorialReview = session.status === "pending_editor_review";
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.25rem 1rem", boxSizing: "border-box" }}>
        <div className="card" style={{ maxWidth: "480px", width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: "1px solid var(--border)", padding: "1.75rem 1.25rem", boxSizing: "border-box", borderRadius: "16px" }}>
          <div className="page-header" style={{ marginBottom: "1.5rem" }}>
            <div className="icon" style={{ fontSize: "2.75rem", color: "var(--amber)", marginBottom: "0.75rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "44px" }}>
                {isEditorialReview ? "rate_review" : "hourglass_top"}
              </span>
            </div>
            <h1 className="page-title" style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.45rem)", fontWeight: 700, margin: "0 0 6px 0", lineHeight: 1.3, letterSpacing: "-0.015em" }}>
              {isEditorialReview ? "Registration Under Editorial Review" : "Registration Pending"}
            </h1>
            <p className="page-subtitle" style={{ fontSize: "13.5px", color: "var(--text3)", margin: 0, lineHeight: 1.5 }}>
              {isEditorialReview
                ? "Your application and placement skills assessment have been submitted."
                : "Your account is currently under review by an administrator or editor."}
            </p>
          </div>

          <div
            style={{
              textAlign: "left",
              marginBottom: "1.75rem",
              padding: "1rem 1.25rem",
              borderRadius: "12px",
              background: "rgba(0, 122, 255, 0.06)",
              border: "1px solid rgba(0, 122, 255, 0.18)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderBottom: "1px solid rgba(0, 122, 255, 0.1)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                Name
              </span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", wordBreak: "break-word" }}>
                {session.name || "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderBottom: "1px solid rgba(0, 122, 255, 0.1)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                Student ID
              </span>
              <span style={{ fontSize: "13.5px", fontWeight: 600, fontFamily: "var(--mono, monospace)", color: "var(--text)", wordBreak: "break-all" }}>
                {session.stId || "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderBottom: "1px solid rgba(0, 122, 255, 0.1)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                Email
              </span>
              <span style={{ fontSize: "13.5px", color: "var(--text)", wordBreak: "break-all" }}>
                {session.email || "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "2px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                Review Status
              </span>
              <div>
                <span className="badge badge-purple" style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", padding: "4px 10px", borderRadius: "6px" }}>
                  {isEditorialReview ? "PENDING EDITORIAL REVIEW" : (session.role || "MEMBER").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <p style={{ color: "var(--text3)", fontSize: "13.5px", margin: "0 0 1.75rem 0", lineHeight: "1.6" }}>
            {isEditorialReview
              ? "Registration submitted for editorial review. Your functional team will be assigned by the executive committee based on your skills assessment."
              : "Once approved, you will be granted access to the society portal. Thank you for your patience!"}
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", width: "100%" }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={refreshingStatus}
              style={{ minWidth: "140px", flex: "1 1 140px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onClick={handleRefreshStatus}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px", animation: refreshingStatus ? "spin 0.8s linear infinite" : "none" }}>
                refresh
              </span>
              {refreshingStatus ? "Checking..." : "Refresh Status"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              style={{ minWidth: "100px", flex: "0 1 100px" }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.userId && session.status === "rejected") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.25rem 1rem", boxSizing: "border-box" }}>
        <div className="card" style={{ maxWidth: "480px", width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: "1px solid var(--border)", padding: "1.75rem 1.25rem", boxSizing: "border-box", borderRadius: "16px" }}>
          <div className="page-header" style={{ marginBottom: "1.5rem" }}>
            <div className="icon" style={{ fontSize: "2.75rem", color: "var(--red)", marginBottom: "0.75rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "44px" }}>cancel</span>
            </div>
            <h1 className="page-title" style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.45rem)", fontWeight: 700, margin: "0 0 6px 0", lineHeight: 1.3, letterSpacing: "-0.015em" }}>
              Registration Rejected
            </h1>
            <p className="page-subtitle" style={{ fontSize: "13.5px", color: "var(--text3)", margin: 0, lineHeight: 1.5 }}>
              Your registration request has been rejected by the administrator or editor
            </p>
          </div>

          <div style={{ textAlign: "center", marginBottom: "1.75rem", padding: "1rem", borderRadius: "12px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--red)" }}>
              Your registration has been rejected.
            </p>
          </div>

          <p style={{ color: "var(--text3)", fontSize: "13.5px", marginBottom: "1.75rem", lineHeight: "1.6" }}>
            Please contact the society administrators if you believe this was in error or if you need to submit correct information.
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button className="btn btn-ghost" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show minimal loading for first-time visitors (no cached profile)
  // Returning users NEVER see this — their dashboard renders instantly from cache
  if (authLoading && !session.userId) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", flexDirection: "column", position: "relative" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "32px", height: "32px", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
        <div style={{ position: "fixed", bottom: "24px", left: 0, right: 0 }}>
          <MinimalFooter session={session} />
        </div>
      </div>
    );
  }

  if (session.role === "guest") {
    return (
      <Suspense fallback={<PageFallback />}>
        <Landing
          theme={theme}
          onThemeToggle={toggleTheme}
          regEnabled={regEnabled}
          aiEnabled={canAccessAi}
          onLoginClick={() => {
            window.history.pushState({}, "", "/login");
            window.dispatchEvent(new Event("popstate"));
          }}
          onRegisterClick={() => {
            window.history.pushState({}, "", "/register");
            window.dispatchEvent(new Event("popstate"));
          }}
        />
        {canAccessAi && (
          <ChatWidget
            role="guest"
            session={session}
            theme={theme}
            onNavigate={(dest) => {
              if (dest === "assistant") {
                window.history.pushState({}, "", "/assistant");
                window.dispatchEvent(new Event("popstate"));
              } else {
                setPage(dest);
              }
            }}
            currentPage="landing"
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile-only Navigation: Top bar, Bottom bar, and Curved side drawer */}
      <MobileNav
        page={page}
        setPage={navigateSafe}
        visibleSections={visibleSections}
        session={session}
        pendingMsgCount={pendingMsgCount}
        theme={theme}
        toggleTheme={toggleTheme}
        isRealStaff={isRealStaff}
        viewAsMember={viewAsMember}
        handleToggleViewAsMember={handleToggleViewAsMember}
        handleLogout={handleLogout}
        connected={connected}
        canAccessAi={canAccessAi}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-header">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img 
              src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`} 
              className="logo-img" 
              alt="ADSS Logo" 
            />
            {sidebarOpen && (
              <div className="logo-text min-w-0">
                <span className="logo-title">ADSS RUHUNA</span>
              </div>
            )}
          </div>
          <button 
            className="sidebar-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4 text-[#8a8f98] hover:text-white transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#8a8f98] hover:text-white transition-colors" />
            )}
          </button>
        </div>

        {/* Database Telemetry Indicator */}
        <div className="connection-badge">
          <span className={`dot ${connected === null ? "pending" : connected ? "ok" : "err"}`} />
          {sidebarOpen && (
            <span className="text-[10px] font-berkeley-mono uppercase tracking-wider text-[#8a8f98]">
              {connected === null ? "SYNCHRONIZING..." : connected ? "DB SYNCHRONIZED" : "OFFLINE"}
            </span>
          )}
        </div>

        {/* Grouped Linear Nav Sections */}
        <nav className="sidebar-nav">
          {visibleSections.map((section) => (
            <div key={section.title} className="sidebar-group">
              {sidebarOpen && (
                <div className="sidebar-group-title">
                  {section.title}
                </div>
              )}
              <div className="sidebar-group-items">
                {section.items.map(item => {
                  const IconComponent = item.icon;
                  const isActive = page === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setPage(item.id);
                        if (window.innerWidth <= 768) setSidebarOpen(false);
                      }}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <span className="nav-icon">
                        <IconComponent className="w-4 h-4" />
                      </span>
                      {sidebarOpen && <span className="nav-label">{item.label}</span>}
                      
                      {/* Pending message badge */}
                      {item.id === "messages" && pendingMsgCount > 0 && (
                        <span className="nav-badge-pill">
                          {pendingMsgCount > 99 ? "99+" : pendingMsgCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: Quick Controls & Actions */}
        {sidebarOpen ? (
          <div className="sidebar-footer">
            {/* Quick Segmented Controls */}
            <div className={`sidebar-grid-row ${isRealStaff ? "two-cols" : "one-col"}`}>
              {isRealStaff && (
                <div
                  className={`sidebar-compact-card ${!viewAsMember ? "active-staff" : ""}`}
                  onClick={handleToggleViewAsMember}
                  title={viewAsMember ? "Switch to Staff View" : "Switch to Member View"}
                >
                  <div className="sidebar-compact-header">
                    <Shield className="w-3.5 h-3.5 icon text-[#6366f1]" />
                    <span className="sidebar-compact-title">{viewAsMember ? "Member" : "Staff"}</span>
                  </div>
                  <div className="sidebar-compact-badge">
                    {viewAsMember ? "OFF" : "ON"}
                  </div>
                </div>
              )}

              <div
                className={`sidebar-compact-card ${theme === "dark" ? "active-dark" : ""}`}
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                <div className="sidebar-compact-header">
                  {theme === "dark" ? <Moon className="w-3.5 h-3.5 icon text-amber-400" /> : <Sun className="w-3.5 h-3.5 icon text-amber-500" />}
                  <span className="sidebar-compact-title">{theme === "dark" ? "Dark" : "Light"}</span>
                </div>
                <div className={`sidebar-toggle-switch mini ${theme === "dark" ? "active" : ""}`}>
                  <div className="sidebar-toggle-thumb" />
                </div>
              </div>
            </div>

            <div className="sidebar-divider" />

            {/* Logout / Login button */}
            <div
              className="sidebar-pref-card logout-card"
              onClick={session.role !== "guest" ? handleLogout : () => {
                window.history.pushState({}, "", "/login");
                window.dispatchEvent(new Event("popstate"));
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
            >
              <div className="sidebar-pref-left">
                <LogOut className="w-3.5 h-3.5 text-[#eb5757]" />
                <span className="sidebar-logout-title">{session.role !== "guest" ? "Logout" : "Login"}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#62666d]" />
            </div>
          </div>
        ) : (
          /* Collapsed Bottom Action */
          <div className="p-2 border-t border-[#23252a] flex flex-col items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-[6px] flex items-center justify-center text-[#8a8f98] hover:text-white hover:bg-[#161718] transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              onClick={session.role !== "guest" ? handleLogout : () => {
                window.history.pushState({}, "", "/login");
                window.dispatchEvent(new Event("popstate"));
              }}
              className="w-9 h-9 rounded-[6px] flex items-center justify-center text-[#eb5757] hover:bg-[#eb5757]/10 transition-colors"
              title={session.role !== "guest" ? "Logout" : "Login"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      <main className="main-content">
        <div className="page-wrapper">
          <ErrorBoundary key={page} onNavigate={navigateSafe}>
            <Suspense fallback={<PageFallback />}>
              <PageComponent
                onNavigate={navigateSafe}
                isAdmin={isEditor}
                role={effectiveRole}
                session={session}
                theme={theme}
                docAccessMembers={docAccessMembers}
                setDocAccessMembers={setDocAccessMembers}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* AI Assistant widget — hidden when user is on full page or when disabled for members */}
      {canAccessAi && page !== "assistant" && (
        <ChatWidget
          role={effectiveRole}
          session={session}
          onNavigate={navigateSafe}
          currentPage={page}
          theme={theme}
        />
      )}
    </div>
  );
}
