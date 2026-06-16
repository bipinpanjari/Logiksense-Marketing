import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

export interface FieldSchema {
  name: string;
  label: string;
  type: 'string' | 'email' | 'phone' | 'number' | 'custom';
  required: boolean;
  canRemove: boolean;
}

export interface LeadFieldsState {
  leadId: string;
  selectedFields: string[];
  availableFields: FieldSchema[];
  customFields: Record<string, any>;
}

@Injectable()
export class FieldManagementService {
  private standardFields: FieldSchema[] = [
    { name: 'firstName', label: 'First Name', type: 'string', required: false, canRemove: true },
    { name: 'lastName', label: 'Last Name', type: 'string', required: false, canRemove: true },
    { name: 'email', label: 'Email', type: 'email', required: true, canRemove: false },
    { name: 'phone', label: 'Phone', type: 'phone', required: false, canRemove: true },
    { name: 'company', label: 'Company', type: 'string', required: false, canRemove: true },
    { name: 'jobTitle', label: 'Job Title', type: 'string', required: false, canRemove: true },
    { name: 'companySize', label: 'Company Size', type: 'number', required: false, canRemove: true },
    { name: 'city', label: 'City', type: 'string', required: false, canRemove: true },
    { name: 'state', label: 'State', type: 'string', required: false, canRemove: true },
    { name: 'country', label: 'Country', type: 'string', required: false, canRemove: true },
  ];

  /**
   * Get available fields for a lead
   */
  async getLeadFieldsState(workspaceId: string, leadId: string): Promise<LeadFieldsState> {
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT custom_fields, first_name, last_name, email, phone, company, job_title, company_size, city, state, country
       FROM leads WHERE id = $1 AND workspace_id = $2`,
      [leadId, workspaceId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Lead not found');
    }

    const lead = result.rows[0];
    const customFields = lead.custom_fields || {};
    
    // Determine selected fields (non-empty fields)
    const selectedFields = this.getSelectedFields(lead);
    
    // Build available fields
    const availableFields: FieldSchema[] = [
      ...this.standardFields.map(f => ({
        ...f,
        canRemove: !this.isFieldRequired(f.name, lead)
      }))
    ];

    return {
      leadId,
      selectedFields,
      availableFields,
      customFields
    };
  }

  /**
   * Add a custom field to a lead
   */
  async addField(workspaceId: string, leadId: string, fieldName: string, fieldValue: any): Promise<void> {
    if (!fieldName || fieldName.trim() === '') {
      throw new BadRequestException('Field name is required');
    }

    const db = getDatabase();
    
    const result = await db.query(
      'SELECT custom_fields FROM leads WHERE id = $1 AND workspace_id = $2',
      [leadId, workspaceId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Lead not found');
    }

    const customFields = result.rows[0].custom_fields || {};
    customFields[fieldName] = fieldValue;

    await db.query(
      'UPDATE leads SET custom_fields = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3',
      [JSON.stringify(customFields), leadId, workspaceId]
    );
  }

  /**
   * Remove a field from a lead (only if empty)
   */
  async removeField(workspaceId: string, leadId: string, fieldName: string): Promise<void> {
    const db = getDatabase();
    
    const result = await db.query(
      'SELECT * FROM leads WHERE id = $1 AND workspace_id = $2',
      [leadId, workspaceId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Lead not found');
    }

    const lead = result.rows[0];

    // Check if field is removable
    const standardField = this.standardFields.find(f => f.name === fieldName);
    if (standardField) {
      if (!standardField.canRemove) {
        throw new ForbiddenException(`Cannot remove required field: ${fieldName}`);
      }
      
      const fieldValue = lead[this.getDbFieldName(fieldName)];
      if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
        throw new ForbiddenException(`Cannot remove field with data. Clear the data first.`);
      }
    } else {
      // Custom field
      const customFields = lead.custom_fields || {};
      const customFieldValue = customFields[fieldName];
      
      if (customFieldValue !== null && customFieldValue !== undefined && customFieldValue !== '') {
        throw new ForbiddenException(`Cannot remove field with data. Clear the data first.`);
      }

      delete customFields[fieldName];
      await db.query(
        'UPDATE leads SET custom_fields = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3',
        [JSON.stringify(customFields), leadId, workspaceId]
      );
    }
  }

  /**
   * Update field value
   */
  async updateField(workspaceId: string, leadId: string, fieldName: string, fieldValue: any): Promise<void> {
    const db = getDatabase();
    
    const standardField = this.standardFields.find(f => f.name === fieldName);
    
    if (standardField) {
      // Update standard field
      const dbFieldName = this.getDbFieldName(fieldName);
      await db.query(
        `UPDATE leads SET ${dbFieldName} = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3`,
        [fieldValue, leadId, workspaceId]
      );
    } else {
      // Update custom field
      const result = await db.query(
        'SELECT custom_fields FROM leads WHERE id = $1 AND workspace_id = $2',
        [leadId, workspaceId]
      );

      if (result.rows.length === 0) {
        throw new BadRequestException('Lead not found');
      }

      const customFields = result.rows[0].custom_fields || {};
      customFields[fieldName] = fieldValue;

      await db.query(
        'UPDATE leads SET custom_fields = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3',
        [JSON.stringify(customFields), leadId, workspaceId]
      );
    }
  }

  /**
   * Get selected fields for a lead based on non-empty values
   */
  private getSelectedFields(lead: any): string[] {
    const selected: string[] = [];

    // Always include email if it exists
    if (lead.email) selected.push('email');
    if (lead.first_name) selected.push('firstName');
    if (lead.last_name) selected.push('lastName');
    if (lead.phone) selected.push('phone');
    if (lead.company) selected.push('company');
    if (lead.job_title) selected.push('jobTitle');
    if (lead.company_size) selected.push('companySize');
    if (lead.city) selected.push('city');
    if (lead.state) selected.push('state');
    if (lead.country) selected.push('country');

    // Add custom fields that have values
    const customFields = lead.custom_fields || {};
    Object.keys(customFields).forEach(key => {
      if (customFields[key] !== null && customFields[key] !== undefined && customFields[key] !== '') {
        selected.push(`custom_${key}`);
      }
    });

    return selected;
  }

  /**
   * Check if a field has required data
   */
  private isFieldRequired(fieldName: string, lead: any): boolean {
    const standardField = this.standardFields.find(f => f.name === fieldName);
    if (!standardField) return false;

    const dbFieldName = this.getDbFieldName(fieldName);
    const value = lead[dbFieldName];
    
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Map field name to database column name
   */
  private getDbFieldName(fieldName: string): string {
    const mapping: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      jobTitle: 'job_title',
      companySize: 'company_size',
    };
    return mapping[fieldName] || fieldName;
  }

  /**
   * Get standard fields for initial field selection
   */
  getStandardFields(): FieldSchema[] {
    return this.standardFields;
  }
}
