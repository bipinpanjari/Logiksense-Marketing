import { authedFetch, getValidAccessToken } from "@/lib/api-client";
import { API_URL } from "@/lib/config";

export interface Lead {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  companySize?: number | null;
  city?: string;
  state?: string;
  country?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  isSuppressed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadsListResponse {
  data: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listLeads(params?: {
  page?: number;
  limit?: number;
  search?: string;
  company?: string;
  tags?: string[];
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.search) sp.set("search", params.search);
  if (params?.company) sp.set("company", params.company);
  if (params?.tags?.length) sp.set("tags", params.tags.join(","));

  const res = await authedFetch(`/leads${sp.toString() ? `?${sp.toString()}` : ""}`);
  return (await res.json()) as LeadsListResponse;
}

export async function getLeadStats() {
  const res = await authedFetch("/leads/stats");
  return res.json();
}

export async function createLead(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}) {
  const res = await authedFetch("/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (await res.json()) as Lead;
}

export async function updateLead(id: string, payload: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  customFields: Record<string, any>;
  isSuppressed: boolean;
}>) {
  const res = await authedFetch(`/leads/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return (await res.json()) as Lead;
}

export async function deleteLead(id: string) {
  const res = await authedFetch(`/leads/${id}`, { method: "DELETE" });
  return res.json();
}

export async function bulkUpdateLeads(leadIds: string[], updates: Record<string, any>) {
  const res = await authedFetch("/leads/bulk/update", {
    method: "PUT",
    body: JSON.stringify({ leadIds, updates }),
  });
  return res.json();
}

export async function bulkDeleteLeads(leadIds: string[]) {
  const res = await authedFetch("/leads/bulk/delete", {
    method: "POST",
    body: JSON.stringify({ leadIds }),
  });
  return res.json();
}

export interface LeadImportResult {
  totalRows: number;
  successCount: number;
  updateCount?: number;
  errorCount: number;
  errors: Array<{ row: number; email: string; error: string }>;
  leads: Lead[];
}

export interface LeadImportMapping {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  companySize?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  source?: string | null;
  tags?: string | null;
}

export interface LeadImportPreviewResult {
  totalRows: number;
  detectedColumns: string[];
  suggestedMapping: LeadImportMapping;
  preview: Array<{
    row: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    companySize?: number;
    city?: string;
    state?: string;
    country?: string;
    source?: string;
    tags?: string;
    valid: boolean;
    issues: string[];
  }>;
}

export async function previewLeadImport(file: File) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/leads/import/preview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Import preview failed (${res.status})`);
  }

  return (await res.json()) as LeadImportPreviewResult;
}

export async function confirmLeadImport(file: File, mapping: LeadImportMapping, dedupeStrategy: "skip" | "update") {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mapping", JSON.stringify(mapping));
  formData.append("dedupeStrategy", dedupeStrategy);

  const res = await fetch(`${API_URL}/leads/import/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Import confirm failed (${res.status})`);
  }

  return (await res.json()) as LeadImportResult;
}

export async function getLeadImportHistory() {
  const res = await authedFetch("/leads/import/history");
  return res.json();
}

