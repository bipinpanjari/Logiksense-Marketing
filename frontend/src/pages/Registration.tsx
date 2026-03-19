"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { API_URL } from "@/lib/config";
import { getValidAccessToken } from "@/lib/api-client";
import { getStoredWorkspace, setSession } from "@/lib/auth-storage";
import { useAuth } from "@/components/providers/auth-provider";

type Step = 1 | 2 | 3 | 4 | 5;

const EMPLOYEE_OPTIONS = [
  { label: "1-10", value: 10 },
  { label: "11-50", value: 50 },
  { label: "51-100", value: 100 },
  { label: "101-500", value: 500 },
  { label: "500+", value: 1000 },
];

const DNS_PROVIDERS = ["namecheap", "godaddy", "route53", "cloudflare", "generic"] as const;

const Registration: React.FC = () => {
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
  const [selectedProvider, setSelectedProvider] = useState<typeof DNS_PROVIDERS[number]>("namecheap");

  const canGoNext = useMemo(() => {
    if (step === 1) return Boolean(companyName.trim() && staffName.trim() && workEmail.trim());
    if (step === 2) return Boolean(sendingEmail.trim() && domain.trim());
    if (step === 3) return true;
    if (step === 4) return true;
    return true;
  }, [companyName, staffName, workEmail, sendingEmail, domain, step]);

  const nextStep = () => setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));

  const handleCompleteOnboarding = async () => {
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
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to complete onboarding");
      }

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
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "780px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        <div style={{ background: "#f9fafb", padding: "24px 28px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", color: "#1f2937" }}>Workspace Onboarding</div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>Complete all steps, review, then submit once.</div>
          </div>
          <button type="button" onClick={logout} style={{ background: "transparent", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Logout
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "16px 28px", borderBottom: "1px solid #e5e7eb", background: "white" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} style={{ height: 6, flex: 1, borderRadius: 999, background: step >= s ? "#2563eb" : "#e5e7eb" }} />
          ))}
        </div>

        <div style={{ padding: "28px" }}>
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px 16px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", color: "#991b1b" }}>
              <AlertCircle size={18} />
              <div>{error}</div>
            </div>
          )}
          {success && (
            <div style={{ background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", color: "#166534" }}>
              <CheckCircle size={18} />
              <div>{success}</div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>Company Information</h2>
              <Field label="Company Name"><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corporation" style={inputStyle} /></Field>
              <Field label="Your Name (Staff)"><input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="John Smith" style={inputStyle} /></Field>
              <Field label="Number of Employees">
                <select value={numberOfEmployees} onChange={(e) => setNumberOfEmployees(Number(e.target.value))} style={inputStyle}>
                  {EMPLOYEE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Work Email"><input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} /></Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1f2937" }}>Outbound Email</h2>
              <p style={{ color: "#6b7280", marginBottom: 20 }}>Configure sending email details. Data is not saved until final review submit.</p>
              <Field label="Sending Email"><input type="email" value={sendingEmail} onChange={(e) => setSendingEmail(e.target.value)} placeholder="campaigns@yourcompany.com" style={inputStyle} /></Field>
              <Field label="Domain"><input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourcompany.com" style={inputStyle} /></Field>
              <Field label="DKIM Selector"><input type="text" value={dkimSelector} onChange={(e) => setDkimSelector(e.target.value)} placeholder="logik" style={inputStyle} /></Field>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1f2937" }}>DNS Provider</h2>
              <p style={{ color: "#6b7280", marginBottom: 20 }}>Select DNS provider for guidance. This selection is part of review metadata.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                {DNS_PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSelectedProvider(provider)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${selectedProvider === provider ? "#1e40af" : "#e5e7eb"}`,
                      background: selectedProvider === provider ? "#2563eb" : "#f9fafb",
                      color: selectedProvider === provider ? "#fff" : "#1f2937",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      fontWeight: 600,
                    }}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1f2937" }}>Pre-Submit Validation</h2>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>
                On final submit, server validates email-domain consistency and DNS checks (MX, DKIM, SPF) before onboarding is marked complete.
              </p>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 14px", color: "#1e3a8a", fontSize: 14 }}>
                <div>Work email: <strong>{workEmail || "-"}</strong></div>
                <div>Sending email: <strong>{sendingEmail || "-"}</strong></div>
                <div>Domain: <strong>{domain || "-"}</strong></div>
                <div>Provider: <strong>{selectedProvider}</strong></div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: "#1f2937" }}>Review</h2>
              <p style={{ color: "#6b7280", marginBottom: 18 }}>No onboarding data is persisted until you click Complete Onboarding.</p>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <ReviewRow label="Company Name" value={companyName} />
                <ReviewRow label="Staff Name" value={staffName} />
                <ReviewRow label="Employees" value={String(numberOfEmployees)} />
                <ReviewRow label="Work Email" value={workEmail} />
                <ReviewRow label="Sending Email" value={sendingEmail} />
                <ReviewRow label="Domain" value={domain} />
                <ReviewRow label="DKIM Selector" value={dkimSelector || "logik"} />
                <ReviewRow label="DNS Provider" value={selectedProvider} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 26, display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button type="button" onClick={prevStep} disabled={step === 1 || loading} style={secondaryButtonStyle(step === 1 || loading)}>
              <ChevronLeft size={16} /> Back
            </button>
            {step < 5 ? (
              <button type="button" onClick={nextStep} disabled={!canGoNext || loading} style={primaryButtonStyle(!canGoNext || loading)}>
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={handleCompleteOnboarding} disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? "Submitting..." : "Complete Onboarding"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 14px", borderBottom: "1px solid #e5e7eb" }}>
      <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || "-"}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 6,
  border: "none",
  background: disabled ? "#d1d5db" : "#2563eb",
  color: "white",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
});

const secondaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: disabled ? "#9ca3af" : "#374151",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
});

export default Registration;
