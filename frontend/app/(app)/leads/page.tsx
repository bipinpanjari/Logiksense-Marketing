"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Lead, LeadImportMapping, LeadImportPreviewResult, LeadImportResult, bulkDeleteLeads, bulkUpdateLeads, confirmLeadImport, createLead, deleteLead, getLeadImportHistory, getLeadStats, listLeads, previewLeadImport, updateLead } from "@/lib/leads";

export default function LeadsPage() {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; suppressed: number }>({ total: 0, active: 0, suppressed: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<LeadImportResult | null>(null);
  const [importPreview, setImportPreview] = useState<LeadImportPreviewResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMapping, setImportMapping] = useState<LeadImportMapping>({});
  const [importDedupeStrategy, setImportDedupeStrategy] = useState<"skip" | "update">("skip");
  const [importHistory, setImportHistory] = useState<Array<{ id: string; created_at: string; details?: { totalRows?: number; successCount?: number; errorCount?: number } }>>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [list, statsData, history] = await Promise.all([
        listLeads({ page, limit: 20, search: query, company: companyFilter }),
        getLeadStats(),
        getLeadImportHistory().catch(() => []),
      ]);
      setLeads(list?.data || []);
      setPages(list?.pagination?.pages || 1);
      setStats({
        total: Number(statsData?.total || 0),
        active: Number(statsData?.active || 0),
        suppressed: Number(statsData?.suppressed || 0),
      });
      setImportHistory(Array.isArray(history) ? history : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, companyFilter, page]);

  function openCreate() {
    setEditingLeadId(null);
    setForm({ firstName: "", lastName: "", email: "", phone: "", company: "" });
    setEditorOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingLeadId(lead.id);
    setForm({
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
    });
    setEditorOpen(true);
  }

  async function submitLead() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingLeadId) {
        await updateLead(editingLeadId, form);
        setMessage("Lead updated");
      } else {
        await createLead({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          company: form.company || undefined,
        });
        setMessage("Lead created");
      }
      setEditorOpen(false);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Failed to save lead");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteLead(id: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteLead(id);
      setMessage("Lead deleted");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Failed to delete lead");
    } finally {
      setSaving(false);
    }
  }

  async function onBulkSuppress(value: boolean) {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await bulkUpdateLeads(selectedIds, { isSuppressed: value });
      setMessage(value ? "Selected leads suppressed" : "Selected leads unsuppressed");
      setSelectedIds([]);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Bulk update failed");
    } finally {
      setSaving(false);
    }
  }

  async function onBulkDelete() {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await bulkDeleteLeads(selectedIds);
      setMessage("Selected leads deleted");
      setSelectedIds([]);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Bulk delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function onImportPreview() {
    if (!importFile) return;
    setImportLoading(true);
    setError("");
    setMessage("");
    setImportResult(null);
    try {
      const preview = await previewLeadImport(importFile);
      setImportPreview(preview);
      setImportMapping(preview.suggestedMapping || {});
    } catch (e: any) {
      setError(e?.message || "Import preview failed");
    } finally {
      setImportLoading(false);
    }
  }

  async function onConfirmImport() {
    if (!importFile) return;
    setImportLoading(true);
    setError("");
    setMessage("");
    setImportResult(null);
    try {
      const result = await confirmLeadImport(importFile, importMapping, importDedupeStrategy);
      setImportResult(result);
      setMessage(`Import completed: ${result.successCount} created, ${Number(result.updateCount || 0)} updated, ${result.errorCount} failed`);
      setImportModalOpen(false);
      setImportPreview(null);
      setImportFile(null);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Import confirm failed");
    } finally {
      setImportLoading(false);
    }
  }

  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads CRM</h1>
        <p className="text-sm text-muted-foreground">Workspace-scoped lead management with search, bulk actions, and lifecycle controls.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Leads</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.active}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Suppressed</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.suppressed}</p></CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters & Actions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search and segment leads, then run workspace-safe bulk operations.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search</label>
              <Input
                className="h-10 bg-background"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</label>
              <Input
                className="h-10 bg-background"
                placeholder="Filter by company"
                value={companyFilter}
                onChange={(e) => {
                  setPage(1);
                  setCompanyFilter(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/30 p-2">
            <Button className="h-9" onClick={openCreate}>New Lead</Button>
            <Button className="h-9" variant="outline" onClick={() => setImportModalOpen(true)}>
              Import Leads
            </Button>
            <div className="mx-1 hidden h-6 w-px bg-border md:block" />
            <Button className="h-9" variant="outline" disabled={selectedIds.length === 0 || saving} onClick={() => onBulkSuppress(true)}>
              Suppress
            </Button>
            <Button className="h-9" variant="outline" disabled={selectedIds.length === 0 || saving} onClick={() => onBulkSuppress(false)}>
              Unsuppress
            </Button>
            <Button className="h-9 md:ml-auto" variant="destructive" disabled={selectedIds.length === 0 || saving} onClick={onBulkDelete}>
              Delete Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track lead ingestion quality and outcomes across all import runs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {importResult ? (
            <div className="grid gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm md:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Total Rows</p><p className="text-lg font-semibold">{importResult.totalRows}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="text-lg font-semibold">{importResult.successCount}</p></div>
              <div><p className="text-xs text-muted-foreground">Updated</p><p className="text-lg font-semibold">{Number(importResult.updateCount || 0)}</p></div>
              <div><p className="text-xs text-muted-foreground">Errors</p><p className="text-lg font-semibold text-destructive">{importResult.errorCount}</p></div>
            </div>
          ) : null}
          <div className="max-h-56 overflow-auto rounded-lg border border-border/80">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="border-b border-border/70">
                  <th className="px-4 py-2.5 text-left font-semibold text-foreground/90">Time</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-foreground/90">Rows</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-foreground/90">Success</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-foreground/90">Errors</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={4}>
                      No imports yet. Use `Import Leads` to run your first extraction.
                    </td>
                  </tr>
                ) : (
                  importHistory.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-4 py-2.5">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5">{Number(item.details?.totalRows || 0)}</td>
                      <td className="px-4 py-2.5">{Number(item.details?.successCount || 0)}</td>
                      <td className="px-4 py-2.5">{Number(item.details?.errorCount || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead List</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked ? leads.map((l) => l.id) : []);
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-3 py-2 text-left font-medium">Tags</th>
                    <th className="px-3 py-2 text-left font-medium">Suppressed</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, lead.id] : prev.filter((x) => x !== lead.id)
                            );
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">{`${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "-"}</td>
                      <td className="px-3 py-2">{lead.email}</td>
                      <td className="px-3 py-2">{lead.phone || "-"}</td>
                      <td className="px-3 py-2">{lead.company || "-"}</td>
                      <td className="px-3 py-2">{(lead.tags || []).join(", ") || "-"}</td>
                      <td className="px-3 py-2">{lead.isSuppressed ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(lead)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeleteLead(lead.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editingLeadId ? "Edit Lead" : "Create Lead"}
        description="Capture and maintain lead details with tenant-safe write operations."
        maxWidthClassName="max-w-2xl"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} />
          <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
          <Input placeholder="Company" value={form.company} onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))} />
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={submitLead}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Import Leads"
        description="Upload any CSV/XLSX structure, map fields, preview extraction quality, and confirm import."
        maxWidthClassName="max-w-[96vw]"
      >
        <div className="grid h-[82vh] gap-4 overflow-hidden md:grid-cols-[380px_1fr]">
          <div className="space-y-3 overflow-auto pr-1">
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Source File</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We auto-detect lead fields from the file.
              </p>
            </div>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={importLoading}
              onChange={(e) => {
                setImportFile(e.target.files?.[0] || null);
                setImportPreview(null);
              }}
            />
            <Button className="w-full" disabled={!importFile || importLoading} onClick={onImportPreview}>
              {importLoading ? "Analyzing..." : "Analyze File"}
            </Button>
            {importPreview ? (
              <div className="space-y-2 rounded-lg border border-border/80 p-3">
                <p className="text-sm font-medium">Column Mapping</p>
                {(["firstName", "lastName", "email", "phone", "company"] as const).map((field) => (
                  <label key={field} className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">{field}</span>
                    <select
                      className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                      value={importMapping[field] || ""}
                      onChange={(e) =>
                        setImportMapping((prev) => ({
                          ...prev,
                          [field]: e.target.value || null,
                        }))
                      }
                    >
                      <option value="">Not mapped</option>
                      {importPreview.detectedColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Duplicate handling</span>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={importDedupeStrategy}
                    onChange={(e) => setImportDedupeStrategy(e.target.value === "update" ? "update" : "skip")}
                  >
                    <option value="skip">Skip existing leads (by email)</option>
                    <option value="update">Update existing leads (by email)</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="mt-2 flex gap-2 border-t pt-4">
              <Button variant="outline" className="w-full" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button className="w-full" disabled={importLoading || !importFile || !importMapping.email} onClick={onConfirmImport}>
                {importLoading ? "Importing..." : "Confirm Import"}
              </Button>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-border/80">
            {importPreview ? (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="sticky top-0 bg-muted/35">
                  <tr className="border-b border-border/80">
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">First Name</th>
                    <th className="px-3 py-2 text-left font-medium">Last Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.preview.map((row) => (
                    <tr key={row.row} className="border-b border-border/70">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2">{row.firstName || "-"}</td>
                      <td className="px-3 py-2">{row.lastName || "-"}</td>
                      <td className="px-3 py-2">{row.email || "-"}</td>
                      <td className="px-3 py-2">{row.phone || "-"}</td>
                      <td className="px-3 py-2">{row.company || "-"}</td>
                      <td className={`px-3 py-2 ${row.valid ? "text-emerald-600" : "text-destructive"}`}>
                        {row.valid ? "Valid" : row.issues.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
                Upload a file and click Analyze File to generate intelligent mapping + extraction preview.
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

