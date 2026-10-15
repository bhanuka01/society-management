import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Events from "./pages/Events";
import Attendance from "./pages/Attendance";
import Committee from "./pages/Committee";
import Setup from "./pages/Setup";
import Access from "./pages/Access";
import MyInfo from "./pages/MyInfo";
import Messages from "./pages/Messages";
import Tasks from "./pages/Tasks";
import Landing from "./pages/Landing";
import PublicEvent from "./pages/PublicEvent";
import Notices from "./pages/Notices";
import PublicNotice from "./pages/PublicNotice";
import ScanAttendance from "./pages/ScanAttendance";
import Letters from "./pages/Letters";
import AssistantPage from "./pages/AssistantPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Documents from "./pages/Documents";
import ChatWidget from "./components/ChatWidget";
import ErrorBoundary from "./components/ErrorBoundary";
import MobileNav from "./components/MobileNav";
import MinimalFooter from "./components/MinimalFooter";
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

const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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
      return _cached.role === "member" ? "attendance" : "dashboard";
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
        const userRole = data?.role || "member";
        const userStatus = data?.status || "approved";
        const profileData = {
          role: userRole,
          stId: data?.st_id || "",
          name: data?.preferred_name || data?.full_name || user.email || "",
          fullName: data?.full_name || "",
          preferredName: data?.preferred_name || "",
          email: data?.email || user.email || "",
          userId: user.id,
          status: userStatus,
        };
        setSession(profileData);
        setCachedProfile(profileData);  // Cache for instant startup next time
        setViewAsMember(false);
        setPage(prev => {
          if (userStatus === "pending") return "dashboard";
          if (prev === "about") {
            return userRole === "member" ? "attendance" : "dashboard";
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

  const pages = { dashboard: Dashboard, notices: Notices, members: Members, committee: Committee, events: Events, attendance: Attendance, access: Access, setup: Setup, my_info: MyInfo, messages: Messages, tasks: Tasks, letters: Letters, assistant: AssistantPage, privacy: PrivacyPolicy, terms: TermsOfService, documents: Documents };
  const PageComponent = pages[page];
  const isRealStaff = canEdit(session.role);
  const effectiveRole = (viewAsMember && isRealStaff) ? "member" : session.role;
  const isEditor = canEdit(effectiveRole);
  const canAccessAi = isEditor || aiEnabled;

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
      <PublicEvent
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (isNoticeRoute) {
    return (
      <PublicNotice
        theme={theme}
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (isScanAttendanceRoute) {
    return (
      <ScanAttendance
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (isPrivacyRoute) {
    return (
      <PrivacyPolicy
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (isTermsRoute) {
    return (
      <TermsOfService
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
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
      <AssistantPage
        onBackToLanding={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
        role={effectiveRole}
        session={session}
        theme={theme}
      />
    );
  }

  if (isLoginRoute) {
    if (session.userId && session.role !== "guest") {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
      return null;
    }
    return (
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
          setPage(profileData.status === "pending" ? "dashboard" : profileData.role === "member" ? "attendance" : profileData.role === "admin" ? "dashboard" : "members");
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (isRegisterRoute) {
    if (session.userId && session.role !== "guest") {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
      return null;
    }
    return (
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
          setPage(isPending ? "dashboard" : profileData.role === "member" ? "attendance" : profileData.role === "admin" ? "dashboard" : "members");
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }}
      />
    );
  }

  if (session.userId && session.status === "pending") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "2rem" }}>
        <div className="card" style={{ maxWidth: "500px", width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
          <div className="page-header" style={{ marginBottom: "2rem" }}>
            <div className="icon" style={{ fontSize: "3rem", color: "var(--amber)", marginBottom: "1rem" }}><span className="material-symbols-outlined" style={{fontSize:'48px'}}>hourglass_top</span></div>
            <h1 className="page-title">Registration Pending</h1>
            <p className="page-subtitle">Your account is currently under review by an administrator or editor</p>
          </div>

          <div className="alert alert-info" style={{ textAlign: "left", marginBottom: "2.5rem", padding: "1.25rem", borderRadius: "12px", background: "rgba(0, 122, 255, 0.08)", border: "1px solid rgba(0, 122, 255, 0.15)" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}><strong>Name:</strong> {session.name}</p>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}><strong>Student ID:</strong> {session.stId}</p>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}><strong>Email:</strong> {session.email}</p>
            <p style={{ margin: 0, fontSize: "14px" }}><strong>Requested Role:</strong> <span className="badge badge-purple" style={{ verticalAlign: "middle" }}>{session.role.toUpperCase()}</span></p>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "2rem", lineHeight: "1.6" }}>
            Once approved, you will be granted access to the society dashboard. Thank you for your patience!
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button className="btn btn-primary" type="button" onClick={async () => {
              setAuthLoading(true);
              const { data } = await supabase.auth.getSession();
              if (data?.session?.user) {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("status, role, st_id, full_name, email")
                  .eq("id", data.session.user.id)
                  .maybeSingle();

                if (profile) {
                  setSession(s => ({
                    ...s,
                    status: profile.status || "approved",
                    role: profile.role || "member",
                    stId: profile.st_id || "",
                    name: profile.full_name || s.name,
                    email: profile.email || s.email,
                  }));
                  setViewAsMember(false);
                  if (profile.status !== "pending") {
                    setPage(profile.role === "member" ? "attendance" : profile.role === "admin" ? "dashboard" : "members");
                  }
                }
              }
              setAuthLoading(false);
            }}>
              Refresh Status
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.userId && session.status === "rejected") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "2rem" }}>
        <div className="card" style={{ maxWidth: "500px", width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
          <div className="page-header" style={{ marginBottom: "2rem" }}>
            <div className="icon" style={{ fontSize: "3rem", color: "var(--red)", marginBottom: "1rem" }}><span className="material-symbols-outlined" style={{fontSize:'48px'}}>cancel</span></div>
            <h1 className="page-title">Registration Rejected</h1>
            <p className="page-subtitle">Your registration request has been rejected by the administrator or editor</p>
          </div>

          <div className="alert alert-error" style={{ textAlign: "center", marginBottom: "2.5rem", padding: "1.25rem", borderRadius: "12px" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700" }}>Your registration has been rejected.</p>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "2rem", lineHeight: "1.6" }}>
            Please contact the society administrators if you believe this was in error or if you need to submit correct information.
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
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
      <>
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
      </>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile-only Navigation: Top bar, Bottom bar, and Curved side drawer */}
      <MobileNav
        page={page}
        setPage={setPage}
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
                <div className="flex items-center gap-1.5">
                  <span className="logo-title">ADSS RUHUNA</span>
                  <span className="text-[9px] font-berkeley-mono text-[#8a8f98] bg-[#161718] border border-[#23252a] px-1 py-0.5 rounded-[3px]">
                    v2.6
                  </span>
                </div>
                <span className="logo-sub">2024/25 Active Cycle</span>
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

        {/* Footer: User Quick Profile & Controls */}
        {sidebarOpen ? (
          <div className="sidebar-footer">
            {/* User Quick Profile Snippet (if logged in) */}
            {session.role !== "guest" && (
              <div className="sidebar-user-pill">
                <div className="w-7 h-7 rounded-[6px] bg-[#161718] border border-[#23252a] flex items-center justify-center font-berkeley-mono text-[11px] font-[510] text-white flex-shrink-0">
                  {getInitials(session.name || session.email)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[12px] font-[510] text-white truncate leading-tight">
                    {session.preferredName || session.name || "Member"}
                  </div>
                  <div className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase tracking-wider">
                    {session.role}
                  </div>
                </div>
              </div>
            )}

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
          <ErrorBoundary key={page} onNavigate={setPage}>
            <PageComponent
              onNavigate={setPage}
              isAdmin={isEditor}
              role={effectiveRole}
              session={session}
              theme={theme}
              docAccessMembers={docAccessMembers}
              setDocAccessMembers={setDocAccessMembers}
            />
          </ErrorBoundary>
        </div>
      </main>

      {/* AI Assistant widget — hidden when user is on full page or when disabled for members */}
      {canAccessAi && page !== "assistant" && (
        <ChatWidget
          role={effectiveRole}
          session={session}
          onNavigate={setPage}
          currentPage={page}
          theme={theme}
        />
      )}
    </div>
  );
}
