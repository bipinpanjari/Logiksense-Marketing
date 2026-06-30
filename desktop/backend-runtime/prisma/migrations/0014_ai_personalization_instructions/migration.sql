-- Free-text workspace instructions appended to AI system prompts (icebreakers, rep briefs).
ALTER TABLE "workspaces"
ADD COLUMN IF NOT EXISTS "ai_personalization_instructions" TEXT;
