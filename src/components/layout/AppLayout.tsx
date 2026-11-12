"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BarChart3,
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
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useAppData } from "@/components/AppProvider";
import { LocalDataMigration } from "@/components/workspaces/LocalDataMigration";

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
  const { user, signOut } = useAuth();
  const { error: appError, clearError: clearAppError } = useAppData();
  const {
    activeWorkspace,
    workspaces,
    loading: workspacesLoading,
    error: workspaceError,
    selectWorkspace,
  } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding"
  ) {
    return children;
  }

  const displayName =
    (typeof user?.user_metadata.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email ||
    "Account";

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Unable to sign out.", error);
      setSignOutError("Sign out failed. Please try again.");
    }
  }

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
          <div className="workspace-avatar">
            {activeWorkspace?.name.slice(0, 1).toUpperCase() ?? "C"}
          </div>
          <div className="workspace-copy">
            {workspaces.length > 1 ? (
              <select
                aria-label="Select workspace"
                className="max-w-full bg-transparent font-semibold"
                onChange={(event) => selectWorkspace(event.target.value)}
                value={activeWorkspace?.id ?? ""}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{workspacesLoading ? "Loading workspace..." : activeWorkspace?.name ?? "Workspace"}</strong>
            )}
            <span>
              {activeWorkspace
                ? `${activeWorkspace.role} access`
                : user?.email ?? "Workspace"}
            </span>
          </div>
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
          <Link className="nav-link" href="/outreach#integrations" onClick={() => setSidebarOpen(false)}>
            <Settings size={18} /><span>Integration setup</span>
          </Link>
          {user && (
            <div className="profile-row">
              <div className="profile-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
              <div className="profile-copy"><strong>{displayName}</strong><span>Signed in</span></div>
            </div>
          )}
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
            <div className="profile-menu-anchor">
              <button className="topbar-avatar" aria-label="Open account menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>{displayName.slice(0, 2).toUpperCase()}</button>
              {profileOpen && <div className="profile-popover"><strong>{displayName}</strong><span>{user?.email}</span>{signOutError && <p role="alert">{signOutError}</p>}<button className="text-button" onClick={handleSignOut}>Sign out</button></div>}
            </div>
          </div>
        </header>
        <main className="page-content">
          <LocalDataMigration />
          {workspaceError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {workspaceError}
            </p>
          )}
          {appError && (
            <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <span>{appError}</span>
              <button className="text-button" onClick={clearAppError}>Dismiss</button>
            </div>
          )}
          {children}
        </main>
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
