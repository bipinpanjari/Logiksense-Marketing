import { Injectable, BadRequestException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { LeadService, CreateLeadDto } from './lead.service';
import { LeadExtractionService, ImportMapping } from './lead-extraction.service';

export interface ImportResult {
  totalRows: number;
  successCount: number;
  updateCount?: number;
  errorCount: number;
  errors: Array<{ row: number; email: string; error: string }>;
  leads: any[];
}

export interface ImportPreviewResult {
  totalRows: number;
  detectedColumns: string[];
  suggestedMapping: ImportMapping;
  preview: Array<{
    row: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    valid: boolean;
    issues: string[];
  }>;
}

@Injectable()
export class LeadImportService {
  constructor(
    private leadService: LeadService,
    private leadExtractionService: LeadExtractionService
  ) {}

  async previewImport(file: Buffer): Promise<ImportPreviewResult> {
    const rows = this.leadExtractionService.parseRows(file);
    const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
    const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
    const preview = this.leadExtractionService.getPreview(rows, suggestedMapping, 30);

    return {
      totalRows: rows.length,
      detectedColumns,
      suggestedMapping,
      preview,
    };
  }

  async confirmImport(
    file: Buffer,
    workspaceId: string,
    customerId: string,
    mapping: ImportMapping,
    dedupeStrategy: 'skip' | 'update' = 'skip'
  ): Promise<ImportResult> {
    const rows = this.leadExtractionService.parseRows(file);
    return this.processRows(rows, workspaceId, customerId, mapping, dedupeStrategy);
  }

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
      const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
      const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
      return this.processRows(rows, workspaceId, customerId, suggestedMapping, 'skip');
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
      const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
      const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
      return this.processRows(rows, workspaceId, customerId, suggestedMapping, 'skip');
    } catch (error) {
      console.error('Excel import error:', error);
      throw new BadRequestException('Invalid Excel file format');
    }
  }

  private async processRows(
    rows: any[],
    workspaceId: string,
    customerId: string,
    mapping: ImportMapping,
    dedupeStrategy: 'skip' | 'update'
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: rows.length,
      successCount: 0,
      updateCount: 0,
      errorCount: 0,
      errors: [],
      leads: [],
    };

    const db = getDatabase();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const mapped = this.leadExtractionService.mapRow(row, mapping);
        const firstName = mapped.firstName;
        const lastName = mapped.lastName;
        const email = mapped.email || '';
        const phone = mapped.phone;
        const company = mapped.company;

        // Validation
        if (!email || !this.leadExtractionService.isValidEmail(email)) {
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
          'SELECT id FROM leads WHERE workspace_id = $1 AND lower(email) = lower($2)',
          [workspaceId, email]
        );

        if (existing.rows.length > 0) {
          if (dedupeStrategy === 'update') {
            const updated = await this.leadService.updateLead(workspaceId, existing.rows[0].id, {
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              phone: phone || undefined,
              company: company || undefined,
              customFields: this.leadExtractionService.extractCustomFields(row, mapping),
            });
            result.updateCount = (result.updateCount || 0) + 1;
            result.leads.push(updated);
            continue;
          }

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
          customFields: this.leadExtractionService.extractCustomFields(row, mapping),
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

    await db.query(
      `INSERT INTO activity_logs (id, workspace_id, entity_type, action, details, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        uuid(),
        workspaceId,
        'lead_import',
        'lead_imported',
        JSON.stringify({
          totalRows: result.totalRows,
          successCount: result.successCount,
          updateCount: result.updateCount || 0,
          errorCount: result.errorCount,
          dedupeStrategy,
        }),
        customerId,
      ]
    );

    return result;
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
