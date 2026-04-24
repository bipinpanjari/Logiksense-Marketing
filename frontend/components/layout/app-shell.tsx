"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Mail, Settings, Users, LogOut, CalendarDays, FileText, Workflow, Send, UserCircle2, ChevronUp, ChevronDown, Globe, History, Linkedin, Sparkles, Activity, Inbox, KanbanSquare, LineChart, Shield, ScrollText } from "lucide-react";
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
      { href: "/email/new", label: "New Sequence", icon: Send },
      { href: "/email/settings", label: "SMTP Settings", icon: Settings },
    ],
  },
  {
    label: "Scraper",
    items: [
      { href: "/scraper", label: "Search Profiles", icon: Globe },
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

/** One active link per section: paths like `/scraper` must not also match `/scraper/jobs` (use longest match). */
function isNavItemActive(pathname: string, itemHref: string, siblings: string[]) {
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (!matches(itemHref)) return false;
  const best = siblings.filter(matches).sort((a, b) => b.length - a.length)[0];
  return best === itemHref;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname || "";
  const { logout, workspace, user } = useAuth();
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const displayName = fullName || user?.email || "User";
  const avatarLetter = (user?.firstName || user?.email || "U").charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="min-h-screen bg-background lg:pl-[260px]">
      <div className="mx-auto max-w-[1600px]">
        <aside className="flex h-full flex-col border-r border-border bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:h-screen lg:w-[260px] lg:overflow-y-auto">
          <div className="flex h-16 items-center border-b border-border px-6">
            <div>
              <p className="text-sm text-muted-foreground">Workspace</p>
              <p className="font-semibold">{workspace?.name || "Logik Sense"}</p>
            </div>
          </div>
          <nav className="space-y-4 p-4">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const siblingHrefs = group.items.map((i) => i.href);
                  const active = isNavItemActive(activePath, item.href, siblingHrefs);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="relative mt-auto border-t border-border p-4" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-background/60 p-3 text-left transition hover:bg-muted"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {avatarLetter}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email || "No email"}</p>
              </div>
              {menuOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {menuOpen ? (
              <div className="absolute bottom-[78px] left-4 right-4 z-20 space-y-1 rounded-md border border-border bg-card p-2 shadow-xl">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                    activePath === "/profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <UserCircle2 className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                    activePath === "/settings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

