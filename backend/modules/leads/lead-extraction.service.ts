import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ExtractedLeadRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
<<<<<<< Updated upstream
  jobTitle?: string;
  companySize?: number;
  city?: string;
  state?: string;
  country?: string;
  source?: string;
  tags?: string[];
=======
>>>>>>> Stashed changes
}

export interface ImportMapping {
  firstName?: string | null;
  lastName?: string | null;
<<<<<<< Updated upstream
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

const IMPORT_MAPPING_KEYS = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'company',
  'jobTitle',
  'companySize',
  'city',
  'state',
  'country',
  'source',
  'tags',
] as const satisfies readonly (keyof ImportMapping)[];

=======
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

>>>>>>> Stashed changes
@Injectable()
export class LeadExtractionService {
  parseRows(file: Buffer): any[] {
    try {
      const workbook = XLSX.read(file, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        throw new BadRequestException('No worksheet found');
      }
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      return Array.isArray(rows) ? rows : [];
    } catch {
      throw new BadRequestException('Invalid import file');
    }
  }

  getDetectedColumns(rows: any[]): string[] {
    const columns = new Set<string>();
    for (const row of rows.slice(0, 300)) {
      Object.keys(row || {}).forEach((key) => columns.add(key));
    }
    return Array.from(columns);
  }

<<<<<<< Updated upstream
  mergeMappings(inferred: ImportMapping, user: Partial<ImportMapping>): ImportMapping {
    const merged: ImportMapping = { ...inferred };
    for (const key of IMPORT_MAPPING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(user, key)) {
        merged[key] = user[key] as string | null | undefined;
      }
    }
    return merged;
  }

