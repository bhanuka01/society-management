import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { resizeImage } from "./utils/imageOptimizer";
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
import PublicEvent from "./pages/PublicEvent";
import Notices from "./pages/Notices";
import PublicNotice from "./pages/PublicNotice";
import ScanAttendance from "./pages/ScanAttendance";
import Letters from "./pages/Letters";
import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "notices", label: "Notices", icon: "campaign" },
  { id: "my_info", label: "My Info", icon: "person" },
  { id: "attendance", label: "Attendance", icon: "check_circle" },
  { id: "members", label: "Members", icon: "groups" },
  { id: "committee", label: "Committee", icon: "diversity_3" },
  { id: "tasks", label: "OC Tasks", icon: "task_alt" },
  { id: "events", label: "Events", icon: "event" },
  { id: "messages", label: "Messages", icon: "mail" },
  { id: "letters", label: "Letter Requests", icon: "description" },
  { id: "access", label: "Access", icon: "admin_panel_settings" },
  { id: "about", label: "Society Details", icon: "info" },

  // { id: "setup", label: "DB Setup", icon: "database" },
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
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [session, setSession] = useState({ role: "guest", stId: "", name: "", email: "", userId: "", status: "approved" });
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [login, setLogin] = useState({ role: "member", email: "", password: "", stId: "", name: "", level: "1", phone: "", memberFunction: "Finance" });
  const [loginError, setLoginError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [regEnabled, setRegEnabled] = useState(true);
  const [viewAsMember, setViewAsMember] = useState(false);
  
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setLoginError("Please select a valid image file.");
        return;
      }
      setProfileImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetAuthForm = () => {
    setLogin({ role: "member", email: "", password: "", name: "", stId: "", level: "1", phone: "", memberFunction: "Finance" });
    setLoginError("");
    setProfileImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
          setViewAsMember(false);
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
        setViewAsMember(false);
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

  const pages = { dashboard: Dashboard, notices: Notices, members: Members, committee: Committee, events: Events, attendance: Attendance, access: Access, about: About, setup: Setup, my_info: MyInfo, messages: Messages, tasks: Tasks, letters: Letters };
  const PageComponent = pages[page];
  const isRealStaff = canEdit(session.role);
  const effectiveRole = (viewAsMember && isRealStaff) ? "member" : session.role;
  const isEditor = canEdit(effectiveRole);
  const visibleNavItems = effectiveRole === "guest"
    ? NAV_ITEMS.filter(item => item.id === "about")
    : NAV_ITEMS.filter(item => {
      if (item.id === "access") return effectiveRole === "admin";
      if (item.id === "letters") return isEditor;
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

      let finalStId = isPreRegistered ? v_st_id : "";
      if (!isPreRegistered) {
        const trimmedStId = login.stId.trim();
        if (!trimmedStId) {
          setLoginError("Student ID is required.");
          setAuthSaving(false);
          return;
        }
        if (/^\d{4}\/\d{5}$/.test(trimmedStId)) {
          finalStId = "SC/" + trimmedStId;
        } else if (/^sc\/\d{4}\/\d{5}$/i.test(trimmedStId)) {
          finalStId = "SC/" + trimmedStId.substring(3);
        } else {
          setLoginError("Invalid Student ID format. Correct format: SC/2022/12984");
          setAuthSaving(false);
          return;
        }
      }

      let profileImageUrl = null;
      if (profileImageFile) {
        try {
          const optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);
          const cleanStId = finalStId.replace(/\//g, "-");
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

          profileImageUrl = urlData?.publicUrl;
        } catch (imgErr) {
          setLoginError(imgErr.message);
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
            st_id: finalStId,
            level: login.level || "1",
            mobile_number: isPreRegistered ? null : login.phone.trim(),
            member_function: isPreRegistered ? null : (role === "member" ? login.memberFunction : null),
            profile_image_url: profileImageUrl
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
          setViewAsMember(false);
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
          setViewAsMember(false);
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
    setViewAsMember(false);
    setPage("about");
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
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setLogin({ role: "member", email: "", password: "", name: "", stId: "", level: "1", phone: "", memberFunction: "Finance" }); setLoginError(""); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => setLogin({ ...login, role: e.target.value, email: "", password: "", name: "", stId: "", level: "1", phone: "", memberFunction: "Finance" })}>
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
                          placeholder="A.B. Pathum Nissanka"
                          value={login.name}
                          onChange={e => setLogin({ ...login, name: e.target.value })}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Profile Picture</label>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Profile Preview"
                              style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)", flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--bg)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--text3)", flexShrink: 0 }}>
                              👤
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <input
                              type="file"
                              accept="image/*"
                              id="profile-image-upload-guest"
                              onChange={handleFileChange}
                              style={{ display: "none" }}
                            />
                            <label
                              htmlFor="profile-image-upload-guest"
                              className="btn btn-ghost btn-sm"
                              style={{ cursor: "pointer", alignSelf: "flex-start", padding: "4px 12px", border: "1px solid var(--border)" }}
                            >
                              Choose Photo
                            </label>
                            <span className="text-muted" style={{ fontSize: "11px" }}>
                              {profileImageFile ? `${profileImageFile.name.substring(0, 20)}${profileImageFile.name.length > 20 ? "..." : ""}` : "No file chosen (Auto-resized to 500x600 px)"}
                            </span>
                          </div>
                        </div>
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
                              placeholder="e.g. SC/2022/12345"
                              value={login.stId}
                              onChange={e => setLogin({ ...login, stId: e.target.value })}
                              required
                            />
                            {login.stId && !/^(?:SC\/)?\d{4}\/\d{5}$/i.test(login.stId.trim()) && (
                              <span style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "4px", display: "block" }}>
                                Invalid Student ID format. Correct format: SC/2022/12984
                              </span>
                            )}
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
                        <div className="form-row">
                          <div className="form-group">
                            <label>Member Function</label>
                            <select value={login.memberFunction} onChange={e => setLogin({ ...login, memberFunction: e.target.value })}>
                              <option value="Finance">Finance</option>
                              <option value="Marketing">Marketing</option>
                              <option value="Operation & Academic Management">Operation & Academic Management</option>
                              <option value="Personal Development">Personal Development</option>
                              <option value="Public Relations">Public Relations</option>
                              <option value="Research & Analyst">Research & Analyst</option>
                            </select>
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
          <img src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`} className="logo-img" alt="ADSS Logo" />
          <div className="logo-text">
            <span className="logo-title">ADSS</span>
            <span className="logo-sub">Society Manager</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation menu">
            <span className="toggle-icon-desktop"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>{sidebarOpen ? "chevron_left" : "chevron_right"}</span></span>
            <span className="toggle-icon-mobile"><span className="material-symbols-outlined" style={{fontSize:'20px'}}>{sidebarOpen ? "close" : "menu"}</span></span>
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
              onClick={() => {
                setPage(item.id);
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
            >
              <span className="nav-icon"><span className="material-symbols-outlined">{item.icon}</span></span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-footer">
            <p>
              {authLoading
                ? "Checking access..."
                : session.role === "guest"
                ? "Members can watch only"
                : viewAsMember
                ? `${ROLE_LABELS[session.role]} (Viewing as Member)`
                : `${ROLE_LABELS[session.role]} mode${session.name ? `: ${session.name}` : ""}`}
            </p>
            {isRealStaff && (
              <button
                type="button"
                className={`role-switch ${viewAsMember ? "active" : ""}`}
                onClick={handleToggleViewAsMember}
                aria-label={viewAsMember ? "Switch to staff view" : "Switch to member view"}
              >
                <span className="role-switch-track">
                  <span className="role-switch-thumb">{viewAsMember ? "M" : "S"}</span>
                </span>
                <span>{viewAsMember ? "View: Member" : "View: Staff"}</span>
              </button>
            )}
            <button
              type="button"
              className="theme-switch"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="theme-switch-track">
                <span className="theme-switch-thumb">{theme === "dark" ? "●" : "○"}</span>
              </span>
              <span>{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <button
              className={`btn ${session.role !== "guest" ? "btn-ghost" : "btn-primary"} auth-btn`}
              onClick={session.role !== "guest" ? handleLogout : () => {
                setShowLogin(true);
                resetAuthForm();
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
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
                  <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); resetAuthForm(); }}>Login</button>
                  <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); resetAuthForm(); }}>Register</button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={login.role} onChange={e => { setLogin({ ...login, role: e.target.value, email: "", password: "", name: "", stId: "", level: "1", phone: "", memberFunction: "Finance" }); setLoginError(""); }}>
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
                          placeholder="A.B. Pathum Nissanka"
                          value={login.name}
                          onChange={e => setLogin({ ...login, name: e.target.value })}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Profile Picture</label>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "var(--bg3)", padding: "12px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Profile Preview"
                              style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)", flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--bg)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--text3)", flexShrink: 0 }}>
                              👤
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <input
                              type="file"
                              accept="image/*"
                              id="profile-image-upload"
                              onChange={handleFileChange}
                              style={{ display: "none" }}
                            />
                            <label
                              htmlFor="profile-image-upload"
                              className="btn btn-ghost btn-sm"
                              style={{ cursor: "pointer", alignSelf: "flex-start", padding: "4px 12px", border: "1px solid var(--border)" }}
                            >
                              Choose Photo
                            </label>
                            <span className="text-muted" style={{ fontSize: "11px" }}>
                              {profileImageFile ? `${profileImageFile.name.substring(0, 20)}${profileImageFile.name.length > 20 ? "..." : ""}` : "No file chosen (Auto-resized to 500x600 px)"}
                            </span>
                          </div>
                        </div>
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
                              placeholder="e.g. SC/2022/12345"
                              value={login.stId}
                              onChange={e => setLogin({ ...login, stId: e.target.value })}
                              required
                            />
                            {login.stId && !/^(?:SC\/)?\d{4}\/\d{5}$/i.test(login.stId.trim()) && (
                              <span style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "4px", display: "block" }}>
                                Invalid Student ID format. Correct format: SC/2022/12984
                              </span>
                            )}
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
                        <div className="form-row">
                          <div className="form-group">
                            <label>Member Function</label>
                            <select value={login.memberFunction} onChange={e => setLogin({ ...login, memberFunction: e.target.value })}>
                              <option value="Finance">Finance</option>
                              <option value="Marketing">Marketing</option>
                              <option value="Operation & Academic Management">Operation & Academic Management</option>
                              <option value="Personal Development">Personal Development</option>
                              <option value="Public Relations">Public Relations</option>
                              <option value="Research & Analyst">Research & Analyst</option>
                            </select>
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
            <PageComponent onNavigate={setPage} isAdmin={isEditor} role={effectiveRole} session={session} />
          )}
        </div>
      </main>
    </div>
  );
}
