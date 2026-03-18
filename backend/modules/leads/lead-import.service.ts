import { Injectable, BadRequestException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { LeadService, CreateLeadDto } from './lead.service';

export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; email: string; error: string }>;
  leads: any[];
}

@Injectable()
export class LeadImportService {
  constructor(private leadService: LeadService) {}

  async importFromCSV(
    file: Buffer,
    workspaceId: string,
    customerId: string
  ): Promise<ImportResult> {
    try {
      // Parse CSV
      const workbook = XLSX.read(file, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      return this.processRows(rows, workspaceId, customerId);
    } catch (error) {
      console.error('CSV import error:', error);
      throw new BadRequestException('Invalid CSV file format');
    }
  }

  async importFromExcel(
    file: Buffer,
    workspaceId: string,
    customerId: string
  ): Promise<ImportResult> {
    try {
      // Parse Excel
      const workbook = XLSX.read(file, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      return this.processRows(rows, workspaceId, customerId);
    } catch (error) {
      console.error('Excel import error:', error);
      throw new BadRequestException('Invalid Excel file format');
    }
  }

  private async processRows(
    rows: any[],
    workspaceId: string,
    customerId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      leads: [],
    };

    const db = getDatabase();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Auto-detect columns (case-insensitive)
        const firstName = this.getColumnValue(row, ['first_name', 'firstname', 'first name', 'fname']);
        const lastName = this.getColumnValue(row, ['last_name', 'lastname', 'last name', 'lname']);
        const email = this.getColumnValue(row, ['email', 'e-mail', 'email_address']);
        const phone = this.getColumnValue(row, ['phone', 'phone_number', 'telephone']);
        const company = this.getColumnValue(row, ['company', 'company_name', 'organisation']);

        // Validation
        if (!email || !this.isValidEmail(email)) {
          result.errorCount++;
          result.errors.push({
            row: i + 2,
            email: email || 'N/A',
            error: 'Invalid or missing email',
          });
          continue;
        }

        if (!firstName && !lastName) {
          result.errorCount++;
          result.errors.push({
            row: i + 2,
            email,
            error: 'At least first name or last name required',
          });
          continue;
        }

        // Check for duplicates in this workspace
        const existing = await db.query(
          'SELECT id FROM leads WHERE workspace_id = $1 AND email = $2',
          [workspaceId, email]
        );

        if (existing.rows.length > 0) {
          result.errorCount++;
          result.errors.push({
            row: i + 2,
            email,
            error: 'Lead already exists',
          });
          continue;
        }

        // Create lead
        const createLeadDto: CreateLeadDto = {
          firstName: firstName || '',
          lastName: lastName || '',
          email,
          phone: phone || undefined,
          company: company || undefined,
          tags: [],
          customFields: this.extractCustomFields(row),
        };

        const lead = await this.leadService.createLead(
          workspaceId,
          customerId,
          createLeadDto
        );

        result.successCount++;
        result.leads.push(lead);
      } catch (error: any) {
        console.error(`Error processing row ${i + 2}:`, error);
        result.errorCount++;
        result.errors.push({
          row: i + 2,
          email: row.email || 'N/A',
          error: (error?.message) || 'Unknown error',
        });
      }
    }

    return result;
  }

  private getColumnValue(row: any, possibleNames: string[]): string | undefined {
    const lowerRow = Object.keys(row).reduce((acc, key) => {
      acc[key.toLowerCase()] = row[key];
      return acc;
    }, {} as any);

    for (const name of possibleNames) {
      const value = lowerRow[name.toLowerCase()];
      if (value && String(value).trim()) {
        return String(value).trim();
      }
    }

    return undefined;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private extractCustomFields(row: any): Record<string, any> {
    const standardFields = [
      'first_name', 'firstname', 'first name', 'fname',
      'last_name', 'lastname', 'last name', 'lname',
      'email', 'e-mail', 'email_address',
      'phone', 'phone_number', 'telephone',
      'company', 'company_name', 'organisation',
    ];

    const customFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase();
      if (!standardFields.includes(lowerKey) && value) {
        customFields[key] = value;
      }
    }

    return customFields;
  }

  async getImportHistory(workspaceId: string) {
    const db = getDatabase();

    try {
      const result = await db.query(
        `SELECT * FROM activity_logs 
         WHERE workspace_id = $1 AND action = 'lead_imported'
         ORDER BY created_at DESC LIMIT 50`,
        [workspaceId]
      );

      return result.rows;
    } catch (error) {
      console.error('Get import history error:', error);
      throw error;
    }
  }
}
