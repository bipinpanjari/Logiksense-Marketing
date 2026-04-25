"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { API_URL } from "@/lib/config";
import { getValidAccessToken } from "@/lib/api-client";
import { getStoredWorkspace, setSession } from "@/lib/auth-storage";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/ui/callout";

type Step = 1 | 2 | 3 | 4 | 5;

const EMPLOYEE_OPTIONS = [
  { label: "1-10", value: 10 },
  { label: "11-50", value: 50 },
  { label: "51-100", value: 100 },
  { label: "101-500", value: 500 },
  { label: "500+", value: 1000 },
];

const DNS_PROVIDERS = ["namecheap", "godaddy", "route53", "cloudflare", "generic"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [numberOfEmployees, setNumberOfEmployees] = useState(10);
  const [workEmail, setWorkEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("logik");
  const [selectedProvider, setSelectedProvider] = useState<(typeof DNS_PROVIDERS)[number]>("namecheap");
  /** Local/dev: allow completing without live MX/DKIM/SPF (server must allow: dev or ONBOARDING_ALLOW_CLIENT_DNS_SKIP). */
  const [skipDnsValidation, setSkipDnsValidation] = useState(false);

  const canGoNext = useMemo(() => {
    if (step === 1) return Boolean(companyName.trim() && staffName.trim() && workEmail.trim());
    if (step === 2) return Boolean(sendingEmail.trim() && domain.trim());
    return true;
  }, [companyName, staffName, workEmail, sendingEmail, domain, step]);

  const nextStep = () => setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));

  async function complete() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error("Session expired. Please login again.");

      const response = await fetch(`${API_URL}/auth/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          staffName: staffName.trim(),
          numberOfEmployees,
          workEmail: workEmail.trim().toLowerCase(),
          sendingEmail: sendingEmail.trim().toLowerCase(),
          domain: domain.trim().toLowerCase(),
          dkimSelector: dkimSelector.trim() || "logik",
          skipDnsValidation,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Failed to complete onboarding");

      if (user) {
        setSession({
          accessToken: token,
          user: { ...user, onboardingCompleted: true },
          workspace: getStoredWorkspace() || undefined,
        });
      }

      setSuccess("Onboarding completed successfully.");
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-b from-background via-background to-muted/25 p-6 md:items-center md:py-10">
      <Card className="w-full max-w-2xl shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-page-title">Workspace onboarding</CardTitle>
            <CardDescription>Complete all steps, review, then submit once.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          {error && (
            <Callout variant="destructive" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </Callout>
          )}
          {success && (
            <Callout variant="success" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </Callout>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Company Information</h2>
              <Field label="Company Name">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corporation" />
              </Field>
              <Field label="Your Name (Staff)">
                <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="John Smith" />
              </Field>
              <Field label="Number of Employees">
                <select
                  value={numberOfEmployees}
                  onChange={(e) => setNumberOfEmployees(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {EMPLOYEE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Work Email">
                <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Outbound Email</h2>
              <p className="text-sm text-muted-foreground">
                Configure sending email details. Data is not saved until final review submit.
              </p>
              <Field label="Sending Email">
                <Input type="email" value={sendingEmail} onChange={(e) => setSendingEmail(e.target.value)} placeholder="campaigns@yourcompany.com" />
              </Field>
              <Field label="Domain">
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourcompany.com" />
              </Field>
              <Field label="DKIM Selector">
                <Input value={dkimSelector} onChange={(e) => setDkimSelector(e.target.value)} placeholder="logik" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">DNS Provider</h2>
              <p className="text-sm text-muted-foreground">
                Select your DNS provider so we can provide tailored DKIM/SPF instructions.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {DNS_PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    type="button"
                    variant={selectedProvider === provider ? "default" : "outline"}
                    className="capitalize"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    {provider}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Pre-submit validation</h2>
              <p className="text-sm text-muted-foreground">
                By default, on submit the server checks that your domain has MX and typical mail DNS (DKIM, SPF, DMARC). You can skip those checks if DNS is not live yet (common for local dev); production servers may require an extra env flag.
              </p>
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <div>Work email: <span className="font-semibold">{workEmail || "-"}</span></div>
                <div>Sending email: <span className="font-semibold">{sendingEmail || "-"}</span></div>
                <div>Domain: <span className="font-semibold">{domain || "-"}</span></div>
                <div>Provider: <span className="font-semibold">{selectedProvider}</span></div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-caution-border/90 bg-caution-bg/90 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={skipDnsValidation}
                  onChange={(e) => setSkipDnsValidation(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Complete without DNS / MX checks</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Use when records are not published yet (e.g. <code className="text-xs">logiksense.ai</code> has no MX in DNS). Re-run validation from Email settings after you configure DNS.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Review</h2>
              <p className="text-sm text-muted-foreground">
                No onboarding data is persisted until you click Complete Onboarding.
              </p>
              <div className="overflow-hidden rounded-md border">
                <ReviewRow label="Company Name" value={companyName} />
                <ReviewRow label="Staff Name" value={staffName} />
                <ReviewRow label="Employees" value={String(numberOfEmployees)} />
                <ReviewRow label="Work Email" value={workEmail} />
                <ReviewRow label="Sending Email" value={sendingEmail} />
                <ReviewRow label="Domain" value={domain} />
                <ReviewRow label="DKIM Selector" value={dkimSelector || "logik"} />
                <ReviewRow label="DNS Provider" value={selectedProvider} />
                <ReviewRow
                  label="DNS validation"
                  value={skipDnsValidation ? "Skipped (complete without MX/DKIM checks)" : "Required on submit"}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button type="button" variant="outline" disabled={step === 1 || loading} onClick={prevStep}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < 5 ? (
              <Button type="button" disabled={!canGoNext || loading} onClick={nextStep}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={loading} onClick={complete}>
                {loading ? "Submitting..." : "Complete Onboarding"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block font-medium">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 last:border-b-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}
