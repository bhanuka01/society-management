import React, { useState, useEffect } from "react";
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
  MoreHorizontal,
  X,
  Sun,
  Moon,
  LogOut,
  Shield,
  ChevronRight
} from "lucide-react";

export default function MobileNav({
  page,
  setPage,
  visibleSections = [],
  session = {},
  pendingMsgCount = 0,
  theme = "dark",
  toggleTheme,
  isRealStaff = false,
  viewAsMember = false,
  handleToggleViewAsMember,
  handleLogout,
  connected = null,
  canAccessAi = false,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Determine user initials
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Determine the 4 primary tabs for the bottom bar based on role
  const isStaff = session.role === "admin" || session.role === "editor";
  const isMember = session.role === "member";
  const hasStId = !!session.stId;

  // Primary bottom tabs
  let primaryTabs = [];
  if (isStaff && !viewAsMember) {
    primaryTabs = [
      { id: "dashboard", label: "Dash", icon: LayoutDashboard },
      { id: "my_info", label: "My Info", icon: UserCheck },
      { id: "notices", label: "Notices", icon: Megaphone },
      { id: "messages", label: "Messages", icon: Mail, badge: pendingMsgCount },
    ];
  } else if (isMember || viewAsMember) {
    primaryTabs = [
      { id: "attendance", label: "Dash", icon: CalendarCheck },
      { id: hasStId ? "my_info" : "events", label: hasStId ? "My Info" : "Events", icon: hasStId ? UserCheck : Calendar },
      { id: "notices", label: "Notices", icon: Megaphone },
      { id: "messages", label: "Messages", icon: Mail, badge: pendingMsgCount },
    ];
  } else {
    // Guest
    primaryTabs = [
      { id: "events", label: "Events", icon: Calendar },
      { id: "notices", label: "Notices", icon: Megaphone },
      { id: "assistant", label: "Assistant", icon: Sparkles },
    ];
  }

  const primaryIds = new Set(primaryTabs.map((t) => t.id));
  const isMoreActive = !primaryIds.has(page) || drawerOpen;

  // Find active page title for the top header
  const allNavItems = visibleSections.flatMap((s) => s.items);
  const activeItem = allNavItems.find((i) => i.id === page);
  const activeTitle = activeItem ? activeItem.label : page.replace("_", " ").toUpperCase();

  const handleTabClick = (tabId) => {
    setDrawerOpen(false);
    setPage(tabId);
  };

  return (
    <>
      {/* ── Mobile Top Sticky Bar ── */}
      <header className="mobile-topbar" role="banner">
        <div className="mobile-topbar-left">
          <img
            src={`${import.meta.env.BASE_URL}${theme === "dark" ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
            className="mobile-topbar-logo"
            alt="ADSS"
          />
          <div className="mobile-topbar-title-wrap">
            <div className="mobile-topbar-brand">
              ADSS RUHUNA
              <span className="mobile-topbar-version">v2.6</span>
            </div>
            <div className="mobile-topbar-page">{activeTitle}</div>
          </div>
        </div>

        <div className="mobile-topbar-right">
          {/* Connection status indicator */}
          <div
            className="mobile-telemetry-dot"
            title={connected === null ? "Synchronizing" : connected ? "DB Synchronized" : "Offline"}
          >
            <span className={`dot ${connected === null ? "pending" : connected ? "ok" : "err"}`} />
          </div>

          {/* User profile initial button */}
          {session.role !== "guest" && (
            <button
              className="mobile-topbar-user-btn"
              onClick={() => setDrawerOpen(true)}
              title="Open profile & menu"
              aria-label="Open profile and navigation menu"
            >
              <span className="mobile-topbar-initials">
                {getInitials(session.name || session.email)}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile Bottom Navigation Bar (Matches user's mockup image) ── */}
      <nav className="mobile-bottom-bar" role="navigation" aria-label="Mobile Navigation">
        <div className="mobile-bottom-grid">
          {/* Primary Tabs */}
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = page === tab.id && !drawerOpen;
            return (
              <button
                key={tab.id}
                className={`mobile-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => handleTabClick(tab.id)}
                aria-label={tab.label}
              >
                <div className="mobile-tab-icon-box">
                  <Icon className="mobile-tab-icon" />
                  {tab.badge > 0 && (
                    <span className="mobile-tab-badge">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </div>
                <span className="mobile-tab-label">{tab.label}</span>
              </button>
            );
          })}

          {/* 5th Tab: "more" */}
          <button
            className={`mobile-tab-btn ${isMoreActive ? "active" : ""}`}
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label="More navigation options"
            aria-expanded={drawerOpen}
          >
            <div className="mobile-tab-icon-box">
              <MoreHorizontal className="mobile-tab-icon" />
            </div>
            <span className="mobile-tab-label">More</span>
          </button>
        </div>
      </nav>

      {/* ── Backdrop Overlay ── */}
      <div
        className={`mobile-drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />

      {/* ── Curved Slide-in Side Drawer (Matches user's mockup image right screen) ── */}
      <aside
        className={`mobile-drawer ${drawerOpen ? "open" : ""}`}
        aria-label="Additional Navigation"
        aria-hidden={!drawerOpen}
      >
        <div className="mobile-drawer-inner">
          {/* Drawer Header */}
          <div className="mobile-drawer-header">
            <div className="mobile-drawer-header-left">
              <div className="mobile-drawer-title">Navigation</div>
              <div className="mobile-drawer-subtitle">ADSS Ruhuna Portal</div>
            </div>
            <button
              className="mobile-drawer-close-btn"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Quick Profile Snippet inside Drawer */}
          {session.role !== "guest" && (
            <div className="mobile-drawer-profile-card">
              <div className="mobile-drawer-avatar">
                {getInitials(session.name || session.email)}
              </div>
              <div className="mobile-drawer-user-info">
                <div className="mobile-drawer-user-name">
                  {session.preferredName || session.name || "Member"}
                </div>
                <div className="mobile-drawer-user-meta">
                  <span className="mobile-drawer-role-badge">
                    {session.role}
                  </span>
                  {session.stId && (
                    <span className="mobile-drawer-stid">{session.stId}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Section List */}
          <div className="mobile-drawer-nav-scroll">
            {visibleSections.map((section) => (
              <div key={section.title} className="mobile-drawer-group">
                <div className="mobile-drawer-group-title">{section.title}</div>
                <div className="mobile-drawer-group-items">
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = page === item.id;
                    const hasPending = item.id === "messages" && pendingMsgCount > 0;

                    return (
                      <button
                        key={item.id}
                        className={`mobile-drawer-item ${isActive ? "active" : ""}`}
                        onClick={() => {
                          setPage(item.id);
                          setDrawerOpen(false);
                        }}
                      >
                        <div className="mobile-drawer-item-left">
                          <span className="mobile-drawer-item-icon">
                            <IconComponent className="w-4 h-4" />
                          </span>
                          <span className="mobile-drawer-item-label">{item.label}</span>
                        </div>
                        <div className="mobile-drawer-item-right">
                          {hasPending && (
                            <span className="mobile-drawer-badge">
                              {pendingMsgCount > 99 ? "99+" : pendingMsgCount}
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Drawer Footer Controls */}
          <div className="mobile-drawer-footer">
            {/* Quick Segmented Controls */}
            <div className="mobile-drawer-controls-grid">
              {isRealStaff && (
                <button
                  type="button"
                  className={`mobile-drawer-ctrl-card ${!viewAsMember ? "active-staff" : ""}`}
                  onClick={handleToggleViewAsMember}
                >
                  <div className="mobile-drawer-ctrl-header">
                    <Shield className="w-3.5 h-3.5 text-[#6366f1]" />
                    <span>{viewAsMember ? "Member" : "Staff"}</span>
                  </div>
                  <span className="mobile-drawer-ctrl-tag">
                    {viewAsMember ? "OFF" : "ON"}
                  </span>
                </button>
              )}

              <button
                type="button"
                className={`mobile-drawer-ctrl-card ${theme === "dark" ? "active-dark" : ""}`}
                onClick={toggleTheme}
              >
                <div className="mobile-drawer-ctrl-header">
                  {theme === "dark" ? (
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{theme === "dark" ? "Dark" : "Light"}</span>
                </div>
                <span className="mobile-drawer-ctrl-tag">MODE</span>
              </button>
            </div>

            {/* Logout / Login Card */}
            <button
              type="button"
              className="mobile-drawer-logout-btn"
              onClick={() => {
                setDrawerOpen(false);
                if (session.role !== "guest") {
                  handleLogout();
                } else {
                  window.history.pushState({}, "", "/login");
                  window.dispatchEvent(new Event("popstate"));
                }
              }}
            >
              <div className="mobile-drawer-logout-left">
                <LogOut className="w-4 h-4 text-[#eb5757]" />
                <span>{session.role !== "guest" ? "Logout" : "Login"}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
