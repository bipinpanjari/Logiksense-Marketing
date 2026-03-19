import { EmailSettingsForm } from "@/components/email/email-settings-form";

export default function EmailSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Settings</h1>
        <p className="text-sm text-muted-foreground">Connect and validate your SMTP provider.</p>
      </div>
      <EmailSettingsForm />
    </div>
  );
}

