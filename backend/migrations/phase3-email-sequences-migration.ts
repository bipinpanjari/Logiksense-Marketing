/**
 * Database Migration: Add Email Sequencing Tables
 * Timestamp: Phase3_EmailSequencing
 * 
 * Creates tables for:
 * - Email sequences
 * - Sequence steps
 * - Email templates
 * - Email logs
 * - Sequence lead enrollment
 * - Workspace email provider configuration
 */

export async function up(db: any) {
  console.log('Creating email sequencing tables...');

  // Email sequences table
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sequences_workspace ON email_sequences(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_sequences_status ON email_sequences(status);
  `);

  // Email templates table
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      subject_line TEXT NOT NULL,
      html_content TEXT NOT NULL,
      text_content TEXT,
      category VARCHAR(100) DEFAULT 'general',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
    CREATE INDEX IF NOT EXISTS idx_templates_workspace ON email_templates(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_templates_default ON email_templates(is_default);
  `);

  // Email sequence steps table
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_sequence_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
      step_number INT NOT NULL,
      email_template_id UUID NOT NULL REFERENCES email_templates(id),
      delay_hours INT DEFAULT 0,
      condition_type VARCHAR(50) DEFAULT 'none' CHECK (condition_type IN ('none', 'opened', 'clicked', 'replied', 'manual')),
      condition_value VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (sequence_id) REFERENCES email_sequences(id),
      FOREIGN KEY (email_template_id) REFERENCES email_templates(id),
      UNIQUE(sequence_id, step_number)
    );
    CREATE INDEX IF NOT EXISTS idx_steps_sequence ON email_sequence_steps(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_steps_template ON email_sequence_steps(email_template_id);
  `);

  // Lead sequence enrollment table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sequence_lead_enrollment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      current_step INT DEFAULT 1,
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'unenrolled')),
      enrolled_at TIMESTAMP DEFAULT NOW(),
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (sequence_id) REFERENCES email_sequences(id),
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      UNIQUE(sequence_id, lead_id)
    );
    CREATE INDEX IF NOT EXISTS idx_enrollment_sequence ON sequence_lead_enrollment(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_enrollment_lead ON sequence_lead_enrollment(lead_id);
    CREATE INDEX IF NOT EXISTS idx_enrollment_status ON sequence_lead_enrollment(status);
  `);

  // Email logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      template_id UUID REFERENCES email_templates(id),
      message_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened', 'clicked')),
      error TEXT,
      enrollment_id UUID REFERENCES sequence_lead_enrollment(id),
      sent_at TIMESTAMP DEFAULT NOW(),
      opened_at TIMESTAMP,
      clicked_at TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (template_id) REFERENCES email_templates(id)
    );
    CREATE INDEX IF NOT EXISTS idx_email_logs_workspace ON email_logs(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_lead ON email_logs(lead_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
    CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
  `);

  // Add email provider configuration column to workspaces
  await db.query(`
    ALTER TABLE workspaces 
    ADD COLUMN IF NOT EXISTS email_provider_config JSONB
  `);

  console.log('Email sequencing tables created successfully');
}

export async function down(db: any) {
  console.log('Dropping email sequencing tables...');

  await db.query(`DROP TABLE IF NOT EXISTS email_logs CASCADE`);
  await db.query(`DROP TABLE IF NOT EXISTS sequence_lead_enrollment CASCADE`);
  await db.query(`DROP TABLE IF NOT EXISTS email_sequence_steps CASCADE`);
  await db.query(`DROP TABLE IF NOT EXISTS email_templates CASCADE`);
  await db.query(`DROP TABLE IF NOT EXISTS email_sequences CASCADE`);
  await db.query(`ALTER TABLE workspaces DROP COLUMN IF EXISTS email_provider_config`);

  console.log('Email sequencing tables dropped');
}
