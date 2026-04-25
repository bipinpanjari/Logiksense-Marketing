"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
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

const navGroups: {
  label: string;
  icon: LucideIcon;
  items: { href: string; label: string; icon: LucideIcon }[];
}[] = [
  {
    label: "Core",
    icon: BarChart3,
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
    icon: Mail,
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
    icon: Globe,
    items: [
      { href: "/scraper", label: "Search profiles", icon: Globe },
      { href: "/scraper/jobs", label: "Jobs", icon: History },
    ],
  },
  {
    label: "LinkedIn",
    icon: Linkedin,
    items: [
      { href: "/linkedin", label: "Campaigns", icon: Linkedin },
      { href: "/linkedin/accounts", label: "Accounts", icon: UserCircle2 },
    ],
  },
];

/** Shown in user menu flyouts (hover / tap). */
const userMenuFlyoutGroups = [
  {
    key: "ai" as const,
    label: "AI",
    summary: "Models & usage",
    icon: Sparkles,
    items: [
      { href: "/ai/settings", label: "AI settings", icon: Sparkles },
      { href: "/ai/usage", label: "Usage", icon: Activity },
    ],
  },
  {
    key: "admin" as const,
    label: "Admin",
    summary: "Compliance & audit",
    icon: Shield,
    items: [
      { href: "/audit", label: "Audit log", icon: ScrollText },
      { href: "/compliance", label: "Privacy", icon: Shield },
    ],
  },
];

const SIDEBAR_W = "w-[var(--sidebar-width)]";

function isNavItemActive(pathname: string, itemHref: string, siblings: string[]) {
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (!matches(itemHref)) return false;
  const best = siblings.filter(matches).sort((a, b) => b.length - a.length)[0];
  return best === itemHref;
}

function sidebarGroupForPath(pathname: string): string | null {
  for (const g of navGroups) {
    const siblings = g.items.map((i) => i.href);
    for (const item of g.items) {
      if (isNavItemActive(pathname, item.href, siblings)) return g.label;
    }
  }
  return null;
}

function SidebarLeafLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm font-medium leading-snug",
        active ? "bg-foreground text-background" : "text-foreground hover:bg-muted/50"
      )}
    >
      {label}
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activePath = pathname || "";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const g of navGroups) o[g.label] = false;
    const initial = sidebarGroupForPath(activePath);
    if (initial) o[initial] = true;
    else if (navGroups[0]) o[navGroups[0].label] = true;
    return o;
  });

  /** Ensure the group for the current route is expanded; leave other sections as the user left them. */
  useEffect(() => {
    const s = sidebarGroupForPath(pathname || "");
    if (s == null) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const g of navGroups) {
        if (next[g.label] === undefined) next[g.label] = false;
      }
      next[s] = true;
      return next;
    });
  }, [pathname]);

  return (
    <nav
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden border-t border-border/60 px-3 py-2"
      aria-label="Main"
    >
      {navGroups.map((group) => {
        const isOpen = Boolean(openSections[group.label]);
        const GroupIcon = group.icon;
        return (
          <div key={group.label} className="border-b border-border/40 last:border-b-0">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 py-2.5 pr-1 text-left text-sm font-medium text-foreground hover:bg-muted/30"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenSections((prev) => ({
                  ...prev,
                  [group.label]: !prev[group.label],
                }))
              }
            >
              <GroupIcon className="h-[18px] w-[18px] shrink-0 opacity-70" strokeWidth={1.65} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            {isOpen ? (
              <div className="flex flex-col gap-0.5 pb-2 pl-2">
                {group.items.map((item) => {
                  const siblingHrefs = group.items.map((i) => i.href);
                  const active = isNavItemActive(activePath, item.href, siblingHrefs);
                  return (
                    <SidebarLeafLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={active}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname || "";
  const { logout, workspace, user } = useAuth();
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const displayName = fullName || user?.email?.split("@")[0] || "Account";
  const avatarLetter = (user?.firstName || user?.email || "U").charAt(0).toUpperCase();
  const workspaceInitial = (workspace?.name || "L").charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flyout, setFlyout] = useState<null | "ai" | "admin">(null);
  const [hoverMenuEnabled, setHoverMenuEnabled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHoverMenuEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const cancelMenuCloseTimer = useCallback(() => {
    if (menuCloseTimer.current) {
      clearTimeout(menuCloseTimer.current);
      menuCloseTimer.current = null;
    }
  }, []);

  const closeUserMenu = useCallback(() => {
    cancelMenuCloseTimer();
    setMenuOpen(false);
    setFlyout(null);
  }, [cancelMenuCloseTimer]);

  const openUserMenu = useCallback(() => {
    cancelMenuCloseTimer();
    setMenuOpen(true);
  }, [cancelMenuCloseTimer]);

  const scheduleUserMenuClose = useCallback(() => {
    cancelMenuCloseTimer();
    menuCloseTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setFlyout(null);
    }, 220);
  }, [cancelMenuCloseTimer]);

  useEffect(() => {
    setMobileOpen(false);
    closeUserMenu();
  }, [pathname, closeUserMenu]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeUserMenu();
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [closeUserMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeUserMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeUserMenu]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const workspaceName = workspace?.name || "Logik Sense";

  const activeFlyout = flyout ? userMenuFlyoutGroups.find((g) => g.key === flyout) : undefined;

  const userBlock = (
    <div
      ref={menuRef}
      className="relative shrink-0 border-t border-border/70 bg-gradient-to-t from-muted/25 to-card/90 p-2.5 backdrop-blur-[6px]"
      onMouseEnter={() => {
        if (hoverMenuEnabled) openUserMenu();
      }}
      onMouseLeave={() => {
        if (hoverMenuEnabled) scheduleUserMenuClose();
      }}
    >
      <button
        type="button"
        onClick={() => (menuOpen ? closeUserMenu() : openUserMenu())}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border px-2 py-2 text-left transition-all",
          "border-border/50 bg-background/70 shadow-xs hover:border-border hover:bg-background/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          menuOpen && "border-border bg-background shadow-sm ring-1 ring-foreground/[0.04]"
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/85 to-primary text-xs font-semibold text-primary-foreground shadow-sm">
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{displayName}</p>
          <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">{user?.email || "—"}</p>
        </div>
        {menuOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {menuOpen ? (
        <div
          className="pointer-events-auto absolute bottom-0 left-full z-[60] ml-2 flex w-max max-w-[min(calc(100vw-var(--sidebar-width)-1.5rem),24rem)] items-stretch max-lg:bottom-full max-lg:left-1/2 max-lg:ml-0 max-lg:max-w-[min(calc(100vw-1rem),22rem)] max-lg:-translate-x-1/2 max-lg:pb-2"
          role="menu"
        >
          <div className="hidden w-2 shrink-0 self-stretch lg:block" aria-hidden />
          <div className="flex max-h-[min(85vh,calc(100vh-1rem))] w-max overflow-hidden rounded-xl border border-border/80 bg-popover shadow-lg ring-1 ring-foreground/[0.04]">
            <div className="flex min-h-0 min-w-[13.75rem] shrink-0 flex-col overflow-y-auto">
              <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{user?.email || "—"}</p>
              </div>
              <div className="p-1.5">
              <Link
                href="/profile"
                onClick={() => closeUserMenu()}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  activePath === "/profile" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                role="menuitem"
              >
                <UserCircle2 className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => closeUserMenu()}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  activePath === "/settings" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                role="menuitem"
              >
                <Settings className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                Workspace settings
              </Link>
              <div className="my-1 h-px bg-border/70" />
              {userMenuFlyoutGroups.map((group) => {
                const Icon = group.icon;
                const open = flyout === group.key;
                const siblingHrefs = group.items.map((i) => i.href);
                return (
                  <div key={group.key} className="relative">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        open ? "bg-muted/90 text-foreground" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                      aria-expanded={open}
                      onMouseEnter={() => hoverMenuEnabled && setFlyout(group.key)}
                      onClick={() => {
                        if (!hoverMenuEnabled) {
                          setFlyout((f) => (f === group.key ? null : group.key));
                        }
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                      <ChevronRight
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "translate-x-0.5")}
                        aria-hidden
                      />
                    </button>
                    {!hoverMenuEnabled && open ? (
                      <div className="mt-0.5 space-y-px rounded-lg border border-border/60 bg-muted/20 p-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const active = isNavItemActive(activePath, item.href, siblingHrefs);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => closeUserMenu()}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              )}
                              role="menuitem"
                            >
                              <ItemIcon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="my-1 h-px bg-border/70" />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logout()}
                role="menuitem"
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Log out
              </button>
              </div>
            </div>
          {hoverMenuEnabled ? (
            <div
              className={cn(
                "flex shrink-0 flex-col overflow-hidden border-l border-border/70 bg-muted/25 transition-[width,opacity] duration-200 ease-out",
                activeFlyout ? "w-[11.75rem] opacity-100" : "w-0 border-l-0 opacity-0"
              )}
            >
              {activeFlyout ? (
                <div className="flex w-[11.75rem] flex-col py-1.5 pl-2 pr-1.5">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeFlyout.label}
                  </p>
                  <p className="mb-1.5 px-2 text-[11px] leading-snug text-muted-foreground">{activeFlyout.summary}</p>
                  <div className="space-y-px">
                    {activeFlyout.items.map((item) => {
                      const ItemIcon = item.icon;
                      const siblingHrefs = activeFlyout.items.map((i) => i.href);
                      const active = isNavItemActive(activePath, item.href, siblingHrefs);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => closeUserMenu()}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                            active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                          )}
                          role="menuitem"
                        >
                          <ItemIcon className="h-3.5 w-3.5 shrink-0 opacity-85" strokeWidth={1.75} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:pl-[var(--sidebar-width)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border/80 bg-background/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 lg:hidden">
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-xs font-bold text-primary">
            {workspaceInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{workspaceName}</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Workspace</p>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-x-visible border-r border-border/70 bg-card shadow-sidebar transition-transform duration-200 ease-out",
          SIDEBAR_W,
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border/70 px-3 lg:h-14">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-sm font-bold text-primary shadow-xs">
              {workspaceInitial}
            </div>
            <div className="min-w-0 py-0.5">
              <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">{workspaceName}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Workspace</p>
            </div>
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

      <div className="mx-auto max-w-app">
        <main className="min-h-[calc(100vh-3rem)] p-4 md:min-h-screen md:p-8 lg:min-h-screen lg:p-10">{children}</main>
      </div>
    </div>
  );
}
