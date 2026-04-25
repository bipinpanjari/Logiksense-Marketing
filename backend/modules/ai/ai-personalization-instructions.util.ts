/** Max length stored and accepted from API (abuse / DB size). */
export const AI_PERSONALIZATION_INSTRUCTIONS_MAX_STORED = 20_000;

/** Cap injected into a single system message so huge notes do not dominate context. */
const AI_PERSONALIZATION_INSTRUCTIONS_MAX_PROMPT = 12_000;

const INSTRUCTIONS_HEADER = `### Workspace instructions (obey strictly)
The selling organization provided the following. Follow it for tone, positioning, product facts, compliance, and any constraints — without contradicting factual data in the user message.`;

/** Append workspace free-text instructions to a system prompt. No-op if empty. */
export function mergePersonalizationInstructionsIntoSystem(
  baseSystemContent: string,
  instructionsFromDb: string | null | undefined,
): string {
  const raw = typeof instructionsFromDb === 'string' ? instructionsFromDb.trim() : '';
  if (!raw) return baseSystemContent;
  let block = raw;
  if (block.length > AI_PERSONALIZATION_INSTRUCTIONS_MAX_PROMPT) {
    block =
      block.slice(0, AI_PERSONALIZATION_INSTRUCTIONS_MAX_PROMPT) +
      '\n\n[Workspace instructions truncated for model context.]';
  }
  return `${baseSystemContent}\n\n${INSTRUCTIONS_HEADER}\n\n${block}`;
}
