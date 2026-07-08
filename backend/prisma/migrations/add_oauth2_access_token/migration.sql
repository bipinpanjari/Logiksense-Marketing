-- AddColumn
ALTER TABLE email_configs 
ADD COLUMN IF NOT EXISTS oauth2_access_token_encrypted VARCHAR(1000);

ALTER TABLE email_configs 
ADD COLUMN IF NOT EXISTS oauth2_token_expires_at TIMESTAMP;

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_oauth2_token_expires ON email_configs(oauth2_token_expires_at);
