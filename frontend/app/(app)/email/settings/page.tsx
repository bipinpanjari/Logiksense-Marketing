import { EmailSettingsForm } from "@/components/email/email-settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function EmailSettingsPage() {
  return (
    <PageShell narrow>
      <PageHeader title="Email settings" description="Connect and validate your SMTP provider." />
      <EmailSettingsForm />
    </PageShell>
  );
}

