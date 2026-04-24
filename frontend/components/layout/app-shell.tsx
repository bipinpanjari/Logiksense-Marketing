"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  History,
  Inbox,
  KanbanSquare,
  LineChart,
  Linkedin,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  Send,
  Settings,
  Shield,
  Sparkles,
  UserCircle2,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    label: "Email",
    items: [
      { href: "/email/campaigns", label: "Campaigns", icon: Mail },
      { href: "/email/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/email/templates", label: "Templates", icon: FileText },
      { href: "/email/sequences", label: "Sequences", icon: Workflow },
      { href: "/email/new", label: "New sequence", icon: Send },
      { href: "/email/settings", label: "SMTP settings", icon: Settings },
    ],
  },
  {
    label: "Scraper",
    items: [
      { href: "/scraper", label: "Search profiles", icon: Globe },
      { href: "/scraper/jobs", label: "Jobs", icon: History },
    ],
  },
  {
    label: "LinkedIn",
    items: [
      { href: "/linkedin", label: "Campaigns", icon: Linkedin },
      { href: "/linkedin/accounts", label: "Accounts", icon: UserCircle2 },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai/settings", label: "Settings", icon: Sparkles },
      { href: "/ai/usage", label: "Usage", icon: Activity },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/audit", label: "Audit log", icon: ScrollText },
      { href: "/compliance", label: "Privacy", icon: Shield },
    ],
  },
];

/** Sidebar width; keep in sync with `lg:pl-[232px]` below (Tailwind needs literal class strings). */
const SIDEBAR_W = "w-[232px]";

/** One active link per section: paths like `/scraper` must not also match `/scraper/jobs` (use longest match). */
function isNavItemActive(pathname: string, itemHref: string, siblings: string[]) {
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (!matches(itemHref)) return false;
  const best = siblings.filter(matches).sort((a, b) => b.length - a.length)[0];
  return best === itemHref;
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-none transition-colors",
        active
          ? "bg-primary/[0.09] text-foreground shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 opacity-80 transition-opacity",
          active ? "text-primary opacity-100" : "group-hover:opacity-100"
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activePath = pathname || "";

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Main">
      {navGroups.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const siblingHrefs = group.items.map((i) => i.href);
              const active = isNavItemActive(activePath, item.href, siblingHrefs);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname || "";
  const { logout, workspace, user } = useAuth();
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const displayName = fullName || user?.email || "User";
  const avatarLetter = (user?.firstName || user?.email || "U").charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const workspaceName = workspace?.name || "Logik Sense";

  const userBlock = (
    <div className="relative border-t border-border/80 bg-card/80 p-3 backdrop-blur-[2px]" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors",
          "hover:border-border/80 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          menuOpen && "border-border/80 bg-muted/40"
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary text-xs font-semibold text-primary-foreground shadow-sm">
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email || "—"}</p>
        </div>
        {menuOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {menuOpen ? (
        <div
          className="absolute bottom-full left-3 right-3 z-30 mb-2 space-y-0.5 rounded-xl border border-border/80 bg-popover p-1.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
          role="menu"
        >
          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              activePath === "/profile" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            role="menuitem"
          >
            <UserCircle2 className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
              activePath === "/settings" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            role="menuitem"
          >
            <Settings className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
            Settings
          </Link>
          <div className="my-1 h-px bg-border/80" />
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={() => logout()}
            role="menuitem"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:pl-[232px]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{workspaceName}</p>
          <p className="truncate text-[11px] text-muted-foreground">Workspace</p>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/80 bg-card shadow-[4px_0_24px_-8px_rgb(0_0_0/0.08)] transition-transform duration-200 ease-out dark:shadow-[4px_0_24px_-8px_rgb(0_0_0/0.35)]",
          SIDEBAR_W,
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 px-4 lg:h-[60px] lg:px-4">
          <Link href="/dashboard" className="min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{workspaceName}</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">Workspace</p>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <SidebarNav onNavigate={() => setMobileOpen(false)} />

        {userBlock}
      </aside>

      <div className="mx-auto max-w-[1600px]">
        <main className="min-h-[calc(100vh-3.5rem)] p-4 md:min-h-screen md:p-8 lg:min-h-screen">{children}</main>
      </div>
    </div>
  );
}
