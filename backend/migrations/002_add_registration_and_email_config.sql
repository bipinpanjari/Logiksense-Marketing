-- Migration: Add registration and email configuration tables
-- This migration creates tables for multi-step registration with email validation and DKIM/SPF tracking

CREATE TABLE IF NOT EXISTS registration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  staff_name VARCHAR(255) NOT NULL,
  number_of_employees INTEGER,
  email VARCHAR(255) NOT NULL,
  verification_code VARCHAR(255),
  verification_expires TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  sending_email VARCHAR(255),
  domain VARCHAR(255),
  dkim_selector VARCHAR(255) DEFAULT 'logik',
  dkim_valid BOOLEAN DEFAULT false,
  spf_valid BOOLEAN DEFAULT false,
  step INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  CONSTRAINT unique_session_email UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  number_of_employees INTEGER,
  industry VARCHAR(255),
  website VARCHAR(255),
  tax_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_companies_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  sending_email VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  dkim_selector VARCHAR(255) DEFAULT 'logik',
  dkim_valid BOOLEAN DEFAULT false,
  spf_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password_encrypted VARCHAR(500),
  smtp_from_name VARCHAR(255),
  email_provider VARCHAR(100),
  daily_send_limit INTEGER DEFAULT 100,
  hourly_send_limit INTEGER DEFAULT 25,
  is_active BOOLEAN DEFAULT true,
  last_validated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_configs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT unique_customer_email_config UNIQUE (customer_id, sending_email)
);

CREATE TABLE IF NOT EXISTS dns_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  domain VARCHAR(255) NOT NULL,
  record_type VARCHAR(50),
  validation_status VARCHAR(50),
  validation_result TEXT,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dns_logs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  verified_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_registration_sessions_session_id ON registration_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_email ON registration_sessions(email);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires_at ON registration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_companies_customer_id ON companies(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_customer_id ON email_configs(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_sending_email ON email_configs(sending_email);
CREATE INDEX IF NOT EXISTS idx_dns_validation_logs_customer_id ON dns_validation_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);
