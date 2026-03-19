"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sequences = [
  { id: "s1", name: "Founder Outreach 4-Step", status: "active", steps: 4, activeLeads: 183 },
  { id: "s2", name: "Reactivation Drip", status: "draft", steps: 3, activeLeads: 0 },
  { id: "s3", name: "Demo Follow-up", status: "paused", steps: 5, activeLeads: 47 },
];

export default function SequencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Sequences</h1>
          <p className="text-sm text-muted-foreground">Automated multi-step outbound flows with status control.</p>
        </div>
        <Button asChild>
          <Link href="/email/new">Build New Sequence</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Sequence</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Steps</th>
                  <th className="px-3 py-2 text-left font-medium">Active Leads</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => (
                  <tr key={seq.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{seq.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={seq.status === "active" ? "success" : "secondary"}>{seq.status}</Badge>
                    </td>
                    <td className="px-3 py-2">{seq.steps}</td>
                    <td className="px-3 py-2">{seq.activeLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

