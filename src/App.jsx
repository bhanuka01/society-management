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
  const [session, setSession] = useState({ role: "guest", stId: "", name: "", email: "", userId: "", status: "approved" });
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [login, setLogin] = useState({ role: "member", email: "", password: "", stId: "", name: "", level: "1", phone: "" });
  const [loginError, setLoginError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [regEnabled, setRegEnabled] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    supabase.from("members").select("count", { count: "exact", head: true })
      .then(({ error }) => setConnected(!error));

    supabase.from("system_settings").select("value").eq("key", "registration_enabled").maybeSingle()
      .then(({ data }) => {
        if (data) setRegEnabled(data.value === "true");
      });
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
        .select("id, email, full_name, role, st_id, status")
        .eq("id", user.id)
        .maybeSingle();

      if (alive) {
        const userRole = data?.role || "member";
        const userStatus = data?.status || "approved";
        setSession({
          role: userRole,
          stId: data?.st_id || "",
          name: data?.full_name || user.email || "",
          email: data?.email || user.email || "",
          userId: user.id,
          status: userStatus,
        });
        setPage(prev => {
          if (userStatus === "pending") return "about";
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

      const isPreRegistered = memberRows && memberRows.length > 0;
      if (isPreRegistered) {
        const memberData = memberRows[0];
        v_st_id = memberData.st_id;
        if (!v_name) {
          v_name = memberData.name;
        }
      }

      // Check if staff invite exists
      const { data: canRegisterStaff } = await supabase
        .rpc("can_register_staff", { p_email: email, p_role: role });

      // If general registration is off, and they are not pre-registered nor invited staff, block it
      if (!regEnabled && !isPreRegistered && !canRegisterStaff) {
        setLoginError("General registration is currently closed.");
        setAuthSaving(false);
        return;
      }

      // If they are registering a new user not in the members table, and they are not invited staff,
      // they must provide student ID and phone number.
      if (!isPreRegistered && !canRegisterStaff) {
        if (!login.stId.trim() || !login.phone.trim()) {
          setLoginError("Student ID and Phone Number are required for registration.");
          setAuthSaving(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: login.password,
        options: {
          data: {
            full_name: v_name,
            role,
            st_id: isPreRegistered ? v_st_id : login.stId.trim(),
            level: login.level || "1",
            mobile_number: isPreRegistered ? null : login.phone.trim()
          }
        },
      });

      if (error) {
        setLoginError(error.message);
        setAuthSaving(false);
        return;
      }

      setAuthSaving(false);
      setLoginError(data.session ? "" : "Registration request submitted. Check your email to confirm your account, then login.");
      if (data.session) {
        setShowLogin(false);
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role")
          .eq("id", data.user.id)
          .maybeSingle();

        const userStatus = profile?.status || "approved";
        const userRole = profile?.role || role;

        if (userStatus === "pending") {
          setSession({
            role: userRole,
            stId: isPreRegistered ? v_st_id : login.stId.trim(),
            name: v_name,
            email,
            userId: data.user.id,
            status: "pending"
          });
          setPage("about");
        } else {
          setSession({
            role: userRole,
            stId: isPreRegistered ? v_st_id : login.stId.trim(),
            name: v_name,
            email,
            userId: data.user.id,
            status: "approved"
          });
          setPage(userRole === "member" ? "attendance" : userRole === "admin" ? "dashboard" : "members");
        }
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

  if (session.userId && session.status === "pending") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "2rem" }}>
        <div className="card" style={{ maxWidth: "500px", width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
          <div className="page-header" style={{ marginBottom: "2rem" }}>
            <div className="icon" style={{ fontSize: "3rem", color: "var(--amber)", marginBottom: "1rem" }}>⏳</div>
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
            <div className="icon" style={{ fontSize: "3rem", color: "var(--red)", marginBottom: "1rem" }}>❌</div>
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

  if (session.role === "guest") {
    return (
      <>
        <Landing
          theme={theme}
          onThemeToggle={toggleTheme}
          regEnabled={regEnabled}
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
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setLogin({ role: "member", email: "", password: "", name: "", stId: "", level: "1", phone: "" }); setLoginError(""); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value, email: "", password: "", name: "", stId: "", level: "1", phone: "" })}>
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {authMode === "register" && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          placeholder="Your full name"
                          value={login.name}
                          onChange={e => setLogin({ ...login, name: e.target.value })}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    {(!regEnabled && login.role === "member") ? (
                      <div className="form-row">
                        <div className="alert alert-error" style={{ width: "100%", margin: 0 }}>
                          General registration is currently closed. If you have been invited as staff, please select Editor or Admin.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="form-row form-row-2">
                          <div className="form-group">
                            <label>Student ID (ST ID)</label>
                            <input
                              placeholder="e.g. 2022/12345"
                              value={login.stId}
                              onChange={e => setLogin({ ...login, stId: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Year / Level</label>
                            <select value={login.level} onChange={e => setLogin({ ...login, level: e.target.value })}>
                              <option value="1">Year 1</option>
                              <option value="2">Year 2</option>
                              <option value="3">Year 3</option>
                              <option value="4">Year 4</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Phone Number</label>
                            <input
                              placeholder="e.g. +94771234567"
                              value={login.phone}
                              onChange={e => setLogin({ ...login, phone: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
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
                  <button type="submit" className="btn btn-primary" disabled={authSaving || (authMode === "register" && !regEnabled && login.role === "member")}>{authSaving ? "Please wait..." : authMode === "login" ? "Login" : "Register"}</button>
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
          <img src={`${import.meta.env.BASE_URL}logo.png`} className="logo-img" alt="ADSS Logo" />
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
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setLogin({ role: "member", email: "", password: "", name: "", stId: "", level: "1", phone: "" }); setLoginError(""); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value, email: "", password: "", name: "", stId: "", level: "1", phone: "" })}>
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {authMode === "register" && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          placeholder="Your full name"
                          value={login.name}
                          onChange={e => setLogin({ ...login, name: e.target.value })}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    {(!regEnabled && login.role === "member") ? (
                      <div className="form-row">
                        <div className="alert alert-error" style={{ width: "100%", margin: 0 }}>
                          General registration is currently closed. If you have been invited as staff, please select Editor or Admin.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="form-row form-row-2">
                          <div className="form-group">
                            <label>Student ID (ST ID)</label>
                            <input
                              placeholder="e.g. 2022/12345"
                              value={login.stId}
                              onChange={e => setLogin({ ...login, stId: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Year / Level</label>
                            <select value={login.level} onChange={e => setLogin({ ...login, level: e.target.value })}>
                              <option value="1">Year 1</option>
                              <option value="2">Year 2</option>
                              <option value="3">Year 3</option>
                              <option value="4">Year 4</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Phone Number</label>
                            <input
                              placeholder="e.g. +94771234567"
                              value={login.phone}
                              onChange={e => setLogin({ ...login, phone: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
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
                  <button type="submit" className="btn btn-primary" disabled={authSaving || (authMode === "register" && !regEnabled && login.role === "member")}>{authSaving ? "Please wait..." : authMode === "login" ? "Login" : "Register"}</button>
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
