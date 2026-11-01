import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  CalendarClock,
  ChevronDown,
  CircleHelp,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { Bootstrap } from "../types/domain";
import { Badge, initials } from "./Primitives";
import { useAuth } from "../context/AuthContext";
const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/obligations", label: "Obligations", icon: ListChecks },
  { to: "/intelligence", label: "Compliance Intelligence", icon: GitBranch },
  { to: "/risks", label: "Risk Center", icon: ShieldAlert },
  { to: "/deadlines", label: "Deadline Radar", icon: CalendarClock },
  { to: "/actions", label: "Action Center", icon: Activity },
  { to: "/audit", label: "Audit Trail", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings2 },
];
export function AppShell({ data }: { data: Bootstrap | null }) {
  const { user: authUser, logout: authLogout } = useAuth();
  const [search, setSearch] = useState(""),
    [notify, setNotify] = useState(false),
    [menu, setMenu] = useState(false),
    [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const current =
    nav.find((x) => x.to === window.location.pathname)?.label ||
    (window.location.pathname.startsWith("/findings/")
      ? "Finding detail"
      : window.location.pathname.startsWith("/documents/")
        ? "Document detail"
        : "Overview");
  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/documents?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  }
  async function logout() {
    await authLogout();
    navigate("/login");
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck size={21} />
            <span />
          </div>
          <div className="brand-name">
            ContractGuard<span>AI</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="org-switch">
          <div className="org-avatar">
            {initials(data?.organization.name || "CG")}
          </div>
          <div className="org-info">
            <span>WORKSPACE</span>
            <strong>{data?.organization.name || "Organization"}</strong>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobile(false)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.to === "/risks" && data?.summary.high_risks ? (
                  <b className="nav-count">{data.summary.high_risks}</b>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-icon">
              <Sparkles size={15} />
            </div>
            <div>
              <strong>Evidence first</strong>
              <p>Every finding links back to its source.</p>
            </div>
          </div>
          <button className="help-link">
            <CircleHelp size={16} />
            Help & documentation
          </button>
          <div className="sidebar-foot">
            ContractGuard AI{" "}
            <span>v0.1 · {data?.demo_mode ? "DEMO MODE" : "WORKSPACE"}</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close menu"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <span />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <span className="crumb-sep">/</span>
            <strong>{current}</strong>
          </div>
          <form className="global-search" onSubmit={doSearch}>
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents, findings…"
            />
            <kbd>⌘ K</kbd>
          </form>
          <div className="top-actions">
            <div className="relative">
              <button
                className={`icon-button ${notify ? "selected" : ""}`}
                onClick={() => {
                  setNotify(!notify);
                  setMenu(false);
                }}
                aria-label="Notifications"
              >
                <Bell size={17} />
                {data?.notifications.length ? <i /> : null}
              </button>
              {notify && (
                <div className="popover notifications">
                  <div className="popover-title">
                    Notifications{" "}
                    <span>{data?.notifications.length || 0} new</span>
                  </div>
                  {data?.notifications.length ? (
                    data.notifications.map((n) => (
                      <div className="notification-row" key={n.id}>
                        <i />
                        <div>
                          <strong>{n.title}</strong>
                          <p>{n.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted small">You’re all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                className="profile-button"
                onClick={() => {
                  setMenu(!menu);
                  setNotify(false);
                }}
              >
                <span className="profile-avatar">
                  {initials(authUser?.name || data?.user.name || "U")}
                </span>
                <span className="profile-name">
                  {authUser?.name || data?.user.name || "Reviewer"}
                </span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="popover profile-menu">
                  <strong>{authUser?.name || data?.user.name || "Reviewer"}</strong>
                  <span>{authUser?.email || data?.user.email || "Workspace reviewer"}</span>
                  {data?.demo_mode && <Badge tone="demo">Synthetic demo</Badge>}
                  <button onClick={logout}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
