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
  leadNumbers: Record<string, string>; // Maps leadId to leadNumber
}

export interface ImportPreviewResult {
  totalRows: number;
  detectedColumns: string[];
  suggestedMapping: ImportMapping;
  suggestedFields: string[]; // Fields to import
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

export interface FieldSelectionConfig {
  selectedFields: string[]; // Fields to keep: email, firstName, lastName, phone, company, etc.
  generateLeadNumber: boolean;
}

@Injectable()
export class LeadImportServiceEnhanced {
  constructor(
    private leadService: LeadService,
    private leadExtractionService: LeadExtractionService
  ) {}

  /**
   * Get next lead number for workspace
   */
  private async getNextLeadNumber(workspaceId: string): Promise<number> {
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT COALESCE(MAX(CAST(lead_number AS INTEGER)), 0) as max_number 
       FROM leads WHERE workspace_id = $1 AND lead_number ~ '^[0-9]+$'`,
      [workspaceId]
    );

    const maxNumber = result.rows[0]?.max_number || 0;
    return maxNumber + 1;
  }

  /**
   * Generate sequential lead number with workspace prefix
   */
  private async generateLeadNumber(workspaceId: string): Promise<string> {
    const nextNumber = await this.getNextLeadNumber(workspaceId);
    // Format: LEAD-000001
    return `LEAD-${String(nextNumber).padStart(6, '0')}`;
  }

  async previewImport(file: Buffer): Promise<ImportPreviewResult> {
    const rows = this.leadExtractionService.parseRows(file);
    const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
    const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
    const preview = this.leadExtractionService.getPreview(rows, suggestedMapping, 30);

    // Suggest fields based on detected columns
    const suggestedFields = this.suggestFieldsForImport(detectedColumns);

    return {
      totalRows: rows.length,
      detectedColumns,
      suggestedMapping,
      suggestedFields,
      preview,
    };
  }

  /**
   * Suggest which fields should be imported based on detected columns
   */
  private suggestFieldsForImport(detectedColumns: string[]): string[] {
    const standardFields = [
      'firstName', 'lastName', 'email', 'phone', 'company', 
      'jobTitle', 'companySize', 'city', 'state', 'country'
    ];
    
    const columnLower = detectedColumns.map(c => c.toLowerCase());
    
    return standardFields.filter(field => {
      const fieldLower = field.toLowerCase();
      return columnLower.some(col => 
        col.includes(fieldLower) || fieldLower.includes(col.replace(/[^a-z]/g, ''))
      );
    });
  }

  async confirmImport(
    file: Buffer,
    workspaceId: string,
    customerId: string,
    mapping: ImportMapping,
    dedupeStrategy: 'skip' | 'update' = 'skip',
    fieldConfig: FieldSelectionConfig = { selectedFields: [], generateLeadNumber: true }
  ): Promise<ImportResult> {
    const rows = this.leadExtractionService.parseRows(file);
    return this.processRows(rows, workspaceId, customerId, mapping, dedupeStrategy, fieldConfig);
  }

  async importFromCSV(
    file: Buffer,
    workspaceId: string,
    customerId: string,
    fieldConfig?: FieldSelectionConfig
  ): Promise<ImportResult> {
    try {
      const workbook = XLSX.read(file, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
      const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
      
      const config = fieldConfig || {
        selectedFields: this.suggestFieldsForImport(detectedColumns),
        generateLeadNumber: true
      };
      
      return this.processRows(rows, workspaceId, customerId, suggestedMapping, 'skip', config);
    } catch (error) {
      console.error('CSV import error:', error);
      throw new BadRequestException('Invalid CSV file format');
    }
  }

  async importFromExcel(
    file: Buffer,
    workspaceId: string,
    customerId: string,
    fieldConfig?: FieldSelectionConfig
  ): Promise<ImportResult> {
    try {
      const workbook = XLSX.read(file, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const detectedColumns = this.leadExtractionService.getDetectedColumns(rows);
      const suggestedMapping = this.leadExtractionService.inferMapping(detectedColumns);
      
      const config = fieldConfig || {
        selectedFields: this.suggestFieldsForImport(detectedColumns),
        generateLeadNumber: true
      };
      
      return this.processRows(rows, workspaceId, customerId, suggestedMapping, 'skip', config);
    } catch (error) {
      console.error('Excel import error:', error);
      throw new BadRequestException('Invalid Excel file format');
    }
  }

  /**
   * Process imported rows with field selection and lead number generation
   */
  private async processRows(
    rows: any[],
    workspaceId: string,
    customerId: string,
    mapping: ImportMapping,
    dedupeStrategy: 'skip' | 'update',
    fieldConfig: FieldSelectionConfig
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: rows.length,
      successCount: 0,
      updateCount: 0,
      errorCount: 0,
      errors: [],
      leads: [],
      leadNumbers: {},
    };

    const db = getDatabase();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const mapped = this.leadExtractionService.mapRow(row, mapping);
        
        // Filter fields based on field selection config
        const filteredData = this.filterFieldsBySelection(mapped, fieldConfig.selectedFields);
        
        const firstName = filteredData.firstName;
        const lastName = filteredData.lastName;
        const email = filteredData.email || '';
        const phone = filteredData.phone;
        const company = filteredData.company;

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

        // Generate lead number if enabled
        let leadNumber: string | undefined;
        if (fieldConfig.generateLeadNumber) {
          leadNumber = await this.generateLeadNumber(workspaceId);
        }

        // Create lead with selected fields only
        const createLeadDto: CreateLeadDto = {
          firstName: firstName || '',
          lastName: lastName || '',
          email,
          phone: phone || undefined,
          company: company || undefined,
          tags: [],
          customFields: {
            ...this.leadExtractionService.extractCustomFields(row, mapping),
            ...(leadNumber && { leadNumber })
          },
          leadNumber, // If supported in schema
        };

        const lead = await this.leadService.createLead(
          workspaceId,
          customerId,
          createLeadDto
        );

        if (leadNumber) {
          result.leadNumbers[lead.id] = leadNumber;
        }

        result.successCount++;
        result.leads.push(lead);
      } catch (error: any) {
        result.errorCount++;
        result.errors.push({
          row: i + 2,
          email: row.email || 'N/A',
          error: error?.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Filter mapped data to only include selected fields
   */
  private filterFieldsBySelection(mapped: any, selectedFields: string[]): any {
    if (!selectedFields || selectedFields.length === 0) {
      return mapped; // Return all fields if none specified
    }

    const filtered: any = {};

    // Always include email
    if (mapped.email) filtered.email = mapped.email;

    // Include other selected fields
    if (selectedFields.includes('firstName') && mapped.firstName) filtered.firstName = mapped.firstName;
    if (selectedFields.includes('lastName') && mapped.lastName) filtered.lastName = mapped.lastName;
    if (selectedFields.includes('phone') && mapped.phone) filtered.phone = mapped.phone;
    if (selectedFields.includes('company') && mapped.company) filtered.company = mapped.company;

    return filtered;
  }
}
