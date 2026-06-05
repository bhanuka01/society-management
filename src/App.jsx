import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Events from "./pages/Events";
import Attendance from "./pages/Attendance";
import Committee from "./pages/Committee";
import About from "./pages/About";
import Setup from "./pages/Setup";
import Access from "./pages/Access";
import MyInfo from "./pages/MyInfo";
import Messages from "./pages/Messages";
import Tasks from "./pages/Tasks";
import Landing from "./pages/Landing";
import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "D" },
  { id: "my_info", label: "My Info", icon: "P" },
  { id: "attendance", label: "Attendance", icon: "A" },
  { id: "members", label: "Members", icon: "M" },
  { id: "committee", label: "Committee", icon: "C" },
  { id: "tasks", label: "OC Tasks", icon: "T" },
  { id: "events", label: "Events", icon: "E" },
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "access", label: "Access", icon: "U" },
  { id: "about", label: "Society Details", icon: "I" },

  // { id: "setup", label: "DB Setup", icon: "S" },
];

const ROLE_LABELS = {
  guest: "Guest",
  member: "Member",
  editor: "Editor",
  admin: "Admin",
};

const canEdit = (role) => role === "admin" || role === "editor";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [page, setPage] = useState("about");
  const [connected, setConnected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [session, setSession] = useState({ role: "guest", stId: "", name: "", email: "", userId: "" });
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [login, setLogin] = useState({ role: "member", email: "", password: "", stId: "", name: "" });
  const [loginError, setLoginError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    supabase.from("members").select("count", { count: "exact", head: true })
      .then(({ error }) => setConnected(!error));
  }, []);

  useEffect(() => {
    let alive = true;

    const loadProfile = async (authSession) => {
      const user = authSession?.user;
      if (!user) {
        if (alive) {
          setSession({ role: "guest", stId: "", name: "", email: "", userId: "" });
          setPage("about");
          setAuthLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, st_id")
        .eq("id", user.id)
        .maybeSingle();

      if (alive) {
        const userRole = data?.role || "member";
        setSession({
          role: userRole,
          stId: data?.st_id || "",
          name: data?.full_name || user.email || "",
          email: data?.email || user.email || "",
          userId: user.id,
        });
        setPage(prev => {
          if (prev === "about") {
            return userRole === "member" ? "attendance" : "dashboard";
          }
          return prev;
        });
        setAuthLoading(false);
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

  const pages = { dashboard: Dashboard, members: Members, committee: Committee, events: Events, attendance: Attendance, access: Access, about: About, setup: Setup, my_info: MyInfo, messages: Messages, tasks: Tasks };
  const PageComponent = pages[page];
  const isEditor = canEdit(session.role);
  const visibleNavItems = session.role === "guest"
    ? NAV_ITEMS.filter(item => item.id === "about")
    : NAV_ITEMS.filter(item => {
      if (item.id === "access") return session.role === "admin";
      if (item.id === "my_info") return !!session.stId;
      if (item.id === "members") return isEditor;
      return isEditor || item.id !== "dashboard";
    });

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    setAuthSaving(true);

    const email = login.email.trim().toLowerCase();
    const role = login.role;

    if (authMode === "register") {
      const name = login.name.trim();
      if (!email || !login.password || !name) {
        setLoginError("Email, name, and password are required.");
        setAuthSaving(false);
        return;
      }

      let v_st_id = null;
      let v_name = name;

      // Check if email exists in the members table to link st_id for all roles (member, editor, admin)
      const { data: memberRows, error: memberErr } = await supabase
        .rpc("get_member_by_email", { p_email: email });

      if (memberErr) {
        setLoginError("Database check failed: " + memberErr.message);
        setAuthSaving(false);
        return;
      }

      if (memberRows && memberRows.length > 0) {
        const memberData = memberRows[0];
        v_st_id = memberData.st_id;
        if (!v_name) {
          v_name = memberData.name;
        }
      }

      if (role === "member") {
        if (!v_st_id) {
          setLoginError("Your email is not registered as a member. Please contact an admin.");
          setAuthSaving(false);
          return;
        }
      } else {
        // Staff validation
        const { data: canRegister, error: inviteError } = await supabase
          .rpc("can_register_staff", { p_email: email, p_role: role });

        if (inviteError || !canRegister) {
          setLoginError("Registration is not enabled for this email and role.");
          setAuthSaving(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: login.password,
        options: { data: { full_name: v_name, role } },
      });

      if (error) {
        setLoginError(error.message);
        setAuthSaving(false);
        return;
      }

      if (data.user) {
        await supabase
          .from("profiles")
          .upsert({ id: data.user.id, email, full_name: v_name, role, st_id: v_st_id }, { onConflict: "id" });
      }

      setAuthSaving(false);
      setLoginError(data.session ? "" : "Check your email to confirm your account, then login.");
      if (data.session) {
        setShowLogin(false);
        setPage(role === "member" ? "attendance" : role === "admin" ? "dashboard" : "members");
      }
      return;
    }

    // Login logic for all roles (member, editor, admin) via email & password
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: login.password });
    setAuthSaving(false);
    if (!error && authData?.user) {
      setShowLogin(false);
      setLogin({ role: "member", email: "", password: "", stId: "", name: "" });
      setLoginError("");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      const userRole = profile?.role || "member";
      if (userRole === "member") {
        setPage("attendance");
      } else {
        setPage(userRole === "admin" ? "dashboard" : "members");
      }
      return;
    }

    setLoginError(error ? error.message : "Invalid credentials.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession({ role: "guest", stId: "", name: "", email: "", userId: "" });
    setPage("about");
  };

  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");

  if (session.role === "guest") {
    return (
      <>
        <Landing
          theme={theme}
          onThemeToggle={toggleTheme}
          onLoginClick={() => {
            setAuthMode("login");
            setShowLogin(true);
            setLoginError("");
          }}
          onRegisterClick={() => {
            setAuthMode("register");
            setShowLogin(true);
            setLoginError("");
          }}
        />
        {showLogin && (
          <div className="modal-overlay" onClick={() => setShowLogin(false)}>
            <div className="modal" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
              <form className="login-card" onSubmit={handleLogin} style={{ padding: 0, border: "none", background: "none" }}>
                <div className="page-header">
                  <h1 className="page-title">{authMode === "login" ? "Login" : "Register"}</h1>
                  <p className="page-subtitle">{authMode === "login" ? "Email access for members, editors, and admins" : "Member or staff registration"}</p>
                </div>
                {loginError && <div className="alert alert-error">{loginError}</div>}
                <div className="auth-tabs">
                  <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setLoginError(""); }}>Login</button>
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setLogin({ ...login, role: "member", email: "", password: "", name: "" }); setLoginError(""); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value, email: "", password: "", name: "" })}>
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {authMode === "register" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        placeholder="Your full name"
                        value={login.name}
                        onChange={e => setLogin({ ...login, name: e.target.value })}
                        autoFocus
                      />
                    </div>
                  </div>
                )}
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="e.g. member@domain.com"
                        value={login.email}
                        onChange={e => setLogin({ ...login, email: e.target.value })}
                        autoFocus={authMode === "login"}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={login.password}
                        onChange={e => setLogin({ ...login, password: e.target.value })}
                      />
                    </div>
                  </div>
                </>
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowLogin(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={authSaving}>{authSaving ? "Please wait..." : authMode === "login" ? "Login" : "Register"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-header">
          <img src="/logo.png" className="logo-img" alt="ADSS Logo" />
          {sidebarOpen && (
            <div className="logo-text">
              <span className="logo-title">ADSS</span>
              <span className="logo-sub">Society Manager</span>
            </div>
          )}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "<" : ">"}
          </button>
        </div>

        <div className="connection-badge">
          <span className={`dot ${connected === null ? "pending" : connected ? "ok" : "err"}`} />
          {sidebarOpen && <span>{connected === null ? "Connecting..." : connected ? "Database Live" : "Not Connected"}</span>}
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-footer">
            <p>{authLoading ? "Checking access..." : session.role === "guest" ? "Members can watch only" : `${ROLE_LABELS[session.role]} mode${session.name ? `: ${session.name}` : ""}`}</p>
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="theme-switch-track">
                <span className="theme-switch-thumb">{theme === "dark" ? "D" : "L"}</span>
              </span>
              <span>{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <button
              className={`btn ${session.role !== "guest" ? "btn-ghost" : "btn-primary"} auth-btn`}
              onClick={session.role !== "guest" ? handleLogout : () => setShowLogin(true)}
            >
              {session.role !== "guest" ? "Logout" : "Login"}
            </button>
          </div>
        )}
      </aside>

      <main className="main-content">
        <div className="page-wrapper">
          {showLogin ? (
            <div className="login-page">
              <form className="login-card" onSubmit={handleLogin}>
                <div className="page-header">
                  <h1 className="page-title">{authMode === "login" ? "Login" : "Register"}</h1>
                  <p className="page-subtitle">{authMode === "login" ? "Email access for members, editors, and admins" : "Member or staff registration"}</p>
                </div>
                {loginError && <div className="alert alert-error">{loginError}</div>}
                <div className="auth-tabs">
                  <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setLoginError(""); }}>Login</button>
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setLogin({ ...login, role: "member", email: "", password: "", name: "" }); setLoginError(""); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value, email: "", password: "", name: "" })}>
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {authMode === "register" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        placeholder="Your full name"
                        value={login.name}
                        onChange={e => setLogin({ ...login, name: e.target.value })}
                        autoFocus
                      />
                    </div>
                  </div>
                )}
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="e.g. member@domain.com"
                        value={login.email}
                        onChange={e => setLogin({ ...login, email: e.target.value })}
                        autoFocus={authMode === "login"}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={login.password}
                        onChange={e => setLogin({ ...login, password: e.target.value })}
                      />
                    </div>
                  </div>
                </>
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowLogin(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={authSaving}>{authSaving ? "Please wait..." : authMode === "login" ? "Login" : "Register"}</button>
                </div>
              </form>
            </div>
          ) : (
            <PageComponent onNavigate={setPage} isAdmin={isEditor} role={session.role} session={session} />
          )}
        </div>
      </main>
    </div>
  );
}
