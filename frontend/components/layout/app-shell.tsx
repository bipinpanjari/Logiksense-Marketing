"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Mail, Settings, Users, LogOut, CalendarDays, FileText, Workflow, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
      { href: "/leads", label: "Leads", icon: Users },
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
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, workspace } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-card">
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
                  const active = pathname.startsWith(item.href);
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
          <div className="p-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

