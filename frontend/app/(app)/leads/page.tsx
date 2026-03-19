"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  company?: string;
}

export default function LeadsPage() {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch(`/leads?search=${encodeURIComponent(query)}&page=1&limit=50`);
        const data = await res.json();
        setLeads(data?.data || data?.rows || data || []);
      } catch {
        setLeads([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads CRM</h1>
        <p className="text-sm text-muted-foreground">Manage leads with clean workspace-level isolation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Search by email, company, or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b">
                      <td className="px-3 py-2">{`${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "-"}</td>
                      <td className="px-3 py-2">{lead.email}</td>
                      <td className="px-3 py-2">{lead.company || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