=======
>>>>>>> Stashed changes
  inferMapping(columns: string[]): ImportMapping {
    const aliases: Record<keyof ImportMapping, string[]> = {
      firstName: ['firstname', 'first', 'givenname', 'fname'],
      lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
<<<<<<< Updated upstream
      fullName: ['fullname', 'name', 'contactname', 'contact', 'person', 'leadname'],
      email: ['email', 'emailaddress', 'mail', 'workemail'],
      phone: ['phone', 'phonenumber', 'mobile', 'telephone', 'contactnumber', 'tel'],
      company: ['company', 'companyname', 'organization', 'organisation', 'employer', 'account', 'accountname'],
      jobTitle: ['jobtitle', 'title', 'position', 'role', 'designation'],
      companySize: ['companysize', 'employees', 'headcount', 'size', 'numemployees'],
      city: ['city', 'town'],
      state: ['state', 'province', 'region'],
      country: ['country', 'nation'],
      source: ['source', 'leadsource', 'origin', 'channel'],
      tags: ['tags', 'labels', 'categories', 'segment'],
=======
      email: ['email', 'emailaddress', 'mail', 'workemail'],
      phone: ['phone', 'phonenumber', 'mobile', 'telephone', 'contactnumber', 'tel'],
      company: ['company', 'companyname', 'organization', 'organisation', 'employer', 'account'],
>>>>>>> Stashed changes
    };

    const normalizedColumns = columns.map((column) => ({
      raw: column,
      normalized: this.normalizeKey(column),
    }));
    const mapping: ImportMapping = {};

    (Object.keys(aliases) as Array<keyof ImportMapping>).forEach((target) => {
      const targetAliases = aliases[target];
      const exact = normalizedColumns.find((col) => targetAliases.includes(col.normalized));
      if (exact) {
        mapping[target] = exact.raw;
        return;
      }

      const fuzzy = normalizedColumns.find((col) =>
        targetAliases.some((alias) => col.normalized.includes(alias) || alias.includes(col.normalized))
      );
      mapping[target] = fuzzy ? fuzzy.raw : null;
    });

    return mapping;
  }

  mapRow(row: any, mapping: ImportMapping): ExtractedLeadRow {
<<<<<<< Updated upstream
    let firstName = this.getValueByColumn(row, mapping.firstName);
    let lastName = this.getValueByColumn(row, mapping.lastName);
    const fullRaw = this.getValueByColumn(row, mapping.fullName);
    if (!firstName && !lastName && fullRaw) {
      const parts = fullRaw.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || undefined;
    }

=======
    const firstName = this.getValueByColumn(row, mapping.firstName);
    const lastName = this.getValueByColumn(row, mapping.lastName);
>>>>>>> Stashed changes
    const emailRaw = this.getValueByColumn(row, mapping.email);
    const email = (emailRaw || '').trim().toLowerCase() || undefined;
    const phone = this.getValueByColumn(row, mapping.phone);
    const company = this.getValueByColumn(row, mapping.company);
<<<<<<< Updated upstream
    const jobTitle = this.getValueByColumn(row, mapping.jobTitle);
    const city = this.getValueByColumn(row, mapping.city);
    const state = this.getValueByColumn(row, mapping.state);
    const country = this.getValueByColumn(row, mapping.country);
    const source = this.getValueByColumn(row, mapping.source);
    const companySize = this.parseCompanySize(this.getValueByColumn(row, mapping.companySize));
    const tags = this.parseTags(this.getValueByColumn(row, mapping.tags));

    return {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      companySize,
      city,
      state,
      country,
      source,
      tags,
    };
=======
    return { firstName, lastName, email, phone, company };
>>>>>>> Stashed changes
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  extractCustomFields(row: any, mapping?: ImportMapping): Record<string, any> {
<<<<<<< Updated upstream
    const mapped = this.getMappedHeaderSet(mapping);

    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (mapped.has(this.normalizeHeaderKey(key))) continue;
      if (value === null || value === undefined) continue;
=======
    const mappedColumns = new Set<string>(
      [mapping?.firstName, mapping?.lastName, mapping?.email, mapping?.phone, mapping?.company]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
    );

    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!value) continue;
      const lowerKey = key.toLowerCase();
      if (mappedColumns.has(lowerKey)) continue;
>>>>>>> Stashed changes
      customFields[key] = value;
    }
    return customFields;
  }

  getPreview(rows: any[], mapping: ImportMapping, previewLimit = 30) {
    return rows.slice(0, previewLimit).map((row, index) => {
      const mapped = this.mapRow(row, mapping);
      const issues: string[] = [];
      if (!mapped.email || !this.isValidEmail(mapped.email)) issues.push('Invalid or missing email');
      if (!mapped.firstName && !mapped.lastName) issues.push('Missing first/last name');

      return {
        row: index + 2,
        ...mapped,
<<<<<<< Updated upstream
        tags: mapped.tags?.join(', '),
=======
>>>>>>> Stashed changes
        valid: issues.length === 0,
        issues,
      };
    });
  }

<<<<<<< Updated upstream
  private getMappedHeaderSet(mapping?: ImportMapping): Set<string> {
    const set = new Set<string>();
    if (!mapping) return set;
    for (const key of IMPORT_MAPPING_KEYS) {
      const col = mapping[key];
      if (col && String(col).trim()) {
        set.add(this.normalizeHeaderKey(String(col)));
      }
    }
    return set;
  }

  private normalizeHeaderKey(key: string): string {
    return key.trim().toLowerCase();
  }

  private parseTags(raw?: string): string[] | undefined {
    if (!raw) return undefined;
    const parts = raw
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }

  private parseCompanySize(raw?: string): number | undefined {
    if (!raw) return undefined;
    const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

=======
>>>>>>> Stashed changes
  private getValueByColumn(row: any, columnName?: string | null): string | undefined {
    if (!columnName) return undefined;
    const entries = Object.entries(row || {});
    const match = entries.find(([key]) => key.trim().toLowerCase() === columnName.trim().toLowerCase());
    if (!match) return undefined;
    const value = match[1];
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text || undefined;
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
