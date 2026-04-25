-- Rich research payload per extracted business (Maps attributes, hours, website text, etc.)
ALTER TABLE search_items
  ADD COLUMN IF NOT EXISTS business_profile JSONB NOT NULL DEFAULT '{}'::jsonb;
