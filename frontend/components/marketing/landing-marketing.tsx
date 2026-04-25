import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Inbox,
  KanbanSquare,
  LineChart,
  Linkedin,
  Mail,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

const primaryCta =
  "inline-flex h-11 items-center justify-center rounded-md bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const secondaryCta =
  "inline-flex h-11 items-center justify-center rounded-md border border-border/80 bg-background px-7 text-sm font-semibold text-foreground shadow-xs hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/50 p-6 shadow-xs">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/80 text-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.65} aria-hidden />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function LandingMarketing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            Logik Sense
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className={secondaryCta + " h-9 px-4 text-xs sm:h-10 sm:px-5 sm:text-sm"}>
              Sign in
            </Link>
            <Link href="/register" className={primaryCta + " h-9 px-4 text-xs sm:h-10 sm:px-5 sm:text-sm"}>
              Create workspace
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:flex lg:items-end lg:gap-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace-based operations</p>
              <h1 className="mt-3 text-pretty text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                Run leads, outbound email, and research workflows in one place.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Logik Sense is a multi-tenant web app for managing leads, email campaigns and sequences, a pipeline board,
                scraper-backed research jobs, LinkedIn surfaces, analytics, and AI settings. Built for teams that need clear
                separation per workspace and an audit trail—not a toy demo.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/register" className={primaryCta}>
                  Create workspace
                </Link>
                <Link href="/login" className={secondaryCta}>
                  Sign in to yours
                </Link>
              </div>
            </div>
            <div className="mt-12 hidden flex-1 lg:mt-0 lg:block">
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-6 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inside the app</p>
                <ul className="mt-4 space-y-3 text-sm text-foreground/90">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    Dashboard, analytics, and inbox views tied to your workspace data.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    Lead lists, CSV import, suppression, and a Kanban-style pipeline.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    Email campaigns, sequences, calendar, templates, and SMTP configuration.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    Scraper search and jobs, LinkedIn campaign and account screens, AI vendor settings and usage.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    Audit log and compliance-oriented pages for review—not marketing fluff.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <h2 className="text-pretty text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              What you can do today
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              These map to real screens and APIs in the product—no invented integrations or fake metrics.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon={Users as ComponentType<{ className?: string; strokeWidth?: number }>} title="Leads & pipeline">
                Store contacts, import spreadsheets, bulk suppress or delete, and move deals on a pipeline board.
              </Feature>
              <Feature icon={Mail as ComponentType<{ className?: string; strokeWidth?: number }>} title="Outbound email">
                Campaigns, multi-step sequences, calendar, templates, and workspace SMTP settings.
              </Feature>
              <Feature icon={Search as ComponentType<{ className?: string; strokeWidth?: number }>} title="Research & scraper">
                Search profiles, run jobs, and inspect structured dossier-style results in the UI.
              </Feature>
              <Feature icon={Linkedin as ComponentType<{ className?: string; strokeWidth?: number }>} title="LinkedIn">
                Campaign and account areas in-app for LinkedIn-oriented workflows (scope depends on your setup).
              </Feature>
              <Feature icon={Sparkles as ComponentType<{ className?: string; strokeWidth?: number }>} title="AI">
                Configure LLM vendor usage and review consumption from a dedicated settings and usage area.
              </Feature>
              <Feature icon={BarChart3 as ComponentType<{ className?: string; strokeWidth?: number }>} title="Reporting & inbox">
                Dashboard and analytics pages plus an inbox view aligned to your workspace activity.
              </Feature>
              <Feature icon={ScrollText as ComponentType<{ className?: string; strokeWidth?: number }>} title="Audit">
                Activity-oriented audit log for accountability inside the tenant.
              </Feature>
              <Feature icon={Shield as ComponentType<{ className?: string; strokeWidth?: number }>} title="Compliance">
                Privacy and compliance pages for policies and controls you surface to your organization.
              </Feature>
              <Feature icon={Settings as ComponentType<{ className?: string; strokeWidth?: number }>} title="Workspace & profile">
                Per-user profile, workspace settings, and onboarding gate for new members.
              </Feature>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Designed for clarity</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  The interface is organized into workspaces, with navigation for core CRM and email work, scraper and LinkedIn
                  tools, AI administration, and governance screens. Responsive layouts target desktop-first operators who still
                  need a usable experience on smaller screens.
                </p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { icon: KanbanSquare, label: "Pipeline stages you can see at a glance" },
                  { icon: CalendarDays, label: "Campaign calendar alongside sequence authoring" },
                  { icon: Inbox, label: "Inbox routing in the same shell as the rest of the app" },
                  { icon: LineChart, label: "Analytics without promising vendor-specific benchmarks" },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.65} aria-hidden />
                    <span className="text-sm leading-snug text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Ready when you are</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-background/80">
                  Create a workspace, finish onboarding, and start with leads or email—the product is the proof, not a slide deck.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-background px-7 text-sm font-semibold text-foreground shadow-xs hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                >
                  Create workspace
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-background/40 bg-transparent px-7 text-sm font-semibold text-background hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Logik Sense. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="text-muted-foreground hover:text-foreground">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
