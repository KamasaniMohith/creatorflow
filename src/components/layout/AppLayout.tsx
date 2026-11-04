"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  Compass,
  LayoutDashboard,
  Menu,
  Megaphone,
  Search,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

const primaryLinks = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Discover creators", href: "/discover", icon: Compass },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Shortlist", href: "/shortlist", icon: UsersRound },
  { label: "Outreach", href: "/outreach", icon: BarChart3 },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/discover": "Discover creators",
  "/campaigns": "Campaigns",
  "/shortlist": "Shortlist",
  "/outreach": "Outreach",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/discover?search=${encodeURIComponent(search)}`);
  }

  return (
    <div className="app-frame">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setSidebarOpen(false)}>
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span>creator<span className="brand-light">flow</span></span>
        </Link>
        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <div className="workspace-copy"><strong>Studio North</strong><span>Free workspace</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {primaryLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              className={`nav-link ${pathname === href ? "nav-link-active" : ""}`}
              href={href}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="note-icon"><Sparkles size={15} /></div>
          <strong>Creator discovery, made clear.</strong>
          <p>Find the right voices for your next big idea.</p>
          <Link href="/discover">Explore creators <span>→</span></Link>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={() => window.alert("Settings are not part of this demo yet.")}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <button className="nav-link" onClick={() => window.alert("Help center is not part of this demo yet.")}>
            <CircleHelp size={18} /><span>Help & support</span>
          </button>
          <div className="profile-row">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jordan Davis</strong><span>Agency admin</span></div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageTitles[pathname] || "CreatorFlow"}</strong></div>
          <div className="topbar-actions">
            <form className="global-search" onSubmit={submitSearch}>
              <Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators..." aria-label="Search creators" />
            </form>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => window.alert("You're all caught up.")}>
              <Bell size={18} /><i />
            </button>
            <div className="profile-menu-anchor">
              <button className="topbar-avatar" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>JD</button>
              {profileOpen && <div className="profile-popover"><strong>Jordan Davis</strong><span>Agency admin</span><div className="profile-popover-note">Studio North · Demo workspace</div></div>}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return <button className="icon-button close-button" aria-label="Close dialog" onClick={onClick}><X size={19} /></button>;
}
