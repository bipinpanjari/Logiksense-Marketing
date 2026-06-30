import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ExtractedLeadRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;


}

export interface ImportMapping {
  firstName?: string | null;
  lastName?: string | null;

  email?: string | null;
  phone?: string | null;
  company?: string | null;
}


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



  inferMapping(columns: string[]): ImportMapping {
    const aliases: Record<keyof ImportMapping, string[]> = {
      firstName: ['firstname', 'first', 'givenname', 'fname'],
      lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],

      email: ['email', 'emailaddress', 'mail', 'workemail'],
      phone: ['phone', 'phonenumber', 'mobile', 'telephone', 'contactnumber', 'tel'],
      company: ['company', 'companyname', 'organization', 'organisation', 'employer', 'account'],

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

    const firstName = this.getValueByColumn(row, mapping.firstName);
    const lastName = this.getValueByColumn(row, mapping.lastName);

    const emailRaw = this.getValueByColumn(row, mapping.email);
    const email = (emailRaw || '').trim().toLowerCase() || undefined;
    const phone = this.getValueByColumn(row, mapping.phone);
    const company = this.getValueByColumn(row, mapping.company);

    return { firstName, lastName, email, phone, company };

  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  extractCustomFields(row: any, mapping?: ImportMapping): Record<string, any> {

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


        valid: issues.length === 0,
        issues,
      };
    });
  }



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



