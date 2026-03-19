import { BarChart3, Mail, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Total Leads", value: "1,248", icon: Users, description: "+8.2% from last month" },
  { label: "Emails Sent", value: "5,432", icon: Mail, description: "+12.4% from last month" },
  { label: "Conversion Rate", value: "3.2%", icon: TrendingUp, description: "+0.5% from last month" },
  { label: "Active Campaigns", value: "12", icon: BarChart3, description: "2 scheduled today" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your workspace performance snapshot.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="text-2xl">{item.value}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <Icon className="h-4 w-4 text-primary" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

