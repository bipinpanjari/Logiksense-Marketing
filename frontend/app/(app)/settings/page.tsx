import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>Centralized settings and preferences are being migrated to the new SaaS UI shell.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Next iteration: team management, role permissions, billing controls, and notification policies.
        </p>
      </CardContent>
    </Card>
  );
}

